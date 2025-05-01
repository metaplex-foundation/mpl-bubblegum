use anchor_lang::prelude::*;
use mpl_core::{
    instructions::UpdateCollectionInfoV1CpiBuilder, types::UpdateType,
    Collection as MplCoreCollection,
};
use mpl_token_metadata::types::MetadataDelegateRole;
use solana_program::{account_info::AccountInfo, pubkey::Pubkey};

use crate::{
    asserts::{assert_collection_membership, assert_has_collection_authority},
    error::BubblegumError,
    state::{
        leaf_schema::{LeafSchema, Version},
        metaplex_adapter::{
            self, Collection as MetaplexAdapterCollection, Creator, MetadataArgs,
            MetadataArgsCommon, MetadataArgsV2,
        },
        metaplex_anchor::TokenMetadata,
        MPL_CORE_CPI_SIGNER_PREFIX,
    },
    traits::{MplCorePluginValidation, ValidationResult},
    utils::{
        get_asset_id, hash_creators, hash_metadata, replace_leaf, DEFAULT_ASSET_DATA_HASH,
        DEFAULT_COLLECTION_HASH, DEFAULT_FLAGS,
    },
};

mod burn;
mod cancel_redeem;
mod collect;
mod compress;
mod create_tree;
mod decompress;
mod delegate;
mod delegate_and_freeze;
mod freeze;
mod mint;
mod mint_to_collection;
mod redeem;
mod set_and_verify_collection;
mod set_collection;
mod set_decompressible_state;
mod set_non_transferable;
mod set_tree_delegate;
mod thaw;
mod thaw_and_revoke;
mod transfer;
mod unverify_collection;
mod unverify_creator;
mod update_asset_data;
mod update_metadata;
mod verify_collection;
mod verify_creator;

pub(crate) use burn::*;
pub(crate) use cancel_redeem::*;
pub(crate) use collect::*;
pub(crate) use compress::*;
pub(crate) use create_tree::*;
pub(crate) use decompress::*;
pub(crate) use delegate::*;
pub(crate) use delegate_and_freeze::*;
pub(crate) use freeze::*;
pub(crate) use mint::*;
pub(crate) use mint_to_collection::*;
pub(crate) use redeem::*;
pub(crate) use set_and_verify_collection::*;
pub(crate) use set_collection::*;
pub(crate) use set_decompressible_state::*;
pub(crate) use set_non_transferable::*;
pub(crate) use set_tree_delegate::*;
pub(crate) use thaw::*;
pub(crate) use thaw_and_revoke::*;
pub(crate) use transfer::*;
pub(crate) use unverify_collection::*;
pub(crate) use unverify_creator::*;
pub(crate) use update_asset_data::*;
pub(crate) use update_metadata::*;
pub(crate) use verify_collection::*;
pub(crate) use verify_creator::*;

