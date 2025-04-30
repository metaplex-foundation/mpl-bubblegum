use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::Collection;

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::{LeafSchema, Version},
        TreeConfig,
    },
    traits::{MplCorePluginValidation, ValidationResult},
    utils::{
        get_asset_id, hash_collection_option, replace_leaf, Flags, DEFAULT_ASSET_DATA_HASH,
        DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct FreezeV2<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    pub payer: Signer<'info>,
    /// Optional authority, defaults to `payer`.  Must be either
    /// the leaf delegate or collection permanent freeze delegate.
    pub authority: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub core_collection: Option<UncheckedAccount<'info>>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn freeze_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, FreezeV2<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
) -> Result<()> {
    process_freeze(
        ctx,
        root,
        data_hash,
        creator_hash,
        asset_data_hash,
        flags,
        nonce,
        index,
        true,
    )
}

pub(crate) fn process_freeze<'info>(
    ctx: Context<'_, '_, '_, 'info, FreezeV2<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
    frozen: bool,
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

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx.accounts.leaf_delegate.key();

    // See if the mpl-core collection plugins approve or reject the transfer.
    let validation_result = if let Some(core_collection) = &ctx.accounts.core_collection {
        require!(
            *core_collection.owner == mpl_core::ID,
            BubblegumError::IncorrectOwner
        );

        let core_collection_data = &core_collection.data.borrow()[..];
        let collection = Collection::from_bytes(core_collection_data)?;
        if let Some(plugin) = &collection.plugin_list.permanent_freeze_delegate {
            plugin.validate_freeze(&collection, authority)?
        } else {
            ValidationResult::Abstain
        }
    } else {
        ValidationResult::Abstain
    };

    // Additional checks and set correct freeze flag.
    let flags = flags.unwrap_or(DEFAULT_FLAGS);
    let updated_flags = if validation_result == ValidationResult::ForceApproved {
        // Authority by permanent-level authority on the collection.
        set_permanent_lvl_freeze_flag(flags, frozen)
    } else {
        // If freeze not not approved by a collection plugin, then the leaf delegate can freeze
        // or unfreeze.
        require!(authority == leaf_delegate, BubblegumError::InvalidAuthority);

        set_asset_lvl_freeze_flag(flags, frozen)
    };

    // Gather info for previous leaf and new leaf.
    let merkle_tree = &ctx.accounts.merkle_tree;
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let collection_hash = hash_collection_option(
        ctx.accounts
            .core_collection
            .as_ref()
            .map(|account| *account.key),
    )?;

    let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);

    let previous_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        flags,
    );

    // New leaf only has updated flags.
    let new_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        updated_flags,
    );

    crate::utils::wrap_application_data_v1(
        Version::V2,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V2,
        &merkle_tree.key(),
        ctx.bumps.tree_authority,
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.tree_authority.to_account_info(),
        &ctx.accounts.merkle_tree.to_account_info(),
        &ctx.accounts.log_wrapper.to_account_info(),
        ctx.remaining_accounts,
        root,
        previous_leaf.to_node(),
        new_leaf.to_node(),
        index,
    )
}

fn set_permanent_lvl_freeze_flag(flags: u8, frozen: bool) -> u8 {
    let mut flags = Flags::from_bytes([flags]);
    flags.set_permanent_lvl_frozen(frozen);
    flags.into_bytes()[0]
}

pub(crate) fn set_asset_lvl_freeze_flag(flags: u8, frozen: bool) -> u8 {
    let mut flags = Flags::from_bytes([flags]);
    flags.set_asset_lvl_frozen(frozen);
    flags.into_bytes()[0]
}
