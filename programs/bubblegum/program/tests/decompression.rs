#![cfg(feature = "test-sbf")]
pub mod utils;

use bubblegum::error::BubblegumError;
use mpl_token_metadata::{
    accounts::{MasterEdition, Metadata},
    types::TokenStandard,
    MAX_NAME_LENGTH, MAX_SYMBOL_LENGTH, MAX_URI_LENGTH,
};
use solana_program::{account_info::AccountInfo, program_option::COption, program_pack::Pack};
use solana_program_test::{tokio, BanksClientError};

use anchor_lang::solana_program::instruction::InstructionError;
use solana_sdk::{signer::Signer, transaction::TransactionError};
use spl_associated_token_account::get_associated_token_address;
use spl_token::state::Mint;
use utils::context::BubblegumTestContext;

use crate::utils::{puffed_out_string, tree::decompress_mint_auth_pda, Error::BanksClient};

// Test for multiple combinations?
const MAX_DEPTH: usize = 14;
const MAX_BUF_SIZE: usize = 64;

// Minting too many leaves takes quite a long time (in these tests at least).
const DEFAULT_NUM_MINTS: u64 = 10;

#[tokio::test]
async fn test_decompress_passes() {
    let context = BubblegumTestContext::new().await.unwrap();

    let (mut tree, mut leaves) = context
        .default_create_and_mint::<MAX_DEPTH, MAX_BUF_SIZE>(DEFAULT_NUM_MINTS)
        .await
        .unwrap();

    tree.enable_decompression().await.unwrap();

    for leaf in leaves.iter_mut() {
        tree.verify_creator(leaf, &context.default_creators[0])
            .await
            .unwrap();

        tree.verify_collection(
            leaf,
            &context.payer(),
            context.default_collection.mint.pubkey(),
            context.default_collection.metadata,
            context.default_collection.edition.unwrap(),
        )
        .await
        .unwrap();

        tree.redeem(leaf).await.unwrap();
        let voucher = tree.read_voucher(leaf.nonce).await.unwrap();

        // `decompress_v1` also validates whether the on-chain tree root always has
        // the expected value via the inner `TxBuilder::execute` call.
        tree.decompress_v1(&voucher, leaf).await.unwrap();

        let mint_key = voucher.decompress_mint_pda();
        let mint_account = tree.read_account(mint_key).await.unwrap();
        let mint = Mint::unpack(mint_account.data.as_slice()).unwrap();

        let expected_mint = Mint {
            mint_authority: COption::Some(MasterEdition::find_pda(&mint_key).0),
            supply: 1,
            decimals: 0,
            is_initialized: true,
            freeze_authority: COption::Some(MasterEdition::find_pda(&mint_key).0),
        };

        assert_eq!(mint, expected_mint);

        let token_account_key = get_associated_token_address(&leaf.owner.pubkey(), &mint_key);
        let token_account = tree.read_account(token_account_key).await.unwrap();
        let t = spl_token::state::Account::unpack(token_account.data.as_slice()).unwrap();

        let expected_t = spl_token::state::Account {
            mint: mint_key,
            owner: leaf.owner.pubkey(),
            amount: 1,
            state: spl_token::state::AccountState::Initialized,
            delegated_amount: 0,
            delegate: COption::None,
            is_native: COption::None,
            close_authority: COption::None,
        };

        assert_eq!(t, expected_t);

        let metadata_key = Metadata::find_pda(&mint_key).0;
        let mut meta_account = tree.read_account(metadata_key).await.unwrap();

        let meta: mpl_token_metadata::accounts::Metadata =
            mpl_token_metadata::accounts::Metadata::try_from(&AccountInfo::from((
                &metadata_key,
                &mut meta_account,
            )))
            .unwrap();

        let mut expected_creators = Vec::new();

        // Can't compare directly as they are different types for some reason.
        for c1 in leaf.metadata.creators.iter() {
            expected_creators.push(mpl_token_metadata::types::Creator {
                address: c1.address,
                verified: c1.verified,
                share: c1.share,
            });
        }

        assert!(expected_creators[0].verified);

        let expected_meta = mpl_token_metadata::accounts::Metadata {
            key: mpl_token_metadata::types::Key::MetadataV1,
            update_authority: decompress_mint_auth_pda(mint_key),
            mint: mint_key,
            name: puffed_out_string(&leaf.metadata.name, MAX_NAME_LENGTH),
            symbol: puffed_out_string(&leaf.metadata.symbol, MAX_SYMBOL_LENGTH),
            uri: puffed_out_string(&leaf.metadata.uri, MAX_URI_LENGTH),
            seller_fee_basis_points: leaf.metadata.seller_fee_basis_points,
            creators: Some(expected_creators),
            primary_sale_happened: false,
            is_mutable: false,
            collection: leaf.metadata.collection.as_mut().map(|c| c.adapt()),
            uses: None,
            collection_details: None,
            // Simply copying this, since the expected value is not straightforward to predict.
            edition_nonce: meta.edition_nonce,
            token_standard: Some(TokenStandard::NonFungible),
            programmable_config: None,
        };

        assert_eq!(meta, expected_meta);

        // Test master edition account.
        let me_key = MasterEdition::find_pda(&mint_key).0;
        let mut me_account = tree.read_account(me_key).await.unwrap();
        let me: MasterEdition =
            MasterEdition::try_from(&AccountInfo::from((&me_key, &mut me_account))).unwrap();

        let expected_me = MasterEdition {
            key: mpl_token_metadata::types::Key::MasterEditionV2,
            supply: 0,
            max_supply: Some(0),
        };
        assert_eq!(me, expected_me);
    }
}

#[tokio::test]
async fn test_decompress_fails_when_disabled() {
    let context = BubblegumTestContext::new().await.unwrap();

    let (mut tree, mut leaves) = context
        .default_create_and_mint::<MAX_DEPTH, MAX_BUF_SIZE>(DEFAULT_NUM_MINTS)
        .await
        .unwrap();

    let leaf = leaves.first_mut().unwrap();

    tree.verify_creator(leaf, &context.default_creators[0])
        .await
        .unwrap();

    tree.verify_collection(
        leaf,
        &context.payer(),
        context.default_collection.mint.pubkey(),
        context.default_collection.metadata,
        context.default_collection.edition.unwrap(),
    )
    .await
    .unwrap();

    let err = tree.redeem(leaf).await.unwrap_err();
    // Cannot mint when delegate does not sign.
    if let BanksClient(BanksClientError::TransactionError(e)) = *err {
        assert_eq!(
            e,
            TransactionError::InstructionError(
                0,
                InstructionError::Custom(BubblegumError::DecompressionDisabled.into()),
            )
        );
    } else {
        panic!("Wrong variant");
    }
}
