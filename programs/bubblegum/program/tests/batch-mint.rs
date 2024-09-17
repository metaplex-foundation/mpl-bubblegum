#![cfg(feature = "test-sbf")]
pub mod utils;

use crate::utils::{clone_keypair, Error::BanksClient, LeafArgs};
use anchor_lang::solana_program::instruction::InstructionError;
use bubblegum::{
    error::BubblegumError,
    state::{
        metaplex_adapter::{MetadataArgs, TokenProgramVersion, TokenStandard},
        PROTOCOL_FEE_PER_1024_ASSETS, VOTER_DISCRIMINATOR,
    },
};
use mpl_common_constants::constants::{DAO_GOVERNING_MINT, DAO_PUBKEY, FEE_RECEIVER};
use mplx_staking_states::state::{
    DepositEntry, Lockup, LockupKind, LockupPeriod, Registrar, Voter, VotingMintConfig,
    REGISTRAR_DISCRIMINATOR,
};
use solana_program_test::{tokio, BanksClientError};
use solana_sdk::{
    account::AccountSharedData,
    instruction::AccountMeta,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::TransactionError,
};
use std::{
    collections::HashSet,
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};
use utils::{context::BubblegumTestContext, tree::Tree};

const MAX_DEPTH: usize = 10;
const MAX_BUF_SIZE: usize = 32;

// Creates Tree object and generates test assets without minting it
async fn preinitialize_merkle_tree(
    program_context: &BubblegumTestContext,
    tree_creator: &Keypair,
    assets_owner: &Keypair,
    canopy_depth: Option<u32>,
    num_of_assets: usize,
) -> Tree<MAX_DEPTH, MAX_BUF_SIZE> {
    let mut tree = Tree::<MAX_DEPTH, MAX_BUF_SIZE>::with_creator_and_canopy(
        tree_creator,
        canopy_depth,
        program_context.client(),
    );

    for i in 0..num_of_assets {
        let (_asset, leaf_args) = create_test_metadata_args(assets_owner, assets_owner, i as u64);
        tree.update_leaf(&leaf_args).unwrap();
    }

    tree.alloc(&program_context.test_context().payer)
        .await
        .unwrap();

    tree
}

fn create_test_metadata_args(
    assets_owner: &Keypair,
    assets_delegate: &Keypair,
    index: u64,
) -> (MetadataArgs, LeafArgs) {
    let asset = MetadataArgs {
        name: format!("{index}"),
        symbol: format!("symbol-{index}"),
        uri: format!("https://immutable-storage/asset/{index}"),
        seller_fee_basis_points: 0,
        primary_sale_happened: false,
        is_mutable: false,
        edition_nonce: None,
        token_standard: Some(TokenStandard::NonFungible),
        collection: None,
        uses: None,
        token_program_version: TokenProgramVersion::Original,
        creators: Vec::new(),
    };

    let leaf_args = LeafArgs {
        owner: clone_keypair(assets_owner),
        delegate: clone_keypair(assets_delegate),
        metadata: asset.clone(),
        nonce: index,
        index: index as u32,
    };

    (asset, leaf_args)
}

async fn get_canopy_from_tree(
    merkle_tree: &Tree<MAX_DEPTH, MAX_BUF_SIZE>,
    tree_depth: usize,
) -> Vec<[u8; 32]> {
    let mut canopy = Vec::new();

    let node_indexes: Vec<_> = (0..1 << tree_depth).collect();

    for i in node_indexes {
        let proofs: Vec<[u8; 32]> = merkle_tree.proof_of_leaf(i);

        canopy.push(
            proofs
                .get(merkle_tree.canopy_depth as usize)
                .unwrap()
                .clone(),
        );
    }

    // drop duplications because we iterate through all the assets
    // some of them have same hash in path on canopy's level
    let mut seen = HashSet::new();
    canopy.retain(|c| {
        let is_first = !seen.contains(c);
        seen.insert(c.clone());
        is_first
    });

    // have to do it because MerkleTree returns hashes where each pair is reversed
    // and this is happening because the proof doesn't contain the parent of the leaf.
    // It contains the neighbor of every relevant node up to one level below the root.
    // Having those neighbors and the leaf you may recreate the root. So the actual canopy leaf is
    // either calculable from the leaf and it's proof by hashing those hashes up to the canopy level,
    // or taken from the neighbor, which is done here.
    reverse_each_couple(&mut canopy);

    canopy
}

