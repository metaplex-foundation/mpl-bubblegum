use anchor_lang::prelude::*;

use crate::{
    error::BubblegumError,
    state::{collect::COLLECT_RECIPIENT, leaf_schema::Version, TreeConfig, TREE_AUTHORITY_SIZE},
};

#[derive(Accounts)]
pub struct CollectV2<'info> {
    #[account(mut)]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: Hardcoded recipient with no data
    #[account(mut, address = COLLECT_RECIPIENT)]
    destination: UncheckedAccount<'info>,
}

pub(crate) fn collect_v2<'info>(ctx: Context<'_, '_, '_, 'info, CollectV2<'info>>) -> Result<()> {
    // V2 instructions only work with V2 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    let rent_amount = Rent::get()?.minimum_balance(TREE_AUTHORITY_SIZE);
    let source = ctx.accounts.tree_authority.to_account_info();
    let destination = ctx.accounts.destination.to_account_info();

    let fee_amount = source
        .lamports()
        .checked_sub(rent_amount)
        .ok_or(BubblegumError::NumericalOverflowError)?;

    **destination.try_borrow_mut_lamports()? = destination
        .lamports()
        .checked_add(fee_amount)
        .ok_or(BubblegumError::NumericalOverflowError)?;

    **source.try_borrow_mut_lamports()? = rent_amount;

    Ok(())
}