fn process_creator_verification<T: MetadataArgsCommon>(
    merkle_tree: Pubkey,
    creator: Pubkey,
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    leaf_owner: Pubkey,
    leaf_delegate: Option<Pubkey>,
    mut message: T,
    collection_hash: Option<[u8; 32]>,
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    verify: bool,
) -> Result<(LeafSchema, LeafSchema)> {
    // Creator Vec must contain creators.
    if message.creators().is_empty() {
        return Err(BubblegumError::NoCreatorsPresent.into());
    }

    // Creator must be in user-provided creator Vec.
    if !message.creators().iter().any(|c| c.address == creator) {
        return Err(BubblegumError::CreatorNotFound.into());
    }

    // User-provided creator Vec must result in same user-provided creator hash.
    let incoming_creator_hash = hash_creators(message.creators())?;
    if creator_hash != incoming_creator_hash {
        return Err(BubblegumError::CreatorHashMismatch.into());
    }

    // User-provided metadata must result in same user-provided data hash.
    let incoming_data_hash = hash_metadata(&message)?;
    if data_hash != incoming_data_hash {
        return Err(BubblegumError::DataHashMismatch.into());
    }

    // Calculate new creator Vec with `verified` set to true for signing creator.
    let updated_creator_vec = message
        .creators()
        .iter()
        .map(|c| {
            let verified = if c.address == creator.key() {
                verify
            } else {
                c.verified
            };
            Creator {
                address: c.address,
                verified,
                share: c.share,
            }
        })
        .collect::<Vec<Creator>>();

    // Calculate new creator hash.
    let updated_creator_hash = hash_creators(&updated_creator_vec)?;

    // Update creator Vec in metadata args.
    message.set_creators(updated_creator_vec);

    // Calculate new data hash.
    let updated_data_hash = hash_metadata(&message)?;

    // Build previous leaf struct, new leaf struct, and replace the leaf in the tree.
    let asset_id = get_asset_id(&merkle_tree, nonce);
    let leaf_delegate = leaf_delegate.unwrap_or(leaf_owner);

    match message.version() {
        Version::V1 => {
            let previous_leaf = LeafSchema::new_v1(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                data_hash,
                creator_hash,
            );
            let new_leaf = LeafSchema::new_v1(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                updated_data_hash,
                updated_creator_hash,
            );
            Ok((previous_leaf, new_leaf))
        }
        Version::V2 => {
            let collection_hash = collection_hash.unwrap_or(DEFAULT_COLLECTION_HASH);
            let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);
            let flags = flags.unwrap_or(DEFAULT_FLAGS);

            let previous_leaf = LeafSchema::new_v2(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                data_hash,
                creator_hash,
                collection_hash,
                asset_data_hash,
                flags,
            );
            let new_leaf = LeafSchema::new_v2(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                updated_data_hash,
                updated_creator_hash,
                collection_hash,
                asset_data_hash,
                flags,
            );

            Ok((previous_leaf, new_leaf))
        }
    }
}

#[allow(deprecated)]
fn process_collection_verification_mpl_only<'info>(
    collection_metadata: &Account<'info, TokenMetadata>,
    collection_mint: &AccountInfo<'info>,
    collection_authority: &AccountInfo<'info>,
    collection_authority_record_pda: &AccountInfo<'info>,
    edition_account: &AccountInfo<'info>,
    asset_collection: &MetaplexAdapterCollection,
) -> Result<()> {
    // See if a collection authority record PDA was provided.
    let collection_authority_record = if collection_authority_record_pda.key() == crate::id() {
        None
    } else {
        Some(collection_authority_record_pda)
    };

    // Verify correct account ownerships.
    require!(
        *collection_metadata.to_account_info().owner == mpl_token_metadata::ID,
        BubblegumError::IncorrectOwner
    );
    require!(
        *collection_mint.owner == spl_token::id(),
        BubblegumError::IncorrectOwner
    );
    require!(
        *edition_account.owner == mpl_token_metadata::ID,
        BubblegumError::IncorrectOwner
    );

    assert_collection_membership(
        &Some(asset_collection.adapt()),
        collection_metadata,
        collection_mint.key,
        edition_account,
    )?;

    assert_has_collection_authority(
        collection_metadata,
        collection_mint.key,
        collection_authority.key,
        collection_authority_record,
        MetadataDelegateRole::Collection,
    )?;

    Ok(())
}