fn reverse_each_couple<T>(vec: &mut Vec<T>) {
    let len = vec.len();
    let mut i = 0;
    while i + 1 < len {
        vec.swap(i, i + 1);
        i += 2;
    }
}

// This function initializes registrar, voter and mining keys.
// Those registrar and voter are related to SPL Governance program. And the mining key is related to the reward program.
// Initialization of these account is required because batch creation requires MPLX stake,
// and all the user's information about stake is saving on these accounts.
async fn initialize_staking_accounts(
    program_context: &mut BubblegumTestContext,
) -> (Pubkey, Pubkey, Pubkey) {
    let governance_program_id =
        Pubkey::from_str("CuyWCRdHT8pZLG793UR5R9z31AC49d47ZW9ggN6P7qZ4").unwrap();
    let realm_authority = Pubkey::from_str("Euec5oQGN3Y9kqVrz6PQRfTpYSn6jK3k1JonDiMTzAtA").unwrap();
    let voter_authority = program_context.test_context().payer.pubkey();

    let mplx_mint_key = Pubkey::new_unique();
    let grant_authority = Pubkey::new_unique();
    let mining_key = Pubkey::new_unique();
    let reward_pool_key = Pubkey::new_unique();

    let registrar_key = Pubkey::find_program_address(
        &[
            DAO_PUBKEY.as_ref(),
            b"registrar".as_ref(),
            DAO_GOVERNING_MINT.as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;

    let (voter_key, voter_bump) = Pubkey::find_program_address(
        &[
            registrar_key.to_bytes().as_ref(),
            b"voter".as_ref(),
            voter_authority.to_bytes().as_ref(),
        ],
        &mplx_staking_states::ID,
    );

    // init structs for Registrar and Voter and fill it in with data
    let voting_mint_config = VotingMintConfig {
        mint: mplx_mint_key,
        grant_authority,
    };

    let registrar = Registrar {
        governance_program_id: governance_program_id.clone(),
        realm: Pubkey::new_from_array(DAO_PUBKEY),
        realm_governing_token_mint: Pubkey::new_from_array(DAO_GOVERNING_MINT),
        realm_authority: realm_authority.clone(),
        voting_mints: [voting_mint_config, voting_mint_config],
        reward_pool: reward_pool_key,
        bump: 0,
        padding: [0; 7],
    };

    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let lockup = Lockup {
        start_ts: 0,
        end_ts: current_time + 100,
        cooldown_ends_at: 0,
        cooldown_requested: false,
        kind: LockupKind::Constant,
        period: LockupPeriod::ThreeMonths,
        _reserved0: [0; 16],
        _reserved1: [0; 5],
    };

    let deposit_entry = DepositEntry {
        lockup: lockup.clone(),
        amount_deposited_native: 100_000_000_000_000,
        voting_mint_config_idx: 0,
        is_used: true,
        delegate: Pubkey::new_unique(),
        delegate_last_update_ts: 0,
        _reserved0: [0; 32],
        _reserved1: [0; 6],
    };

    let deposit_entries = [deposit_entry; 32];

    let voter = Voter {
        deposits: deposit_entries,
        voter_authority: voter_authority.clone(),
        registrar: registrar_key,
        voter_bump,
        voter_weight_record_bump: 0,
        _reserved1: [0; 14],
    };

    let registrar_acc_data = [
        REGISTRAR_DISCRIMINATOR.as_ref(),
        bytemuck::bytes_of(&registrar),
    ]
    .concat();
    let voter_acc_data = [VOTER_DISCRIMINATOR.as_ref(), bytemuck::bytes_of(&voter)].concat();

    // for next two accounts set arbitrary balance because it doesn't meter for test
    let mut registrar_account = AccountSharedData::new(
        10000000000000000,
        registrar_acc_data.len(),
        &mplx_staking_states::ID,
    );
    registrar_account.set_data_from_slice(registrar_acc_data.as_ref());

    let mut voter_account = AccountSharedData::new(
        10000000000000000,
        voter_acc_data.len(),
        &mplx_staking_states::ID,
    );
    voter_account.set_data_from_slice(voter_acc_data.as_ref());
    let mut mining_acc_data = [0; mplx_rewards::state::WrappedMining::LEN];
    // TODO: good luck trying to make it work with those allignment requirements of the WrappedMining struct,
    // let account_type:u8 = mplx_rewards::state::AccountType::Mining.into();
    // mining_acc_data[0] = account_type;
    // let mining_acc = mplx_rewards::state::WrappedMining::from_bytes_mut(&mut mining_acc_data)
    //     .expect("Failed to create mining account");
    // mining_acc.mining.owner = voter_authority;
    // mining_acc.mining.stake_from_others = 0;
    // so here is a hacky way to set the owner of the mining account directly
    mining_acc_data[32..64].copy_from_slice(&voter_authority.to_bytes());
    let mut mining_account =
        AccountSharedData::new(10000000000000000, mining_acc_data.len(), &mplx_rewards::ID);
    mining_account.set_data_from_slice(mining_acc_data.as_ref());
    program_context
        .mut_test_context()
        .set_account(&registrar_key, &registrar_account);
    program_context
        .mut_test_context()
        .set_account(&voter_key, &voter_account);
    program_context
        .mut_test_context()
        .set_account(&mining_key, &mining_account);

    (registrar_key, voter_key, mining_key)
}

#[tokio::test]
async fn test_prepare_tree_without_canopy() {
    let tree_creator = Keypair::new();

    let asset_owner = Keypair::new();

    let num_of_assets_to_mint = 1000;

    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let mut tree = preinitialize_merkle_tree(
        &program_context,
        &tree_creator,
        &asset_owner,
        None,
        num_of_assets_to_mint,
    )
    .await;

    let rightmost_proof = tree.proof_of_leaf((num_of_assets_to_mint - 1) as u32);
    let rightmost_leaf = tree.get_node(num_of_assets_to_mint - 1);

    let (registrar_key, voter_key, mining_key) =
        initialize_staking_accounts(&mut program_context).await;

    let fee_receiver = Pubkey::new_from_array(FEE_RECEIVER);

    program_context
        .fund_account(tree.creator_pubkey(), 10_000_000_000)
        .await
        .unwrap();
    program_context
        .fund_account(fee_receiver, 10_000_000_000)
        .await
        .unwrap();
    let start_fee_receiver_balance = program_context
        .client()
        .get_account(fee_receiver)
        .await
        .unwrap()
        .unwrap()
        .lamports;
    let start_staker_balance = program_context
        .client()
        .get_account(program_context.test_context().payer.pubkey())
        .await
        .unwrap()
        .unwrap()
        .lamports;

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        &tree_creator,
        tree.expected_root(),
        rightmost_leaf,
        (num_of_assets_to_mint - 1) as u32,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
        mining_key,
        fee_receiver,
    );

    for proof in rightmost_proof {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(proof),
            is_signer: false,
            is_writable: false,
        });
    }

    tree_tx_builder.execute().await.unwrap();

    let end_fee_receiver_balance = program_context
        .client()
        .get_account(fee_receiver)
        .await
        .unwrap()
        .unwrap()
        .lamports;
    let end_staker_balance = program_context
        .client()
        .get_account(program_context.test_context().payer.pubkey())
        .await
        .unwrap()
        .unwrap()
        .lamports;

    // such as payer paid for TreeConfig account creation(rent space) in PrepareTree instruction
    // and it paid Solana txs fee
    // we deduct sum of that expenses to check if protocol fee was really charged
    let solana_fee = 1579040;

    assert_eq!(
        end_fee_receiver_balance,
        start_fee_receiver_balance + PROTOCOL_FEE_PER_1024_ASSETS
    );
    assert_eq!(
        end_staker_balance,
        start_staker_balance - PROTOCOL_FEE_PER_1024_ASSETS - solana_fee
    );
}

