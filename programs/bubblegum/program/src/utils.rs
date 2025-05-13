use crate::state::{
    leaf_schema::Version,
    metaplex_adapter::{Creator, MetadataArgsCommon},
    ASSET_PREFIX,
};
use anchor_lang::{
    prelude::*,
    solana_program::{program_memory::sol_memcmp, pubkey::PUBKEY_BYTES},
};
use modular_bitfield::{bitfield, specifiers::B5};
use solana_program::{keccak, program::invoke};
use spl_account_compression::Node;

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

pub fn hash_collection_option(collection: Option<Pubkey>) -> Result<[u8; 32]> {
    let collection_key = collection.unwrap_or(DEFAULT_COLLECTION);
    Ok(keccak::hashv(&[collection_key.as_ref()]).to_bytes())
}

pub const DEFAULT_COLLECTION_HASH: [u8; 32] = [
    41, 13, 236, 217, 84, 139, 98, 168, 214, 3, 69, 169, 136, 56, 111, 200, 75, 166, 188, 149, 72,
    64, 8, 246, 54, 47, 147, 22, 14, 243, 229, 99,
];

pub fn hash_asset_data_option(asset_data: Option<&[u8]>) -> Result<[u8; 32]> {
    let data = asset_data.unwrap_or(b""); // Treat None as empty data
    Ok(keccak::hashv(&[data]).to_bytes())
}

pub const DEFAULT_ASSET_DATA_HASH: [u8; 32] = [
    197, 210, 70, 1, 134, 247, 35, 60, 146, 126, 125, 178, 220, 199, 3, 192, 229, 0, 182, 83, 202,
    130, 39, 59, 123, 250, 216, 4, 93, 133, 164, 112,
];

pub const DEFAULT_FLAGS: u8 = 0;

pub fn replace_leaf<'info>(
    version: Version,
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

    match version {
        Version::V1 => {
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
            spl_account_compression::cpi::replace_leaf(
                cpi_ctx,
                root_node,
                previous_leaf,
                new_leaf,
                index,
            )
        }
        Version::V2 => {
            let cpi_ctx = CpiContext::new_with_signer(
                compression_program.clone(),
                mpl_account_compression::cpi::accounts::Modify {
                    authority: authority.clone(),
                    merkle_tree: merkle_tree.clone(),
                    noop: log_wrapper.clone(),
                },
                authority_pda_signer,
            )
            .with_remaining_accounts(remaining_accounts.to_vec());
            mpl_account_compression::cpi::replace_leaf(
                cpi_ctx,
                root_node,
                previous_leaf,
                new_leaf,
                index,
            )
        }
    }
}

pub fn append_leaf<'info>(
    version: Version,
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

    match version {
        Version::V1 => {
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

        Version::V2 => {
            let cpi_ctx = CpiContext::new_with_signer(
                compression_program.clone(),
                mpl_account_compression::cpi::accounts::Modify {
                    authority: authority.clone(),
                    merkle_tree: merkle_tree.clone(),
                    noop: log_wrapper.clone(),
                },
                authority_pda_signer,
            );
            mpl_account_compression::cpi::append(cpi_ctx, leaf_node)
        }
    }
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

/// Wraps a custom event in the most recent version of application event data.
/// Modified from spl-account-compression to allow `noop_program` to be an `UncheckedAccount`
/// and choose the correct one based on program ID.
pub(crate) fn wrap_application_data_v1(
    version: Version,
    custom_data: Vec<u8>,
    noop_program: &AccountInfo<'_>,
) -> Result<()> {
    match version {
        Version::V1 => {
            let versioned_data = spl_account_compression::events::ApplicationDataEventV1 {
                application_data: custom_data,
            };
            let event = spl_account_compression::events::AccountCompressionEvent::ApplicationData(
                spl_account_compression::events::ApplicationDataEvent::V1(versioned_data),
            );

            invoke(
                &spl_noop::instruction(event.try_to_vec()?),
                &[noop_program.to_account_info()],
            )?;
        }
        Version::V2 => {
            let versioned_data = mpl_account_compression::events::ApplicationDataEventV1 {
                application_data: custom_data,
            };
            let event = mpl_account_compression::events::AccountCompressionEvent::ApplicationData(
                mpl_account_compression::events::ApplicationDataEvent::V1(versioned_data),
            );

            invoke(
                &mpl_noop::instruction(event.try_to_vec()?),
                &[noop_program.to_account_info()],
            )?;
        }
    }
    Ok(())
}
