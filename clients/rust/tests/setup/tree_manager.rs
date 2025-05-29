use mpl_bubblegum::{
    accounts::TreeConfig,
    hash::{hash_creators, hash_metadata, DEFAULT_ASSET_DATA_HASH, DEFAULT_COLLECTION_HASH},
    instructions::{
        BurnV2Builder, CreateTreeConfigBuilder, CreateTreeConfigV2Builder, MintV1Builder,
        MintV2Builder, TransferBuilder, TransferV2Builder,
    },
    types::{LeafSchema, MetadataArgs, MetadataArgsV2},
    utils::get_asset_id,
    DEFAULT_FLAGS,
};
use solana_program::{instruction::AccountMeta, pubkey::Pubkey, system_instruction};
use solana_program_test::{BanksClientError, ProgramTestContext};
use solana_sdk::{signature::Keypair, signer::Signer, transaction::Transaction};
use spl_account_compression::{state::CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1, ConcurrentMerkleTree};
use spl_merkle_tree_reference::{MerkleTree, Node};

use crate::get_account;

pub struct TreeManager<const MAX_DEPTH: usize, const MAX_BUFFER_SIZE: usize> {
    /// A keypair to represent the merkle tree account.
    pub tree: Keypair,

    /// A merkle tree to keep a "local" copy of the on-chain tree in order to
    /// generate the proofs for the tests.
    proof_tree: MerkleTree,

    /// Number of minted assets use to populate the `nonce` and `index`
    minted: u64,
}

impl<const MAX_DEPTH: usize, const MAX_BUFFER_SIZE: usize> Default
    for TreeManager<MAX_DEPTH, MAX_BUFFER_SIZE>
{
    fn default() -> Self {
        Self {
            tree: Keypair::new(),
            proof_tree: spl_merkle_tree_reference::MerkleTree::new(
                vec![Node::default(); 1 << MAX_DEPTH].as_slice(),
            ),
            minted: 0,
        }
    }
}

impl<const MAX_DEPTH: usize, const MAX_BUFFER_SIZE: usize> TreeManager<MAX_DEPTH, MAX_BUFFER_SIZE> {
    pub fn minted(&self) -> u64 {
        self.minted
    }

    pub fn get_proof(&self, index: u32) -> Vec<Node> {
        self.proof_tree.get_proof_of_leaf(index as usize)
    }

    pub async fn create(
        &mut self,
        context: &mut ProgramTestContext,
    ) -> Result<(), BanksClientError> {
        let size = CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1
            + std::mem::size_of::<ConcurrentMerkleTree<MAX_DEPTH, MAX_BUFFER_SIZE>>();
        let rent = context.banks_client.get_rent().await.unwrap();
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());

        // create tree account
        let create_account_ix = system_instruction::create_account(
            &context.payer.pubkey(),
            &self.tree.pubkey(),
            rent.minimum_balance(size),
            size as u64,
            &spl_account_compression::ID,
        );

        // create tree config account
        let create_config_ix = CreateTreeConfigBuilder::new()
            .tree_config(tree_config)
            .merkle_tree(self.tree.pubkey())
            .payer(context.payer.pubkey())
            .tree_creator(context.payer.pubkey())
            .max_depth(MAX_DEPTH as u32)
            .max_buffer_size(MAX_BUFFER_SIZE as u32)
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[create_account_ix, create_config_ix],
            Some(&context.payer.pubkey()),
            &[&self.tree, &context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await
    }

    pub async fn create_v2(
        &mut self,
        context: &mut ProgramTestContext,
    ) -> Result<(), BanksClientError> {
        let size = CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1
            + std::mem::size_of::<ConcurrentMerkleTree<MAX_DEPTH, MAX_BUFFER_SIZE>>();
        let rent = context.banks_client.get_rent().await.unwrap();
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());

        // create tree account
        let create_account_ix = system_instruction::create_account(
            &context.payer.pubkey(),
            &self.tree.pubkey(),
            rent.minimum_balance(size),
            size as u64,
            &mpl_account_compression::ID,
        );

        // create tree config account
        let create_config_ix = CreateTreeConfigV2Builder::new()
            .tree_config(tree_config)
            .merkle_tree(self.tree.pubkey())
            .payer(context.payer.pubkey())
            .tree_creator(Some(context.payer.pubkey()))
            .max_depth(MAX_DEPTH as u32)
            .max_buffer_size(MAX_BUFFER_SIZE as u32)
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[create_account_ix, create_config_ix],
            Some(&context.payer.pubkey()),
            &[&self.tree, &context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await
    }

