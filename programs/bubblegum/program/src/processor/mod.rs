use anchor_lang::prelude::*;
use mpl_token_metadata::{
    assertions::collection::assert_collection_verify_is_valid, state::CollectionDetails,
};
use solana_program::{account_info::AccountInfo, program::invoke_signed, pubkey::Pubkey};
use spl_account_compression::wrap_application_data_v1;

use crate::{
    asserts::{assert_has_collection_authority, get_asset_id, replace_leaf},
    error::{metadata_error_into_bubblegum, BubblegumError},
    state::{
        leaf_schema::LeafSchema,
        metaplex_adapter::{self, Creator, MetadataArgs},
        metaplex_anchor::TokenMetadata,
        COLLECTION_CPI_PREFIX,
    },
    utils::{hash_creators, hash_metadata},
};

pub mod burn;
pub mod cancel_redeem;
pub mod compress;
pub mod create_tree;
pub mod decompress;
pub mod delegate;
pub mod mint;
pub mod mint_to_collection;
pub mod redeem;
pub mod set_and_verify_collection;
pub mod set_decompressable_state;
pub mod set_tree_delegate;
pub mod transfer;
pub mod unverify_collection;
pub mod unverify_creator;
pub mod verify_collection;
pub mod verify_creator;

pub use burn::*;
pub use cancel_redeem::*;
pub use compress::*;
pub use create_tree::*;
pub use decompress::*;
pub use delegate::*;
pub use mint::*;
pub use mint_to_collection::*;
pub use redeem::*;
pub use set_and_verify_collection::*;
pub use set_decompressable_state::*;
pub use set_tree_delegate::*;
pub use transfer::*;
pub use unverify_collection::*;
pub use unverify_creator::*;
pub use verify_collection::*;
pub use verify_creator::*;

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
        *ctx.bumps.get("tree_authority").unwrap(),
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
pub fn process_collection_verification_mpl_only<'info>(
    collection_metadata: &Account<'info, TokenMetadata>,
    collection_mint: &AccountInfo<'info>,
    collection_authority: &AccountInfo<'info>,
    collection_authority_record_pda: &AccountInfo<'info>,
    edition_account: &AccountInfo<'info>,
    bubblegum_signer: &AccountInfo<'info>,
    bubblegum_bump: u8,
    token_metadata_program: &AccountInfo<'info>,
    message: &mut MetadataArgs,
    verify: bool,
    new_collection: Option<Pubkey>,
) -> Result<()> {
    // See if a collection authority record PDA was provided.
    let collection_authority_record = if collection_authority_record_pda.key() == crate::id() {
        None
    } else {
        Some(collection_authority_record_pda)
    };

    // Verify correct account ownerships.
    require!(
        *collection_metadata.to_account_info().owner == token_metadata_program.key(),
        BubblegumError::IncorrectOwner
    );
    require!(
        *collection_mint.owner == spl_token::id(),
        BubblegumError::IncorrectOwner
    );
    require!(
        *edition_account.owner == token_metadata_program.key(),
        BubblegumError::IncorrectOwner
    );

    // If new collection was provided, set it in the NFT metadata.
    if new_collection.is_some() {
        message.collection = new_collection.map(|key| metaplex_adapter::Collection {
            verified: false, // Set to true below.
            key,
        });
    }

    // If the NFT has collection data, we set it to the correct value after doing some validation.
    if let Some(collection) = &mut message.collection {
        // Don't verify already verified items, or unverify unverified items, otherwise for sized
        // collections we end up with invalid size data.
        if verify && collection.verified {
            return Err(BubblegumError::AlreadyVerified.into());
        } else if !verify && !collection.verified {
            return Err(BubblegumError::AlreadyUnverified.into());
        }

        // Collection verify assert from token-metadata program.
        assert_collection_verify_is_valid(
            &Some(collection.adapt()),
            collection_metadata,
            collection_mint,
            edition_account,
        )
        .map_err(metadata_error_into_bubblegum)?;

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

    // If this is a sized collection, then increment or decrement collection size.
    if let Some(details) = &collection_metadata.collection_details {
        // Increment or decrement existing size.
        let new_size = match details {
            CollectionDetails::V1 { size } => {
                if verify {
                    size.checked_add(1)
                        .ok_or(BubblegumError::NumericalOverflowError)?
                } else {
                    size.checked_sub(1)
                        .ok_or(BubblegumError::NumericalOverflowError)?
                }
            }
        };

        // CPI into to token-metadata program to change the collection size.
        let mut bubblegum_set_collection_size_infos = vec![
            collection_metadata.to_account_info(),
            collection_authority.clone(),
            collection_mint.clone(),
            bubblegum_signer.clone(),
        ];

        if let Some(record) = collection_authority_record {
            bubblegum_set_collection_size_infos.push(record.clone());
        }

        invoke_signed(
            &mpl_token_metadata::instruction::bubblegum_set_collection_size(
                token_metadata_program.key(),
                collection_metadata.to_account_info().key(),
                collection_authority.key(),
                collection_mint.key(),
                bubblegum_signer.key(),
                collection_authority_record.map(|r| r.key()),
                new_size,
            ),
            bubblegum_set_collection_size_infos.as_slice(),
            &[&[COLLECTION_CPI_PREFIX.as_bytes(), &[bubblegum_bump]]],
        )?;
    } else {
        return Err(BubblegumError::CollectionMustBeSized.into());
    }

    Ok(())
}

pub fn process_collection_verification<'info>(
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
    let bubblegum_signer = ctx.accounts.bubblegum_signer.to_account_info();
    let token_metadata_program = ctx.accounts.token_metadata_program.to_account_info();

    // User-provided metadata must result in same user-provided data hash.
    let incoming_data_hash = hash_metadata(&message)?;
    if data_hash != incoming_data_hash {
        return Err(BubblegumError::DataHashMismatch.into());
    }

    // Note this call mutates message.
    process_collection_verification_mpl_only(
        collection_metadata,
        &collection_mint,
        &collection_authority,
        &collection_authority_record_pda,
        &edition_account,
        &bubblegum_signer,
        ctx.bumps["bubblegum_signer"],
        &token_metadata_program,
        &mut message,
        verify,
        new_collection,
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
        *ctx.bumps.get("tree_authority").unwrap(),
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
