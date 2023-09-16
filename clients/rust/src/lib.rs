mod generated;
pub mod hash;
pub mod util;

pub use generated::programs::MPL_BUBBLEGUM_ID as ID;
use generated::types::{LeafSchema, Version};
pub use generated::*;
use solana_program::keccak;

// additional methods for the `LeafSchema` type

impl LeafSchema {
    pub fn hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 {
                id,
                owner,
                delegate,
                nonce,
                data_hash,
                creator_hash,
            } => keccak::hashv(&[
                &[self.version().to_bytes()],
                id.as_ref(),
                owner.as_ref(),
                delegate.as_ref(),
                nonce.to_le_bytes().as_ref(),
                data_hash.as_ref(),
                creator_hash.as_ref(),
            ])
            .to_bytes(),
        }
    }

    pub fn version(&self) -> Version {
        match self {
            LeafSchema::V1 { .. } => Version::V1,
        }
    }
}

impl Version {
    pub fn to_bytes(&self) -> u8 {
        match self {
            Version::V1 => 1,
        }
    }
}
