use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, program_memory::sol_memcmp, pubkey::PUBKEY_BYTES},
};
use solana_program::keccak;
use spl_concurrent_merkle_tree::node::Node;

use crate::{
    error::BubblegumError,
    state::{
        metaplex_adapter::{Creator, MetadataArgs},
        ASSET_PREFIX,
    },
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

    if compression_program.key == &spl_account_compression::id() {
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
    } else {
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

    if compression_program.key == &spl_account_compression::id() {
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
    } else {
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

/// Wraps a custom event in the most recent version of application event data.
/// Modified from spl-account-compression to allow `noop_program` to be an `UncheckedAccount`
/// and choose the correct one based on program ID.
pub(crate) fn wrap_application_data_v1(
    custom_data: Vec<u8>,
    noop_program: &AccountInfo<'_>,
) -> Result<()> {
    if noop_program.key == &spl_noop::id() {
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
    } else if noop_program.key == &mpl_noop::id() {
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
    } else {
        return Err(BubblegumError::InvalidLogWrapper.into());
    }

    Ok(())
}

/// Validate the Merkle tree is owned by one of the valid program choices, and that the provided
/// log wrapper and compression program are one of the valid choices.
pub(crate) fn validate_ownership_and_programs(
    merkle_tree: &AccountInfo<'_>,
    log_wrapper: &AccountInfo<'_>,
    compression_program: &AccountInfo<'_>,
) -> Result<()> {
    if merkle_tree.owner == &spl_account_compression::id() {
        require!(
            log_wrapper.key == &spl_noop::id(),
            BubblegumError::InvalidLogWrapper
        );
        require!(
            compression_program.key == &spl_account_compression::id(),
            BubblegumError::InvalidCompressionProgram
        );
    } else if merkle_tree.owner == &mpl_account_compression::id() {
        require!(
            log_wrapper.key == &mpl_noop::id(),
            BubblegumError::InvalidLogWrapper
        );
        require!(
            compression_program.key == &mpl_account_compression::id(),
            BubblegumError::InvalidCompressionProgram
        );
    } else {
        return Err(BubblegumError::IncorrectOwner.into());
    }

    require!(log_wrapper.executable, BubblegumError::InvalidLogWrapper);
    require!(
        compression_program.executable,
        BubblegumError::InvalidCompressionProgram
    );

    Ok(())
}