fn process_collection_verification<'info>(
    ctx: Context<'_, '_, '_, 'info, verify_collection::CollectionVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    message: MetadataArgs,
    verify: bool,
    new_collection: Option<Pubkey>,
) -> Result<()> {
    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    let owner = ctx.accounts.leaf_owner.to_account_info();
    let delegate = ctx.accounts.leaf_delegate.to_account_info();
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let collection_metadata = &ctx.accounts.collection_metadata;
    let collection_mint = ctx.accounts.collection_mint.to_account_info();
    let edition_account = ctx.accounts.edition_account.to_account_info();
    let collection_authority = ctx.accounts.collection_authority.to_account_info();
    let collection_authority_record_pda = ctx
        .accounts
        .collection_authority_record_pda
        .to_account_info();

    // User-provided metadata must result in same user-provided data hash.
    let incoming_data_hash = hash_metadata(&message)?;
    if data_hash != incoming_data_hash {
        return Err(BubblegumError::DataHashMismatch.into());
    }

    // Check existing collection.  Don't verify already-verified items, or unverify unverified
    // items, otherwise for sized collections we end up with invalid size data.  Also, we don't
    // allow a new collection (via `set_and_verify_collection`) to overwrite an already-verified
    // item.
    if let Some(collection) = &message.collection {
        if verify && collection.verified {
            return Err(BubblegumError::AlreadyVerified.into());
        } else if !verify && !collection.verified {
            return Err(BubblegumError::AlreadyUnverified.into());
        }
    }

    let mut updated_message = message;

    // If new collection was provided (via `set_and_verify_collection`), set it in the metadata.
    if new_collection.is_some() {
        updated_message.collection = new_collection.map(|key| metaplex_adapter::Collection {
            verified: verify,
            key,
        });
    }

    let collection = updated_message
        .collection
        .as_mut()
        .ok_or(BubblegumError::CollectionNotFound)?;

    collection.verified = verify;

    // Note this call mutates message.
    process_collection_verification_mpl_only(
        collection_metadata,
        &collection_mint,
        &collection_authority,
        &collection_authority_record_pda,
        &edition_account,
        collection,
    )?;

    // Calculate new data hash.
    let updated_data_hash = hash_metadata(&updated_message)?;

    // Build previous leaf struct, new leaf struct, and replace the leaf in the tree.
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v1(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );

    let new_leaf = LeafSchema::new_v1(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        updated_data_hash,
        creator_hash,
    );

    crate::utils::wrap_application_data_v1(
        Version::V1,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V1,
        &merkle_tree.key(),
        ctx.bumps.tree_authority,
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.tree_authority.to_account_info(),
        &ctx.accounts.merkle_tree.to_account_info(),
        &ctx.accounts.log_wrapper.to_account_info(),
        ctx.remaining_accounts,
        root,
        previous_leaf.to_node(),
        new_leaf.to_node(),
        index,
    )
}

#[allow(deprecated)]
fn process_collection_verification_mpl_core_only<'info>(
    update_type: UpdateType,
    core_collection_account: &AccountInfo<'info>,
    collection_authority: &Pubkey,
    bubblegum_signer: &AccountInfo<'info>,
    bubblegum_signer_bump: u8,
    mpl_core_program: &AccountInfo<'info>,
    message: &MetadataArgsV2,
) -> Result<()> {
    // Create a new scope so that the reference to `core_collection_account` is dropped prior
    // to the CPI.
    let collection = {
        let core_collection_data = &core_collection_account.data.borrow()[..];
        MplCoreCollection::from_bytes(core_collection_data)?
    };

    // See if the mpl-core collection plugins approve or reject the mint.
    let validation_result = if collection.base.update_authority == collection_authority.key() {
        ValidationResult::Approved
    } else if let Some(plugin) = &collection.plugin_list.update_delegate {
        plugin.validate_add_to_collection(&collection, collection_authority.key())?
    } else {
        ValidationResult::Abstain
    };

    if validation_result != ValidationResult::Approved {
        return Err(BubblegumError::InvalidCollectionAuthority.into());
    }

    // Make sure the collection has the `BubblegumV2` plugin.
    if collection.plugin_list.bubblegum_v2.is_none() {
        return Err(BubblegumError::CollectionMustHaveBubblegumPlugin.into());
    }

    let asset_collection = message
        .collection
        .ok_or(BubblegumError::CollectionNotFound)?;

    if asset_collection != core_collection_account.key() {
        return Err(BubblegumError::CollectionMismatch.into());
    }

    // Update collection info.
    UpdateCollectionInfoV1CpiBuilder::new(mpl_core_program)
        .collection(core_collection_account)
        .bubblegum_signer(bubblegum_signer)
        .update_type(update_type)
        .amount(1)
        .invoke_signed(&[&[
            MPL_CORE_CPI_SIGNER_PREFIX.as_bytes(),
            &[bubblegum_signer_bump],
        ]])?;

    Ok(())
}

fn mpl_core_collection_validate_update(
    collection: &MplCoreCollection,
    authority: Pubkey,
) -> Result<ValidationResult> {
    if collection.base.update_authority == authority.key() {
        Ok(ValidationResult::Approved)
    } else if let Some(plugin) = &collection.plugin_list.update_delegate {
        plugin.validate_update_metadata(collection, authority.key())
    } else {
        Ok(ValidationResult::Abstain)
    }
}
