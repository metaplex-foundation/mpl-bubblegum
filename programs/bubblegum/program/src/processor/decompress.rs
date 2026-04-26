use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::{
    instructions::{CreateV2CpiBuilder, UpdateCollectionInfoV1CpiBuilder},
    types::{
        Creator as MplCoreCreator, DataState, Plugin, PluginAuthority, PluginAuthorityPair,
        Royalties, RuleSet, UpdateType,
    },
    Collection as MplCoreCollection,
};
use mpl_token_metadata::{
    instructions::{CreateMasterEditionV3CpiBuilder, CreateMetadataAccountV3CpiBuilder},
    types::DataV2,
};
use solana_program::{
    program::{invoke, invoke_signed},
    program_pack::Pack,
    system_instruction,
};
use spl_account_compression::{Node, Noop as SplNoop};
use spl_token::state::Mint;

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::{LeafSchema, Version},
        metaplex_adapter::{MetadataArgs, MetadataArgsV2, TokenProgramVersion},
        metaplex_anchor::{MplCore, MplTokenMetadata},
        TreeConfig, Voucher, ASSET_PREFIX, MPL_CORE_CPI_SIGNER_PREFIX, VOUCHER_PREFIX,
    },
    utils::{
        cmp_bytes, cmp_pubkeys, get_asset_id, hash_collection_option, hash_metadata, replace_leaf,
        Flags, DEFAULT_ASSET_DATA_HASH, DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct DecompressV1<'info> {
    #[account(
        mut,
        close = leaf_owner,
        seeds = [
            VOUCHER_PREFIX.as_ref(),
            voucher.merkle_tree.as_ref(),
            voucher.leaf_schema.nonce().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub voucher: Box<Account<'info, Voucher>>,
    #[account(mut)]
    pub leaf_owner: Signer<'info>,
    /// CHECK: versioning is handled in the instruction
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,
    /// CHECK: versioning is handled in the instruction
    #[account(
        mut,
        seeds = [
            ASSET_PREFIX.as_ref(),
            voucher.merkle_tree.as_ref(),
            voucher.leaf_schema.nonce().to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub mint: UncheckedAccount<'info>,
    /// CHECK:
    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: Initialized in Token Metadata Program
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub sysvar_rent: Sysvar<'info, Rent>,
    /// CHECK:
    pub token_metadata_program: Program<'info, MplTokenMetadata>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub log_wrapper: Program<'info, SplNoop>,
}

pub(crate) fn decompress_v1(ctx: Context<DecompressV1>, metadata: MetadataArgs) -> Result<()> {
    // Validate the incoming metadata
    let incoming_data_hash = hash_metadata(&metadata)?;
    if !cmp_bytes(
        &ctx.accounts.voucher.leaf_schema.data_hash(),
        &incoming_data_hash,
        32,
    ) {
        return Err(BubblegumError::HashingMismatch.into());
    }
    if !cmp_pubkeys(
        &ctx.accounts.voucher.leaf_schema.owner(),
        ctx.accounts.leaf_owner.key,
    ) {
        return Err(BubblegumError::AssetOwnerMismatch.into());
    }

    let voucher = &ctx.accounts.voucher;
    match metadata.token_program_version {
        TokenProgramVersion::Original => {
            if ctx.accounts.mint.data_is_empty() {
                invoke_signed(
                    &system_instruction::create_account(
                        &ctx.accounts.leaf_owner.key(),
                        &ctx.accounts.mint.key(),
                        Rent::get()?.minimum_balance(Mint::LEN),
                        Mint::LEN as u64,
                        &spl_token::id(),
                    ),
                    &[
                        ctx.accounts.leaf_owner.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[
                        ASSET_PREFIX.as_bytes(),
                        voucher.merkle_tree.key().as_ref(),
                        voucher.leaf_schema.nonce().to_le_bytes().as_ref(),
                        &[ctx.bumps.mint],
                    ]],
                )?;
                invoke(
                    &spl_token::instruction::initialize_mint2(
                        &spl_token::id(),
                        &ctx.accounts.mint.key(),
                        &ctx.accounts.mint_authority.key(),
                        Some(&ctx.accounts.mint_authority.key()),
                        0,
                    )?,
                    &[
                        ctx.accounts.token_program.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                    ],
                )?;
            }
            if ctx.accounts.token_account.data_is_empty() {
                invoke(
                    &spl_associated_token_account::instruction::create_associated_token_account(
                        &ctx.accounts.leaf_owner.key(),
                        &ctx.accounts.leaf_owner.key(),
                        &ctx.accounts.mint.key(),
                        &spl_token::ID,
                    ),
                    &[
                        ctx.accounts.leaf_owner.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                        ctx.accounts.token_account.to_account_info(),
                        ctx.accounts.token_program.to_account_info(),
                        ctx.accounts.associated_token_program.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                        ctx.accounts.sysvar_rent.to_account_info(),
                    ],
                )?;
            }
            // SPL token will check that the associated token account is initialized, that it
            // has the correct owner, and that the mint (which is a PDA of this program)
            // matches.

            invoke_signed(
                &spl_token::instruction::mint_to(
                    &spl_token::id(),
                    &ctx.accounts.mint.key(),
                    &ctx.accounts.token_account.key(),
                    &ctx.accounts.mint_authority.key(),
                    &[],
                    1,
                )?,
                &[
                    ctx.accounts.mint.to_account_info(),
                    ctx.accounts.token_account.to_account_info(),
                    ctx.accounts.mint_authority.to_account_info(),
                    ctx.accounts.token_program.to_account_info(),
                ],
                &[&[
                    ctx.accounts.mint.key().as_ref(),
                    &[ctx.bumps.mint_authority],
                ]],
            )?;
        }
        TokenProgramVersion::Token2022 => return Err(ProgramError::InvalidArgument.into()),
    }

    invoke_signed(
        &system_instruction::assign(&ctx.accounts.mint_authority.key(), &crate::id()),
        &[ctx.accounts.mint_authority.to_account_info()],
        &[&[
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.mint_authority],
        ]],
    )?;

    msg!("Creating metadata");
    CreateMetadataAccountV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(&ctx.accounts.metadata)
        .mint(&ctx.accounts.mint)
        .mint_authority(&ctx.accounts.mint_authority)
        .payer(&ctx.accounts.leaf_owner)
        .update_authority(&ctx.accounts.mint_authority, true)
        .system_program(&ctx.accounts.system_program)
        .data(DataV2 {
            name: metadata.name.clone(),
            symbol: metadata.symbol.clone(),
            uri: metadata.uri.clone(),
            creators: if metadata.creators.is_empty() {
                None
            } else {
                Some(metadata.creators.iter().map(|c| c.adapt()).collect())
            },
            collection: metadata.collection.map(|c| c.adapt()),
            seller_fee_basis_points: metadata.seller_fee_basis_points,
            uses: metadata.uses.map(|u| u.adapt()),
        })
        .is_mutable(metadata.is_mutable)
        .invoke_signed(&[&[
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.mint_authority],
        ]])?;

    msg!("Creating master edition");
    CreateMasterEditionV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .edition(&ctx.accounts.master_edition)
        .mint(&ctx.accounts.mint)
        .mint_authority(&ctx.accounts.mint_authority)
        .update_authority(&ctx.accounts.mint_authority)
        .metadata(&ctx.accounts.metadata)
        .payer(&ctx.accounts.leaf_owner)
        .system_program(&ctx.accounts.system_program)
        .token_program(&ctx.accounts.token_program)
        .max_supply(0)
        .invoke_signed(&[&[
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.mint_authority],
        ]])?;

    ctx.accounts
        .mint_authority
        .to_account_info()
        .assign(&System::id());

    Ok(())
}

