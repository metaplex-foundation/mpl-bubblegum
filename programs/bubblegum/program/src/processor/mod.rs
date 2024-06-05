use anchor_lang::prelude::*;
use solana_program::{account_info::AccountInfo, pubkey::Pubkey};
use spl_account_compression::wrap_application_data_v1;

use crate::{
    asserts::{assert_collection_membership, assert_has_collection_authority},
    error::BubblegumError,
    state::{
        leaf_schema::LeafSchema,
        metaplex_adapter::{self, Creator, MetadataArgs},
        metaplex_anchor::TokenMetadata,
    },
    utils::{get_asset_id, hash_creators, hash_metadata, replace_leaf},
};

mod add_canopy;
mod burn;
mod cancel_redeem;
mod compress;
mod create_tree;
mod decompress;
mod delegate;
mod finalize_tree_with_root;
mod mint;
mod mint_to_collection;
mod prepare_tree;
mod redeem;
mod set_and_verify_collection;
mod set_decompressible_state;
mod set_tree_delegate;
mod transfer;
mod unverify_collection;
mod unverify_creator;
mod update_metadata;
mod verify_collection;
mod verify_creator;

pub(crate) use add_canopy::*;
pub(crate) use burn::*;
pub(crate) use cancel_redeem::*;
pub(crate) use compress::*;
pub(crate) use create_tree::*;
pub(crate) use decompress::*;
pub(crate) use delegate::*;
pub(crate) use finalize_tree_with_root::*;
pub(crate) use mint::*;
pub(crate) use mint_to_collection::*;
pub(crate) use prepare_tree::*;
pub(crate) use redeem::*;
pub(crate) use set_and_verify_collection::*;
pub(crate) use set_decompressible_state::*;
pub(crate) use set_tree_delegate::*;
pub(crate) use transfer::*;
pub(crate) use unverify_collection::*;
pub(crate) use unverify_creator::*;
pub(crate) use update_metadata::*;
pub(crate) use verify_collection::*;
pub(crate) use verify_creator::*;

fn process_creator_verification<'info>(
    ctx: Context<'_, '_, '_, 'info, verify_creator::CreatorVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    mut message: MetadataArgs,
    verify: bool,
) -> Result<()> {
    let owner = ctx.accounts.leaf_owner.to_account_info();
    let delegate = ctx.accounts.leaf_delegate.to_account_info();
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();

    let creator = ctx.accounts.creator.key();

    // Creator Vec must contain creators.
    if message.creators.is_empty() {
        return Err(BubblegumError::NoCreatorsPresent.into());
    }

    // Creator must be in user-provided creator Vec.
    if !message.creators.iter().any(|c| c.address == creator) {
        return Err(BubblegumError::CreatorNotFound.into());
    }

    // User-provided creator Vec must result in same user-provided creator hash.
    let incoming_creator_hash = hash_creators(&message.creators)?;
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
        .creators
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
    message.creators = updated_creator_vec;

    // Calculate new data hash.
    let updated_data_hash = hash_metadata(&message)?;

    // Build previous leaf struct, new leaf struct, and replace the leaf in the tree.
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );
    let new_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        updated_data_hash,
        updated_creator_hash,
    );

    wrap_application_data_v1(new_leaf.to_event().try_to_vec()?, &ctx.accounts.log_wrapper)?;

    replace_leaf(
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
fn process_collection_verification_mpl_only<'info>(
    collection_metadata: &Account<'info, TokenMetadata>,
    collection_mint: &AccountInfo<'info>,
    collection_authority: &AccountInfo<'info>,
    collection_authority_record_pda: &AccountInfo<'info>,
    edition_account: &AccountInfo<'info>,
    message: &mut MetadataArgs,
    verify: bool,
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

    // If the NFT has collection data, we set it to the correct value after doing some validation.
    if let Some(collection) = &mut message.collection {
        assert_collection_membership(
            &Some(collection.adapt()),
            collection_metadata,
            collection_mint.key,
            edition_account,
        )?;

        assert_has_collection_authority(
            collection_metadata,
            collection_mint.key,
            collection_authority.key,
            collection_authority_record,
        )?;

        // Update collection in metadata args.  Note since this is a mutable reference,
        // it is still updating `message.collection` after being destructured.
        collection.verified = verify;
    } else {
        return Err(BubblegumError::CollectionNotFound.into());
    }

    Ok(())
}

fn process_collection_verification<'info>(
    ctx: Context<'_, '_, '_, 'info, verify_collection::CollectionVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    mut message: MetadataArgs,
    verify: bool,
    new_collection: Option<Pubkey>,
) -> Result<()> {
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

    // If new collection was provided (via `set_and_verify_collection`), set it in the metadata.
    if new_collection.is_some() {
        message.collection = new_collection.map(|key| metaplex_adapter::Collection {
            verified: false, // Will be set to true later.
            key,
        });
    }

    // Note this call mutates message.
    process_collection_verification_mpl_only(
        collection_metadata,
        &collection_mint,
        &collection_authority,
        &collection_authority_record_pda,
        &edition_account,
        &mut message,
        verify,
    )?;

    // Calculate new data hash.
    let updated_data_hash = hash_metadata(&message)?;

    // Build previous leaf struct, new leaf struct, and replace the leaf in the tree.
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );
    let new_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        updated_data_hash,
        creator_hash,
    );

    wrap_application_data_v1(new_leaf.to_event().try_to_vec()?, &ctx.accounts.log_wrapper)?;

    replace_leaf(
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
