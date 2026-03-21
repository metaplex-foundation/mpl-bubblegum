import { generateSigner } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  DecompressibleState,
  TreeConfig,
  fetchTreeConfigFromSeeds,
  updateTreeConfig,
} from '../src';
import { createTree, createUmi, createTreeV2 } from './_setup';

// creator
test('it can update the creator on a Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set a new creator on the tree.
  const treeCreator = generateSigner(umi).publicKey;
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator,
    treeDelegate: null,
    isDecompressible: null,
    isPublic: null,
  }).sendAndConfirm(umi);

  // Then the tree config account was updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator,
  });
});

test('it can update the creator on a V2 Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set a new creator on the tree.
  const treeCreator = generateSigner(umi).publicKey;
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator,
    treeDelegate: null,
    isDecompressible: null,
    isPublic: null,
  }).sendAndConfirm(umi);

  // Then the tree config account was updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator,
  });
});

// delegate
test('it can update the delegate on a Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set a new delegate on the tree.
  const treeDelegate = generateSigner(umi).publicKey;
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator: null,
    treeDelegate,
    isDecompressible: null,
    isPublic: null,
  }).sendAndConfirm(umi);

  // Then the tree config account was updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate,
  });
});

test('it can update the delegate on a V2 Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set a new delegate on the tree.
  const treeDelegate = generateSigner(umi).publicKey;
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator: null,
    treeDelegate,
    isDecompressible: null,
    isPublic: null,
  }).sendAndConfirm(umi);

  // Then the tree config account was updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate,
  });
});

// decompressible
test('it can update is decompressible on a Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set the tree to allow decompression.
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator: null,
    treeDelegate: null,
    isDecompressible: DecompressibleState.Enabled,
    isPublic: null,
  }).sendAndConfirm(umi);

  // Then the tree config account is updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    isDecompressible: DecompressibleState.Enabled,
  });
});

test('it cannot update is decompressible on a V2 Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we try to set the tree to allow decompression.
  const promise = updateTreeConfig(umi, {
    merkleTree,
    treeCreator: null,
    treeDelegate: null,
    isDecompressible: DecompressibleState.Enabled,
    isPublic: null,
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'UnsupportedUpdateOperation' });
});

// public
test('it can update is public on a Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set the tree to allow decompression.
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator: null,
    treeDelegate: null,
    isDecompressible: null,
    isPublic: true,
  }).sendAndConfirm(umi);

  // Then the tree config account is updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    isPublic: true,
  });
});

test('it can update is public on a V2 Bubblegum tree', async (t) => {
  // Given a Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate: umi.identity.publicKey,
  });

  // When we set the tree to allow decompression.
  await updateTreeConfig(umi, {
    merkleTree,
    treeCreator: null,
    treeDelegate: null,
    isDecompressible: null,
    isPublic: true,
  }).sendAndConfirm(umi);

  // Then the tree config account is updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    isPublic: true,
  });
});
