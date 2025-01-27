use anchor_lang::prelude::*;

use crate::{
    state::{metaplex_adapter::MetadataArgs, metaplex_anchor::TokenMetadata, TreeConfig},
    utils::validate_ownership_and_programs,
};

use super::process_collection_verification;

#[derive(Accounts)]
pub struct CollectionVerification<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is checked in the instruction
    pub leaf_owner: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub leaf_delegate: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: This account is modified in the downstream program
    pub merkle_tree: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    /// CHECK: This account is checked in the instruction
    /// This account is checked to be a signer in
    /// the case of `set_and_verify_collection` where
    /// we are actually changing the NFT metadata.
    pub tree_delegate: UncheckedAccount<'info>,
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
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
    /// CHECK: This is no longer needed but kept for backwards compatibility.
    pub token_metadata_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn verify_collection<'info>(
    ctx: Context<'_, '_, '_, 'info, CollectionVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    message: MetadataArgs,
) -> Result<()> {
    validate_ownership_and_programs(
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    process_collection_verification(
        ctx,
        root,
        data_hash,
        creator_hash,
        nonce,
        index,
        message,
        true,
        None,
    )
}
