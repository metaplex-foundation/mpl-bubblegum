use anchor_lang::prelude::*;

use crate::processor::{freeze::FreezeV2, process_freeze};

pub(crate) fn thaw_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, FreezeV2<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    asset_data_hash: Option<[u8; 32]>,
    flags: Option<u8>,
    nonce: u64,
    index: u32,
) -> Result<()> {
    process_freeze(
        ctx,
        root,
        data_hash,
        creator_hash,
        asset_data_hash,
        flags,
        nonce,
        index,
        false,
    )
}
