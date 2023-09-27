use anchor_lang::prelude::*;

use crate::state::{DecompressableState, TreeConfig};

#[derive(Accounts)]
pub struct SetDecompressableState<'info> {
    #[account(mut, has_one = tree_creator)]
    pub tree_authority: Account<'info, TreeConfig>,
    pub tree_creator: Signer<'info>,
}

pub(crate) fn set_decompressable_state(
    ctx: Context<SetDecompressableState>,
    decompressable_state: DecompressableState,
) -> Result<()> {
    ctx.accounts.tree_authority.is_decompressable = decompressable_state;

    Ok(())
}
