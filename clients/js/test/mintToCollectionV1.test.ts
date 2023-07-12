import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import {
  defaultPublicKey,
  generateSigner,
  percentAmount,
  publicKey,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  MetadataArgsArgs,
  fetchMerkleTree,
  hashLeaf,
  mintToCollectionV1,
} from '../src';
import { createTree, createUmi } from './_setup';

test('it can mint an NFT from a collection', async (t) => {
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

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: false,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    message: metadata,
    collectionMint: collectionMint.publicKey,
  }).sendAndConfirm(umi);

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
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});
