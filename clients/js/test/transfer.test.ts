import { PublicKey, generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  delegate,
  fetchMerkleTree,
  findLeafAssetIdPda,
  getAssetWithProof,
  getCurrentRoot,
  getMerkleProof,
  hashLeaf,
  hashMetadataCreators,
  hashMetadataData,
  transfer,
  verifyLeaf,
  getCompressionPrograms,
  MPL_NOOP_PROGRAM_ID,
  MPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
} from '../src';
import { createTree, createUmi, mint } from './_setup';
import {
  DasApiAsset,
  GetAssetProofRpcResponse,
} from '@metaplex-foundation/digital-asset-standard-api';

test('it can transfer a compressed NFT', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can transfer a compressed NFT using mpl-account-compression and mpl-noop', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();

  // For these tests, make sure `getCompressionPrograms` doesn't return spl programs.
  const { logWrapper, compressionProgram } = await getCompressionPrograms(umi);
  t.is(logWrapper, MPL_NOOP_PROGRAM_ID);
  t.is(compressionProgram, MPL_ACCOUNT_COMPRESSION_PROGRAM_ID);

  const merkleTree = await createTree(umi, {
    ...(await getCompressionPrograms(umi)),
  });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    ...(await getCompressionPrograms(umi)),
  });

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
    ...(await getCompressionPrograms(umi)),
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it cannot transfer a compressed NFT owned by spl-account-compression using mpl programs', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();

  // For these tests, make sure `getCompressionPrograms` doesn't return spl programs.
  const { logWrapper, compressionProgram } = await getCompressionPrograms(umi);
  t.is(logWrapper, MPL_NOOP_PROGRAM_ID);
  t.is(compressionProgram, MPL_ACCOUNT_COMPRESSION_PROGRAM_ID);

  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  const promise = transfer(umi, {
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
    ...(await getCompressionPrograms(umi)),
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidLogWrapper' });

  // Then the leaf was not updated in the merkle tree.
  const originalLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerA.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(originalLeaf));
});

test('it cannot transfer a compressed NFT owned by spl-account-compression using mpl-account-compression', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  const promise = transfer(umi, {
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
    compressionProgram: MPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidCompressionProgram' });

  // Then the leaf was not updated in the merkle tree.
  const originalLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerA.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(originalLeaf));
});

test('it can transfer a compressed NFT as a delegated authority', async (t) => {
  // Given a tree with a delegated compressed NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const delegateAuthority = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });
  await delegate(umi, {
    leafOwner: leafOwnerA,
    previousLeafDelegate: leafOwnerA.publicKey,
    newLeafDelegate: delegateAuthority.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
  }).sendAndConfirm(umi);

  // When the delegated authority transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    leafDelegate: delegateAuthority, // <- The delegated authority signs the transaction.
    leafOwner: leafOwnerA.publicKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    delegate: leafOwnerB.publicKey, // <- The delegated authority is removed.
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can transfer a compressed NFT using a proof', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTree(umi, {
    maxDepth: 5,
    maxBufferSize: 8,
  });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const preMints = [
    await mint(umi, { merkleTree, leafIndex: 0 }),
    await mint(umi, { merkleTree, leafIndex: 1 }),
    await mint(umi, { merkleTree, leafIndex: 2 }),
    await mint(umi, { merkleTree, leafIndex: 3 }),
    await mint(umi, { merkleTree, leafIndex: 4 }),
    await mint(umi, { merkleTree, leafIndex: 5 }),
    await mint(umi, { merkleTree, leafIndex: 6 }),
    await mint(umi, { merkleTree, leafIndex: 7 }),
  ];

  // And a 9th minted NFT owned by leafOwnerA.
  const leafOwnerA = generateSigner(umi);
  const { metadata, leaf, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    leafIndex: 8,
  });

  // And a proof for the 9th minted NFT.
  const proof = getMerkleProof([...preMints.map((m) => m.leaf), leaf], 5, leaf);

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
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

test('it can transfer a compressed NFT using the getAssetWithProof helper', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTree(umi, { maxDepth: 5, maxBufferSize: 8 });
  const preMints = [
    await mint(umi, { merkleTree, leafIndex: 0 }),
    await mint(umi, { merkleTree, leafIndex: 1 }),
    await mint(umi, { merkleTree, leafIndex: 2 }),
    await mint(umi, { merkleTree, leafIndex: 3 }),
    await mint(umi, { merkleTree, leafIndex: 4 }),
    await mint(umi, { merkleTree, leafIndex: 5 }),
    await mint(umi, { merkleTree, leafIndex: 6 }),
    await mint(umi, { merkleTree, leafIndex: 7 }),
  ];

  // And a 9th minted NFT owned by leafOwnerA.
  const leafOwnerA = generateSigner(umi);
  const { metadata, leaf, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    leafIndex: 8,
  });

  // And given we mock the RPC client to return the following asset and proof.
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  const rpcAsset = {
    ownership: { owner: leafOwnerA.publicKey },
    compression: {
      leaf_id: leafIndex,
      data_hash: publicKey(hashMetadataData(metadata)),
      creator_hash: publicKey(hashMetadataCreators(metadata.creators)),
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

  // Then leafOwnerA can use it to transfer the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    ...assetWithProof,
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
  }).sendAndConfirm(umi);

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);
});
