use crate::{
    error::BubblegumError,
    state::{leaf_schema::Version, TreeConfig},
};
use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};

#[derive(Accounts)]
pub struct CloseTreeV2<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// Tree creator or delegate.
    pub authority: Signer<'info>,
    /// CHECK: This account is modified in the downstream program.
    #[account(mut, owner = mpl_account_compression::ID)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// Recipient for reclaimed lamports (tree + config PDA). Must be the creator
    /// or the delegate.
    /// CHECK: This account is validated in the instruction.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn close_tree_v2(ctx: Context<CloseTreeV2>) -> Result<()> {
    // Only V2 trees (created via `create_tree_v2`) are supported.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    // Only the creator or delegate can trigger closure.
    let authority = ctx.accounts.authority.key();
    require!(
        authority == ctx.accounts.tree_authority.tree_creator
            || authority == ctx.accounts.tree_authority.tree_delegate,
        BubblegumError::InvalidAuthority
    );

    // Recipient must be the creator or delegate as well.
    require!(
        ctx.accounts.recipient.key() == ctx.accounts.tree_authority.tree_creator
            || ctx.accounts.recipient.key() == ctx.accounts.tree_authority.tree_delegate,
        BubblegumError::PublicKeyMismatch
    );

    // Close the empty tree via CPI using the tree authority PDA as the signer.
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let seed = merkle_tree.key();
    let seeds = &[seed.as_ref(), &[ctx.bumps.tree_authority]];
    let authority_pda_signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(),
        mpl_account_compression::cpi::accounts::CloseTree {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority: ctx.accounts.tree_authority.to_account_info(),
            recipient: ctx.accounts.recipient.to_account_info(),
        },
        authority_pda_signer,
    );
    mpl_account_compression::cpi::close_empty_tree(cpi_ctx)?;

    // Close the tree config PDA to reclaim its rent.
    ctx.accounts
        .tree_authority
        .close(ctx.accounts.recipient.to_account_info())
}
