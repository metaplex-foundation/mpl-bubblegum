use anchor_lang::prelude::*;
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::state::{
    metaplex_adapter::MetadataArgs,
    metaplex_anchor::{MplTokenMetadata, TokenMetadata},
    TreeConfig, COLLECTION_CPI_PREFIX,
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
    /// CHECK: This is just used as a signing PDA.
    #[account(
        seeds = [COLLECTION_CPI_PREFIX.as_ref()],
        bump,
    )]
    pub bubblegum_signer: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub token_metadata_program: Program<'info, MplTokenMetadata>,
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
