import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import {
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
  transfer,
  getCurrentRoot,
  hashMetadataCreators,
  hashMetadataData,
} from '../src';
import { createTree, createUmi } from './_setup';

test('it can mint an NFT from a collection and then transfer it', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let leafOwner = generateSigner(umi);
  let leafOwnerKey = leafOwner.publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);

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
    leafOwner: leafOwnerKey,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
  }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  let updatedMetadata = {
    ...metadata,
    collection: some({ key: collectionMint.publicKey, verified: true }),
  };

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    leafOwner: leafOwner,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(updatedMetadata),
    creatorHash: hashMetadataCreators(updatedMetadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    delegate: leafOwnerB.publicKey,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
