use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, wrap_application_data_v1, Noop};

use crate::{
    asserts::assert_metadata_is_mpl_compatible,
    error::BubblegumError,
    state::{
        leaf_schema::LeafSchema,
        metaplex_adapter::{Creator, MetadataArgs, UpdateArgs},
        metaplex_anchor::MplTokenMetadata,
        TreeConfig,
    },
    utils::{get_asset_id, hash_creators, hash_metadata, replace_leaf},
};

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: Account<'info, TreeConfig>,
    pub tree_delegate: Signer<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    #[account(mut)]
    /// CHECK: This account is modified in the downstream program
    pub merkle_tree: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub token_metadata_program: Program<'info, MplTokenMetadata>,
    pub system_program: Program<'info, System>,
}

fn all_verified_creators_in_a_are_in_b(a: &[Creator], b: &[Creator], exception: Pubkey) -> bool {
    a.iter()
        .filter(|creator_a| creator_a.verified)
        .all(|creator_a| {
            creator_a.address == exception
                || b.iter()
                    .any(|creator_b| creator_a.address == creator_b.address && creator_b.verified)
        })
}

fn process_update_metadata<'info>(
    merkle_tree: &AccountInfo<'info>,
    tree_delegate: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    delegate: &AccountInfo<'info>,
    compression_program: &AccountInfo<'info>,
    tree_authority: &AccountInfo<'info>,
    tree_authority_bump: u8,
    log_wrapper: &Program<'info, Noop>,
    remaining_accounts: &[AccountInfo<'info>],
    root: [u8; 32],
    current_metadata: MetadataArgs,
    update_args: UpdateArgs,
    nonce: u64,
    index: u32,
) -> Result<()> {
    // Old metadata must be mutable to allow metadata update
    require!(
        current_metadata.is_mutable,
        BubblegumError::MetadataImmutable
    );

    let current_data_hash = hash_metadata(&current_metadata)?;
    let current_creator_hash = hash_creators(&current_metadata.creators)?;

    // Update metadata
    let mut updated_metadata = current_metadata;
    if let Some(name) = update_args.name {
        updated_metadata.name = name;
    };
    if let Some(symbol) = update_args.symbol {
        updated_metadata.symbol = symbol;
    };
    if let Some(uri) = update_args.uri {
        updated_metadata.uri = uri;
    };
    if let Some(updated_creators) = update_args.creators {
        let current_creators = updated_metadata.creators;

        // Make sure no new creator is verified (unless it is the tree delegate).
        let no_new_creators_verified = all_verified_creators_in_a_are_in_b(
            &updated_creators,
            &current_creators,
            tree_delegate.key(),
        );
        require!(
            no_new_creators_verified,
            BubblegumError::CreatorDidNotVerify
        );

        // Make sure no current verified creator is unverified or removed (unless it is the tree
        // delegate).
        let no_current_creators_unverified = all_verified_creators_in_a_are_in_b(
            &current_creators,
            &updated_creators,
            tree_delegate.key(),
        );
        require!(
            no_current_creators_unverified,
            BubblegumError::CreatorDidNotUnverify
        );

        updated_metadata.creators = updated_creators;
    }
    if let Some(seller_fee_basis_points) = update_args.seller_fee_basis_points {
        updated_metadata.seller_fee_basis_points = seller_fee_basis_points
    };
    if let Some(primary_sale_happened) = update_args.primary_sale_happened {
        // a new value of primary_sale_happened should only be specified if primary_sale_happened was false in the original metadata
        require!(
            !updated_metadata.primary_sale_happened,
            BubblegumError::PrimarySaleCanOnlyBeFlippedToTrue
        );
        updated_metadata.primary_sale_happened = primary_sale_happened;
    };
    if let Some(is_mutable) = update_args.is_mutable {
        updated_metadata.is_mutable = is_mutable;
    };

    assert_metadata_is_mpl_compatible(&updated_metadata)?;
    let updated_data_hash = hash_metadata(&updated_metadata)?;
    let updated_creator_hash = hash_creators(&updated_metadata.creators)?;

    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        current_data_hash,
        current_creator_hash,
    );
    let new_leaf = LeafSchema::new_v0(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        updated_data_hash,
        updated_creator_hash,
    );

    wrap_application_data_v1(new_leaf.to_event().try_to_vec()?, log_wrapper)?;

    replace_leaf(
        &merkle_tree.key(),
        tree_authority_bump,
        compression_program,
        tree_authority,
        merkle_tree,
        &log_wrapper.to_account_info(),
        remaining_accounts,
        root,
        previous_leaf.to_node(),
        new_leaf.to_node(),
        index,
    )
}

pub fn update_metadata<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateMetadata<'info>>,
    root: [u8; 32],
    nonce: u64,
    index: u32,
    current_metadata: MetadataArgs,
    update_args: UpdateArgs,
) -> Result<()> {
    require!(
        ctx.accounts.tree_delegate.key() == ctx.accounts.tree_authority.tree_creator
            || ctx.accounts.tree_delegate.key() == ctx.accounts.tree_authority.tree_delegate,
        BubblegumError::TreeAuthorityIncorrect,
    );

    process_update_metadata(
        &ctx.accounts.merkle_tree.to_account_info(),
        &ctx.accounts.tree_delegate,
        &ctx.accounts.leaf_owner,
        &ctx.accounts.leaf_delegate,
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.tree_authority.to_account_info(),
        *ctx.bumps.get("tree_authority").unwrap(),
        &ctx.accounts.log_wrapper,
        ctx.remaining_accounts,
        root,
        current_metadata,
        update_args,
        nonce,
        index,
    )
}
