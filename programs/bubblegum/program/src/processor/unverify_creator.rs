use anchor_lang::prelude::*;

use crate::{
    processor::{
        process_creator_verification,
        verify_creator::{CreatorVerification, CreatorVerificationV2},
        BubblegumError,
    },
    state::{
        leaf_schema::Version,
        metaplex_adapter::{MetadataArgs, MetadataArgsV2},
    },
    utils::{
        hash_collection_option, hash_creators, hash_metadata, replace_leaf,
        validate_ownership_and_programs,
    },
};

pub(crate) fn unverify_creator<'info>(
    ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    message: MetadataArgs,
) -> Result<()> {
    validate_ownership_and_programs(
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    let (previous_leaf, new_leaf) = process_creator_verification(
        ctx.accounts.merkle_tree.key(),
        ctx.accounts.creator.key(),
        data_hash,
        creator_hash,
        nonce,
        ctx.accounts.leaf_owner.key(),
        Some(ctx.accounts.leaf_delegate.key()),
        message,
        None,
        None,
        None,
        false,
    )?;

    crate::utils::wrap_application_data_v1(
        Version::V1,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V1,
        &ctx.accounts.merkle_tree.key(),
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

pub(crate) fn unverify_creator_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, CreatorVerificationV2<'info>>,
    root: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
    message: MetadataArgsV2,
) -> Result<()> {
    // V2 instructions only work with V2 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    let creator = ctx
        .accounts
        .creator
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    let previous_data_hash = hash_metadata(&message)?;
    let previous_creator_hash = hash_creators(&message.creators)?;

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key());

    let collection_hash = hash_collection_option(message.collection)?;

    let (previous_leaf, new_leaf) = process_creator_verification(
        ctx.accounts.merkle_tree.key(),
        creator,
        previous_data_hash,
        previous_creator_hash,
        nonce,
        leaf_owner,
        leaf_delegate,
        message,
        Some(collection_hash),
        asset_data_hash,
        flags,
        false,
    )?;

    crate::utils::wrap_application_data_v1(
        Version::V2,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V2,
        &ctx.accounts.merkle_tree.key(),
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
