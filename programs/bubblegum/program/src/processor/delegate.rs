use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use spl_account_compression::{program::SplAccountCompression, Noop as SplNoop};

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::{LeafSchema, Version},
        TreeConfig,
    },
    utils::{
        get_asset_id, replace_leaf, Flags, DEFAULT_ASSET_DATA_HASH, DEFAULT_COLLECTION_HASH,
        DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct Delegate<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: Account<'info, TreeConfig>,
    pub leaf_owner: Signer<'info>,
    /// CHECK: This account is neither written to nor read from.
    pub previous_leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from.
    pub new_leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, SplNoop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn delegate<'info>(
    ctx: Context<'_, '_, '_, 'info, Delegate<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
) -> Result<()> {
    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let owner = ctx.accounts.leaf_owner.key();
    let previous_delegate = ctx.accounts.previous_leaf_delegate.key();
    let new_delegate = ctx.accounts.new_leaf_delegate.key();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v1(
        asset_id,
        owner,
        previous_delegate,
        nonce,
        data_hash,
        creator_hash,
    );
    let new_leaf = LeafSchema::new_v1(
        asset_id,
        owner,
        new_delegate,
        nonce,
        data_hash,
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

#[derive(Accounts)]
pub struct DelegateV2<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    pub payer: Signer<'info>,
    /// Optional leaf owner, defaults to `payer`
    pub leaf_owner: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    /// Defaults to `leaf_owner`
    pub previous_leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub new_leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn delegate_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, DelegateV2<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    collection_hash: Option<[u8; 32]>,
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
) -> Result<()> {
    // V2 instructions only work with V2 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    // Ensure asset is not frozen.
    let flags = flags.unwrap_or(DEFAULT_FLAGS);
    asset_validate_delegate(flags)?;

    // Gather info for previous leaf and new leaf.
    let merkle_tree = &ctx.accounts.merkle_tree;
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let leaf_owner = ctx
        .accounts
        .leaf_owner
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    let previous_leaf_delegate = ctx
        .accounts
        .previous_leaf_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(leaf_owner);

    let collection_hash = collection_hash.unwrap_or(DEFAULT_COLLECTION_HASH);
    let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);

    let previous_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        previous_leaf_delegate,
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
        ctx.accounts.new_leaf_delegate.key(),
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        flags,
    );

    crate::utils::wrap_application_data_v1(
        Version::V2,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V2,
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

pub(crate) fn asset_validate_delegate(flags: u8) -> Result<()> {
    let flags = Flags::from_bytes([flags]);

    if flags.asset_lvl_frozen() || flags.permanent_lvl_frozen() {
        return Err(BubblegumError::AssetIsFrozen.into());
    }

    Ok(())
}
