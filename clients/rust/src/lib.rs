use borsh::{BorshDeserialize, BorshSerialize};
use modular_bitfield::{bitfield, specifiers::B5};
use types::{BubblegumEventType, LeafSchema, Version};

mod generated;
pub mod hash;
mod traits;
pub mod utils;

pub use generated::programs::MPL_BUBBLEGUM_ID as ID;
pub use generated::*;

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

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct LeafSchemaEvent {
    pub event_type: BubblegumEventType,
    pub version: Version,
    pub schema: LeafSchema,
    pub leaf_hash: [u8; 32],
}

impl LeafSchemaEvent {
    pub fn new(version: Version, schema: LeafSchema, leaf_hash: [u8; 32]) -> Self {
        Self {
            event_type: BubblegumEventType::LeafSchemaEvent,
            version,
            schema,
            leaf_hash,
        }
    }
}

/// Bitfield representation of asset flags.
#[bitfield(bits = 8)]
#[derive(Eq, PartialEq, Copy, Clone, Debug, Default)]
pub struct Flags {
    /// Frozen at the asset level by the leaf delegate.
    pub asset_lvl_frozen: bool,
    /// Frozen by the mpl-core collection permanent freeze delegate.
    pub permanent_lvl_frozen: bool,
    /// Set to permanently non-transferable (soulbound).
    pub non_transferable: bool,
    /// Unused flags for future asset-level usage.
    pub empty_bits: B5,
}

/// Default flags for `LeafSchemaV2`.
pub const DEFAULT_FLAGS: u8 = 0;
