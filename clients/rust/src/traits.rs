#![allow(clippy::derivable_impls)]
use solana_program::{keccak, pubkey::Pubkey};

use crate::types::{
    Collection, LeafSchema, MetadataArgs, MetadataArgsV2, TokenProgramVersion, UpdateArgs, Version,
};

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
            LeafSchema::V2 {
                id,
                owner,
                delegate,
                nonce,
                data_hash,
                creator_hash,
                collection_hash,
                asset_data_hash,
                flags,
            } => keccak::hashv(&[
                &[self.version().to_bytes()],
                id.as_ref(),
                owner.as_ref(),
                delegate.as_ref(),
                nonce.to_le_bytes().as_ref(),
                data_hash.as_ref(),
                creator_hash.as_ref(),
                collection_hash.as_ref(),
                asset_data_hash.as_ref(),
                &[*flags],
            ])
            .to_bytes(),
        }
    }

    pub fn version(&self) -> Version {
        match self {
            LeafSchema::V1 { .. } => Version::V1,
            LeafSchema::V2 { .. } => Version::V2,
        }
    }

    pub fn id(&self) -> Pubkey {
        match self {
            LeafSchema::V1 { id, .. } => *id,
            LeafSchema::V2 { id, .. } => *id,
        }
    }

    pub fn owner(&self) -> Pubkey {
        match self {
            LeafSchema::V1 { owner, .. } => *owner,
            LeafSchema::V2 { owner, .. } => *owner,
        }
    }

    pub fn delegate(&self) -> Pubkey {
        match self {
            LeafSchema::V1 { delegate, .. } => *delegate,
            LeafSchema::V2 { delegate, .. } => *delegate,
        }
    }

    pub fn nonce(&self) -> u64 {
        match self {
            LeafSchema::V1 { nonce, .. } => *nonce,
            LeafSchema::V2 { nonce, .. } => *nonce,
        }
    }

    pub fn data_hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 { data_hash, .. } => *data_hash,
            LeafSchema::V2 { data_hash, .. } => *data_hash,
        }
    }

    pub fn creator_hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 { creator_hash, .. } => *creator_hash,
            LeafSchema::V2 { creator_hash, .. } => *creator_hash,
        }
    }

    pub fn collection_hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 { .. } => [0; 32],
            LeafSchema::V2 {
                collection_hash, ..
            } => *collection_hash,
        }
    }

    pub fn asset_data_hash(&self) -> [u8; 32] {
        match self {
            LeafSchema::V1 { .. } => [0; 32],
            LeafSchema::V2 {
                asset_data_hash, ..
            } => *asset_data_hash,
        }
    }

    pub fn flags(&self) -> u8 {
        match self {
            LeafSchema::V1 { .. } => 0,
            LeafSchema::V2 { flags, .. } => *flags,
        }
    }
}

// TODO where is this used
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
            Version::V2 => 2,
        }
    }
}

#[allow(clippy::derivable_impls)]
impl Default for Version {
    fn default() -> Self {
        Version::V1
    }
}

/// MetadataArgs
/// Differences:
/// `edition_nonce` not present in V2, default to `None`
/// `collection` is always considered verified in V2
/// `uses` not present in V2, default to `None`
/// `token_program_version` not present in V2, default to `TokenProgramVersion::Original`
impl From<MetadataArgsV2> for MetadataArgs {
    fn from(v2: MetadataArgsV2) -> Self {
        MetadataArgs {
            name: v2.name,
            symbol: v2.symbol,
            uri: v2.uri,
            seller_fee_basis_points: v2.seller_fee_basis_points,
            primary_sale_happened: v2.primary_sale_happened,
            is_mutable: v2.is_mutable,
            edition_nonce: None, // Not present in V2, default to `None`
            token_standard: v2.token_standard,
            collection: v2.collection.map(|key| Collection {
                key,
                verified: true, // `collection` is always considered verified in V2
            }),
            uses: None, // Not present in V2, default to `None`
            token_program_version: TokenProgramVersion::Original, // Default value
            creators: v2.creators,
        }
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
