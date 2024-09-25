#![allow(clippy::derivable_impls)]
use solana_program::{keccak, pubkey::Pubkey};

use crate::types::{LeafSchema, UpdateArgs, Version};

// LeafSchema

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

    pub fn id(&self) -> Pubkey {
        match self {
            LeafSchema::V1 { id, .. } => *id,
        }
    }

    pub fn owner(&self) -> Pubkey {
        match self {
            LeafSchema::V1 { owner, .. } => *owner,
        }
    }

    pub fn delegate(&self) -> Pubkey {
        match self {
            LeafSchema::V1 { delegate, .. } => *delegate,
        }
    }

    pub fn nonce(&self) -> u64 {
        match self {
            LeafSchema::V1 { nonce, .. } => *nonce,
        }
    }

    pub fn data_hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 { data_hash, .. } => *data_hash,
        }
    }

    pub fn creator_hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 { creator_hash, .. } => *creator_hash,
        }
    }
}

impl Default for LeafSchema {
    fn default() -> Self {
        Self::V1 {
            id: Default::default(),
            owner: Default::default(),
            delegate: Default::default(),
            nonce: 0,
            data_hash: [0; 32],
            creator_hash: [0; 32],
        }
    }
}

// Version

impl Version {
    pub fn to_bytes(&self) -> u8 {
        match self {
            Version::V1 => 1,
        }
    }
}

#[allow(clippy::derivable_impls)]
impl Default for Version {
    fn default() -> Self {
        Version::V1
    }
}

// UpdateArgs

impl Default for UpdateArgs {
    fn default() -> Self {
        Self {
            creators: None,
            is_mutable: None,
            name: None,
            primary_sale_happened: None,
            seller_fee_basis_points: None,
            symbol: None,
            uri: None,
        }
    }
}
