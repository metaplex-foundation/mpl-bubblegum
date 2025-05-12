import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  delegateV2,
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  freezeV2,
  transferV2,
  burnV2,
  LeafSchemaV2Flags,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('delegate can freeze a compressed NFT with V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
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
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When the delegate of the NFT freezes it.
  await freezeV2(umi, {
    authority: newDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});

test('unauthorized user cannot can freeze a compressed NFT with V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
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
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When an unauthorized user attempts to freeze.
  const nonDelegate = generateSigner(umi);
  const promise = freezeV2(umi, {
    authority: nonDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // We expect a failure.
  await t.throwsAsync(promise, { name: 'InvalidAuthority' });

  // Then the leaf was not updated in the merkle tree.
  const nonFrozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.None,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(nonFrozenLeaf));
});

test('item frozen by leaf delegate cannot be transferred by owner', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
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
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When the delegate of the NFT freezes it.
  await freezeV2(umi, {
    authority: newDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the owner attempts to transfer the NFT.
  const leafOwnerB = generateSigner(umi);
  const promise = transferV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: LeafSchemaV2Flags.FrozenByOwner,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'AssetIsFrozen' });

  // And the leaf has not changed in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});

test('item frozen by leaf delegate cannot be burned by owner', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
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
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When the delegate of the NFT freezes it.
  await freezeV2(umi, {
    authority: newDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the owner attempts to burn the NFT.
  const promise = burnV2(umi, {
    authority: leafOwner,
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

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'AssetIsFrozen' });

  // And the leaf has not changed in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});

test('owner as default leaf delegate can freeze a compressed NFT', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT freezes it.
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await freezeV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: leafOwner.publicKey,
    leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});
