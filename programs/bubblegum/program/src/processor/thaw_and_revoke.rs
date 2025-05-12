use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};

use crate::{
    processor::{freeze::set_asset_lvl_freeze_flag, BubblegumError},
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
pub struct ThawAndRevokeV2<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Optional leaf delegate, defaults to `payer`
    pub leaf_delegate: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn thaw_and_revoke_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, ThawAndRevokeV2<'info>>,
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

    let raw_flags = flags.unwrap_or(DEFAULT_FLAGS);
    let flags = Flags::from_bytes([raw_flags]);

    // Ensure asset is already frozen at the asset-level.
    if !flags.asset_lvl_frozen() {
        return Err(BubblegumError::AssetIsNotFrozen.into());
    }

    // Clear freeze flag.
    let updated_flags = set_asset_lvl_freeze_flag(raw_flags, false);

    // Gather info for previous leaf and new leaf.
    let merkle_tree = &ctx.accounts.merkle_tree;
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    let collection_hash = collection_hash.unwrap_or(DEFAULT_COLLECTION_HASH);
    let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);

    let previous_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        raw_flags,
    );

    // Reset delegate to leaf owner, and use updated flags.
    let new_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_owner,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        updated_flags,
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
