#![cfg(feature = "test-sbf")]
pub mod setup;
pub use setup::*;

use mpl_bubblegum::types::{Creator, MetadataArgsV2, TokenStandard};
use solana_program_test::tokio;
use solana_sdk::signature::Keypair;
use solana_sdk::signature::Signer;

mod burn {

    use super::*;

    #[tokio::test]
    async fn burn_v2_asset() {
        let mut program_test = create_program_test();
        program_test.set_compute_max_units(400_000);
        let mut context = program_test.start_with_context().await;

        // Given a new merkle tree.

        let mut tree_manager = TreeManager::<5, 8>::default();
        tree_manager.create(&mut context).await.unwrap();

        // And minted cNFTs.

        let mut assets = vec![];

        for _ in 0..10 {
            let owner = Keypair::new();

            let metadata = MetadataArgsV2 {
                name: String::from("cNFT"),
                symbol: String::from("cNFT"),
                uri: String::from("https://c.nft"),
                seller_fee_basis_points: 500,
                primary_sale_happened: true,
                is_mutable: true,
                token_standard: Some(TokenStandard::NonFungible),
                creators: vec![Creator {
                    address: context.payer.pubkey(),
                    share: 100,
                    verified: false,
                }],
                collection: None,
            };

            let owner_pubkey = owner.pubkey();

            assets.push((
                owner,
                tree_manager
                    .mint_v2(&mut context, owner_pubkey, metadata)
                    .await
                    .unwrap(),
            ));
        }

        // When transferring a cNFT.

        let receiver = Keypair::new().pubkey();
        let (owner, asset) = assets.pop().unwrap();

        let leaf = tree_manager
            .transfer_v2(&mut context, &owner, receiver, &asset)
            .await
            .unwrap();

        // Then the cNFT is transferred.

        assert_eq!(leaf.owner(), receiver);

        // And the merkle tree root is updated.

        tree_manager.assert_root(&mut context).await;

        // When burning a cNFT.

        tree_manager
            .burn_v2(&mut context, &owner, &asset)
            .await
            .unwrap();

        // And the merkle tree root is updated.

        tree_manager.assert_root(&mut context).await;
    }
}
