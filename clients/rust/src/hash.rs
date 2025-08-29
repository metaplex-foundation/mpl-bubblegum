use solana_program::{keccak, pubkey::Pubkey};
use std::io::Result;

use crate::{traits::MetadataArgsCommon, types::Creator};

/// Computes the hash of the creators.
///
/// The hash is computed as the keccak256 hash of the creators bytes.
pub fn hash_creators(creators: &[Creator]) -> [u8; 32] {
    // convert creator Vec to bytes Vec
    let creator_data = creators
        .iter()
        .map(|c| [c.address.as_ref(), &[c.verified as u8], &[c.share]].concat())
        .collect::<Vec<_>>();
    // computes the hash
    keccak::hashv(
        creator_data
            .iter()
            .map(|c| c.as_slice())
            .collect::<Vec<&[u8]>>()
            .as_ref(),
    )
    .to_bytes()
}

/// Computes the hash of the metadata.
///
/// The hash is computed as the keccak256 hash of the metadata bytes, which is
/// then hashed with the `seller_fee_basis_points`.
pub fn hash_metadata<T: MetadataArgsCommon>(metadata: &T) -> Result<[u8; 32]> {
    let metadata_args_hash = keccak::hashv(&[metadata.try_to_vec()?.as_slice()]);
    // Calculate new data hash.
    Ok(keccak::hashv(&[
        &metadata_args_hash.to_bytes(),
        &metadata.seller_fee_basis_points().to_le_bytes(),
    ])
    .to_bytes())
}

pub const DEFAULT_COLLECTION: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// Computes the hash of the collection (or if `None` provides default) for `LeafSchemaV2`.
pub fn hash_collection_option(collection: Option<Pubkey>) -> Result<[u8; 32]> {
    let collection_key = collection.unwrap_or(DEFAULT_COLLECTION);
    Ok(keccak::hashv(&[collection_key.as_ref()]).to_bytes())
}

/// Default collection hash for `LeafSchemaV2`.
pub const DEFAULT_COLLECTION_HASH: [u8; 32] = [
    41, 13, 236, 217, 84, 139, 98, 168, 214, 3, 69, 169, 136, 56, 111, 200, 75, 166, 188, 149, 72,
    64, 8, 246, 54, 47, 147, 22, 14, 243, 229, 99,
];

/// Computes the hash of the asset data (or if `None` provides default) for `LeafSchemaV2`.
pub fn hash_asset_data_option(asset_data: Option<&[u8]>) -> Result<[u8; 32]> {
    let data = asset_data.unwrap_or(b""); // Treat None as empty data
    Ok(keccak::hashv(&[data]).to_bytes())
}

/// Default asset data hash for `LeafSchemaV2`.
pub const DEFAULT_ASSET_DATA_HASH: [u8; 32] = [
    197, 210, 70, 1, 134, 247, 35, 60, 146, 126, 125, 178, 220, 199, 3, 192, 229, 0, 182, 83, 202,
    130, 39, 59, 123, 250, 216, 4, 93, 133, 164, 112,
];