    pub async fn mint(
        &mut self,
        context: &mut ProgramTestContext,
        owner: Pubkey,
        args: MetadataArgs,
    ) -> Result<LeafSchema, BanksClientError> {
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());

        let mint_ix = MintV1Builder::new()
            .leaf_delegate(owner)
            .leaf_owner(owner)
            .merkle_tree(self.tree.pubkey())
            .payer(context.payer.pubkey())
            .tree_config(tree_config)
            .tree_creator_or_delegate(context.payer.pubkey())
            .metadata(args.clone())
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[mint_ix],
            Some(&context.payer.pubkey()),
            &[&context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await?;

        // on success, we store the newly-created leaf in the proof tree
        // and increment the number of minted assets

        let data_hash = hash_metadata(&args).unwrap();
        let creator_hash = hash_creators(&args.creators);
        let asset_id = get_asset_id(&self.tree.pubkey(), self.minted);

        let leaf = LeafSchema::V1 {
            id: asset_id,
            owner,
            delegate: owner,
            nonce: self.minted,
            data_hash,
            creator_hash,
        };

        self.proof_tree.add_leaf(leaf.hash(), self.minted as usize);
        self.minted += 1;

        Ok(leaf)
    }

    pub async fn mint_v2(
        &mut self,
        context: &mut ProgramTestContext,
        owner: Pubkey,
        args: MetadataArgsV2,
    ) -> Result<LeafSchema, BanksClientError> {
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());

        let mint_ix = MintV2Builder::new()
            .tree_config(tree_config)
            .payer(context.payer.pubkey())
            .tree_creator_or_delegate(Some(context.payer.pubkey()))
            .leaf_owner(owner)
            .leaf_delegate(Some(owner))
            .merkle_tree(self.tree.pubkey())
            .metadata(args.clone())
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[mint_ix],
            Some(&context.payer.pubkey()),
            &[&context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await?;

        // on success, we store the newly-created leaf in the proof tree
        // and increment the number of minted assets

        let data_hash = hash_metadata(&args).unwrap();
        let creator_hash = hash_creators(&args.creators);
        let asset_id = get_asset_id(&self.tree.pubkey(), self.minted);

        let leaf = LeafSchema::V2 {
            id: asset_id,
            owner,
            delegate: owner,
            nonce: self.minted,
            data_hash,
            creator_hash,
            collection_hash: DEFAULT_COLLECTION_HASH,
            asset_data_hash: DEFAULT_ASSET_DATA_HASH,
            flags: DEFAULT_FLAGS,
        };

        self.proof_tree.add_leaf(leaf.hash(), self.minted as usize);
        self.minted += 1;

        Ok(leaf)
    }

    pub async fn transfer(
        &mut self,
        context: &mut ProgramTestContext,
        owner: &Keypair,
        receiver: Pubkey,
        asset: &LeafSchema,
    ) -> Result<LeafSchema, BanksClientError> {
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());
        let proof: Vec<AccountMeta> = self
            .get_proof(asset.nonce() as u32)
            .iter()
            .map(|node| AccountMeta {
                pubkey: Pubkey::new_from_array(*node),
                is_signer: false,
                is_writable: false,
            })
            .collect();

        let transfer_ix = TransferBuilder::new()
            .leaf_delegate(owner.pubkey(), false)
            .leaf_owner(owner.pubkey(), true)
            .merkle_tree(self.tree.pubkey())
            .tree_config(tree_config)
            .new_leaf_owner(receiver)
            .root(self.proof_tree.root)
            .nonce(asset.nonce())
            .creator_hash(asset.creator_hash())
            .data_hash(asset.data_hash())
            .index(asset.nonce() as u32)
            .add_remaining_accounts(&proof)
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[transfer_ix],
            Some(&context.payer.pubkey()),
            &[owner, &context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await?;

        // on success, we update the leaf in the proof tree

        let leaf = LeafSchema::V1 {
            id: asset.id(),
            owner: receiver,
            delegate: receiver,
            nonce: asset.nonce(),
            data_hash: asset.data_hash(),
            creator_hash: asset.creator_hash(),
        };

        self.proof_tree
            .add_leaf(leaf.hash(), asset.nonce() as usize);

        Ok(leaf)
    }

