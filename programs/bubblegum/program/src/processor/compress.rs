use anchor_lang::prelude::*;

use crate::state::metaplex_anchor::{MasterEdition, TokenMetadata};

#[derive(Accounts)]
pub struct Compress<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: Signer<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is not read
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK: versioning is handled in the instruction
    #[account(mut)]
    pub token_account: AccountInfo<'info>,
    /// CHECK: versioning is handled in the instruction
    #[account(mut)]
    pub mint: AccountInfo<'info>,
    #[account(mut)]
    pub metadata: Box<Account<'info, TokenMetadata>>,
    #[account(mut)]
    pub master_edition: Box<Account<'info, MasterEdition>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK:
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK:
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK:
    pub token_program: UncheckedAccount<'info>,
    /// CHECK:
    pub token_metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn compress(_ctx: Context<Compress>) -> Result<()> {
    // TODO
    Ok(())
}
