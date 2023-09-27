use anchor_lang::prelude::*;

use crate::{
    processor::{process_creator_verification, verify_creator::CreatorVerification},
    state::metaplex_adapter::MetadataArgs,
};

pub(crate) fn unverify_creator<'info>(
    ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    message: MetadataArgs,
) -> Result<()> {
    process_creator_verification(
        ctx,
        root,
        data_hash,
        creator_hash,
        nonce,
        index,
        message,
        false,
    )
}
