#![cfg(feature = "test-sbf")]
pub mod utils;

use anchor_lang::solana_program::instruction::InstructionError;

use solana_program_test::{tokio, BanksClientError};
use solana_sdk::{
    signature::{Keypair, Signer},
    transaction::TransactionError,
};

use crate::utils::Error::BanksClient;
use utils::{
    context::{BubblegumTestContext, DEFAULT_LAMPORTS_FUND_AMOUNT},
    tree::Tree,
    LeafArgs, Result,
};

// Test for multiple combinations?
const MAX_DEPTH: usize = 14;
const MAX_BUF_SIZE: usize = 64;

// Minting too many leaves takes quite a long time (in these tests at least).
const DEFAULT_NUM_MINTS: u64 = 10;

// TODO: test signer conditions on mint_authority and other stuff that's manually checked
// and not by anchor (what else is there?)

// TODO: will add some exta checks to the tests below (i.e. read accounts and
// assert on values therein).
// Creates a `BubblegumTestContext`, a `Tree` with default arguments, and also mints an NFT
// with the default `LeafArgs`.
pub async fn context_tree_and_leaves() -> Result<(
    BubblegumTestContext,
    Tree<MAX_DEPTH, MAX_BUF_SIZE>,
    Vec<LeafArgs>,
)> {
    let context = BubblegumTestContext::new().await?;

    let (tree, leaves) = context
        .default_create_and_mint::<MAX_DEPTH, MAX_BUF_SIZE>(DEFAULT_NUM_MINTS)
        .await?;

    Ok((context, tree, leaves))
}

#[tokio::test]
async fn test_create_tree_and_mint_passes() {
    // The mint operation implicitly called below also verifies that the on-chain tree
    // root matches the expected value as leaves are added.
    let (context, mut tree, _) = context_tree_and_leaves().await.unwrap();

    let payer = context.payer();

    let cfg = tree.read_tree_config().await.unwrap();
    assert_eq!(cfg.tree_creator, payer.pubkey());
    assert_eq!(cfg.tree_delegate, payer.pubkey());
    assert_eq!(cfg.total_mint_capacity, 1 << MAX_DEPTH);
    assert_eq!(cfg.num_minted, DEFAULT_NUM_MINTS);
}

#[tokio::test]
async fn test_creator_verify_and_unverify_passes() {
    let (context, mut tree, mut leaves) = context_tree_and_leaves().await.unwrap();

    // `verify_creator` and `unverify_creator` also validate the on-chain tree root
    // always has the expected value via the inner `TxBuilder::execute` call.

    for leaf in leaves.iter_mut() {
        tree.verify_creator(leaf, &context.default_creators[0])
            .await
            .unwrap();
    }

    for leaf in leaves.iter_mut() {
        tree.unverify_creator(leaf, &context.default_creators[0])
            .await
            .unwrap();
    }
}

#[tokio::test]
async fn test_delegate_passes() {
    let (_, mut tree, mut leaves) = context_tree_and_leaves().await.unwrap();
    let new_delegate = Keypair::new();

    // `delegate` also validates whether the on-chain tree root always has the expected
    // value via the inner `TxBuilder::execute` call.

    for leaf in leaves.iter_mut() {
        tree.delegate(leaf, &new_delegate).await.unwrap();
    }
}

#[tokio::test]
async fn test_transfer_passes() {
    let (_, mut tree, mut leaves) = context_tree_and_leaves().await.unwrap();
    let new_owner = Keypair::new();

    // `transfer` also validates whether the on-chain tree root always has the expected
    // value via the inner `TxBuilder::execute` call.

    for leaf in leaves.iter_mut() {
        tree.transfer(leaf, &new_owner).await.unwrap();
    }
}

#[tokio::test]
async fn test_delegated_transfer_passes() {
    let (mut context, mut tree, mut leaves) = context_tree_and_leaves().await.unwrap();
    context.warp_to_slot(100).unwrap();
    let delegate = Keypair::new();
    let new_owner = Keypair::new();

    context
        .fund_account(delegate.pubkey(), DEFAULT_LAMPORTS_FUND_AMOUNT)
        .await
        .unwrap();
    context.warp_to_slot(200).unwrap();

    for (index, leaf) in leaves.iter_mut().enumerate() {
        // We need to explicitly set a new delegate, since by default the owner has both
        // roles right after minting.
        tree.delegate(leaf, &delegate).await.unwrap();

        let mut tx = tree.transfer_tx(leaf, &new_owner).await.unwrap();

        // Set the delegate as payer and signer (by default, it's the owner).
        tx.set_payer(delegate.pubkey()).set_signers(&[&delegate]);

        // Also automatically checks the on-chain tree root matches the expected state.
        tx.execute().await.unwrap();
        context.warp_to_slot(300 + index as u64 * 100).unwrap();
    }
}

#[tokio::test]
async fn test_burn_passes() {
    let (_, mut tree, leaves) = context_tree_and_leaves().await.unwrap();

    // `burn` also validates whether the on-chain tree root always has the expected
    // value via the inner `TxBuilder::execute` call.

    for leaf in leaves.iter() {
        tree.burn(leaf).await.unwrap();
    }
}

