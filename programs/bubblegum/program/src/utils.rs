use crate::{
    error::BubblegumError,
    state::{
        metaplex_adapter::{Creator, MetadataArgs},
        ASSET_PREFIX, MAX_ACC_PROOFS_SIZE,
    },
};
use anchor_lang::{
    prelude::*,
    solana_program::{program_memory::sol_memcmp, pubkey::PUBKEY_BYTES},
};
use bytemuck::cast_slice;
use solana_program::keccak;
use spl_account_compression::{
    state::{
        merkle_tree_get_size, ConcurrentMerkleTreeHeader, CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1,
    },
    Node,
};

pub fn hash_creators(creators: &[Creator]) -> Result<[u8; 32]> {
    // Convert creator Vec to bytes Vec.
    let creator_data = creators
        .iter()
        .map(|c| [c.address.as_ref(), &[c.verified as u8], &[c.share]].concat())
        .collect::<Vec<_>>();
    // Calculate new creator hash.
    Ok(keccak::hashv(
        creator_data
            .iter()
            .map(|c| c.as_slice())
            .collect::<Vec<&[u8]>>()
            .as_ref(),
    )
    .to_bytes())
}

pub fn hash_metadata(metadata: &MetadataArgs) -> Result<[u8; 32]> {
    let metadata_args_hash = keccak::hashv(&[metadata.try_to_vec()?.as_slice()]);
    // Calculate new data hash.
    Ok(keccak::hashv(&[
        &metadata_args_hash.to_bytes(),
        &metadata.seller_fee_basis_points.to_le_bytes(),
    ])
    .to_bytes())
}

pub fn replace_leaf<'info>(
    seed: &Pubkey,
    bump: u8,
    compression_program: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    log_wrapper: &AccountInfo<'info>,
    remaining_accounts: &[AccountInfo<'info>],
    root_node: Node,
    previous_leaf: Node,
    new_leaf: Node,
    index: u32,
) -> Result<()> {
    let seeds = &[seed.as_ref(), &[bump]];
    let authority_pda_signer = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(
        compression_program.clone(),
        spl_account_compression::cpi::accounts::Modify {
            authority: authority.clone(),
            merkle_tree: merkle_tree.clone(),
            noop: log_wrapper.clone(),
        },
        authority_pda_signer,
    )
    .with_remaining_accounts(remaining_accounts.to_vec());
    spl_account_compression::cpi::replace_leaf(cpi_ctx, root_node, previous_leaf, new_leaf, index)
}

pub fn append_leaf<'info>(
    seed: &Pubkey,
    bump: u8,
    compression_program: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    log_wrapper: &AccountInfo<'info>,
    leaf_node: Node,
) -> Result<()> {
    let seeds = &[seed.as_ref(), &[bump]];
    let authority_pda_signer = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(
        compression_program.clone(),
        spl_account_compression::cpi::accounts::Modify {
            authority: authority.clone(),
            merkle_tree: merkle_tree.clone(),
            noop: log_wrapper.clone(),
        },
        authority_pda_signer,
    );
    spl_account_compression::cpi::append(cpi_ctx, leaf_node)
}

pub fn cmp_pubkeys(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), PUBKEY_BYTES) == 0
}

pub fn cmp_bytes(a: &[u8], b: &[u8], size: usize) -> bool {
    sol_memcmp(a, b, size) == 0
}

pub fn get_asset_id(tree_id: &Pubkey, nonce: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[
            ASSET_PREFIX.as_ref(),
            tree_id.as_ref(),
            &nonce.to_le_bytes(),
        ],
        &crate::id(),
    )
    .0
}

pub(crate) fn check_canopy_size<'info>(
    merkle_tree: AccountInfo<'info>,
    tree_authority: AccountInfo<'info>,
    max_depth: u32,
    max_buffer_size: u32,
) -> Result<()> {
    let merkle_tree_bytes = merkle_tree.data.borrow();

    let (header_bytes, rest) = merkle_tree_bytes.split_at(CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1);

    let mut header = ConcurrentMerkleTreeHeader::try_from_slice(header_bytes)?;
    header.initialize(
        max_depth,
        max_buffer_size,
        &tree_authority.key(),
        Clock::get()?.slot,
    );

    let merkle_tree_size = merkle_tree_get_size(&header)?;

    let (_tree_bytes, canopy_bytes) = rest.split_at(merkle_tree_size);

    let canopy = cast_slice::<u8, Node>(canopy_bytes);

    let cached_path_len = get_cached_path_length(canopy, max_depth)?;

    let required_canopy = max_depth.saturating_sub(MAX_ACC_PROOFS_SIZE);

    require!(
        (cached_path_len as u32) >= required_canopy,
        BubblegumError::InvalidCanopySize
    );

    Ok(())
}

// Method taken from [account-compression Solana program](spl_account_compression::canopy::check_canopy_bytes)
#[inline(always)]
fn get_cached_path_length(canopy: &[Node], max_depth: u32) -> Result<u32> {
    // The offset of 2 is applied because the canopy is a full binary tree without the root node
    // Size: (2^n - 2) -> Size + 2 must be a power of 2
    let closest_power_of_2 = (canopy.len() + 2) as u32;
    // This expression will return true if `closest_power_of_2` is actually a power of 2
    if closest_power_of_2 & (closest_power_of_2 - 1) == 0 {
        // (1 << max_depth) returns the number of leaves in the full merkle tree
        // (1 << (max_depth + 1)) - 1 returns the number of nodes in the full tree
        // The canopy size cannot exceed the size of the tree
        if closest_power_of_2 > (1 << (max_depth + 1)) {
            msg!(
                "Canopy size is too large. Size: {}. Max size: {}",
                closest_power_of_2 - 2,
                (1 << (max_depth + 1)) - 2
            );
            return err!(BubblegumError::InvalidCanopySize);
        }
    } else {
        msg!(
            "Canopy length {} is not 2 less than a power of 2",
            canopy.len()
        );
        return err!(BubblegumError::InvalidCanopySize);
    }
    // 1 is subtracted from the trailing zeros because the root is not stored in the canopy
    Ok(closest_power_of_2.trailing_zeros() - 1)
}
