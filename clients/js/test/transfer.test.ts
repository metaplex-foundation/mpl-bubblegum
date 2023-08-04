import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  delegate,
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  hashMetadataCreators,
  hashMetadataData,
  transfer,
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
