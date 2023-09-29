#![cfg(feature = "test-sbf")]
pub mod utils;
use crate::utils::{Error::BanksClient, LeafArgs};
use anchor_lang::solana_program::instruction::InstructionError;
use bubblegum::{error::BubblegumError, state::metaplex_adapter::Creator};
use solana_program_test::{tokio, BanksClientError};
use solana_sdk::{signature::Keypair, signer::Signer, transaction::TransactionError};
use utils::context::BubblegumTestContext;

const MAX_DEPTH: usize = 14;
const MAX_BUF_SIZE: usize = 64;

// See simple.rs for basic verify/unverify creator test.

#[tokio::test]
async fn mint_with_verified_creator() {
    let context = BubblegumTestContext::new().await.unwrap();

    let mut tree = context
        .default_create_tree::<MAX_DEPTH, MAX_BUF_SIZE>()
        .await
        .unwrap();

    let new_tree_delegate = Keypair::new();
    tree.set_tree_delegate(&new_tree_delegate).await.unwrap();

    let mut metadata = context.default_metadata_args("test".to_string(), "TST".to_string());

    // Set creator to tree delegate.
    metadata.creators = vec![Creator {
        address: new_tree_delegate.pubkey(),
        verified: true,
        share: 100,
    }];

    let mut args = LeafArgs::new(&context.payer(), metadata);

    // Cannot mint when delegate does not sign.
    if let Err(err) = tree.mint_v1(&context.payer(), &mut args).await {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(
                    0,
                    InstructionError::Custom(BubblegumError::CreatorDidNotVerify.into()),
                )
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }

    // Can mint when delegate signs.
    tree.mint_v1(&new_tree_delegate, &mut args).await.unwrap();
}

#[tokio::test]
async fn mint_to_collection_with_verified_creator() {
    let context = BubblegumTestContext::new().await.unwrap();

    let mut tree = context
        .default_create_tree::<MAX_DEPTH, MAX_BUF_SIZE>()
        .await
        .unwrap();

    let new_tree_delegate = Keypair::new();
    tree.set_tree_delegate(&new_tree_delegate).await.unwrap();

    let mut metadata = context.default_metadata_args("test".to_string(), "TST".to_string());

    // Set creator to tree delegate.
    metadata.creators = vec![Creator {
        address: new_tree_delegate.pubkey(),
        verified: true,
        share: 100,
    }];

    let mut args = LeafArgs::new(&context.payer(), metadata);

    // Cannot mint when delegate does not sign.
    if let Err(err) = tree
        .mint_to_collection_v1(
            &context.payer(),
            &mut args,
            &context.payer(),
            context.default_collection.mint.pubkey(),
            context.default_collection.metadata,
            context.default_collection.edition.unwrap(),
        )
        .await
    {
        if let BanksClient(BanksClientError::TransactionError(e)) = *err {
            assert_eq!(
                e,
                TransactionError::InstructionError(
                    0,
                    InstructionError::Custom(BubblegumError::CreatorDidNotVerify.into()),
                )
            );
        } else {
            panic!("Wrong variant");
        }
    } else {
        panic!("Should have failed");
    }

    // Can mint when delegate signs.
    tree.mint_to_collection_v1(
        &new_tree_delegate,
        &mut args,
        &context.payer(),
        context.default_collection.mint.pubkey(),
        context.default_collection.metadata,
        context.default_collection.edition.unwrap(),
    )
    .await
    .unwrap();
}
