use anchor_lang::prelude::*;
use spl_account_compression::wrap_application_data_v1;

use crate::{
    error::PrimitivesError,
    state::{
        leaf_schema::LeafSchema,
        metaplex_adapter::{Creator, NodeArgs},
    },
    utils::{get_asset_id, hash_creators, hash_metadata, replace_leaf},
};

mod burn;
mod create_tree;
mod mint_edge;
mod mint_node;
mod set_decompressible_state;
mod set_tree_delegate;
mod unverify_creator;
mod update_metadata;
mod verify_creator;

pub(crate) use burn::*;
pub(crate) use create_tree::*;
pub(crate) use mint_edge::*;
pub(crate) use mint_node::*;
pub(crate) use set_decompressible_state::*;
pub(crate) use set_tree_delegate::*;
pub(crate) use unverify_creator::*;
pub(crate) use update_metadata::*;
pub(crate) use verify_creator::*;

fn process_creator_verification<'info>(
    ctx: Context<'_, '_, '_, 'info, verify_creator::CreatorVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    mut message: NodeArgs,
    verify: bool,
) -> Result<()> {
    let owner = ctx.accounts.leaf_owner.to_account_info();
    let delegate = ctx.accounts.leaf_delegate.to_account_info();
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();

    let creator = ctx.accounts.creator.key();

    // Creator Vec must contain creators.
    if message.creators.is_empty() {
        return Err(PrimitivesError::NoCreatorsPresent.into());
    }

    // Creator must be in user-provided creator Vec.
    if !message.creators.iter().any(|c| c.address == creator) {
        return Err(PrimitivesError::CreatorNotFound.into());
    }

    // User-provided creator Vec must result in same user-provided creator hash.
    let incoming_creator_hash = hash_creators(&message.creators)?;
    if creator_hash != incoming_creator_hash {
        return Err(PrimitivesError::CreatorHashMismatch.into());
    }

    // User-provided metadata must result in same user-provided data hash.
    let incoming_data_hash = hash_metadata(&message)?;
    if data_hash != incoming_data_hash {
        return Err(PrimitivesError::DataHashMismatch.into());
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
