import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  delegateAndFreezeV2,
  delegateV2,
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  thawAndRevokeV2,
  LeafSchemaV2Flags,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('delegate can thaw and revoke a compressed NFT using thawAndRevokeV2', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account and freezes it.
  const newDelegate = generateSigner(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await delegateAndFreezeV2(umi, {
    leafOwner,
    newLeafDelegate: newDelegate.publicKey,
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
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When the delegate of the NFT thaws it.
  await thawAndRevokeV2(umi, {
    leafDelegate: newDelegate,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: LeafSchemaV2Flags.FrozenByOwner,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree with revoked delegate and flags cleared.
  const unfrozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: leafOwner.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.None,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(unfrozenLeaf));
});

test('owner cannot thaw and revoke a compressed NFT using thawAndRevokeV2', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account and freezes it.
  const newDelegate = generateSigner(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await delegateAndFreezeV2(umi, {
    leafOwner,
    newLeafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // When the owner of the NFT attempts to thaw it.
  const promise = thawAndRevokeV2(umi, {
    leafDelegate: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: LeafSchemaV2Flags.FrozenByOwner,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // We expect the Merkle root to be wrong.
  await t.throwsAsync(promise, { name: 'PublicKeyMismatch' });

  // Then the leaf was not updated in the merkle tree with revoked delegate and flags cleared.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('delegate cannot thaw and revoke a compressed NFT when it is not frozen', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account, but does not freeze it.
  const newDelegate = generateSigner(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await delegateV2(umi, {
    leafOwner,
    newLeafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.None,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // When the delegate of the NFT attempts to thaw and revoke it.
  const promise = thawAndRevokeV2(umi, {
    leafDelegate: newDelegate,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'AssetIsNotFrozen' });

  // And the leaf was not updated in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // And when trying again with the frozen flag explicitly sent.
  const promiseAgain = thawAndRevokeV2(umi, {
    leafDelegate: newDelegate,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: LeafSchemaV2Flags.FrozenByOwner,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // We expect the Merkle root to be wrong.
  await t.throwsAsync(promiseAgain, { name: 'PublicKeyMismatch' });

  // And the leaf was still not updated in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});
