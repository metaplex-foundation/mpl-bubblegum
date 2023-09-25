use solana_program::pubkey::Pubkey;

/// Computes the asset id of an asset given its tree and nonce values.
pub fn get_asset_id(tree: &Pubkey, nonce: u64) -> Pubkey {
    Pubkey::find_program_address(&[b"asset", tree.as_ref(), &nonce.to_le_bytes()], &crate::ID).0
}
