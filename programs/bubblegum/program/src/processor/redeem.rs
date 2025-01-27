use anchor_lang::prelude::*;
use spl_concurrent_merkle_tree::node::Node;

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::LeafSchema, DecompressibleState, TreeConfig, Voucher, VOUCHER_PREFIX,
        VOUCHER_SIZE,
    },
    utils::{get_asset_id, replace_leaf, validate_ownership_and_programs},
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
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub leaf_owner: Signer<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: checked in cpi
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
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
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
    validate_ownership_and_programs(
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    if ctx.accounts.tree_authority.is_decompressible == DecompressibleState::Disabled {
        return Err(BubblegumError::DecompressionDisabled.into());
    }

    let owner = ctx.accounts.leaf_owner.key();
    let delegate = ctx.accounts.leaf_delegate.key();
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf =
        LeafSchema::new_v0(asset_id, owner, delegate, nonce, data_hash, creator_hash);

    let new_leaf = Node::default();

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
        new_leaf,
        index,
    )?;
    ctx.accounts
        .voucher
        .set_inner(Voucher::new(previous_leaf, index, merkle_tree.key()));

    Ok(())
}
