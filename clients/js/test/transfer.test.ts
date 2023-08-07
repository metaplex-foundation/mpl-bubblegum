import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  delegate,
  fetchMerkleTree,
  getCurrentRoot,
  getMerkleProof,
  hashLeaf,
  hashMetadataCreators,
  hashMetadataData,
  transfer,
  verifyLeaf,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

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
