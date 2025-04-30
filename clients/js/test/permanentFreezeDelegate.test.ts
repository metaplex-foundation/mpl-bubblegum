import {
  createCollection,
  updateCollectionPlugin,
} from '@metaplex-foundation/mpl-core';
import { generateSigner, publicKey, some } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  freezeV2,
  MetadataArgsV2Args,
  mintV2,
  transferV2,
  burnV2,
  thawV2,
} from '../src';
import { createTreeV2, createUmi } from './_setup';

test('permanent freeze delegate on collection can freeze a compressed NFT', async (t) => {
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
  const permanentFreezeDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
        authority: {
          type: 'Address',
          address: permanentFreezeDelegate.publicKey,
        },
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

  // When the permanent freeze delegate of the collection freezes the NFT.
  await freezeV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwnerKey,
    leafDelegate: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex: 0,
    metadata,
    flags: 2,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});

test('permanent freeze delegate on collection can thaw compressed NFT it previously froze', async (t) => {
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
  const permanentFreezeDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
        authority: {
          type: 'Address',
          address: permanentFreezeDelegate.publicKey,
        },
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

  // When the permanent freeze delegate of the collection freezes the NFT.
  await freezeV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwnerKey,
    leafDelegate: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex: 0,
    metadata,
    flags: 2,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the permanent freeze delegate of the collection freezes the NFT.
  await thawV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwnerKey,
    leafDelegate: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 2,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const thawedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex: 0,
    metadata,
    flags: 0,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(thawedLeaf));
});

test('asset cannot be transferred by owner when asset is frozen by permanent freeze delegate', async (t) => {
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
  const permanentFreezeDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
        authority: {
          type: 'Address',
          address: permanentFreezeDelegate.publicKey,
        },
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

  // When the permanent freeze delegate of the collection freezes the NFT.
  await freezeV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwnerKey,
    leafDelegate: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata,
    flags: 2,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the owner attempts to transfer the NFT.
  const leafOwnerB = generateSigner(umi);
  const promise = transferV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwnerKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 2,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'AssetIsFrozen' });

  // And the leaf has not changed in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});

test('asset cannot be transferred by owner when collection is frozen', async (t) => {
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
  const permanentFreezeDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
        authority: {
          type: 'Address',
          address: permanentFreezeDelegate.publicKey,
        },
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

  // When we update the collection to be frozen.
  await updateCollectionPlugin(umi, {
    collection: coreCollection.publicKey,
    authority: permanentFreezeDelegate,
    plugin: {
      type: 'PermanentFreezeDelegate',
      frozen: true,
    },
  }).sendAndConfirm(umi);

  // When the owner attempts to transfer the NFT.
  const leafOwnerB = generateSigner(umi);
  const promise = transferV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwnerKey,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 2,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'CollectionIsFrozen' });

  // And the leaf has not changed in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('asset cannot be burned by owner when asset is frozen by permanent freeze delegate ', async (t) => {
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
  const permanentFreezeDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
        authority: {
          type: 'Address',
          address: permanentFreezeDelegate.publicKey,
        },
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

  // When the permanent freeze delegate of the collection freezes the NFT.
  await freezeV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwnerKey,
    leafDelegate: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata,
    flags: 2,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the owner attempts to burn the NFT.
  const promise = burnV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 2,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'AssetIsFrozen' });

  // And the leaf has not changed in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));
});

test('asset cannot be burned by owner when collection is frozen', async (t) => {
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
  const permanentFreezeDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV1',
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
        authority: {
          type: 'Address',
          address: permanentFreezeDelegate.publicKey,
        },
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

  // When we update the collection to be frozen.
  await updateCollectionPlugin(umi, {
    collection: coreCollection.publicKey,
    authority: permanentFreezeDelegate,
    plugin: {
      type: 'PermanentFreezeDelegate',
      frozen: true,
    },
  }).sendAndConfirm(umi);

  // When the owner attempts to burn the NFT.
  const promise = burnV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 2,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'CollectionIsFrozen' });

  // And the leaf has not changed in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});
