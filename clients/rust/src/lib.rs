use borsh::{BorshDeserialize, BorshSerialize};
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
        [77, 73, 220, 153, 126, 225, 64, 204] => InstructionName::FinalizeTreeWithRoot,
        [194, 98, 45, 168, 183, 72, 67, 155] => InstructionName::FinalizeTreeWithRootAndCollection,
        [41, 56, 189, 77, 58, 12, 142, 71] => InstructionName::PrepareTree,
        [247, 118, 145, 92, 84, 66, 207, 25] => InstructionName::AddCanopy,
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

pub const MAX_ACC_PROOFS_SIZE: u32 = 17;
