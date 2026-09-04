use crate::{
    error::BubblegumError,
    state::{collect::COLLECT_RECIPIENT, leaf_schema::Version, TreeConfig, TREE_AUTHORITY_SIZE},
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
    /// Recipient for reclaimed lamports (tree + config PDA rent). Must be the
    /// creator or the delegate.
    /// CHECK: This account is validated in the instruction.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    /// Hardcoded protocol recipient for any uncollected fees held by the tree
    /// config PDA.
    /// CHECK: Hardcoded recipient with no data
    #[account(mut, address = COLLECT_RECIPIENT)]
    pub fee_recipient: UncheckedAccount<'info>,
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

    // Sweep any uncollected protocol fees (balance above rent) to the hardcoded
    // protocol recipient before closing the PDA.
    let rent_amount = Rent::get()?.minimum_balance(TREE_AUTHORITY_SIZE);
    let config = ctx.accounts.tree_authority.to_account_info();
    let fee_amount = config.lamports().saturating_sub(rent_amount);
    if fee_amount > 0 {
        let fee_recipient = ctx.accounts.fee_recipient.to_account_info();
        **fee_recipient.try_borrow_mut_lamports()? = fee_recipient
            .lamports()
            .checked_add(fee_amount)
            .ok_or(BubblegumError::NumericalOverflowError)?;
        **config.try_borrow_mut_lamports()? = rent_amount;
    }

    // Close the tree config PDA to reclaim its remaining rent.
    ctx.accounts
        .tree_authority
        .close(ctx.accounts.recipient.to_account_info())
}
