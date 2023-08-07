import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  unverifyCreator,
  verifyCreator,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can unverify the creator of a minted compressed NFT', async (t) => {
  // Given a tree with a minted NFT that has two creators A and B.
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

  // And given both creators are verified.
  const commonArgs = {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
  };
  const partiallyVerifiedMetadata = {
    ...metadata,
    creators: [
      { address: creatorA.publicKey, verified: true, share: 60 },
      { address: creatorB.publicKey, verified: false, share: 40 },
    ],
  };
  await verifyCreator(umi, {
    ...commonArgs,
    creator: creatorA,
    metadata,
  })
    .add(
      verifyCreator(umi, {
        ...commonArgs,
        creator: creatorB,
        metadata: partiallyVerifiedMetadata,
      })
    )
    .sendAndConfirm(umi);

  // When creator A unverifies themselves.
  const verifiedMetadata = {
    ...metadata,
    creators: [
      { address: creatorA.publicKey, verified: true, share: 60 },
      { address: creatorB.publicKey, verified: true, share: 40 },
    ],
  };
  await unverifyCreator(umi, {
    ...commonArgs,
    creator: creatorA,
    metadata: verifiedMetadata,
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
        { address: creatorA.publicKey, verified: false, share: 60 },
        { address: creatorB.publicKey, verified: true, share: 40 },
      ],
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
