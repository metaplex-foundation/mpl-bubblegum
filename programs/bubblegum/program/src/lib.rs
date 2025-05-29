#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]

use anchor_lang::prelude::*;

pub mod asserts;
pub mod error;
mod processor;
pub mod state;
pub mod traits;
pub mod utils;

use processor::*;
use state::{
    leaf_schema::LeafSchema,
    metaplex_adapter::{MetadataArgs, MetadataArgsV2, UpdateArgs},
    AssetDataSchema, DecompressibleState,
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
    /// V2 instructions have been added that use `LeafSchema` V2.
    /// See `mint_v2` below for more details on the new functionality.
    BurnV2,
    CollectV2,
    CreateTreeV2,
    DelegateAndFreezeV2,
    DelegateV2,
    FreezeV2,
    MintV2,
    SetCollectionV2,
    SetNonTransferableV2,
    ThawAndRevokeV2,
    ThawV2,
    TransferV2,
    UnverifyCreatorV2,
    UpdateAssetDataV2,
    UpdateMetadataV2,
    VerifyCreatorV2,
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
        [82, 104, 152, 6, 149, 111, 100, 13] => InstructionName::SetDecompressibleState,
        // `SetDecompressableState` instruction mapped to `SetDecompressibleState` instruction
        [18, 135, 238, 168, 246, 195, 61, 115] => InstructionName::SetDecompressibleState,
        [170, 182, 43, 239, 97, 78, 225, 186] => InstructionName::UpdateMetadata,
        [115, 210, 34, 240, 232, 143, 183, 16] => InstructionName::BurnV2,
        [21, 11, 159, 47, 4, 195, 106, 56] => InstructionName::CollectV2,
        [55, 99, 95, 215, 142, 203, 227, 205] => InstructionName::CreateTreeV2,
        [17, 229, 35, 218, 190, 241, 250, 123] => InstructionName::DelegateAndFreezeV2,
        [95, 87, 125, 140, 181, 131, 128, 227] => InstructionName::DelegateV2,
        [200, 151, 244, 102, 16, 195, 255, 3] => InstructionName::FreezeV2,
        [120, 121, 23, 146, 173, 110, 199, 205] => InstructionName::MintV2,
        [229, 35, 61, 91, 15, 14, 99, 160] => InstructionName::SetCollectionV2,
        [181, 141, 206, 58, 242, 199, 152, 168] => InstructionName::SetNonTransferableV2,
        [86, 214, 190, 37, 167, 4, 28, 116] => InstructionName::ThawAndRevokeV2,
        [96, 133, 101, 93, 82, 220, 146, 191] => InstructionName::ThawV2,
        [119, 40, 6, 235, 234, 221, 248, 49] => InstructionName::TransferV2,
        [174, 112, 29, 142, 230, 100, 239, 7] => InstructionName::UnverifyCreatorV2,
        [59, 56, 111, 43, 95, 14, 11, 61] => InstructionName::UpdateAssetDataV2,
        [43, 103, 89, 42, 121, 242, 62, 72] => InstructionName::UpdateMetadataV2,
        [85, 138, 140, 42, 22, 241, 118, 102] => InstructionName::VerifyCreatorV2,
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
        processor::burn_v1(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Burns a `LeafSchema` V2 leaf node from the tree.
    pub fn burn_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, BurnV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::burn_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
    }

    /// Cancels a redeem.
    pub fn cancel_redeem<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelRedeem<'info>>,
        root: [u8; 32],
    ) -> Result<()> {
        processor::cancel_redeem(ctx, root)
    }

    /// Collect fees from a V2 tree.
    pub fn collect_v2<'info>(ctx: Context<'_, '_, '_, 'info, CollectV2<'info>>) -> Result<()> {
        processor::collect_v2(ctx)
    }

    /// Compresses a metadata account.
    pub fn compress(ctx: Context<Compress>) -> Result<()> {
        processor::compress(ctx)
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

    /// Creates a new tree for use with `LeafSchema` V2 leaf nodes.  See `mint_v2` for more details
    /// on the new functionality.
    pub fn create_tree_v2(
        ctx: Context<CreateTreeV2>,
        max_depth: u32,
        max_buffer_size: u32,
        public: Option<bool>,
    ) -> Result<()> {
        processor::create_tree_v2(ctx, max_depth, max_buffer_size, public)
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

    /// Delegates and freezes a `LeafSchema` V2 leaf node, preventing transferring or burning.
    pub fn delegate_and_freeze_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, DelegateAndFreezeV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        collection_hash: Option<[u8; 32]>,
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::delegate_and_freeze_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            collection_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
    }

    /// Sets a delegate for a `LeafSchema` V2 leaf node.
    pub fn delegate_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, DelegateV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        collection_hash: Option<[u8; 32]>,
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::delegate_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            collection_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
    }

    /// Freezes a `LeafSchema` V2 leaf node, preventing transferring or burning.
    pub fn freeze_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, FreezeV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::freeze_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
    }

    /// Mints a new asset and adds it to a Token Metadata collection.
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

    /// Mints a new asset using `LeafSchema` V2 and optionally adds it to an MPL Core collection.
    /// Requires a tree created with `createTreeV2`.
    ///
    /// 'LeafSchema' V2 enables new functionality:
    ///   1. Uses MPL Core collections instead of Token Metadata collections.
    ///   2. Uses the streamlined `MetadataV2` arguments, which eliminate the collection verified
    ///      flag.  In `MetadataV2`, any collection included is automatically considered verified.
    ///   3. Allows for use of plugins such as Royalties, Permanent Burn Delegate, etc. on the
    ///      MPL Core collection to authorize operations on the Bubblegum asset.  Note the
    ///      `BubblegumV2` plugin must also be present on the MPL Core collection for it to be
    ///      used for Bubblegum.  See MPL Core `BubblegumV2` plugin for list of compatible
    ///      collection-level plugins.
    ///   4. Allows for freezing/thawing of the asset, as well as setting an asset to be
    ///      permanently non-transferable (soulbound).  Non-transferable is similar to freezing
    ///      but allows the owner to burn the asset, while freezing does not.
    ///   5. Not available yet, but optionally specify data (and a schema) to be associated with
    ///      the asset.
    pub fn mint_v2(
        ctx: Context<MintV2>,
        metadata_args: MetadataArgsV2,
        asset_data: Option<Vec<u8>>,
        asset_data_schema: Option<AssetDataSchema>,
    ) -> Result<LeafSchema> {
        processor::mint_v2(ctx, metadata_args, asset_data, asset_data_schema)
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

    /// Sets and collection to a `LeafSchema` V2 leaf node
    pub fn set_collection_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, SetCollectionV2<'info>>,
        root: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
        message: MetadataArgsV2,
    ) -> Result<()> {
        processor::set_collection_v2(ctx, root, asset_data_hash, flags, nonce, index, message)
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

    /// Permanently sets the non-transferable flag on a `LeafSchema` V2 leaf node,
    /// making it soulbound.
    pub fn set_non_transferable_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, SetNonTransferableV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::set_non_transferable_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
    }

    /// Sets a delegate for a tree.
    pub fn set_tree_delegate(ctx: Context<SetTreeDelegate>) -> Result<()> {
        processor::set_tree_delegate(ctx)
    }

    /// Thaws a previously frozen `LeafSchema` V2 leaf node, and revoke the leaf delegate.
    pub fn thaw_and_revoke_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, ThawAndRevokeV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        collection_hash: Option<[u8; 32]>,
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::thaw_and_revoke_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            collection_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
    }

    /// Thaws a previously frozen `LeafSchema` V2 leaf node.
    pub fn thaw_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, FreezeV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::thaw_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
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
        processor::transfer_v1(ctx, root, data_hash, creator_hash, nonce, index)
    }

    /// Transfers a `LeafSchema` V2 leaf node from one account to another.
    pub fn transfer_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, TransferV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
    ) -> Result<()> {
        processor::transfer_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            asset_data_hash,
            flags,
            nonce,
            index,
        )
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

    /// Unverifies a creator from a `LeafSchema` V2 leaf node.
    pub fn unverify_creator_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, CreatorVerificationV2<'info>>,
        root: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
        message: MetadataArgsV2,
    ) -> Result<()> {
        processor::unverify_creator_v2(ctx, root, asset_data_hash, flags, nonce, index, message)
    }

    /// Updates asset data for a `LeafSchema` V2 leaf node.
    pub fn update_asset_data_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateAssetDataV2<'info>>,
        root: [u8; 32],
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        previous_asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
        new_asset_data: Option<Vec<u8>>,
        new_asset_data_schema: Option<AssetDataSchema>,
    ) -> Result<()> {
        processor::update_asset_data_v2(
            ctx,
            root,
            data_hash,
            creator_hash,
            previous_asset_data_hash,
            flags,
            nonce,
            index,
            new_asset_data,
            new_asset_data_schema,
        )
    }

    /// Updates metadata for a leaf node.
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

    /// Updates metadata for a `LeafSchema` V2 leaf node.
    pub fn update_metadata_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, UpdateMetadataV2<'info>>,
        root: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
        current_metadata: MetadataArgsV2,
        update_args: UpdateArgs,
    ) -> Result<()> {
        processor::update_metadata_v2(
            ctx,
            root,
            asset_data_hash,
            flags,
            nonce,
            index,
            current_metadata,
            update_args,
        )
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

    /// Verifies a creator for a `LeafSchema` V2 leaf node.
    pub fn verify_creator_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, CreatorVerificationV2<'info>>,
        root: [u8; 32],
        asset_data_hash: Option<[u8; 32]>,
        flags: Option<u8>,
        nonce: u64,
        index: u32,
        message: MetadataArgsV2,
    ) -> Result<()> {
        processor::verify_creator_v2(ctx, root, asset_data_hash, flags, nonce, index, message)
    }
}
