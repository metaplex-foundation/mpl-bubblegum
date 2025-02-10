#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]

use anchor_lang::prelude::*;

pub mod asserts;
pub mod error;
mod processor;
pub mod state;
pub mod utils;

use processor::*;
use state::{
    leaf_schema::LeafSchema,
    metaplex_adapter::{MetadataArgs, UpdateArgs},
    DecompressibleState,
};

declare_id!("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");

pub enum InstructionName {
    Unknown,
    MintV1,
    Redeem,
    CancelRedeem,
    Transfer,
    Delegate,
    DecompressV1,
    Compress,
    Burn,
    CreateTree,
    VerifyCreator,
    UnverifyCreator,
    VerifyCollection,
    UnverifyCollection,
    SetAndVerifyCollection,
    MintToCollectionV1,
    SetDecompressibleState,
    UpdateMetadata,
    FinalizeTreeWithRoot,
    FinalizeTreeWithRootAndCollection,
    PrepareTree,
    AddCanopy,
}

pub fn get_instruction_type(full_bytes: &[u8]) -> InstructionName {
    let disc: [u8; 8] = {
        let mut disc = [0; 8];
        disc.copy_from_slice(&full_bytes[..8]);
        disc
    };
    match disc {
        [145, 98, 192, 118, 184, 147, 118, 104] => InstructionName::MintV1,
        [153, 18, 178, 47, 197, 158, 86, 15] => InstructionName::MintToCollectionV1,
        [111, 76, 232, 50, 39, 175, 48, 242] => InstructionName::CancelRedeem,
        [184, 12, 86, 149, 70, 196, 97, 225] => InstructionName::Redeem,
        [163, 52, 200, 231, 140, 3, 69, 186] => InstructionName::Transfer,
        [90, 147, 75, 178, 85, 88, 4, 137] => InstructionName::Delegate,
        [54, 85, 76, 70, 228, 250, 164, 81] => InstructionName::DecompressV1,
        [116, 110, 29, 56, 107, 219, 42, 93] => InstructionName::Burn,
        [82, 193, 176, 117, 176, 21, 115, 253] => InstructionName::Compress,
        [77, 73, 220, 153, 126, 225, 64, 204] => InstructionName::FinalizeTreeWithRoot,
        [194, 98, 45, 168, 183, 72, 67, 155] => InstructionName::FinalizeTreeWithRootAndCollection,
        [165, 83, 136, 142, 89, 202, 47, 220] => InstructionName::CreateTree,
        [52, 17, 96, 132, 71, 4, 85, 194] => InstructionName::VerifyCreator,
        [107, 178, 57, 39, 105, 115, 112, 152] => InstructionName::UnverifyCreator,
        [56, 113, 101, 253, 79, 55, 122, 169] => InstructionName::VerifyCollection,
        [250, 251, 42, 106, 41, 137, 186, 168] => InstructionName::UnverifyCollection,
        [235, 242, 121, 216, 158, 234, 180, 234] => InstructionName::SetAndVerifyCollection,
        [82, 104, 152, 6, 149, 111, 100, 13] => InstructionName::SetDecompressibleState,
        // `SetDecompressableState` instruction mapped to `SetDecompressibleState` instruction
        [18, 135, 238, 168, 246, 195, 61, 115] => InstructionName::SetDecompressibleState,
        [170, 182, 43, 239, 97, 78, 225, 186] => InstructionName::UpdateMetadata,
        [41, 56, 189, 77, 58, 12, 142, 71] => InstructionName::PrepareTree,
        [247, 118, 145, 92, 84, 66, 207, 25] => InstructionName::AddCanopy,
        _ => InstructionName::Unknown,
    }
}

#[program]
pub mod bubblegum {
    use super::*;

    /// Burns a leaf node from the tree.
    pub fn burn<'info>(
        ctx: Context<'_, '_, '_, 'info, Burn<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::burn(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Cancels a redeem.
    pub fn cancel_redeem<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelRedeem<'info>>,
        root: [u8; 32],
    ) -> Result<()> {
        processor::cancel_redeem(ctx, root)
    }

    /// Compresses a metadata account.
    pub fn compress(ctx: Context<Compress>) -> Result<()> {
        processor::compress(ctx)
    }

