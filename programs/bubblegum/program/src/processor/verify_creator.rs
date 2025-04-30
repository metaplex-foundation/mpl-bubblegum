use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use spl_account_compression::{program::SplAccountCompression, Noop as SplNoop};

use crate::{
    processor::{process_creator_verification, BubblegumError},
    state::{
        leaf_schema::Version,
        metaplex_adapter::{MetadataArgs, MetadataArgsV2},
        TreeConfig,
    },
    utils::{hash_collection_option, hash_creators, hash_metadata, replace_leaf},
};

#[derive(Accounts)]
pub struct CreatorVerification<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    pub creator: Signer<'info>,
    pub log_wrapper: Program<'info, SplNoop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn verify_creator<'info>(
    ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    message: MetadataArgs,
) -> Result<()> {
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
        true,
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

#[derive(Accounts)]
pub struct CreatorVerificationV2<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    pub payer: Signer<'info>,
    /// Optional creator, defaults to `payer`
    pub creator: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    /// Defaults to `leaf_owner`
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn verify_creator_v2<'info>(
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
        true,
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
