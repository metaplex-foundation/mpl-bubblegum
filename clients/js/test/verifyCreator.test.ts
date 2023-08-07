import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  verifyCreator,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can verify the creator of a minted compressed NFT', async (t) => {
  // Given a tree with a minted NFT that has two unverified creators A and B.
  const umi = await createUmi();
  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner,
    metadata: {
      creators: [
        { address: creatorA.publicKey, verified: false, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
  });

  // When creator A verifies themselves.
  await verifyCreator(umi, {
    leafOwner,
    creator: creatorA,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: {
      ...metadata,
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
