use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::{
    instructions::UpdateCollectionInfoV1CpiBuilder, types::UpdateType,
    Collection as MplCoreCollection,
};
use spl_account_compression::{program::SplAccountCompression, Node, Noop as SplNoop};

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::{LeafSchema, Version},
        metaplex_anchor::MplCore,
        TreeConfig, MPL_CORE_CPI_SIGNER_PREFIX,
    },
    traits::{MplCorePluginValidation, ValidationResult},
    utils::{
        get_asset_id, hash_collection_option, replace_leaf, Flags, DEFAULT_ASSET_DATA_HASH,
        DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct Burn<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, SplNoop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn burn_v1<'info>(
    ctx: Context<'_, '_, '_, 'info, Burn<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
) -> Result<()> {
    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    let owner = ctx.accounts.leaf_owner.to_account_info();
    let delegate = ctx.accounts.leaf_delegate.to_account_info();

    // Burn must be initiated by either the leaf owner or leaf delegate.
    require!(
        owner.is_signer || delegate.is_signer,
        BubblegumError::LeafAuthorityMustSign
    );
    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);

    let previous_leaf = LeafSchema::new_v1(
        asset_id,
        owner.key(),
        delegate.key(),
        nonce,
        data_hash,
        creator_hash,
    );

    let new_leaf = Node::default();

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
        new_leaf,
        index,
    )
}

#[derive(Accounts)]
pub struct BurnV2<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// Authority must be either the leaf owner or collection
    /// permanent burn delegate.
    pub authority: Signer<'info>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    /// Defaults to `leaf_owner`
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    #[account(mut)]
    /// CHECK: This account is modified in the downstream program
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(mut, owner = mpl_core_program.key())]
    pub core_collection: Option<UncheckedAccount<'info>>,
    /// CHECK: This is just used as a signing PDA.
    #[account(
        seeds = [MPL_CORE_CPI_SIGNER_PREFIX.as_ref()],
        bump,
    )]
    pub mpl_core_cpi_signer: Option<UncheckedAccount<'info>>,
    pub log_wrapper: Program<'info, MplNoop>,
    pub compression_program: Program<'info, MplAccountCompression>,
    pub mpl_core_program: Program<'info, MplCore>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn burn_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, BurnV2<'info>>,
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

    let authority = ctx.accounts.authority.key();
    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(leaf_owner);

    let validation_result = if let Some(core_collection) = &ctx.accounts.core_collection {
        let mpl_core_cpi_signer = &ctx
            .accounts
            .mpl_core_cpi_signer
            .as_ref()
            .ok_or(BubblegumError::MissingMplCoreCpiSignerAccount)?;

        // Update collection info.
        UpdateCollectionInfoV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .collection(core_collection)
            .bubblegum_signer(mpl_core_cpi_signer)
            .update_type(UpdateType::Remove)
            .amount(1)
            .invoke_signed(&[&[
                MPL_CORE_CPI_SIGNER_PREFIX.as_bytes(),
                &[ctx.bumps.mpl_core_cpi_signer],
            ]])?;

        let core_collection_data = &core_collection.data.borrow()[..];
        let collection = MplCoreCollection::from_bytes(core_collection_data)?;
        mpl_core_collection_validate_burn(&collection, authority, leaf_owner)?
    } else {
        ValidationResult::Abstain
    };

    let raw_flags = flags.unwrap_or(DEFAULT_FLAGS);
    let flags = Flags::from_bytes([raw_flags]);

    // If burn not force approved, then require either the leaf owner or leaf delegate to approve.
    if validation_result != ValidationResult::ForceApproved {
        require!(
            authority == leaf_owner || authority == leaf_delegate,
            BubblegumError::InvalidAuthority
        );

        // Ensure asset is not frozen.  Note this is skipped if the permanent burn delegate force
        // approved.
        asset_validate_non_frozen(flags)?;
    }

    let collection_hash = hash_collection_option(
        ctx.accounts
            .core_collection
            .as_ref()
            .map(|account| *account.key),
    )?;

    // Gather info for previous leaf and new leaf.
    let merkle_tree = &ctx.accounts.merkle_tree;
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
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
        raw_flags,
    );

    let new_leaf = Node::default();

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
        new_leaf,
        index,
    )
}

fn mpl_core_collection_validate_burn(
    collection: &MplCoreCollection,
    authority: Pubkey,
    leaf_owner: Pubkey,
) -> Result<ValidationResult> {
    // Permanent Burn Delegate can force approve.
    if let Some(plugin) = &collection.plugin_list.permanent_burn_delegate {
        if plugin.validate_burn(collection, authority, leaf_owner)?
            == ValidationResult::ForceApproved
        {
            return Ok(ValidationResult::ForceApproved);
        }
    }

    // Fail if collection is frozen.
    if let Some(plugin) = &collection.plugin_list.permanent_freeze_delegate {
        if plugin.validate_burn(collection, authority, leaf_owner)? == ValidationResult::Rejected {
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
