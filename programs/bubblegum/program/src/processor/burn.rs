use anchor_lang::prelude::*;
use spl_concurrent_merkle_tree::node::Node;

use crate::{
    error::BubblegumError,
    state::{leaf_schema::LeafSchema, TreeConfig},
    utils::{get_asset_id, replace_leaf, validate_ownership_and_programs},
};

#[derive(Accounts)]
pub struct Burn<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: This account is modified in the downstream program
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn burn<'info>(
    ctx: Context<'_, '_, '_, 'info, Burn<'info>>,
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
    let owner = ctx.accounts.leaf_owner.to_account_info();
    let delegate = ctx.accounts.leaf_delegate.to_account_info();

    // Burn must be initiated by either the leaf owner or leaf delegate.
    require!(
        owner.is_signer || delegate.is_signer,
        BubblegumError::LeafAuthorityMustSign
    );
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);

    let previous_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );

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
    )
}
