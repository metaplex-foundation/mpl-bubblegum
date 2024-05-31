#![cfg(feature = "test-sbf")]
pub mod test_data;
pub mod utils;

use crate::utils::Error::BanksClient;
use anchor_lang::solana_program::instruction::InstructionError;
use bubblegum::state::{REALM, REALM_GOVERNING_MINT};
use mplx_staking_states::state::{
    DepositEntry, Lockup, LockupKind, LockupPeriod, Registrar, Voter, VotingMintConfig,
    REGISTRAR_DISCRIMINATOR, VOTER_DISCRIMINATOR,
};
use solana_program_test::tokio;
use solana_program_test::BanksClientError;
use solana_sdk::account::AccountSharedData;
use solana_sdk::instruction::AccountMeta;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::transaction::TransactionError;
use spl_merkle_tree_reference::{MerkleTree, Node};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};
use test_data::rollup_tree::*;
use utils::context::BubblegumTestContext;
use utils::tree::Tree;

const MAX_DEPTH: usize = 10;
const MAX_BUF_SIZE: usize = 32;

#[tokio::test]
async fn test_prepare_tree_without_canopy() {
    // preinitialise offchain tree for rollups
    let mut merkle_tree = MerkleTree::new(vec![Node::default(); 1 << MAX_DEPTH].as_slice());
    for (i, node) in MERKLE_TREE_NODES.iter().enumerate() {
        merkle_tree.add_leaf(*node, i);
    }

    assert_eq!(merkle_tree.get_root(), TREE_ROOT);

    // user
    let tree_creator = Keypair::from_bytes(TREE_CREATOR.as_ref()).unwrap();

    let tree_key = Keypair::from_bytes(TREE_KEY.as_ref()).unwrap();

    // get test context
    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let governance_program_id =
        Pubkey::from_str("CuyWCRdHT8pZLG793UR5R9z31AC49d47ZW9ggN6P7qZ4").unwrap();
    let realm_authority = Pubkey::from_str("Euec5oQGN3Y9kqVrz6PQRfTpYSn6jK3k1JonDiMTzAtA").unwrap();
    let voter_authority = program_context.test_context().payer.pubkey();

    let mplx_mint_key = Pubkey::new_unique();
    let grant_authority = Pubkey::new_unique();

    let registrar_key = Pubkey::find_program_address(
        &[
            REALM.to_bytes().as_ref(),
            b"registrar".as_ref(),
            REALM_GOVERNING_MINT.to_bytes().as_ref(),
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

    // // init structs for Registrar and Voter and fill it in with data
    let voting_mint_config = VotingMintConfig {
        mint: mplx_mint_key,
        grant_authority,
        baseline_vote_weight_scaled_factor: 0,
        max_extra_lockup_vote_weight_scaled_factor: 0,
        lockup_saturation_secs: 0,
        digit_shift: 0,
        padding: [0, 0, 0, 0, 0, 0, 0],
    };

    let registrar = Registrar {
        governance_program_id,
        realm: REALM,
        realm_governing_token_mint: REALM_GOVERNING_MINT,
        realm_authority,
        voting_mints: [
            voting_mint_config,
            voting_mint_config,
            voting_mint_config,
            voting_mint_config,
        ],
        time_offset: 0,
        bump: 0,
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
        _reserved1: [0; 5],
    };

    let deposit_entry = DepositEntry {
        lockup: lockup.clone(),
        amount_deposited_native: 100000000,
        voting_mint_config_idx: 0,
        is_used: true,
        _reserved1: [0; 6],
    };

    let deposit_entries = [deposit_entry; 32];

    let voter = Voter {
        deposits: deposit_entries,
        voter_authority,
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

    program_context
        .mut_test_context()
        .set_account(&registrar_key, &registrar_account);
    program_context
        .mut_test_context()
        .set_account(&voter_key, &voter_account);

    let mut tree = Tree::<MAX_DEPTH, MAX_BUF_SIZE>::with_preinitialised_tree(
        &tree_creator,
        &tree_key,
        program_context.client(),
        merkle_tree,
        1000,
        0,
    );

    tree.alloc(&program_context.test_context().payer)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        TREE_ROOT,
        RIGHTMOST_LEAF,
        999,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
    );

    for proof in RIGHTMOST_PROOFS {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(proof),
            is_signer: false,
            is_writable: false,
        });
    }

    tree_tx_builder.execute().await.unwrap();
}

