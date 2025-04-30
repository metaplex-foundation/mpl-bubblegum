import { createCollection } from '@metaplex-foundation/mpl-core';
import {
  generateSigner,
  publicKey,
  some,
  none,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  MetadataArgsV2Args,
  hashLeafV2,
  mintV2,
  setCollectionV2,
} from '../src';
import { createTreeV2, createUmi } from './_setup';

test('it can mint an NFT to a collection and then remove it from collection using V2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const leafOwnerKey = leafOwner.publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);

  // And a Collection NFT.
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
    ],
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  // When collection update authority removes it from the collection.
  await setCollectionV2(umi, {
    authority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: none(),
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can mint an NFT not in a collection then add it to collection using V2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const leafOwnerKey = leafOwner.publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: none(),
    creators: [],
  };
  await mintV2(umi, {
    leafOwner: leafOwnerKey,
    merkleTree,
    metadata,
  }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // When we mint a Collection NFT.
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
    ],
  }).sendAndConfirm(umi);

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  // Then add the leaf to the collection.
  await setCollectionV2(umi, {
    newCollectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newCoreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: some(coreCollection.publicKey),
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can mint an NFT to a collection and move it to a new collection using V2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const leafOwnerKey = leafOwner.publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);

  // And a Collection NFT.
  const originalCoreCollection = generateSigner(umi);
  const originalCollectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: originalCoreCollection,
    updateAuthority: originalCollectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
    ],
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: some(originalCoreCollection.publicKey),
    creators: [],
  };
  await mintV2(umi, {
    collectionAuthority: originalCollectionUpdateAuthority,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: originalCoreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // When we mint a new Collection NFT.
  const newCoreCollection = generateSigner(umi);
  const newCollectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: newCoreCollection,
    updateAuthority: newCollectionUpdateAuthority.publicKey,
    name: 'Test Collection 2',
    uri: 'https://example.com/collection2.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
    ],
  }).sendAndConfirm(umi);

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  // Then add the leaf to the collection.
  await setCollectionV2(umi, {
    authority: originalCollectionUpdateAuthority,
    newCollectionAuthority: newCollectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: originalCoreCollection.publicKey,
    newCoreCollection: newCoreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: some(newCoreCollection.publicKey),
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
