use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::Collection as MplCoreCollection;
use mpl_token_metadata::types::MetadataDelegateRole;

use crate::{
    asserts::{assert_has_collection_authority, assert_metadata_is_mpl_compatible},
    error::BubblegumError,
    processor::mpl_core_collection_validate_update,
    state::{
        leaf_schema::{LeafSchema, Version},
        metaplex_adapter::{
            Collection as MetaplexAdapterCollection, Creator, MetadataArgs, MetadataArgsCommon,
            MetadataArgsV2, UpdateArgs,
        },
        metaplex_anchor::TokenMetadata,
        TreeConfig,
    },
    traits::ValidationResult,
    utils::{
        get_asset_id, hash_collection_option, hash_creators, hash_metadata, replace_leaf,
        validate_ownership_and_programs, DEFAULT_ASSET_DATA_HASH, DEFAULT_COLLECTION_HASH,
        DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
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
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: This is no longer needed but kept for backwards compatibility.
    pub token_metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn update_metadata<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateMetadata<'info>>,
    root: [u8; 32],
    nonce: u64,
    index: u32,
    current_metadata: MetadataArgs,
    update_args: UpdateArgs,
) -> Result<()> {
    validate_ownership_and_programs(
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    match &current_metadata.collection {
        // Verified collection case.
        Some(collection) if collection.verified => {
            let collection_mint = ctx
                .accounts
                .collection_mint
                .as_ref()
                .ok_or(BubblegumError::MissingCollectionMintAccount)?;

            let collection_metadata = ctx
                .accounts
                .collection_metadata
                .as_ref()
                .ok_or(BubblegumError::MissingCollectionMetadataAccount)?;

            assert_authority_matches_collection(
                collection,
                &ctx.accounts.authority.to_account_info(),
                &ctx.accounts.collection_authority_record_pda,
                collection_mint,
                &collection_metadata.to_account_info(),
                collection_metadata,
            )?;
        }
        // No collection or unverified collection case.
        _ => {
            require!(
                ctx.accounts.authority.key() == ctx.accounts.tree_authority.tree_creator
                    || ctx.accounts.authority.key() == ctx.accounts.tree_authority.tree_delegate,
                BubblegumError::TreeAuthorityIncorrect,
            );
        }
    }

    let (previous_leaf, new_leaf) = process_update_metadata(
        ctx.accounts.merkle_tree.key(),
        ctx.accounts.authority.key(),
        ctx.accounts.leaf_owner.key(),
        Some(ctx.accounts.leaf_delegate.key()),
        current_metadata,
        update_args,
        None,
        None,
        None,
        nonce,
    )?;

    crate::utils::wrap_application_data_v1(
        Version::V1,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V1,
        &ctx.accounts.merkle_tree.key(),
        ctx.bumps.tree_authority,
        &ctx.accounts.compression_program,
        &ctx.accounts.tree_authority.to_account_info(),
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        ctx.remaining_accounts,
        root,
        previous_leaf.to_node(),
        new_leaf.to_node(),
        index,
    )
}

#[derive(Accounts)]
pub struct UpdateMetadataV2<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Either collection authority or tree owner/delegate, depending
    /// on whether the item is in a verified collection.  Defaults to `payer`
    pub authority: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    /// Defaults to `leaf_owner`
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub core_collection: Option<UncheckedAccount<'info>>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub fn update_metadata_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateMetadataV2<'info>>,
    root: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
    current_metadata: MetadataArgsV2,
    update_args: UpdateArgs,
) -> Result<()> {
    // V2 instructions only work with V2 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    let authority = ctx
        .accounts
        .authority
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    // Validate authority.
    if let Some(core_collection) = &ctx.accounts.core_collection {
        require!(
            *core_collection.owner == mpl_core::ID,
            BubblegumError::IncorrectOwner
        );

        let core_collection_data = &core_collection.data.borrow()[..];
        let collection: Box<MplCoreCollection> =
            MplCoreCollection::from_bytes(core_collection_data)?;

        // If there's a collection, the update authority or update delegate must be the
        // authority.
        if mpl_core_collection_validate_update(&collection, authority)?
            != ValidationResult::Approved
        {
            return Err(BubblegumError::InvalidCollectionAuthority.into());
        }
    } else {
        // No collection case.
        require!(
            authority == ctx.accounts.tree_authority.tree_creator
                || authority == ctx.accounts.tree_authority.tree_delegate,
            BubblegumError::TreeAuthorityIncorrect,
        );
    }

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key());

    let collection_hash = hash_collection_option(
        ctx.accounts
            .core_collection
            .as_ref()
            .map(|account| *account.key),
    )?;

    let (previous_leaf, new_leaf) = process_update_metadata(
        ctx.accounts.merkle_tree.key(),
        authority,
        leaf_owner,
        leaf_delegate,
        current_metadata,
        update_args,
        Some(collection_hash),
        asset_data_hash,
        flags,
        nonce,
    )?;

    crate::utils::wrap_application_data_v1(
        Version::V2,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V2,
        &ctx.accounts.merkle_tree.key(),
        ctx.bumps.tree_authority,
        &ctx.accounts.compression_program,
        &ctx.accounts.tree_authority.to_account_info(),
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        ctx.remaining_accounts,
        root,
        previous_leaf.to_node(),
        new_leaf.to_node(),
        index,
    )
}