#[tokio::test]
async fn test_prepare_tree_with_canopy() {
    // preinitialise offchain tree for rollups
    let mut merkle_tree = MerkleTree::new(vec![Node::default(); 1 << MAX_DEPTH].as_slice());
    for (i, node) in MERKLE_TREE_NODES.iter().enumerate() {
        merkle_tree.add_leaf(*node, i);
    }

    assert_eq!(merkle_tree.get_root(), TREE_ROOT);

    // user
    let tree_creator = Keypair::from_bytes(TREE_CREATOR.as_ref()).unwrap();

    let tree_key = Keypair::from_bytes(TREE_KEY.as_ref()).unwrap();

    // get test context
    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let governance_program_id =
        Pubkey::from_str("CuyWCRdHT8pZLG793UR5R9z31AC49d47ZW9ggN6P7qZ4").unwrap();
    let realm_authority = Pubkey::from_str("Euec5oQGN3Y9kqVrz6PQRfTpYSn6jK3k1JonDiMTzAtA").unwrap();
    let voter_authority = program_context.test_context().payer.pubkey();

    let mplx_mint_key = Pubkey::new_unique();
    let grant_authority = Pubkey::new_unique();

    let registrar_key = Pubkey::find_program_address(
        &[
            REALM.to_bytes().as_ref(),
            b"registrar".as_ref(),
            REALM_GOVERNING_MINT.to_bytes().as_ref(),
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

    // // init structs for Registrar and Voter and fill it in with data
    let voting_mint_config = VotingMintConfig {
        mint: mplx_mint_key,
        grant_authority,
        baseline_vote_weight_scaled_factor: 0,
        max_extra_lockup_vote_weight_scaled_factor: 0,
        lockup_saturation_secs: 0,
        digit_shift: 0,
        padding: [0, 0, 0, 0, 0, 0, 0],
    };

    let registrar = Registrar {
        governance_program_id,
        realm: REALM,
        realm_governing_token_mint: REALM_GOVERNING_MINT,
        realm_authority,
        voting_mints: [
            voting_mint_config,
            voting_mint_config,
            voting_mint_config,
            voting_mint_config,
        ],
        time_offset: 0,
        bump: 0,
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
        _reserved1: [0; 5],
    };

    let deposit_entry = DepositEntry {
        lockup: lockup.clone(),
        amount_deposited_native: 100000000,
        voting_mint_config_idx: 0,
        is_used: true,
        _reserved1: [0; 6],
    };

    let deposit_entries = [deposit_entry; 32];

    let voter = Voter {
        deposits: deposit_entries,
        voter_authority,
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

    program_context
        .mut_test_context()
        .set_account(&registrar_key, &registrar_account);
    program_context
        .mut_test_context()
        .set_account(&voter_key, &voter_account);

    let mut tree = Tree::<MAX_DEPTH, MAX_BUF_SIZE>::with_preinitialised_tree(
        &tree_creator,
        &tree_key,
        program_context.client(),
        merkle_tree,
        1000,
        5,
    );

    tree.alloc(&program_context.test_context().payer)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    for (i, ch) in CANOPY_LEAVES.chunks(20).enumerate() {
        let start_index = i * 20;

        let mut add_canopy_tx_builder = tree.add_canopy_tx(
            &program_context.test_context().payer,
            start_index as u32,
            ch.to_vec(),
        );

        add_canopy_tx_builder
            .execute_without_root_check()
            .await
            .unwrap();
    }

    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        TREE_ROOT,
        RIGHTMOST_LEAF,
        999,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
    );

    for proof in RIGHTMOST_PROOFS {
        tree_tx_builder.additional_accounts.push(AccountMeta {
            pubkey: Pubkey::new_from_array(proof),
            is_signer: false,
            is_writable: false,
        });
    }

    tree_tx_builder.execute().await.unwrap();
}

#[tokio::test]
async fn test_put_wrong_canopy() {
    // preinitialise offchain tree for rollups
    let mut merkle_tree = MerkleTree::new(vec![Node::default(); 1 << MAX_DEPTH].as_slice());
    for (i, node) in MERKLE_TREE_NODES.iter().enumerate() {
        merkle_tree.add_leaf(*node, i);
    }

    assert_eq!(merkle_tree.get_root(), TREE_ROOT);

    let canopy_leaves = vec![[10; 32]; 32];

    // user
    let tree_creator = Keypair::from_bytes(TREE_CREATOR.as_ref()).unwrap();

    let tree_key = Keypair::from_bytes(TREE_KEY.as_ref()).unwrap();

    // get test context
    let mut program_context = BubblegumTestContext::new().await.unwrap();

    let governance_program_id =
        Pubkey::from_str("CuyWCRdHT8pZLG793UR5R9z31AC49d47ZW9ggN6P7qZ4").unwrap();
    let realm_authority = Pubkey::from_str("Euec5oQGN3Y9kqVrz6PQRfTpYSn6jK3k1JonDiMTzAtA").unwrap();
    let voter_authority = program_context.test_context().payer.pubkey();

    let mplx_mint_key = Pubkey::new_unique();
    let grant_authority = Pubkey::new_unique();

    let registrar_key = Pubkey::find_program_address(
        &[
            REALM.to_bytes().as_ref(),
            b"registrar".as_ref(),
            REALM_GOVERNING_MINT.to_bytes().as_ref(),
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

    // // init structs for Registrar and Voter and fill it in with data
    let voting_mint_config = VotingMintConfig {
        mint: mplx_mint_key,
        grant_authority,
        baseline_vote_weight_scaled_factor: 0,
        max_extra_lockup_vote_weight_scaled_factor: 0,
        lockup_saturation_secs: 0,
        digit_shift: 0,
        padding: [0, 0, 0, 0, 0, 0, 0],
    };

    let registrar = Registrar {
        governance_program_id,
        realm: REALM,
        realm_governing_token_mint: REALM_GOVERNING_MINT,
        realm_authority,
        voting_mints: [
            voting_mint_config,
            voting_mint_config,
            voting_mint_config,
            voting_mint_config,
        ],
        time_offset: 0,
        bump: 0,
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
        _reserved1: [0; 5],
    };

    let deposit_entry = DepositEntry {
        lockup: lockup.clone(),
        amount_deposited_native: 100000000,
        voting_mint_config_idx: 0,
        is_used: true,
        _reserved1: [0; 6],
    };

    let deposit_entries = [deposit_entry; 32];

    let voter = Voter {
        deposits: deposit_entries,
        voter_authority,
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

    program_context
        .mut_test_context()
        .set_account(&registrar_key, &registrar_account);
    program_context
        .mut_test_context()
        .set_account(&voter_key, &voter_account);

    let mut tree = Tree::<MAX_DEPTH, MAX_BUF_SIZE>::with_preinitialised_tree(
        &tree_creator,
        &tree_key,
        program_context.client(),
        merkle_tree,
        1000,
        5,
    );

    tree.alloc(&program_context.test_context().payer)
        .await
        .unwrap();

    let mut tree_tx_builder = tree.prepare_tree_tx(
        &program_context.test_context().payer,
        false,
        MAX_DEPTH as u32,
        MAX_BUF_SIZE as u32,
    );

    tree_tx_builder.execute_without_root_check().await.unwrap();

    for (i, ch) in canopy_leaves.chunks(20).enumerate() {
        let start_index = i * 20;

        let mut add_canopy_tx_builder = tree.add_canopy_tx(
            &program_context.test_context().payer,
            start_index as u32,
            ch.to_vec(),
        );

        add_canopy_tx_builder
            .execute_without_root_check()
            .await
            .unwrap();
    }

    let mut tree_tx_builder = tree.finalize_tree_with_root_tx(
        &program_context.test_context().payer,
        TREE_ROOT,
        RIGHTMOST_LEAF,
        999,
        "http://some-url.com".to_string(),
        "fileHash".to_string(),
        registrar_key,
        voter_key,
    );

    for proof in RIGHTMOST_PROOFS {
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
                TransactionError::InstructionError(0, InstructionError::Custom(6011),)
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }
}
