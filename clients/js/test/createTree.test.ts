import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import { TreeConfig, createTree, fetchTreeConfigFromSeeds } from '../src';
import { createUmi } from './_setup';

test('it can create a Bubblegum tree', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
  });
  await builder.sendAndConfirm(umi);

  // Then an account exists at the merkle tree address.
  t.true(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was created with the correct data.
  const treeConfig = await fetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: publicKey(umi.identity),
    treeDelegate: publicKey(umi.identity),
    totalMintCapacity: 2n ** 14n,
    numMinted: 0n,
    isPublic: false,
  });
});

test('it can create a Bubblegum tree using a newer size', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 6,
    maxBufferSize: 16,
  });
  await builder.sendAndConfirm(umi);

  // Then an account exists at the merkle tree address.
  t.true(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was created with the correct data.
  const treeConfig = await fetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: publicKey(umi.identity),
    treeDelegate: publicKey(umi.identity),
    totalMintCapacity: 2n ** 6n,
    numMinted: 0n,
    isPublic: false,
  });
});
