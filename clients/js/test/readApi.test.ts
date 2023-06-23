import { transferAllSol } from '@metaplex-foundation/mpl-toolbox';
import { Umi, generateSigner, publicKey, sol } from '@metaplex-foundation/umi';
import anyTest, { TestFn } from 'ava';
import { fetchMerkleTree } from '../src';
import { createTree, createUmi, mint } from './_setup';

const test = anyTest as TestFn<{ umi: Umi }>;

test.before(async (t) => {
  t.context.umi = await createUmi('https://api.devnet.solana.com', sol(0.5));
  const identity = t.context.umi.identity.publicKey;
  const balance = await t.context.umi.rpc.getBalance(identity);
  console.log({ identity, balance });
});

test.after(async (t) => {
  // Don't loose devnet SOLs.
  const { umi } = t.context;
  await transferAllSol(umi, {
    destination: publicKey('LorisCg1FTs89a32VSrFskYDgiRbNQzct1WxyZb7nuA'),
  }).sendAndConfirm(umi);
});

test('it can fetch a compressed asset', async (t) => {
  // Given a tree with a minted NFT.
  const { umi } = t.context;
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const { leaf, leafIndex } = await mint(umi, { merkleTree, leafOwner });

  // When
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  console.log({ leaf, leafIndex, merkleTree, merkleTreeAccount });

  // Then the transaction was successful.
  t.pass();
});
