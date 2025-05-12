use anchor_lang::prelude::*;
use mpl_account_compression::{program::MplAccountCompression, Noop as MplNoop};
use mpl_core::types::UpdateType;
use solana_program::{keccak, program::invoke, system_instruction};
use spl_account_compression::{program::SplAccountCompression, Noop as SplNoop};
use std::collections::HashSet;

use crate::{
    asserts::{assert_metadata_is_mpl_compatible, assert_metadata_token_standard},
    error::BubblegumError,
    processor::process_collection_verification_mpl_core_only,
    state::{
        collect::MINT_V2_FEE_LAMPORTS,
        leaf_schema::{LeafSchema, Version},
        metaplex_adapter::{MetadataArgs, MetadataArgsCommon, MetadataArgsV2},
        metaplex_anchor::MplCore,
        AssetDataSchema, TreeConfig, MPL_CORE_CPI_SIGNER_PREFIX,
    },
    utils::{
        append_leaf, get_asset_id, hash_collection_option, DEFAULT_ASSET_DATA_HASH, DEFAULT_FLAGS,
    },
};

#[derive(Accounts)]
pub struct MintV1<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is neither written to nor read from.
    pub leaf_owner: AccountInfo<'info>,
    /// CHECK: This account is neither written to nor read from.
    pub leaf_delegate: AccountInfo<'info>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    pub tree_delegate: Signer<'info>,
    pub log_wrapper: Program<'info, SplNoop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn mint_v1(ctx: Context<MintV1>, message: MetadataArgs) -> Result<LeafSchema> {
    let payer = ctx.accounts.payer.key();
    let incoming_tree_delegate = ctx.accounts.tree_delegate.key();
    let merkle_tree = &ctx.accounts.merkle_tree;

    // V1 instructions only work with V1 trees.
    let authority = &mut ctx.accounts.tree_authority;
    require!(
        authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    if !authority.is_public {
        require!(
            incoming_tree_delegate == authority.tree_creator
                || incoming_tree_delegate == authority.tree_delegate,
            BubblegumError::TreeAuthorityIncorrect,
        );
    }

    if !authority.contains_mint_capacity(1) {
        return Err(BubblegumError::InsufficientMintCapacity.into());
    }

    // Create a HashSet to store signers to use with creator validation.  Any signer can be
    // counted as a validated creator.
    let mut metadata_auth = HashSet::<Pubkey>::new();
    metadata_auth.insert(payer);
    metadata_auth.insert(incoming_tree_delegate);

    // If there are any remaining accounts that are also signers, they can also be used for
    // creator validation.
    metadata_auth.extend(
        ctx.remaining_accounts
            .iter()
            .filter(|a| a.is_signer)
            .map(|a| a.key()),
    );

    let leaf = process_mint(
        message,
        &ctx.accounts.leaf_owner,
        Some(&ctx.accounts.leaf_delegate),
        metadata_auth,
        ctx.bumps.tree_authority,
        authority,
        merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
        false,
    )?;

    authority.increment_mint_count();

    Ok(leaf)
}

#[derive(Accounts)]
pub struct MintV2<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Optional tree delegate, defaults to `payer`
    pub tree_delegate: Option<Signer<'info>>,
    /// Optional collection authority, defaults to `tree_delegate`
    pub collection_authority: Option<Signer<'info>>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is neither written to nor read from
    pub leaf_delegate: Option<UncheckedAccount<'info>>,
    /// CHECK: This account is modified in the downstream program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
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

