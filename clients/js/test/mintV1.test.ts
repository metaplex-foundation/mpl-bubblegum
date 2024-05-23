import {
  defaultPublicKey,
  generateSigner,
  none,
  publicKey,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  NodeArgsArgs,
  TokenStandard,
  fetchMerkleTree,
  hashLeaf,
  mintNodeV1,
} from '../src';
import { createTree, createUmi } from './_setup';

test('it can mint an NFT from a Bubblegum tree', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);
  t.is(merkleTreeAccount.tree.bufferSize, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 0);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: NodeArgsArgs = {
    label: 'My NFT',
    properties: [
      {
        key: 'test',
        value: 'test2',
      },
    ],
    isMutable: true,
    creators: [],
  };
  await mintNodeV1(umi, { leafOwner, merkleTree, metadata }).sendAndConfirm(
    umi
  );

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);
  t.is(merkleTreeAccount.tree.activeIndex, 1n);
  t.is(merkleTreeAccount.tree.bufferSize, 2n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 1);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test.skip('it cannot mint an NFT from a Bubblegum tree because token standard is empty', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: NodeArgsArgs = {
    // @ts-ignore
    label: none(),
    properties: [],
  };
  const promise = mintNodeV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
  }).sendAndConfirm(umi);
  // Then we expect a program error because metadata's token standard is empty.
  await t.throwsAsync(promise, { name: 'InvalidTokenStandard' });
});
