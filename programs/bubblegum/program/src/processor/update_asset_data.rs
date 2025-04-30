use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::Collection as MplCoreCollection;

use crate::{
    error::BubblegumError,
    processor::mpl_core_collection_validate_update,
    state::{
        leaf_schema::{LeafSchema, Version},
        AssetDataSchema, TreeConfig,
    },
    traits::ValidationResult,
    utils::{
        get_asset_id, hash_asset_data_option, hash_collection_option, replace_leaf,
        DEFAULT_ASSET_DATA_HASH, DEFAULT_FLAGS,
    },
};

pub const ASSET_DATA_FEATURE_ACTIVATED: bool = false;

pub const MAX_ASSET_DATA_LEN: usize = 128;

#[derive(Accounts)]
pub struct UpdateAssetDataV2<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    pub payer: Signer<'info>,
    /// Either collection authority or tree owner/delegate, depending on
    /// whether the item is in a verified collection.  Defaults to `payer`
    pub authority: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
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

pub fn update_asset_data_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateAssetDataV2<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    previous_asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
    new_asset_data: Option<Vec<u8>>,
    _new_asset_data_schema: Option<AssetDataSchema>,
) -> Result<()> {
    if !ASSET_DATA_FEATURE_ACTIVATED {
        return Err(BubblegumError::NotAvailable.into());
    }

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

    // Check asset data length.
    if new_asset_data
        .as_ref()
        .map_or(false, |v| v.len() > MAX_ASSET_DATA_LEN)
    {
        return Err(BubblegumError::AssetDataLengthTooLong.into());
    }

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

    let collection_hash = hash_collection_option(
        ctx.accounts
            .core_collection
            .as_ref()
            .map(|account| *account.key),
    )?;

    let previous_asset_data_hash = previous_asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);
    let new_asset_data_hash = hash_asset_data_option(new_asset_data.as_deref())?;
    let flags = flags.unwrap_or(DEFAULT_FLAGS);

    let previous_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        previous_asset_data_hash,
        flags,
    );

    let new_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        new_asset_data_hash,
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
