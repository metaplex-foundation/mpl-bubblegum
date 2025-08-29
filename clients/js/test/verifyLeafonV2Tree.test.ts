import { generateSigner, publicKeyBytes } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
  verifyLeaf,
} from '@metaplex-foundation/mpl-account-compression';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can verify a leaf on a V2 merkle tree', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { leaf, leafIndex } = await mintV2(umi, { merkleTree, leafOwner });

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
