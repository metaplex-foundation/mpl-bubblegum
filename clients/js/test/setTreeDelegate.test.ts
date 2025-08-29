import { generateSigner } from '@metaplex-foundation/umi';
import test from 'ava';
import { TreeConfig, fetchTreeConfigFromSeeds, setTreeDelegate } from '../src';
import { createTree, createUmi, createTreeV2 } from './_setup';

test('it can set a delegate on a Bubblegum tree', async (t) => {
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
  await setTreeDelegate(umi, {
    merkleTree,
    newTreeDelegate: treeDelegate,
  }).sendAndConfirm(umi);

  // Then the tree config account was updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate,
  });
});

test('it can set a delegate on a V2 Bubblegum tree', async (t) => {
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
  await setTreeDelegate(umi, {
    merkleTree,
    newTreeDelegate: treeDelegate,
  }).sendAndConfirm(umi);

  // Then the tree config account was updated accordingly.
  treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: umi.identity.publicKey,
    treeDelegate,
  });
});
