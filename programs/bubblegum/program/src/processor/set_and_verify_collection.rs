use anchor_lang::prelude::*;

use crate::{
    error::BubblegumError,
    processor::{process_collection_verification, verify_collection::CollectionVerification},
    state::metaplex_adapter::MetadataArgs,
    utils::validate_ownership_and_programs,
};

pub(crate) fn set_and_verify_collection<'info>(
    ctx: Context<'_, '_, '_, 'info, CollectionVerification<'info>>,
    root: [u8; 32],
    data_hash: [u8; 32],
    creator_hash: [u8; 32],
    nonce: u64,
    index: u32,
    message: MetadataArgs,
    collection: Pubkey,
) -> Result<()> {
    validate_ownership_and_programs(
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    let incoming_tree_delegate = &ctx.accounts.tree_delegate;
    let tree_creator = ctx.accounts.tree_authority.tree_creator;
    let tree_delegate = ctx.accounts.tree_authority.tree_delegate;
    let collection_metadata = &ctx.accounts.collection_metadata;

    // Require that either the tree authority signed this transaction, or the tree authority is
    // the collection update authority which means the leaf update is approved via proxy, when
    // we later call `assert_has_collection_authority()`.
    //
    // This is similar to logic in token-metadata for `set_and_verify_collection()` except
    // this logic also allows the tree authority (which we are treating as the leaf metadata
    // authority) to be different than the collection authority (actual or delegated).  The
    // token-metadata program required them to be the same.
    let tree_authority_signed = incoming_tree_delegate.is_signer
        && (incoming_tree_delegate.key() == tree_creator
            || incoming_tree_delegate.key() == tree_delegate);

    let tree_authority_is_collection_update_authority = collection_metadata.update_authority
        == tree_creator
        || collection_metadata.update_authority == tree_delegate;

    require!(
        tree_authority_signed || tree_authority_is_collection_update_authority,
        BubblegumError::UpdateAuthorityIncorrect
    );

    process_collection_verification(
        ctx,
        root,
        data_hash,
        creator_hash,
        nonce,
        index,
        message,
        true,
        Some(collection),
    )
}
