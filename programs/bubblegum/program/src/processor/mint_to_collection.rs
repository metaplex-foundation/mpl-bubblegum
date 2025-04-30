use std::collections::HashSet;

use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::{
    error::BubblegumError,
    processor::{mint::process_mint, process_collection_verification_mpl_only},
    state::{
        leaf_schema::{LeafSchema, Version},
        metaplex_adapter::MetadataArgs,
        metaplex_anchor::TokenMetadata,
        TreeConfig,
    },
};

#[derive(Accounts)]
pub struct MintToCollectionV1<'info> {
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
    pub collection_authority: Signer<'info>,
    /// CHECK: Optional collection authority record PDA.
    /// If there is no collecton authority record PDA then
    /// this must be the Bubblegum program address.
    pub collection_authority_record_pda: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub collection_mint: UncheckedAccount<'info>,
    #[account(mut)]
    pub collection_metadata: Box<Account<'info, TokenMetadata>>,
    /// CHECK: This account is checked in the instruction
    pub edition_account: UncheckedAccount<'info>,
    /// CHECK: This is no longer needed but kept for backwards compatibility.
    pub bubblegum_signer: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    /// CHECK: This is no longer needed but kept for backwards compatibility.
    pub token_metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn mint_to_collection_v1(
    ctx: Context<MintToCollectionV1>,
    metadata_args: MetadataArgs,
) -> Result<LeafSchema> {
    // V1 instructions only work with V1 trees.
    require!(
        ctx.accounts.tree_authority.version == Version::V1,
        BubblegumError::UnsupportedSchemaVersion
    );

    let mut message = metadata_args;
    let payer = ctx.accounts.payer.key();
    let incoming_tree_delegate = ctx.accounts.tree_delegate.key();
    let authority = &mut ctx.accounts.tree_authority;
    let merkle_tree = &ctx.accounts.merkle_tree;

    let collection_metadata = &ctx.accounts.collection_metadata;
    let collection_mint = ctx.accounts.collection_mint.to_account_info();
    let edition_account = ctx.accounts.edition_account.to_account_info();
    let collection_authority = ctx.accounts.collection_authority.to_account_info();
    let collection_authority_record_pda = ctx
        .accounts
        .collection_authority_record_pda
        .to_account_info();

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

    let collection = message
        .collection
        .as_mut()
        .ok_or(BubblegumError::CollectionNotFound)?;

    collection.verified = true;

    process_collection_verification_mpl_only(
        collection_metadata,
        &collection_mint,
        &collection_authority,
        &collection_authority_record_pda,
        &edition_account,
        collection,
    )?;

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
        true,
    )?;

    authority.increment_mint_count();

    Ok(leaf)
}