pub(crate) fn mint_v2(
    ctx: Context<MintV2>,
    metadata_args: MetadataArgsV2,
    asset_data: Option<Vec<u8>>,
    asset_data_schema: Option<AssetDataSchema>,
) -> Result<LeafSchema> {
    if asset_data.is_some() || asset_data_schema.is_some() {
        return Err(BubblegumError::NotAvailable.into());
    }

    let tree_delegate = ctx
        .accounts
        .tree_delegate
        .as_ref()
        .map(|account| account.key())
        .unwrap_or(ctx.accounts.payer.key());

    // V2 instructions only work with V2 trees.
    let tree_authority = &mut ctx.accounts.tree_authority;
    require!(
        tree_authority.version == Version::V2,
        BubblegumError::UnsupportedSchemaVersion
    );

    if !tree_authority.is_public {
        require!(
            tree_delegate == tree_authority.tree_creator
                || tree_delegate == tree_authority.tree_delegate,
            BubblegumError::TreeAuthorityIncorrect,
        );
    }

    if !tree_authority.contains_mint_capacity(1) {
        return Err(BubblegumError::InsufficientMintCapacity.into());
    }

    // Create a HashSet to store signers to use with creator validation.  Any signer can be
    // counted as a validated creator.
    let mut metadata_auth = HashSet::<Pubkey>::new();
    metadata_auth.insert(ctx.accounts.payer.key());
    metadata_auth.insert(tree_delegate);

    // If there are any remaining accounts that are also signers, they can also be used for
    // creator validation.
    metadata_auth.extend(
        ctx.remaining_accounts
            .iter()
            .filter(|a| a.is_signer)
            .map(|a| a.key()),
    );

    match &ctx.accounts.core_collection {
        Some(core_collection_account) => {
            let collection_authority = ctx
                .accounts
                .collection_authority
                .as_ref()
                .map(|account| account.key())
                .unwrap_or(tree_delegate);

            metadata_auth.insert(collection_authority);

            let mpl_core_cpi_signer = &ctx
                .accounts
                .mpl_core_cpi_signer
                .as_ref()
                .ok_or(BubblegumError::MissingMplCoreCpiSignerAccount)?;

            process_collection_verification_mpl_core_only(
                UpdateType::Mint,
                core_collection_account,
                &collection_authority,
                mpl_core_cpi_signer,
                ctx.bumps.mpl_core_cpi_signer,
                &ctx.accounts.mpl_core_program,
                &metadata_args,
            )?;
        }
        None => {
            if metadata_args.collection.is_some() {
                return Err(BubblegumError::MissingCollectionAccount.into());
            }
        }
    }

    let leaf = process_mint(
        metadata_args,
        &ctx.accounts.leaf_owner,
        ctx.accounts.leaf_delegate.as_deref(),
        metadata_auth,
        ctx.bumps.tree_authority,
        tree_authority,
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
        true,
    )?;

    tree_authority.increment_mint_count();

    invoke(
        &system_instruction::transfer(
            ctx.accounts.payer.key,
            &ctx.accounts.tree_authority.key(),
            MINT_V2_FEE_LAMPORTS,
        ),
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.tree_authority.to_account_info(),
        ],
    )?;

    Ok(leaf)
}

pub(crate) fn process_mint<'info, T: MetadataArgsCommon>(
    message: T,
    leaf_owner: &AccountInfo<'info>,
    leaf_delegate: Option<&AccountInfo<'info>>,
    metadata_auth: HashSet<Pubkey>,
    authority_bump: u8,
    tree_authority: &mut Account<'info, TreeConfig>,
    merkle_tree: &AccountInfo<'info>,
    wrapper: &AccountInfo<'info>,
    compression_program: &AccountInfo<'info>,
    allow_verified_collection: bool,
) -> Result<LeafSchema> {
    assert_metadata_is_mpl_compatible(&message)?;

    if !allow_verified_collection && message.collection_verified() {
        return Err(BubblegumError::CollectionCannotBeVerifiedInThisInstruction.into());
    }

    assert_metadata_token_standard(&message)?;

    // @dev: seller_fee_basis points is encoded twice so that it can be passed to marketplace
    // instructions, without passing the entire, un-hashed MetadataArgs struct
    let metadata_args_hash = keccak::hashv(&[message.try_to_vec()?.as_slice()]);
    let data_hash = keccak::hashv(&[
        &metadata_args_hash.to_bytes(),
        &message.seller_fee_basis_points().to_le_bytes(),
    ]);

    // Use the metadata auth to check whether we can allow `verified` to be set to true in the
    // creator Vec.
    let creator_data = message
        .creators()
        .iter()
        .map(|c| {
            if c.verified && !metadata_auth.contains(&c.address) {
                Err(BubblegumError::CreatorDidNotVerify.into())
            } else {
                Ok([c.address.as_ref(), &[c.verified as u8], &[c.share]].concat())
            }
        })
        .collect::<Result<Vec<_>>>()?;

    // Calculate creator hash.
    let creator_hash = keccak::hashv(
        creator_data
            .iter()
            .map(|c| c.as_slice())
            .collect::<Vec<&[u8]>>()
            .as_ref(),
    );

    let asset_id = get_asset_id(&merkle_tree.key(), tree_authority.num_minted);
    let leaf_delegate = leaf_delegate.unwrap_or(leaf_owner);
    let version = message.version();
    let leaf = match version {
        Version::V1 => LeafSchema::new_v1(
            asset_id,
            leaf_owner.key(),
            leaf_delegate.key(),
            tree_authority.num_minted,
            data_hash.to_bytes(),
            creator_hash.to_bytes(),
        ),
        Version::V2 => {
            let collection_hash = hash_collection_option(message.collection_key())?;

            LeafSchema::new_v2(
                asset_id,
                leaf_owner.key(),
                leaf_delegate.key(),
                tree_authority.num_minted,
                data_hash.to_bytes(),
                creator_hash.to_bytes(),
                collection_hash,
                DEFAULT_ASSET_DATA_HASH,
                DEFAULT_FLAGS,
            )
        }
    };

    crate::utils::wrap_application_data_v1(version, leaf.to_event().try_to_vec()?, wrapper)?;

    append_leaf(
        version,
        &merkle_tree.key(),
        authority_bump,
        &compression_program.to_account_info(),
        &tree_authority.to_account_info(),
        &merkle_tree.to_account_info(),
        &wrapper.to_account_info(),
        leaf.to_node(),
    )?;

    Ok(leaf)
}
