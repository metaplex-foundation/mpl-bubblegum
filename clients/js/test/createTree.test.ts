import { generateSigner } from '@metaplex-foundation/umi';
import test from 'ava';
import { createTree } from '../src';
import { createUmi } from './_setup';

test.skip('it can create a Bubblegum tree', async (t) => {
  // Given.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When.
  await createTree(umi, {
    merkleTree: merkleTree.publicKey,
    maxDepth: 1,
    maxBufferSize: 1,
  }).sendAndConfirm(umi);

  // Then.
  t.pass();
});
