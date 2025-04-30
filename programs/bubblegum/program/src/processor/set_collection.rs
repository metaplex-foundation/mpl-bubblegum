use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::types::UpdateType;

use crate::{
    error::BubblegumError,
    processor::process_collection_verification_mpl_core_only,
    state::{
        leaf_schema::{LeafSchema, Version},
        metaplex_adapter::MetadataArgsV2,
        metaplex_anchor::MplCore,
        TreeConfig, MPL_CORE_CPI_SIGNER_PREFIX,
    },
    utils::{
        get_asset_id, hash_collection_option, hash_creators, hash_metadata, replace_leaf,
        DEFAULT_ASSET_DATA_HASH, DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct SetCollectionV2<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    pub payer: Signer<'info>,
    /// If item is not in a collection, then authority must be tree owner/delegate.  If item is
    /// getting removed from a collection, then this must be an authority for the existing
    /// collection.  Defaults to `payer`
    pub authority: Option<Signer<'info>>,
    /// If item is getting added to a new collection, then this must be the authority
    /// for the new collection.  Defaults to `authority`
    pub new_collection_authority: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    /// Defaults to `leaf_owner`
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    #[account(mut, owner = mpl_core_program.key())]
    pub core_collection: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is checked in the instruction
    #[account(mut, owner = mpl_core_program.key())]
    pub new_core_collection: Option<UncheckedAccount<'info>>,
    /// CHECK: This is just used as a signing PDA.
    #[account(
        seeds = [MPL_CORE_CPI_SIGNER_PREFIX.as_ref()],
        bump,
    )]
    pub mpl_core_cpi_signer: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub mpl_core_program: Program<'info, MplCore>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn set_collection_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, SetCollectionV2<'info>>,
    root: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
    message: MetadataArgsV2,
) -> Result<()> {
    // V2 instructions only work with V2 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    // Do not add to collection if already in collection, or remove from collection
    // if already not in a collection.
    match (message.collection, &ctx.accounts.new_core_collection) {
        (Some(existing_collection), Some(new_collection)) => {
            if existing_collection == new_collection.key() {
                return Err(BubblegumError::AlreadyInCollection.into());
            }
        }
        (None, None) => {
            return Err(BubblegumError::AlreadyNotInCollection.into());
        }
        _ => {}
    }

    let authority = ctx
        .accounts
        .authority
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    // If there is an existing collection, it must authorize removing it from the collection.
    if let Some(existing_core_collection_account) = &ctx.accounts.core_collection {
        process_collection_verification_mpl_core_only(
            UpdateType::Remove,
            existing_core_collection_account,
            &authority,
            &ctx.accounts.mpl_core_cpi_signer,
            ctx.bumps.mpl_core_cpi_signer,
            &ctx.accounts.mpl_core_program,
            &message,
        )?;
    } else {
        // If there's no existing collection, the tree creator or tree delegate must sign.
        require!(
            authority == ctx.accounts.tree_authority.tree_creator
                || authority == ctx.accounts.tree_authority.tree_delegate,
            BubblegumError::TreeAuthorityIncorrect,
        );
    }

    let previous_data_hash = hash_metadata(&message)?;
    let creator_hash = hash_creators(&message.creators)?;

    // Determine new collection value.
    let updated_message = {
        let mut updated_message = message;

        // If there's a new collection, its authority must authorize adding it to the collection.
        if let Some(new_core_collection_account) = &ctx.accounts.new_core_collection {
            let new_collection_authority = ctx
                .accounts
                .new_collection_authority
                .as_ref()
                .map(|account| account.key())
                .unwrap_or(authority);

            updated_message.collection = Some(new_core_collection_account.key());

            process_collection_verification_mpl_core_only(
                UpdateType::Add,
                new_core_collection_account,
                &new_collection_authority,
                &ctx.accounts.mpl_core_cpi_signer,
                ctx.bumps.mpl_core_cpi_signer,
                &ctx.accounts.mpl_core_program,
                &updated_message,
            )?;
        } else {
            updated_message.collection = None;
        }

        updated_message
    };

    // Gather info for previous leaf and new leaf.
    let merkle_tree = &ctx.accounts.merkle_tree;
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(leaf_owner);

    let updated_data_hash = hash_metadata(&updated_message)?;

    let previous_collection_hash = hash_collection_option(
        ctx.accounts
            .core_collection
            .as_ref()
            .map(|account| *account.key),
    )?;

    let new_collection_hash = hash_collection_option(
        ctx.accounts
            .new_core_collection
            .as_ref()
            .map(|account| *account.key),
    )?;

    let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);
    let flags = flags.unwrap_or(DEFAULT_FLAGS);

    let previous_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        previous_data_hash,
        creator_hash,
        previous_collection_hash,
        asset_data_hash,
        flags,
    );

    let new_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        updated_data_hash,
        creator_hash,
        new_collection_hash,
        asset_data_hash,
        flags,
    );

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