    pub fn prepare_tree<'info>(
        ctx: Context<'_, '_, '_, 'info, PrepareTree<'info>>,
        max_depth: u32,
        max_buffer_size: u32,
        public: Option<bool>,
    ) -> Result<()> {
        processor::prepare_tree(ctx, max_depth, max_buffer_size, public)
    }

    pub fn add_canopy<'info>(
        ctx: Context<'_, '_, '_, 'info, AddCanopy<'info>>,
        start_index: u32,
        canopy_nodes: Vec<[u8; 32]>,
    ) -> Result<()> {
        processor::add_canopy(ctx, start_index, canopy_nodes)
    }

    /// Creates a new tree.
    pub fn create_tree<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateTree<'info>>,
        max_depth: u32,
        max_buffer_size: u32,
        public: Option<bool>,
    ) -> Result<()> {
        processor::create_tree(ctx, max_depth, max_buffer_size, public)
    }

    pub(crate) fn finalize_tree_with_root<'info>(
        ctx: Context<'_, '_, '_, 'info, FinalizeTreeWithRoot<'info>>,
        root: [u8; 32],
        rightmost_leaf: [u8; 32],
        rightmost_index: u32,
        metadata_url: String,
        metadata_hash: String,
    ) -> Result<()> {
        processor::finalize_tree_with_root(
            ctx,
            root,
            rightmost_leaf,
            rightmost_index,
            metadata_url,
            metadata_hash,
        )
    }

    pub(crate) fn finalize_tree_with_root_and_collection<'info>(
        ctx: Context<'_, '_, '_, 'info, FinalizeTreeWithRootAndCollection<'info>>,
        root: [u8; 32],
        rightmost_leaf: [u8; 32],
        rightmost_index: u32,
        metadata_url: String,
        metadata_hash: String,
    ) -> Result<()> {
        processor::finalize_tree_with_root_and_collection(
            ctx,
            root,
            rightmost_leaf,
            rightmost_index,
            metadata_url,
            metadata_hash,
        )
    }

    /// Decompresses a leaf node from the tree.
    pub fn decompress_v1(ctx: Context<DecompressV1>, metadata: MetadataArgs) -> Result<()> {
        processor::decompress_v1(ctx, metadata)
    }

    /// Sets a delegate for a leaf node.
    pub fn delegate<'info>(
        ctx: Context<'_, '_, '_, 'info, Delegate<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::delegate(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Mints a new asset and adds it to a collection.
    pub fn mint_to_collection_v1(
        ctx: Context<MintToCollectionV1>,
        metadata_args: MetadataArgs,
    ) -> Result<LeafSchema> {
        processor::mint_to_collection_v1(ctx, metadata_args)
    }

    /// Mints a new asset.
    pub fn mint_v1(ctx: Context<MintV1>, message: MetadataArgs) -> Result<LeafSchema> {
        processor::mint_v1(ctx, message)
    }

    /// Redeems a vouches.
    ///
    /// Once a vouch is redeemed, the corresponding leaf node is removed from the tree.
    pub fn redeem<'info>(
        ctx: Context<'_, '_, '_, 'info, Redeem<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::redeem(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Sets and verifies a collection to a leaf node
    pub fn set_and_verify_collection<'info>(
        ctx: Context<'_, '_, '_, 'info, CollectionVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: MetadataArgs,
        collection: Pubkey,
    ) -> Result<()> {
        processor::set_and_verify_collection(
            ctx,
            root,
            data_hash,
            creator_hash,
            nonce,
            index,
            message,
            collection,
        )
    }

    /// Sets the `decompressible_state` of a tree.
    #[deprecated(
        since = "0.11.1",
        note = "Please use `set_decompressible_state` instead"
    )]
    pub fn set_decompressable_state(
        ctx: Context<SetDecompressibleState>,
        decompressable_state: DecompressibleState,
    ) -> Result<()> {
        msg!("Deprecated: please use `set_decompressible_state` instead");
        processor::set_decompressible_state(ctx, decompressable_state)
    }

    /// Sets the `decompressible_state` of a tree.
    pub fn set_decompressible_state(
        ctx: Context<SetDecompressibleState>,
        decompressable_state: DecompressibleState,
    ) -> Result<()> {
        processor::set_decompressible_state(ctx, decompressable_state)
    }

    /// Sets a delegate for a tree.
    pub fn set_tree_delegate(ctx: Context<SetTreeDelegate>) -> Result<()> {
        processor::set_tree_delegate(ctx)
    }

    /// Transfers a leaf node from one account to another.
    pub fn transfer<'info>(
        ctx: Context<'_, '_, '_, 'info, Transfer<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::transfer(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Unverifies a collection from a leaf node.
    pub fn unverify_collection<'info>(
        ctx: Context<'_, '_, '_, 'info, CollectionVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: MetadataArgs,
    ) -> Result<()> {
        processor::unverify_collection(ctx, root, data_hash, creator_hash, nonce, index, message)
    }

    /// Unverifies a creator from a leaf node.
    pub fn unverify_creator<'info>(
        ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: MetadataArgs,
    ) -> Result<()> {
        processor::unverify_creator(ctx, root, data_hash, creator_hash, nonce, index, message)
    }

    /// Verifies a collection for a leaf node.
    pub fn verify_collection<'info>(
        ctx: Context<'_, '_, '_, 'info, CollectionVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: MetadataArgs,
    ) -> Result<()> {
        processor::verify_collection(ctx, root, data_hash, creator_hash, nonce, index, message)
    }

    /// Verifies a creator for a leaf node.
    pub fn verify_creator<'info>(
        ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: MetadataArgs,
    ) -> Result<()> {
        processor::verify_creator(ctx, root, data_hash, creator_hash, nonce, index, message)
    }

    /// Updates metadata for a leaf node that is not part of a verified collection.
    pub fn update_metadata<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateMetadata<'info>>,
        root: [u8; 32],
        nonce: u64,
        index: u32,
        current_metadata: MetadataArgs,
        update_args: UpdateArgs,
    ) -> Result<()> {
        processor::update_metadata(ctx, root, nonce, index, current_metadata, update_args)
    }
}
