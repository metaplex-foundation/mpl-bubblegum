use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, wrap_application_data_v1, Noop};

use crate::{
    asserts::{assert_has_collection_authority, assert_metadata_is_node_compatible},
    error::PrimitivesError,
    state::{
        leaf_schema::LeafSchema,
        metaplex_adapter::{Collection, Creator, NodeArgs, UpdateNodeArgs},
        metaplex_anchor::{MplTokenMetadata, TokenMetadata},
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
    /// Either collection authority or tree owner/delegate, depending
    /// on whether the item is in a verified collection
    pub authority: Signer<'info>,
    /// CHECK: This account is checked in the instruction
    /// Used when item is in a verified collection
    pub collection_mint: Option<UncheckedAccount<'info>>,
    /// Used when item is in a verified collection
    pub collection_metadata: Option<Box<Account<'info, TokenMetadata>>>,
    /// CHECK: This account is checked in the instruction
    pub collection_authority_record_pda: Option<UncheckedAccount<'info>>,
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

fn assert_authority_matches_collection<'info>(
    collection: &Collection,
    collection_authority: &AccountInfo<'info>,
    collection_authority_record_pda: &Option<UncheckedAccount<'info>>,
    collection_mint: &AccountInfo<'info>,
    collection_metadata_account_info: &AccountInfo,
    collection_metadata: &TokenMetadata,
    token_metadata_program: &Program<'info, MplTokenMetadata>,
) -> Result<()> {
    // Mint account must match Collection mint
    require!(
        collection_mint.key() == collection.key,
        PrimitivesError::CollectionMismatch
    );
    // Metadata mint must match Collection mint
    require!(
        collection_metadata.mint == collection.key,
        PrimitivesError::CollectionMismatch
    );
    // Verify correct account ownerships.
    require!(
        *collection_metadata_account_info.owner == token_metadata_program.key(),
        PrimitivesError::IncorrectOwner
    );
    // Collection mint must be owned by SPL token
    require!(
        *collection_mint.owner == spl_token::id(),
        PrimitivesError::IncorrectOwner
    );

    let collection_authority_record = collection_authority_record_pda
        .as_ref()
        .map(|authority_record_pda| authority_record_pda.to_account_info());

    // Assert that the correct Collection Authority was provided using token-metadata
    assert_has_collection_authority(
        collection_metadata,
        collection_mint.key,
        collection_authority.key,
        collection_authority_record.as_ref(),
    )?;

    Ok(())
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
    authority: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    delegate: &AccountInfo<'info>,
    compression_program: &AccountInfo<'info>,
    tree_authority: &AccountInfo<'info>,
    tree_authority_bump: u8,
    log_wrapper: &Program<'info, Noop>,
    remaining_accounts: &[AccountInfo<'info>],
    root: [u8; 32],
    current_metadata: NodeArgs,
    update_args: UpdateNodeArgs,
    nonce: u64,
    index: u32,
) -> Result<()> {
    // Old metadata must be mutable to allow metadata update
    require!(
        current_metadata.is_mutable,
        PrimitivesError::MetadataImmutable
    );

    let current_data_hash = hash_metadata(&current_metadata)?;
    let current_creator_hash = hash_creators(&current_metadata.creators)?;
    let mut updated_metadata = current_metadata;
    if let Some(label) = update_args.label.into() {
        updated_metadata.label = label;
    };
    if let Some(properties) = update_args.properties.into() {
        updated_metadata.properties = properties;
    };

    if let Some(updated_creators) = update_args.creators.into() {
        let current_creators = updated_metadata.creators;

        // Make sure no new creator is verified (unless it is the tree delegate).
        let no_new_creators_verified = all_verified_creators_in_a_are_in_b(
            &updated_creators,
            &current_creators,
            authority.key(),
        );
        require!(
            no_new_creators_verified,
            PrimitivesError::CreatorDidNotVerify
        );

        // Make sure no current verified creator is unverified or removed (unless it is the tree
        // delegate).
        let no_current_creators_unverified = all_verified_creators_in_a_are_in_b(
            &current_creators,
            &updated_creators,
            authority.key(),
        );
        require!(
            no_current_creators_unverified,
            PrimitivesError::CreatorDidNotUnverify
        );

        updated_metadata.creators = updated_creators;
    }

    if let Some(is_mutable) = update_args.is_mutable.into() {
        updated_metadata.is_mutable = is_mutable;
    };

    assert_metadata_is_node_compatible(&updated_metadata)?;
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
    current_metadata: NodeArgs,
    update_args: UpdateNodeArgs,
) -> Result<()> {
    process_update_metadata(
        &ctx.accounts.merkle_tree.to_account_info(),
        &ctx.accounts.authority,
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
