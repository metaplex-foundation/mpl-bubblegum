use anchor_lang::{prelude::*, system_program::System};
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::{
    state::{DecompressibleState, TreeConfig, TREE_AUTHORITY_SIZE},
    utils::check_canopy_size,
};

#[derive(Accounts)]
pub struct PrepareTree<'info> {
    #[account(
        init,
        seeds = [merkle_tree.key().as_ref()],
        payer = payer,
        space = TREE_AUTHORITY_SIZE,
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(zero)]
    /// CHECK: This account must be all zeros
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub tree_creator: Signer<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn prepare_tree<'info>(
    ctx: Context<'_, '_, '_, 'info, PrepareTree<'info>>,
    max_depth: u32,
    max_buffer_size: u32,
    public: Option<bool>,
) -> Result<()> {
    check_canopy_size(
        ctx.accounts.merkle_tree.to_account_info(),
        ctx.accounts.tree_authority.to_account_info(),
        max_depth,
        max_buffer_size,
    )?;

    let authority = &mut ctx.accounts.tree_authority;
    authority.set_inner(TreeConfig {
        tree_creator: ctx.accounts.tree_creator.key(),
        tree_delegate: ctx.accounts.tree_creator.key(),
        total_mint_capacity: 1 << max_depth,
        num_minted: 0,
        is_public: public.unwrap_or(false),
        is_decompressible: DecompressibleState::Disabled,
    });

    prep_tree_cpi_call(ctx, max_depth, max_buffer_size)
}

#[inline(always)]
fn prep_tree_cpi_call<'info>(
    ctx: Context<'_, '_, '_, 'info, PrepareTree<'info>>,
    max_depth: u32,
    max_buffer_size: u32,
) -> Result<()> {
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let seed = merkle_tree.key();
    let seeds: &[&[u8]; 2] = &[seed.as_ref(), &[ctx.bumps.tree_authority]];
    let authority_pda_signer = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(),
        spl_account_compression::cpi::accounts::Initialize {
            merkle_tree,
            authority: ctx.accounts.tree_authority.to_account_info(),
            noop: ctx.accounts.log_wrapper.to_account_info(),
        },
        authority_pda_signer,
    );
    spl_account_compression::cpi::prepare_batch_merkle_tree(cpi_ctx, max_depth, max_buffer_size)
}