#[derive(Accounts)]
pub struct DecompressV2<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Optional leaf authority, defaults to `payer`. Must be either the leaf owner
    /// or the leaf delegate.
    pub leaf_authority: Option<Signer<'info>>,
    /// CHECK: This account is checked in the instruction. Becomes the owner of the
    /// new MPL Core asset.
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction. Defaults to `leaf_owner`.
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is modified in the downstream program.
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// The new MPL Core asset account that will be initialized.
    /// CHECK: Verified by mpl-core during the create CPI; must be a fresh signer.
    #[account(mut)]
    pub new_asset: Signer<'info>,
    /// The MPL Core collection that the compressed asset belonged to. Required
    /// because v2 leaves with a collection can only be decompressed back into the
    /// same collection. Must have the BubblegumV2 plugin.
    /// CHECK: Verified in the instruction.
    #[account(mut, owner = mpl_core_program.key())]
    pub core_collection: UncheckedAccount<'info>,
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

pub(crate) fn decompress_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, DecompressV2<'info>>,
    root: [u8; 32],
    nonce: u64,
    index: u32,
    metadata: MetadataArgsV2,
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
) -> Result<()> {
    // V2 instructions only work with V2 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    // The leaf must reference a Core collection: decompression must land in that
    // same collection (we cannot synthesize an mpl-core asset that belongs to no
    // collection because the BubblegumV2 plugin authorization flows through the
    // collection).
    let metadata_collection = metadata
        .collection
        .ok_or(BubblegumError::CollectionNotFound)?;
    if metadata_collection != ctx.accounts.core_collection.key() {
        return Err(BubblegumError::CollectionMismatch.into());
    }

    let leaf_authority = ctx
        .accounts
        .leaf_authority
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    let leaf_owner = ctx.accounts.leaf_owner.key();
    let leaf_delegate = ctx
        .accounts
        .leaf_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(leaf_owner);

    // Decompression must be initiated by either the leaf owner or leaf delegate.
    require!(
        leaf_authority == leaf_owner || leaf_authority == leaf_delegate,
        BubblegumError::InvalidAuthority
    );

    let raw_flags = flags.unwrap_or(DEFAULT_FLAGS);
    let parsed_flags = Flags::from_bytes([raw_flags]);

    // A frozen or permanent-frozen leaf cannot be decompressed: the caller must
    // thaw first so the resulting Core asset's frozen state is unambiguous.
    if parsed_flags.asset_lvl_frozen() || parsed_flags.permanent_lvl_frozen() {
        return Err(BubblegumError::AssetIsFrozen.into());
    }

    // Hash the user-supplied metadata and reconstruct the leaf so we can prove it
    // exists in the tree before burning it.
    let data_hash = hash_metadata(&metadata)?;
    let creator_hash = crate::utils::hash_creators(&metadata.creators)?;
    let collection_hash = hash_collection_option(Some(metadata_collection))?;
    let asset_data_hash = asset_data_hash.unwrap_or(DEFAULT_ASSET_DATA_HASH);

    let merkle_tree = &ctx.accounts.merkle_tree;
    let asset_id = get_asset_id(&merkle_tree.key(), nonce);
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

    // Burn the leaf in the tree before materializing the Core asset.
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
        Node::default(),
        index,
    )?;

    // Sanity-check the collection has the BubblegumV2 plugin so we know mpl-core
    // is going to authorize our cpi-signer below.
    {
        let core_collection_data = &ctx.accounts.core_collection.data.borrow()[..];
        let collection = MplCoreCollection::from_bytes(core_collection_data)?;
        if collection.plugin_list.bubblegum_v2.is_none() {
            return Err(BubblegumError::CollectionMustHaveBubblegumPlugin.into());
        }
    }

    // Build the plugin list for the new asset. Collection-level plugins
    // (PermanentBurnDelegate, PermanentFreezeDelegate, Royalties on the
    // collection, etc.) are inherited automatically by mpl-core, so we only
    // add asset-level plugins for things that vary per-leaf:
    //   * royalties / creators (always emitted so creator splits survive
    //     decompression even if the collection has no Royalties plugin)
    let mut plugins: Vec<PluginAuthorityPair> = Vec::new();

    if !metadata.creators.is_empty() {
        let creators = metadata
            .creators
            .iter()
            .map(|c| MplCoreCreator {
                address: c.address,
                percentage: c.share,
            })
            .collect::<Vec<_>>();

        plugins.push(PluginAuthorityPair {
            plugin: Plugin::Royalties(Royalties {
                basis_points: metadata.seller_fee_basis_points,
                creators,
                rule_set: RuleSet::None,
            }),
            authority: Some(PluginAuthority::UpdateAuthority),
        });
    }

    // Decrement the compressed-asset counter on the collection. The matching
    // increment for the materialized Core asset happens inside CreateV2 itself.
    UpdateCollectionInfoV1CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .collection(&ctx.accounts.core_collection)
        .bubblegum_signer(&ctx.accounts.mpl_core_cpi_signer)
        .update_type(UpdateType::Remove)
        .amount(1)
        .invoke_signed(&[&[
            MPL_CORE_CPI_SIGNER_PREFIX.as_bytes(),
            &[ctx.bumps.mpl_core_cpi_signer],
        ]])?;

    // Materialize the Core asset inside the same collection. The bubblegum cpi
    // signer is passed as the `authority` so collections gated by the
    // BubblegumV2 plugin can authorize the create. NOTE: requires a matching
    // mpl-core change that recognizes the bubblegum cpi signer for CreateV2 on
    // a BubblegumV2-plugged collection (see PR description).
    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
        .asset(&ctx.accounts.new_asset)
        .collection(Some(&ctx.accounts.core_collection))
        .authority(Some(&ctx.accounts.mpl_core_cpi_signer))
        .payer(&ctx.accounts.payer)
        .owner(Some(&ctx.accounts.leaf_owner))
        .system_program(&ctx.accounts.system_program)
        .log_wrapper(Some(&ctx.accounts.log_wrapper))
        .data_state(DataState::AccountState)
        .name(metadata.name.clone())
        .uri(metadata.uri.clone())
        .plugins(plugins)
        .invoke_signed(&[&[
            MPL_CORE_CPI_SIGNER_PREFIX.as_bytes(),
            &[ctx.bumps.mpl_core_cpi_signer],
        ]])?;

    // Emit a leaf event for indexers (the leaf is now empty in the tree, but
    // downstream consumers want to associate the burn with the original asset
    // id and the new core asset key).
    crate::utils::wrap_application_data_v1(
        Version::V2,
        previous_leaf.to_event().try_to_vec()?,
        &ctx.accounts.log_wrapper,
    )?;

    Ok(())
}
