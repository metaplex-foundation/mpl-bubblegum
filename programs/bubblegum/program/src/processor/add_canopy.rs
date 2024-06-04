use anchor_lang::{prelude::*, system_program::System};
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::{error::BubblegumError, state::TreeConfig};

#[derive(Accounts)]
pub struct AddCanopy<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    /// CHECK:
    pub merkle_tree: UncheckedAccount<'info>,
    pub delegate: Signer<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn add_canopy<'info>(
    ctx: Context<'_, '_, '_, 'info, AddCanopy<'info>>,
    start_index: u32,
    canopy_nodes: Vec<[u8; 32]>,
) -> Result<()> {
    let delegate = ctx.accounts.delegate.key();
    let authority = &mut ctx.accounts.tree_authority;

    // delegate is Metagrid node in this case
    require!(
        delegate == authority.tree_delegate,
        BubblegumError::TreeAuthorityIncorrect,
    );

    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let seed = merkle_tree.key();
    let seeds = &[seed.as_ref(), &[ctx.bumps.tree_authority]];

    let authority_pda_signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(),
        spl_account_compression::cpi::accounts::Modify {
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
            authority: ctx.accounts.tree_authority.to_account_info(),
            noop: ctx.accounts.log_wrapper.to_account_info(),
        },
        authority_pda_signer,
    );
    spl_account_compression::cpi::append_canopy_nodes(cpi_ctx, start_index, canopy_nodes)
}
