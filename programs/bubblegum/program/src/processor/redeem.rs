use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, Node, Noop as SplNoop};

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::{LeafSchema, Version},
        DecompressibleState, TreeConfig, Voucher, VOUCHER_PREFIX, VOUCHER_SIZE,
    },
    utils::{get_asset_id, replace_leaf},
};

#[derive(Accounts)]
#[instruction(
    _root: [u8; 32],
    _data_hash: [u8; 32],
    _creator_hash: [u8; 32],
    nonce: u64,
    _index: u32,
)]
pub struct Redeem<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub leaf_owner: Signer<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(
        init,
        seeds = [
        VOUCHER_PREFIX.as_ref(),
        merkle_tree.key().as_ref(),
        & nonce.to_le_bytes()
    ],
    payer = leaf_owner,
    space = VOUCHER_SIZE,
    bump
    )]
    pub voucher: Account<'info, Voucher>,
    pub log_wrapper: Program<'info, SplNoop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn redeem<'info>(
    ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
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

    if ctx.accounts.tree_authority.is_decompressible == DecompressibleState::Disabled {
        return Err(BubblegumError::DecompressionDisabled.into());
    }

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx.accounts.leaf_delegate.key();
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v1(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
    );

    let new_leaf = Node::default();

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
        new_leaf,
        index,
    )?;
    ctx.accounts
        .voucher
        .set_inner(Voucher::new(previous_leaf, index, merkle_tree.key()));

    Ok(())
}
