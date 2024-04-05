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
    metaplex_adapter::EdgeArgs, metaplex_adapter::NodeArgs, metaplex_adapter::UpdateNodeArgs,
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
        [165, 83, 136, 142, 89, 202, 47, 220] => InstructionName::CreateTree,
        [52, 17, 96, 132, 71, 4, 85, 194] => InstructionName::VerifyCreator,
        [107, 178, 57, 39, 105, 115, 112, 152] => InstructionName::UnverifyCreator,
        [56, 113, 101, 253, 79, 55, 122, 169] => InstructionName::VerifyCollection,
        [250, 251, 42, 106, 41, 137, 186, 168] => InstructionName::UnverifyCollection,
        [235, 242, 121, 216, 158, 234, 180, 234] => InstructionName::SetAndVerifyCollection,
        [170, 182, 43, 239, 97, 78, 225, 186] => InstructionName::UpdateMetadata,
        _ => InstructionName::Unknown,
    }
}

#[program]
pub mod bubblegum {

    use self::state::metaplex_adapter::{EdgeArgs, NodeArgs};

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

    /// Creates a new tree.
    pub fn create_tree(
        ctx: Context<CreateTree>,
        max_depth: u32,
        max_buffer_size: u32,
        public: Option<bool>,
    ) -> Result<()> {
        processor::create_tree(ctx, max_depth, max_buffer_size, public)
    }

    /// Mints a new asset.
    pub fn mint_node_v1(ctx: Context<MintNodeV1>, message: NodeArgs) -> Result<()> {
        processor::mint_node_v1(ctx, message)
    }
    /// Mints a new asset.
    pub fn mint_edge_v1(ctx: Context<MintEdgeV1>, message: EdgeArgs) -> Result<()> {
        processor::mint_edge_v1(ctx, message)
    }

    /// Sets a delegate for a tree.
    pub fn set_tree_delegate(ctx: Context<SetTreeDelegate>) -> Result<()> {
        processor::set_tree_delegate(ctx)
    }

    /// Unverifies a creator from a leaf node.
    pub fn unverify_creator<'info>(
        ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: NodeArgs,
    ) -> Result<()> {
        processor::unverify_creator(ctx, root, data_hash, creator_hash, nonce, index, message)
    }

    /// Verifies a creator for a leaf node.
    pub fn verify_creator<'info>(
        ctx: Context<'_, '_, '_, 'info, CreatorVerification<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        nonce: u64,
        index: u32,
        message: NodeArgs,
    ) -> Result<()> {
        processor::verify_creator(ctx, root, data_hash, creator_hash, nonce, index, message)
    }

    /// Updates metadata for a leaf node that is not part of a verified collection.
    pub fn update_metadata<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateMetadata<'info>>,
        root: [u8; 32],
        nonce: u64,
        index: u32,
        current_metadata: NodeArgs,
        update_args: UpdateNodeArgs,
    ) -> Result<()> {
        processor::update_metadata(ctx, root, nonce, index, current_metadata, update_args)
    }
}
