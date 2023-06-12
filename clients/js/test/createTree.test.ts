import { generateSigner, none } from '@metaplex-foundation/umi';
import test from 'ava';
import { createTree } from '../src';
import { createUmi } from './_setup';

test.skip('it can create a Bubblegum tree', async (t) => {
  // Given.
  const umi = await createUmi();
  const todo = generateSigner(umi);

  // When.
  await createTree(umi, {
    treeAuthority: todo.publicKey,
    merkleTree: todo.publicKey,
    treeCreator: todo,
    logWrapper: todo.publicKey,
    compressionProgram: todo.publicKey,
    maxDepth: 1,
    maxBufferSize: 1,
    public: none(),
  }).sendAndConfirm(umi);

  // Then.
  t.pass();
});