#[tokio::test]
async fn test_prepare_tree_with_canopy() {
    let tree_creator = Keypair::new();

    let asset_owner = Keypair::new();

    let canopy_depth = 5;
    let num_of_assets_to_mint = 1000;

    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let mut tree = preinitialize_merkle_tree(
        &program_context,
        &tree_creator,
        &asset_owner,
        Some(canopy_depth),
        num_of_assets_to_mint,
    )
    .await;

    let canopy_hashes = get_canopy_from_tree(&tree, MAX_DEPTH).await;
    let rightmost_leaf = tree.get_node(num_of_assets_to_mint - 1);
    let rightmost_proof = tree.proof_of_leaf((num_of_assets_to_mint - 1) as u32);

    let (registrar_key, voter_key, mining_key) =
        initialize_staking_accounts(&mut program_context).await;

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    for (i, ch) in canopy_hashes.chunks(20).enumerate() {
        let start_index = i * 20;

        let mut add_canopy_tx_builder = tree.add_canopy_tx(
            &program_context.test_context().payer,
            &tree_creator,
            start_index as u32,
            ch.to_vec(),
        );

        add_canopy_tx_builder
            .execute_without_root_check()
            .await
            .unwrap();
    }

    let fee_receiver = Pubkey::new_from_array(FEE_RECEIVER);

    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        &tree_creator,
        tree.expected_root(),
        rightmost_leaf,
        (num_of_assets_to_mint - 1) as u32,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
        mining_key,
        fee_receiver,
    );

    for proof in rightmost_proof[..canopy_depth as usize].iter() {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(*proof),
            is_signer: false,
            is_writable: false,
        });
    }

    tree_tx_builder.execute().await.unwrap();
}

