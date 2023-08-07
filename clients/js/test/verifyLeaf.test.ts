import { generateSigner, publicKeyBytes } from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchMerkleTree, getCurrentRoot, verifyLeaf } from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can verify a leaf on the merkle tree', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { leaf, leafIndex } = await mint(umi, { merkleTree, leafOwner });

  // When we verify that minted leaf.
  await verifyLeaf(umi, {
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    leaf: publicKeyBytes(leaf),
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the transaction was successful.
  t.pass();
});