fn assert_authority_matches_collection<'info>(
    collection: &MetaplexAdapterCollection,
    collection_authority: &AccountInfo<'info>,
    collection_authority_record_pda: &Option<UncheckedAccount<'info>>,
    collection_mint: &AccountInfo<'info>,
    collection_metadata_account_info: &AccountInfo,
    collection_metadata: &TokenMetadata,
) -> Result<()> {
    // Mint account must match Collection mint
    require!(
        collection_mint.key() == collection.key,
        BubblegumError::CollectionMismatch
    );
    // Metadata mint must match Collection mint
    require!(
        collection_metadata.mint == collection.key,
        BubblegumError::CollectionMismatch
    );
    // Verify correct account ownerships.
    require!(
        *collection_metadata_account_info.owner == mpl_token_metadata::ID,
        BubblegumError::IncorrectOwner
    );
    // Collection mint must be owned by SPL token
    require!(
        *collection_mint.owner == spl_token::id(),
        BubblegumError::IncorrectOwner
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
        MetadataDelegateRole::Data,
    )?;

    Ok(())
}

fn process_update_metadata<T: MetadataArgsCommon>(
    merkle_tree: Pubkey,
    authority: Pubkey,
    leaf_owner: Pubkey,
    leaf_delegate: Option<Pubkey>,
    current_metadata: T,
    update_args: UpdateArgs,
    collection_hash: Option<[u8; 32]>,
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
) -> Result<(LeafSchema, LeafSchema)> {
    // Old metadata must be mutable to allow metadata update
    require!(
        current_metadata.is_mutable(),
        BubblegumError::MetadataImmutable
    );

    let current_data_hash = hash_metadata(&current_metadata)?;
    let current_creator_hash = hash_creators(current_metadata.creators())?;

    // Update metadata
    let mut updated_metadata = current_metadata;
    if let Some(name) = update_args.name {
        updated_metadata.set_name(name);
    };
    if let Some(symbol) = update_args.symbol {
        updated_metadata.set_symbol(symbol);
    };
    if let Some(uri) = update_args.uri {
        updated_metadata.set_uri(uri);
    };
    if let Some(updated_creators) = update_args.creators {
        let current_creators = updated_metadata.creators();

        // Make sure no new creator is verified (unless it is the tree delegate).
        let no_new_creators_verified =
            all_verified_creators_in_a_are_in_b(&updated_creators, current_creators, authority);
        require!(
            no_new_creators_verified,
            BubblegumError::CreatorDidNotVerify
        );

        // Make sure no current verified creator is unverified or removed (unless it is the tree
        // delegate).
        let no_current_creators_unverified =
            all_verified_creators_in_a_are_in_b(current_creators, &updated_creators, authority);
        require!(
            no_current_creators_unverified,
            BubblegumError::CreatorDidNotUnverify
        );

        updated_metadata.set_creators(updated_creators);
    }
    if let Some(seller_fee_basis_points) = update_args.seller_fee_basis_points {
        updated_metadata.set_seller_fee_basis_points(seller_fee_basis_points);
    }
    if let Some(primary_sale_happened) = update_args.primary_sale_happened {
        // a new value of primary_sale_happened should only be specified if primary_sale_happened was false in the original metadata
        require!(
            !updated_metadata.primary_sale_happened(),
            BubblegumError::PrimarySaleCanOnlyBeFlippedToTrue
        );
        updated_metadata.set_primary_sale_happened(primary_sale_happened);
    };
    if let Some(is_mutable) = update_args.is_mutable {
        updated_metadata.set_is_mutable(is_mutable);
    };

    assert_metadata_is_mpl_compatible(&updated_metadata)?;
    let updated_data_hash = hash_metadata(&updated_metadata)?;
    let updated_creator_hash = hash_creators(updated_metadata.creators())?;
    let asset_id = get_asset_id(&merkle_tree, nonce);
    let leaf_delegate = leaf_delegate.unwrap_or(leaf_owner);

    match updated_metadata.version() {
        Version::V1 => {
            let previous_leaf = LeafSchema::new_v1(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                current_data_hash,
                current_creator_hash,
            );
            let new_leaf = LeafSchema::new_v1(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                updated_data_hash,
                updated_creator_hash,
            );

            Ok((previous_leaf, new_leaf))
        }
        Version::V2 => {
            let collection_hash = collection_hash.unwrap_or(DEFAULT_COLLECTION_HASH);
            let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);
            let flags = flags.unwrap_or(DEFAULT_FLAGS);

            let previous_leaf = LeafSchema::new_v2(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                current_data_hash,
                current_creator_hash,
                collection_hash,
                asset_data_hash,
                flags,
            );
            let new_leaf = LeafSchema::new_v2(
                asset_id,
                leaf_owner,
                leaf_delegate,
                nonce,
                updated_data_hash,
                updated_creator_hash,
                collection_hash,
                asset_data_hash,
                flags,
            );

            Ok((previous_leaf, new_leaf))
        }
    }
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