#[tokio::test]
async fn test_put_wrong_canopy() {
    let tree_creator = Keypair::new();

    let asset_owner = Keypair::new();

    let canopy_depth = 5;
    let num_of_assets_to_mint = 1000;

    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let mut tree = preinitialize_merkle_tree(
        &program_context,
        &tree_creator,
        &asset_owner,
        Some(canopy_depth),
        num_of_assets_to_mint,
    )
    .await;

    let rightmost_leaf = tree.get_node(num_of_assets_to_mint - 1);
    let rightmost_proof = tree.proof_of_leaf((num_of_assets_to_mint - 1) as u32);

    let canopy_hashes = vec![[1; 32]; 32];

    let (registrar_key, voter_key, mining_key) =
        initialize_staking_accounts(&mut program_context).await;

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    for (i, ch) in canopy_hashes.chunks(20).enumerate() {
        let start_index = i * 20;

        let mut add_canopy_tx_builder = tree.add_canopy_tx(
            &program_context.test_context().payer,
            &tree_creator,
            start_index as u32,
            ch.to_vec(),
        );

        add_canopy_tx_builder
            .execute_without_root_check()
            .await
            .unwrap();
    }

    let fee_receiver = Pubkey::new_from_array(FEE_RECEIVER);

    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        &tree_creator,
        tree.expected_root(),
        rightmost_leaf,
        (num_of_assets_to_mint - 1) as u32,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
        mining_key,
        fee_receiver,
    );

    for proof in rightmost_proof {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(proof),
            is_signer: false,
            is_writable: false,
        });
    }

    let res = tree_tx_builder.execute().await;

    if let Err(err) = res {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(0, InstructionError::Custom(6012),)
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }
}

#[tokio::test]
async fn test_prepare_with_small_canopy() {
    let program_context = BubblegumTestContext::new().await.unwrap();

    #[allow(non_upper_case_globals)]
    const tree_depth: usize = 20;
    #[allow(non_upper_case_globals)]
    const tree_buffer: usize = 64;

    let tree_creator = Keypair::new();

    let mut tree = Tree::<tree_depth, tree_buffer>::with_creator_and_canopy(
        &tree_creator,
        None,
        program_context.client(),
    );

    tree.alloc(&program_context.test_context().payer)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        tree_depth as u32,
        tree_buffer as u32,
    );

    let res = tree_tx_builder.execute_without_root_check().await;

    if let Err(err) = res {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(0, InstructionError::Custom(6041),)
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }
}

