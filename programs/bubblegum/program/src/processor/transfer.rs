use anchor_lang::prelude::*;

use crate::{
    error::BubblegumError,
    state::{leaf_schema::LeafSchema, TreeConfig},
    utils::{get_asset_id, replace_leaf, validate_ownership_and_programs},
};

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from.
    pub new_leaf_owner: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: This account is modified in the downstream program
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn transfer<'info>(
    ctx: Context<'_, '_, '_, 'info, Transfer<'info>>,
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

    // TODO add back version to select hash schema
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let owner = ctx.accounts.leaf_owner.to_account_info();
    let delegate = ctx.accounts.leaf_delegate.to_account_info();

    // Transfers must be initiated by either the leaf owner or leaf delegate.
    require!(
        owner.is_signer || delegate.is_signer,
        BubblegumError::LeafAuthorityMustSign
    );
    let new_owner = ctx.accounts.new_leaf_owner.key();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );
    // New leafs are instantiated with no delegate
    let new_leaf = LeafSchema::new_v0(
        asset_id,
        new_owner,
        new_owner,
        nonce,
        data_hash,
        creator_hash,
    );

    crate::utils::wrap_application_data_v1(
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

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
