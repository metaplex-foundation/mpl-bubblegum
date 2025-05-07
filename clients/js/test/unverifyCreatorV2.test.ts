import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import { hashLeafV2, unverifyCreatorV2, verifyCreatorV2 } from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can unverify the creator of a minted compressed NFT', async (t) => {
  // Given a tree with a minted NFT that has two creators A and B.
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
  await verifyCreatorV2(umi, {
    ...commonArgs,
    creator: creatorA,
    metadata,
  })
    .add(
      verifyCreatorV2(umi, {
        ...commonArgs,
        creator: creatorB,
        metadata: partiallyVerifiedMetadata,
      })
    )
    .sendAndConfirm(umi);

  // When creator A unverifies themselves after both creators were verified.
  const verifiedMetadata = {
    ...metadata,
    creators: [
      { address: creatorA.publicKey, verified: true, share: 60 },
      { address: creatorB.publicKey, verified: true, share: 40 },
    ],
  };
  await unverifyCreatorV2(umi, {
    ...commonArgs,
    creator: creatorA,
    metadata: verifiedMetadata,
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
        { address: creatorA.publicKey, verified: false, share: 60 },
        { address: creatorB.publicKey, verified: true, share: 40 },
      ],
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