#[tokio::test]
async fn test_put_wrong_fee_receiver() {
    let tree_creator = Keypair::new();

    let asset_owner = Keypair::new();

    let num_of_assets_to_mint = 1000;

    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let mut tree = preinitialize_merkle_tree(
        &program_context,
        &tree_creator,
        &asset_owner,
        None,
        num_of_assets_to_mint,
    )
    .await;

    let rightmost_leaf = tree.get_node(num_of_assets_to_mint - 1);
    let rightmost_proof = tree.proof_of_leaf((num_of_assets_to_mint - 1) as u32);

    let (registrar_key, voter_key, mining_key) =
        initialize_staking_accounts(&mut program_context).await;

    let fee_receiver = Pubkey::new_from_array(FEE_RECEIVER);

    program_context
        .fund_account(tree.creator_pubkey(), 10_000_000_000)
        .await
        .unwrap();
    program_context
        .fund_account(fee_receiver, 10_000_000_000)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    let wrong_fee_receiver = Pubkey::new_unique();
    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        &tree_creator,
        tree.expected_root(),
        rightmost_leaf,
        (num_of_assets_to_mint - 1) as u32,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
        mining_key,
        wrong_fee_receiver,
    );

    for proof in rightmost_proof {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(proof),
            is_signer: false,
            is_writable: false,
        });
    }

    let res = tree_tx_builder.execute().await;
    if let Err(err) = res {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(
                    0,
                    InstructionError::Custom(BubblegumError::FeeReceiverMismatch.into()),
                )
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }
}

#[tokio::test]
async fn test_prepare_tree_with_collection() {
    let tree_creator = Keypair::new();

    let asset_owner = Keypair::new();

    let num_of_assets_to_mint = 1000;

    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let mut tree = preinitialize_merkle_tree(
        &program_context,
        &tree_creator,
        &asset_owner,
        None,
        num_of_assets_to_mint,
    )
    .await;

    let fee_receiver = Pubkey::new_from_array(FEE_RECEIVER);

    let rightmost_proof = tree.proof_of_leaf((num_of_assets_to_mint - 1) as u32);
    let rightmost_leaf = tree.get_node(num_of_assets_to_mint - 1);

    let (registrar_key, voter_key, mining_key) =
        initialize_staking_accounts(&mut program_context).await;

    program_context
        .fund_account(tree.creator_pubkey(), 10_000_000_000)
        .await
        .unwrap();
    program_context
        .fund_account(fee_receiver, 10_000_000_000)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    let mut tree_tx_builder = tree.finalize_tree_with_root_and_collection_tx(
        &program_context.payer(),
        &program_context.default_collection,
        &program_context.test_context().payer,
        &tree_creator,
        tree.expected_root(),
        rightmost_leaf,
        999,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
        mining_key,
        fee_receiver,
    );

    for proof in rightmost_proof {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(proof),
            is_signer: false,
            is_writable: false,
        });
    }

    tree_tx_builder.execute().await.unwrap();
}

#[tokio::test]
async fn test_prepare_tree_with_collection_wrong_authority() {
    let tree_creator = Keypair::new();

    let asset_owner = Keypair::new();

    let num_of_assets_to_mint = 1000;

    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let mut tree = preinitialize_merkle_tree(
        &program_context,
        &tree_creator,
        &asset_owner,
        None,
        num_of_assets_to_mint,
    )
    .await;

    let fee_receiver = Pubkey::new_from_array(FEE_RECEIVER);

    let rightmost_leaf = tree.get_node(num_of_assets_to_mint - 1);

    let (registrar_key, voter_key, mining_key) =
        initialize_staking_accounts(&mut program_context).await;

    program_context
        .fund_account(tree.creator_pubkey(), 10_000_000_000)
        .await
        .unwrap();
    program_context
        .fund_account(fee_receiver, 10_000_000_000)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        &tree_creator,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    let mut tree_tx_builder = tree.finalize_tree_with_root_and_collection_tx(
        &tree_creator,
        &program_context.default_collection,
        &program_context.test_context().payer,
        &tree_creator,
        tree.expected_root(),
        rightmost_leaf,
        999,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
        mining_key,
        fee_receiver,
    );

    let res = tree_tx_builder.execute().await;
    if let Err(err) = res {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(
                    0,
                    InstructionError::Custom(BubblegumError::InvalidCollectionAuthority.into()),
                )
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }
}
