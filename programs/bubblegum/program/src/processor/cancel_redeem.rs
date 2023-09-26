use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, wrap_application_data_v1, Noop};

use crate::{
    asserts::assert_pubkey_equal,
    error::BubblegumError,
    state::{leaf_schema::LeafSchema, TreeConfig, Voucher, VOUCHER_PREFIX},
    utils::replace_leaf,
};

#[derive(Accounts)]
pub struct CancelRedeem<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub leaf_owner: Signer<'info>,
    #[account(mut)]
    /// CHECK: unsafe
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(
        mut,
        close = leaf_owner,
        seeds = [
        VOUCHER_PREFIX.as_ref(),
        merkle_tree.key().as_ref(),
        & voucher.leaf_schema.nonce().to_le_bytes()
    ],
    bump
    )]
    pub voucher: Account<'info, Voucher>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub fn cancel_redeem<'info>(
    ctx: Context<'_, '_, '_, 'info, CancelRedeem<'info>>,
    root: [u8; 32],
) -> Result<()> {
    let voucher = &ctx.accounts.voucher;
    match ctx.accounts.voucher.leaf_schema {
        LeafSchema::V1 { owner, .. } => assert_pubkey_equal(
            &ctx.accounts.leaf_owner.key(),
            &owner,
            Some(BubblegumError::AssetOwnerMismatch.into()),
        ),
    }?;
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();

    wrap_application_data_v1(
        voucher.leaf_schema.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        &merkle_tree.key(),
        *ctx.bumps.get("tree_authority").unwrap(),
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.tree_authority.to_account_info(),
        &ctx.accounts.merkle_tree.to_account_info(),
        &ctx.accounts.log_wrapper.to_account_info(),
        ctx.remaining_accounts,
        root,
        [0; 32],
        voucher.leaf_schema.to_node(),
        voucher.index,
    )
}
