use anchor_lang::prelude::*;

use crate::{
    processor::BubblegumError,
    state::{leaf_schema::Version, DecompressibleState, TreeConfig},
};

#[derive(Accounts)]
pub struct SetDecompressibleState<'info> {
    #[account(mut, has_one = tree_creator)]
    pub tree_authority: Account<'info, TreeConfig>,
    pub tree_creator: Signer<'info>,
}

pub(crate) fn set_decompressible_state(
    ctx: Context<SetDecompressibleState>,
    decompressable_state: DecompressibleState,
) -> Result<()> {
    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    ctx.accounts.tree_authority.is_decompressible = decompressable_state;

    Ok(())
}
