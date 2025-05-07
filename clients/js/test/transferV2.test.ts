import {
  PublicKey,
  generateSigner,
  publicKey,
  defaultPublicKey,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  DasApiAsset,
  GetAssetProofRpcResponse,
} from '@metaplex-foundation/digital-asset-standard-api';
import {
  fetchMerkleTree,
  getCurrentRoot,
  verifyLeaf,
} from '@metaplex-foundation/mpl-account-compression';
import {
  delegateV2,
  findLeafAssetIdPda,
  getAssetWithProof,
  getMerkleProof,
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  transferV2,
  hashCollection,
  hashAssetData,
  canTransfer,
  LeafSchemaV2Flags,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('owner can transfer a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transferV2(umi, {
    authority: leafOwnerA,
    leafOwner: leafOwnerA.publicKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('leaf delegate can transfer a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a delegated compressed NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const delegateAuthority = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });
  await delegateV2(umi, {
    leafOwner: leafOwnerA,
    previousLeafDelegate: leafOwnerA.publicKey,
    newLeafDelegate: delegateAuthority.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
  }).sendAndConfirm(umi);

  // When the delegated authority transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transferV2(umi, {
    authority: delegateAuthority, // <- The delegated authority signs the transaction.
    leafOwner: leafOwnerA.publicKey,
    leafDelegate: delegateAuthority.publicKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    delegate: leafOwnerB.publicKey, // <- The delegated authority is removed.
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('owner can transfer a compressed NFT using a proof', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi, {
    maxDepth: 5,
    maxBufferSize: 8,
  });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const preMints = [
    await mintV2(umi, { merkleTree, leafIndex: 0 }),
    await mintV2(umi, { merkleTree, leafIndex: 1 }),
    await mintV2(umi, { merkleTree, leafIndex: 2 }),
    await mintV2(umi, { merkleTree, leafIndex: 3 }),
    await mintV2(umi, { merkleTree, leafIndex: 4 }),
    await mintV2(umi, { merkleTree, leafIndex: 5 }),
    await mintV2(umi, { merkleTree, leafIndex: 6 }),
    await mintV2(umi, { merkleTree, leafIndex: 7 }),
  ];

  // And a 9th minted NFT owned by leafOwnerA.
  const leafOwnerA = generateSigner(umi);
  const { metadata, leaf, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    leafIndex: 8,
  });

  // And a proof for the 9th minted NFT.
  const proof = getMerkleProof([...preMints.map((m) => m.leaf), leaf], 5, leaf);

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transferV2(umi, {
    authority: leafOwnerA,
    leafOwner: leafOwnerA.publicKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    leafIndex,
    metadata,
  });
  const updatedProof = getMerkleProof(
    [...preMints.map((m) => m.leaf), publicKey(updatedLeaf)],
    5,
    publicKey(updatedLeaf)
  );
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await verifyLeaf(umi, {
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    leaf: updatedLeaf,
    index: leafIndex,
    proof: updatedProof,
  }).sendAndConfirm(umi);
  t.pass();
});

test('owner can transfer a compressed NFT using the getAssetWithProof helper', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi, { maxDepth: 5, maxBufferSize: 8 });
  const preMints = [
    await mintV2(umi, { merkleTree, leafIndex: 0 }),
    await mintV2(umi, { merkleTree, leafIndex: 1 }),
    await mintV2(umi, { merkleTree, leafIndex: 2 }),
    await mintV2(umi, { merkleTree, leafIndex: 3 }),
    await mintV2(umi, { merkleTree, leafIndex: 4 }),
    await mintV2(umi, { merkleTree, leafIndex: 5 }),
    await mintV2(umi, { merkleTree, leafIndex: 6 }),
    await mintV2(umi, { merkleTree, leafIndex: 7 }),
  ];

  // And a 9th minted NFT owned by leafOwnerA.
  const leafOwnerA = generateSigner(umi);
  const { metadata, leaf, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    leafIndex: 8,
  });

  // And given we mock the RPC client to return the following asset and proof.
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  const rpcAsset = {
    ownership: {
      owner: leafOwnerA.publicKey,
      frozen: false,
      non_transferable: false,
    },
    compression: {
      leaf_id: leafIndex,
      data_hash: publicKey(hashMetadataDataV2(metadata)),
      creator_hash: publicKey(hashMetadataCreators(metadata.creators)),
      collection_hash: publicKey(hashCollection(defaultPublicKey())),
      asset_data_hash: publicKey(hashAssetData()),
      flags: LeafSchemaV2Flags.None,
    },
  } as DasApiAsset;
  const rpcAssetProof = {
    proof: getMerkleProof([...preMints.map((m) => m.leaf), leaf], 5, leaf),
    root: publicKey(getCurrentRoot(merkleTreeAccount.tree)),
    tree_id: merkleTree,
    node_index: leafIndex + 2 ** 5,
  } as GetAssetProofRpcResponse;
  umi.rpc = {
    ...umi.rpc,
    getAsset: async (givenAssetId: PublicKey) => {
      t.is(givenAssetId, assetId);
      return rpcAsset;
    },
    getAssetProof: async (givenAssetId: PublicKey) => {
      t.is(givenAssetId, assetId);
      return rpcAssetProof;
    },
  };

  // When we use the getAssetWithProof helper.
  const assetWithProof = await getAssetWithProof(umi, assetId);

  // Check using the canTransfer helper.
  t.is(canTransfer(assetWithProof), true);

  // Then leafOwnerA can use it to transfer the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transferV2(umi, {
    // Pass parameters from the asset with proof.
    ...assetWithProof,
    authority: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
  }).sendAndConfirm(umi);

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);
});
