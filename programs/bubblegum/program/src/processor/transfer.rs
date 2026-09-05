use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::Collection;
use solana_program::{program::invoke, system_instruction};

use crate::{
    error::BubblegumError,
    state::{
        collect::TRANSFER_V2_FEE_LAMPORTS,
        leaf_schema::{LeafSchema, Version},
        TreeConfig,
    },
    traits::{MplCorePluginValidation, ValidationResult},
    utils::{
        get_asset_id, hash_collection_option, replace_leaf, validate_ownership_and_programs, Flags,
        DEFAULT_ASSET_DATA_HASH, DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    /// CHECK: This account is neither written to nor read from.
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from.
    pub new_leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn transfer_v1<'info>(
    ctx: Context<'_, '_, '_, 'info, Transfer<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
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

    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let leaf_owner = ctx.accounts.leaf_owner.to_account_info();
    let leaf_delegate = ctx.accounts.leaf_delegate.to_account_info();

    // Transfers must be initiated by either the leaf owner or leaf delegate.
    require!(
        leaf_owner.is_signer || leaf_delegate.is_signer,
        BubblegumError::LeafAuthorityMustSign
    );
    let new_owner = ctx.accounts.new_leaf_owner.key();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
    let previous_leaf = LeafSchema::new_v1(
        asset_id,
        leaf_owner.key(),
        leaf_delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );

    // New leaves are instantiated with no delegate.
    let new_leaf = LeafSchema::new_v1(
        asset_id,
        new_owner,
        new_owner,
        nonce,
        data_hash,
        creator_hash,
    );

    crate::utils::wrap_application_data_v1(
        Version::V1,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    replace_leaf(
        Version::V1,
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

#[derive(Accounts)]
pub struct TransferV2<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Optional authority, defaults to `payer`.  Must be either
    /// the leaf owner or collection permanent transfer delegate.
    pub authority: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    /// Defaults to `leaf_owner`
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is neither written to nor read from.
    pub new_leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub core_collection: Option<UncheckedAccount<'info>>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn transfer_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, TransferV2<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
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

    // See if the mpl-core collection plugins approve or reject the transfer.
    let validation_result = if let Some(core_collection) = &ctx.accounts.core_collection {
        require!(
            *core_collection.owner == mpl_core::ID,
            BubblegumError::IncorrectOwner
        );

        let core_collection_data = &core_collection.data.borrow()[..];
        let collection = Collection::from_bytes(core_collection_data)?;
        mpl_core_collection_validate_transfer(
            &collection,
            authority,
            &ctx.accounts.leaf_owner,
            &ctx.accounts.new_leaf_owner,
        )?
    } else {
        ValidationResult::Abstain
    };

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(leaf_owner);

    let raw_flags = flags.unwrap_or(DEFAULT_FLAGS);
    let flags = Flags::from_bytes([raw_flags]);

    // If transfer not not approved by a collection plugin, then require either
    // the leaf owner or leaf delegate to approve.
    if validation_result != ValidationResult::ForceApproved {
        require!(
            authority == leaf_owner || authority == leaf_delegate,
            BubblegumError::InvalidAuthority
        );

        // Ensure asset is not frozen.  Note this is skipped if the permanent transfer delegate
        // force approved.
        asset_validate_non_frozen(flags)?;
    }

    // Ensure asset is transferable.
    asset_validate_transferable(flags)?;

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
    let new_leaf_owner = ctx.accounts.new_leaf_owner.key();

    let previous_leaf = LeafSchema::new_v2(
        asset_id,
        leaf_owner,
        leaf_delegate,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        raw_flags,
    );

    // New leaves are instantiated with no delegate.
    let new_leaf = LeafSchema::new_v2(
        asset_id,
        new_leaf_owner,
        new_leaf_owner,
        nonce,
        data_hash,
        creator_hash,
        collection_hash,
        asset_data_hash,
        raw_flags,
    );

    crate::utils::wrap_application_data_v1(
        Version::V2,
        new_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    invoke(
        &system_instruction::transfer(
            ctx.accounts.payer.key,
            &ctx.accounts.tree_authority.key(),
            TRANSFER_V2_FEE_LAMPORTS,
        ),
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.tree_authority.to_account_info(),
        ],
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

fn mpl_core_collection_validate_transfer<'info>(
    collection: &Collection,
    authority: Pubkey,
    leaf_owner: &AccountInfo<'info>,
    new_leaf_owner: &AccountInfo<'info>,
) -> Result<ValidationResult> {
    // Permanent Transfer Delegate can force approve.
    if let Some(plugin) = &collection.plugin_list.permanent_transfer_delegate {
        if plugin.validate_transfer(collection, authority, leaf_owner, new_leaf_owner)?
            == ValidationResult::ForceApproved
        {
            return Ok(ValidationResult::ForceApproved);
        }
    }

    // Fail if Royalties rejects the transfer.
    if let Some(plugin) = &collection.plugin_list.royalties {
        if plugin.validate_transfer(collection, authority, leaf_owner, new_leaf_owner)?
            == ValidationResult::Rejected
        {
            return Err(BubblegumError::InvalidAuthority.into());
        }
    }

    // Fail if collection is frozen.
    if let Some(plugin) = &collection.plugin_list.permanent_freeze_delegate {
        if plugin.validate_transfer(collection, authority, leaf_owner, new_leaf_owner)?
            == ValidationResult::Rejected
        {
            return Err(BubblegumError::CollectionIsFrozen.into());
        }
    }

    Ok(ValidationResult::Abstain)
}

fn asset_validate_non_frozen(flags: Flags) -> Result<()> {
    if flags.asset_lvl_frozen() || flags.permanent_lvl_frozen() {
        return Err(BubblegumError::AssetIsFrozen.into());
    }

    Ok(())
}

fn asset_validate_transferable(flags: Flags) -> Result<()> {
    if flags.non_transferable() {
        return Err(BubblegumError::AssetIsNonTransferable.into());
    }

    Ok(())
}
