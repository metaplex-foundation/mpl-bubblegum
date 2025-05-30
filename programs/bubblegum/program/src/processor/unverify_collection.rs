use anchor_lang::prelude::*;

use crate::{
    processor::{process_collection_verification, verify_collection::CollectionVerification},
    state::metaplex_adapter::MetadataArgs,
    utils::validate_ownership_and_programs,
};

pub(crate) fn unverify_collection<'info>(
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
        false,
        None,
    )
}