#[tokio::test]
async fn test_set_tree_delegate_passes() {
    let (context, mut tree, _) = context_tree_and_leaves().await.unwrap();
    let new_tree_delegate = Keypair::new();

    // `set_tree_delegate` also validates whether the on-chain tree root always has the expected
    // value via the inner `TxBuilder::execute` call.

    let initial_cfg = tree.read_tree_config().await.unwrap();
    tree.set_tree_delegate(&new_tree_delegate).await.unwrap();
    let mut cfg = tree.read_tree_config().await.unwrap();

    // Configs are not the same.
    assert_ne!(cfg, initial_cfg);
    assert_eq!(cfg.tree_delegate, new_tree_delegate.pubkey());
    // Configs are the same if we change back the delegate (nothing else changed).
    cfg.tree_delegate = context.payer().pubkey();
    assert_eq!(cfg, initial_cfg);
}

#[tokio::test]
async fn test_redeem_and_cancel_passes() {
    let (_, mut tree, leaves) = context_tree_and_leaves().await.unwrap();
    tree.enable_decompression().await.unwrap();

    // `redeem` and `cancel_redeem` also validate the on-chain tree root
    // always has the expected value via the inner `TxBuilder::execute` call.

    for leaf in leaves.iter() {
        tree.redeem(leaf).await.unwrap();

        let v = tree.read_voucher(leaf.nonce).await.unwrap();
        assert_eq!(v, tree.expected_voucher(leaf));
    }

    for leaf in leaves.iter() {
        tree.cancel_redeem(leaf).await.unwrap();
    }
}

#[tokio::test]
async fn test_create_public_tree_and_mint_passes() {
    // The mint operation implicitly called below also verifies that the on-chain tree
    // root matches the expected value as leaves are added.
    let mut context = BubblegumTestContext::new().await.unwrap();
    let mut tree = context
        .create_public_tree::<MAX_DEPTH, MAX_BUF_SIZE>()
        .await
        .unwrap();
    let mut tree_private = context
        .default_create_tree::<MAX_DEPTH, MAX_BUF_SIZE>()
        .await
        .unwrap();
    let payer = context.payer();
    let minter = Keypair::new(); // NON tree authority payer, nor delegate

    context
        .fund_account(minter.pubkey(), 10000000000)
        .await
        .unwrap();
    let cfg = tree.read_tree_config().await.unwrap();

    let name = format!("test{}", 0);
    let symbol = format!("tst{}", 0);
    let mut args = LeafArgs::new(&minter, context.default_metadata_args(name, symbol));

    assert_eq!(cfg.tree_creator, payer.pubkey());
    assert_eq!(cfg.tree_delegate, payer.pubkey());
    assert_eq!(cfg.total_mint_capacity, 1 << MAX_DEPTH);
    assert!(cfg.is_public);

    tree.mint_v1_non_owner(&minter, &mut args).await.unwrap();
    let cfg = tree.read_tree_config().await.unwrap();
    assert_eq!(cfg.num_minted, 1);

    if let Err(err) = tree_private.mint_v1_non_owner(&minter, &mut args).await {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(0, InstructionError::Custom(6016),)
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }
}

#[tokio::test]
async fn test_create_public_tree_with_canopy() {
    let context = BubblegumTestContext::new().await.unwrap();
    let payer = context.payer();
    let mut tree = context
        .create_tree_with_canopy::<18, 64>(1, true)
        .await
        .unwrap();
    let cfg = tree.read_tree_config().await.unwrap();
    assert_eq!(cfg.tree_creator, payer.pubkey());
    assert_eq!(cfg.tree_delegate, payer.pubkey());
    assert!(cfg.is_public);
}

#[tokio::test]
async fn test_cannot_create_tree_needing_too_many_proofs_with_too_small_canopy() {
    let context = BubblegumTestContext::new().await.unwrap();

    let tree_create_result = context.create_tree_with_canopy::<19, 64>(1, true).await;

    if let Err(err) = tree_create_result {
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
async fn test_cannot_create_tree_needing_too_many_proofs_with_no_canopy() {
    let context = BubblegumTestContext::new().await.unwrap();

    let tree_create_result = context.create_tree_with_canopy::<19, 64>(1, true).await;

    if let Err(err) = tree_create_result {
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
async fn test_create_public_tree_with_zero_canopy() {
    let context = BubblegumTestContext::new().await.unwrap();

    let tree_create_result = context.create_tree_with_canopy::<18, 64>(0, true).await;

    if let Err(err) = tree_create_result {
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
async fn test_create_small_public_tree() {
    let context = BubblegumTestContext::new().await.unwrap();
    let payer = context.payer();

    // to make sure canopy check allows creating small trees
    let mut tree = context
        .create_tree_with_canopy::<3, 8>(0, true)
        .await
        .unwrap();

    let cfg = tree.read_tree_config().await.unwrap();

    assert_eq!(cfg.tree_creator, payer.pubkey());
    assert_eq!(cfg.tree_delegate, payer.pubkey());
    assert!(cfg.is_public);
}
