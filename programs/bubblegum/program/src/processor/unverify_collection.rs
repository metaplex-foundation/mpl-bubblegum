use anchor_lang::prelude::*;

use crate::{
    processor::{process_collection_verification, verify_collection::CollectionVerification},
    state::metaplex_adapter::MetadataArgs,
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
