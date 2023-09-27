use anchor_lang::prelude::*;

use crate::state::TreeConfig;

#[derive(Accounts)]
pub struct SetTreeDelegate<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
        has_one = tree_creator
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    pub tree_creator: Signer<'info>,
    /// CHECK: this account is neither read from or written to
    pub new_tree_delegate: UncheckedAccount<'info>,
    /// CHECK: this account is neither read from or written to
    pub merkle_tree: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn set_tree_delegate(ctx: Context<SetTreeDelegate>) -> Result<()> {
    ctx.accounts.tree_authority.tree_delegate = ctx.accounts.new_tree_delegate.key();
    Ok(())
}
