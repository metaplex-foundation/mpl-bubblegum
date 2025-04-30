import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import { hashLeafV2, verifyCreatorV2 } from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can verify the creator of a minted compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT that has two unverified creators A and B.
  const umi = await createUmi();
  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mintV2(umi, {
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
  await verifyCreatorV2(umi, {
    creator: creatorA,
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
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