    pub async fn transfer_v2(
        &mut self,
        context: &mut ProgramTestContext,
        owner: &Keypair,
        receiver: Pubkey,
        asset: &LeafSchema,
    ) -> Result<LeafSchema, BanksClientError> {
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());
        let proof: Vec<AccountMeta> = self
            .get_proof(asset.nonce() as u32)
            .iter()
            .map(|node| AccountMeta {
                pubkey: Pubkey::new_from_array(*node),
                is_signer: false,
                is_writable: false,
            })
            .collect();

        let transfer_ix = TransferV2Builder::new()
            .tree_config(tree_config)
            .payer(context.payer.pubkey())
            .authority(Some(owner.pubkey()))
            .leaf_owner(owner.pubkey())
            .leaf_delegate(Some(owner.pubkey()))
            .new_leaf_owner(receiver)
            .merkle_tree(self.tree.pubkey())
            .root(self.proof_tree.root)
            .data_hash(asset.data_hash())
            .creator_hash(asset.creator_hash())
            .nonce(asset.nonce())
            .index(asset.nonce() as u32)
            .add_remaining_accounts(&proof)
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[transfer_ix],
            Some(&context.payer.pubkey()),
            &[owner, &context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await?;

        // on success, we update the leaf in the proof tree

        let leaf = LeafSchema::V2 {
            id: asset.id(),
            owner: receiver,
            delegate: receiver,
            nonce: asset.nonce(),
            data_hash: asset.data_hash(),
            creator_hash: asset.creator_hash(),
            collection_hash: asset.collection_hash(),
            asset_data_hash: asset.asset_data_hash(),
            flags: asset.flags(),
        };

        self.proof_tree
            .add_leaf(leaf.hash(), asset.nonce() as usize);

        Ok(leaf)
    }

    pub async fn burn_v2(
        &mut self,
        context: &mut ProgramTestContext,
        owner: &Keypair,
        asset: &LeafSchema,
    ) -> Result<(), BanksClientError> {
        let (tree_config, _) = TreeConfig::find_pda(&self.tree.pubkey());
        let proof: Vec<AccountMeta> = self
            .get_proof(asset.nonce() as u32)
            .iter()
            .map(|node| AccountMeta {
                pubkey: Pubkey::new_from_array(*node),
                is_signer: false,
                is_writable: false,
            })
            .collect();

        let burn_ix = BurnV2Builder::new()
            .tree_config(tree_config)
            .payer(context.payer.pubkey())
            .authority(Some(owner.pubkey()))
            .leaf_owner(owner.pubkey())
            .leaf_delegate(Some(owner.pubkey()))
            .merkle_tree(self.tree.pubkey())
            .root(self.proof_tree.root)
            .data_hash(asset.data_hash())
            .creator_hash(asset.creator_hash())
            .nonce(asset.nonce())
            .index(asset.nonce() as u32)
            .add_remaining_accounts(&proof)
            .instruction();

        let tx = Transaction::new_signed_with_payer(
            &[burn_ix],
            Some(&context.payer.pubkey()),
            &[owner, &context.payer],
            context.last_blockhash,
        );

        context.banks_client.process_transaction(tx).await?;

        // on success, we update the leaf in the proof tree

        let leaf = Node::default();
        self.proof_tree.add_leaf(leaf, asset.nonce() as usize);

        Ok(())
    }

    pub async fn assert_root(&self, context: &mut ProgramTestContext) {
        let mut tree_account = get_account(context, &self.tree.pubkey()).await;
        let merkle_tree = tree_account.data.as_mut_slice();

        let (_header, data) = merkle_tree.split_at_mut(CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1);
        let size = std::mem::size_of::<ConcurrentMerkleTree<MAX_DEPTH, MAX_BUFFER_SIZE>>();
        let tree = &mut data[..size];

        let tree =
            bytemuck::try_from_bytes::<ConcurrentMerkleTree<MAX_DEPTH, MAX_BUFFER_SIZE>>(tree)
                .unwrap();
        let root = tree.change_logs[tree.active_index as usize].root;

        assert_eq!(root, self.proof_tree.root);
    }
}
