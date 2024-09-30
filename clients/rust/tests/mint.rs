#![cfg(feature = "test-sbf")]
pub mod setup;
pub use setup::*;

use mpl_bubblegum::{
    hash::{hash_creators, hash_metadata},
    types::{Creator, MetadataArgs, TokenProgramVersion, TokenStandard},
    utils::get_asset_id,
};
use solana_program_test::tokio;
use solana_sdk::signature::Keypair;
use solana_sdk::signature::Signer;

mod mint {

    use super::*;

    #[tokio::test]
    async fn mint_asset() {
        let mut program_test = create_program_test();
        program_test.set_compute_max_units(400_000);
        let mut context = program_test.start_with_context().await;

        // Given a new merkle tree.

        let mut tree_manager = TreeManager::<6, 16>::default();
        tree_manager.create(&mut context).await.unwrap();

        assert!(find_account(&mut context, &tree_manager.tree.pubkey())
            .await
            .is_some());

        // When minting a new cNFT.

        let owner = Keypair::new();

        let metadata = MetadataArgs {
            name: String::from("cNFT"),
            uri: String::from("https://c.nft"),
            symbol: String::from("cNFT"),
            creators: vec![Creator {
                address: context.payer.pubkey(),
                share: 100,
                verified: false,
            }],
            edition_nonce: None,
            is_mutable: true,
            primary_sale_happened: true,
            seller_fee_basis_points: 500,
            token_program_version: TokenProgramVersion::Original,
            token_standard: Some(TokenStandard::NonFungible),
            collection: None,
            uses: None,
        };

        tree_manager
            .mint(&mut context, owner.pubkey(), metadata)
            .await
            .unwrap();

        // Then one cNFT is minted.

        assert_eq!(tree_manager.minted(), 1);

        // And the merkle tree root is updated.

        tree_manager.assert_root(&mut context).await;
    }

    #[tokio::test]
    async fn mint_multiple_asset() {
        let mut program_test = create_program_test();
        program_test.set_compute_max_units(400_000);
        let mut context = program_test.start_with_context().await;

        // Given a new merkle tree.

        let mut tree_manager = TreeManager::<5, 8>::default();
        tree_manager.create(&mut context).await.unwrap();

        assert!(find_account(&mut context, &tree_manager.tree.pubkey())
            .await
            .is_some());

        // When minting mutiple cNFTs.

        for _ in 0..10 {
            let owner = Keypair::new();

            let metadata = MetadataArgs {
                name: String::from("cNFT"),
                uri: String::from("https://c.nft"),
                symbol: String::from("cNFT"),
                creators: vec![Creator {
                    address: context.payer.pubkey(),
                    share: 100,
                    verified: false,
                }],
                edition_nonce: None,
                is_mutable: true,
                primary_sale_happened: true,
                seller_fee_basis_points: 500,
                token_program_version: TokenProgramVersion::Original,
                token_standard: Some(TokenStandard::NonFungible),
                collection: None,
                uses: None,
            };

            tree_manager
                .mint(&mut context, owner.pubkey(), metadata)
                .await
                .unwrap();
        }

        // Then all cNFTs are minted.

        assert_eq!(tree_manager.minted(), 10);
        assert!(!tree_manager.get_proof(9).is_empty());

        // And the merkle tree root is updated.

        tree_manager.assert_root(&mut context).await;
    }

    #[tokio::test]
    async fn recieve_leaf_schema() {
        let mut program_test = create_program_test();
        program_test.set_compute_max_units(400_000);
        let mut context = program_test.start_with_context().await;

        // Given a new merkle tree.

        let mut tree_manager = TreeManager::<5, 8>::default();
        tree_manager.create(&mut context).await.unwrap();

        assert!(find_account(&mut context, &tree_manager.tree.pubkey())
            .await
            .is_some());

        // When minting a new cNFT.

        let owner = Keypair::new();

        let metadata = MetadataArgs {
            name: String::from("cNFT"),
            uri: String::from("https://c.nft"),
            symbol: String::from("cNFT"),
            creators: vec![Creator {
                address: context.payer.pubkey(),
                share: 100,
                verified: false,
            }],
            edition_nonce: None,
            is_mutable: true,
            primary_sale_happened: true,
            seller_fee_basis_points: 500,
            token_program_version: TokenProgramVersion::Original,
            token_standard: Some(TokenStandard::NonFungible),
            collection: None,
            uses: None,
        };

        let leaf = tree_manager
            .mint(&mut context, owner.pubkey(), metadata.clone())
            .await
            .unwrap();

        // Then LeafSchema returned and valid.
        assert_eq!(
            leaf.id(),
            get_asset_id(&tree_manager.tree.pubkey(), tree_manager.minted() - 1)
        );
        assert_eq!(leaf.owner(), owner.pubkey());
        assert_eq!(leaf.delegate(), owner.pubkey());
        assert_eq!(leaf.nonce(), tree_manager.minted() - 1);
        assert_eq!(leaf.data_hash(), hash_metadata(&metadata).unwrap());
        assert_eq!(leaf.creator_hash(), hash_creators(&metadata.creators));
    }
}
