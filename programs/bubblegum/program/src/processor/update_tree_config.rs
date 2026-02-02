use anchor_lang::prelude::*;

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::Version, metaplex_adapter::UpdateTreeConfigArgs, DecompressibleState,
        TreeConfig,
    },
};

#[derive(Accounts)]
pub struct UpdateTreeConfig<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(address = tree_authority.tree_creator @ BubblegumError::TreeAuthorityIncorrect)]
    pub authority: Signer<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
}

pub fn update_tree_config<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateTreeConfig<'info>>,
    update_args: UpdateTreeConfigArgs,
) -> Result<()> {
    // Support V1 and V2 trees.
    require!(
        matches!(
            ctx.accounts.tree_authority.version,
            Version::V1 | Version::V2
        ),
        BubblegumError::UnsupportedSchemaVersion
    );

    let tree_authority = &mut ctx.accounts.tree_authority;

    // Update tree config.
    let UpdateTreeConfigArgs {
        tree_creator,
        tree_delegate,
        is_decompressible,
        is_public,
    } = update_args;

    // Validate update args.
    // `tree_creator` must equal `tree_delegate`
    if tree_creator != tree_delegate {
        msg!(
            "Tree creator must equal tree delegate, got {:?} != {:?}",
            tree_creator,
            tree_delegate
        );
        return Err(BubblegumError::UnsupportedUpdateOperation.into());
    }
    // `is_decompressible` must be `None` or `Disabled`
    if !matches!(
        is_decompressible,
        None | Some(DecompressibleState::Disabled)
    ) {
        msg!("Tree cannot be set to decompressible, is_decompressed must be None or Disabled, got {:?}", is_decompressible);
        return Err(BubblegumError::UnsupportedUpdateOperation.into());
    }

    if let Some(tree_creator) = tree_creator {
        tree_authority.tree_creator = tree_creator;
    }

    if let Some(tree_delegate) = tree_delegate {
        tree_authority.tree_delegate = tree_delegate;
    }

    if let Some(is_decompressible) = is_decompressible {
        tree_authority.is_decompressible = is_decompressible;
    }

    if let Some(is_public) = is_public {
        tree_authority.is_public = is_public;
    }

    Ok(())
}
