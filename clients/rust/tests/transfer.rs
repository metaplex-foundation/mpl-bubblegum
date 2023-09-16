#![cfg(feature = "test-sbf")]
pub mod setup;
pub use setup::*;

use mpl_bubblegum::types::{Creator, LeafSchema, MetadataArgs, TokenProgramVersion, TokenStandard};
use solana_program_test::tokio;
use solana_sdk::signature::Keypair;
use solana_sdk::signature::Signer;

mod transfer {

    use super::*;

    #[tokio::test]
    async fn transfer_asset() {
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

            let owner_pubkey = owner.pubkey();

            assets.push((
                owner,
                tree_manager
                    .mint(&mut context, owner_pubkey, metadata)
                    .await
                    .unwrap(),
            ));
        }

        // When transferring a cNFT.

        let receiver = Keypair::new().pubkey();
        let (owner, asset) = assets.pop().unwrap();

        let leaf = tree_manager
            .transfer(&mut context, &owner, receiver, &asset)
            .await
            .unwrap();

        // Then the cNFT is transferred.

        let LeafSchema::V1 { owner, .. } = leaf;

        assert_eq!(owner, receiver);
    }
}
