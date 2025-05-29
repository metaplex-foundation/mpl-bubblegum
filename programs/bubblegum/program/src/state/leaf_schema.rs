use crate::state::BubblegumEventType;
use anchor_lang::{prelude::*, solana_program::keccak};
use borsh::{BorshDeserialize, BorshSerialize};
use spl_account_compression::Node;

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

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Eq, Debug, Clone, Copy, Default)]
pub enum Version {
    #[default]
    V1,
    V2,
}

impl Version {
    pub fn to_bytes(&self) -> u8 {
        match self {
            Version::V1 => 1,
            Version::V2 => 2,
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Eq, Debug, Clone)]
pub enum LeafSchema {
    V1 {
        id: Pubkey,
        owner: Pubkey,
        delegate: Pubkey,
        nonce: u64,
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
    },
    V2 {
        id: Pubkey,
        owner: Pubkey,
        delegate: Pubkey,
        nonce: u64,
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        collection_hash: [u8; 32],
        asset_data_hash: [u8; 32],
        flags: u8,
    },
}

// TODO can remove
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

impl LeafSchema {
    pub fn new_v1(
        id: Pubkey,
        owner: Pubkey,
        delegate: Pubkey,
        nonce: u64,
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
    ) -> Self {
        Self::V1 {
            id,
            owner,
            delegate,
            nonce,
            data_hash,
            creator_hash,
        }
    }

    pub fn new_v2(
        id: Pubkey,
        owner: Pubkey,
        delegate: Pubkey,
        nonce: u64,
        data_hash: [u8; 32],
        creator_hash: [u8; 32],
        collection_hash: [u8; 32],
        asset_data_hash: [u8; 32],
        flags: u8,
    ) -> Self {
        Self::V2 {
            id,
            owner,
            delegate,
            nonce,
            data_hash,
            creator_hash,
            collection_hash,
            asset_data_hash,
            flags,
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

    pub fn to_event(&self) -> LeafSchemaEvent {
        LeafSchemaEvent::new(self.version(), self.clone(), self.to_node())
    }

    pub fn to_node(&self) -> Node {
        let hashed_leaf = match self {
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
        };
        hashed_leaf
    }
}
