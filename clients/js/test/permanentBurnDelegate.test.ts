import {
  createCollection,
  updateCollectionPlugin,
} from '@metaplex-foundation/mpl-core';
import {
  generateSigner,
  publicKey,
  some,
  defaultPublicKey,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  burnV2,
  MetadataArgsV2Args,
  mintV2,
  freezeV2,
  setNonTransferableV2,
} from '../src';
import { createTreeV2, createUmi } from './_setup';

test('permanent burn delegate on collection can burn a compressed NFT', async (t) => {
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
  const permanentBurnDelegate = generateSigner(umi);
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
        type: 'PermanentBurnDelegate',
        authority: {
          type: 'Address',
          address: permanentBurnDelegate.publicKey,
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

  // When the permanent burn delegate of the collection burns the NFT.
  await burnV2(umi, {
    authority: permanentBurnDelegate,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});

test('permanent burn delegate can burn a compressed NFT even if asset is frozen by owner', async (t) => {
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
  const permanentBurnDelegate = generateSigner(umi);
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
        type: 'PermanentBurnDelegate',
        authority: {
          type: 'Address',
          address: permanentBurnDelegate.publicKey,
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

  // When the owner of the NFT freezes the NFT.
  await freezeV2(umi, {
    authority: leafOwner,
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
    flags: 1,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the permanent burn delegate of the collection burns the NFT.
  await burnV2(umi, {
    authority: permanentBurnDelegate,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 1,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});

test('permanent burn delegate can burn a compressed NFT even if asset is frozen by permanent freeze delegate', async (t) => {
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
  const permanentBurnDelegate = generateSigner(umi);
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
        type: 'PermanentBurnDelegate',
        authority: {
          type: 'Address',
          address: permanentBurnDelegate.publicKey,
        },
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

  // When the permanent burn delegate of the collection burns the NFT.
  await burnV2(umi, {
    authority: permanentBurnDelegate,
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

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});

test('permanent burn delegate can burn a compressed NFT even if collection is frozen', async (t) => {
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
  const permanentBurnDelegate = generateSigner(umi);
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
        type: 'PermanentBurnDelegate',
        authority: {
          type: 'Address',
          address: permanentBurnDelegate.publicKey,
        },
      },
      {
        type: 'PermanentFreezeDelegate',
        frozen: false,
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
    authority: collectionUpdateAuthority,
    plugin: {
      type: 'PermanentFreezeDelegate',
      frozen: true,
    },
  }).sendAndConfirm(umi);

  // When the permanent burn delegate of the collection burns the NFT.
  await burnV2(umi, {
    authority: permanentBurnDelegate,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});

test('item set to non-transferrable can be burnt by permanent burn delegate', async (t) => {
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
  const permanentBurnDelegate = generateSigner(umi);
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
        type: 'PermanentBurnDelegate',
        authority: {
          type: 'Address',
          address: permanentBurnDelegate.publicKey,
        },
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
  await setNonTransferableV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwnerKey,
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
  const soulboundLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerKey,
    leafIndex: 0,
    metadata,
    flags: 4,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(soulboundLeaf));

  // When the permanent burn delegate of the collection burns the NFT.
  await burnV2(umi, {
    authority: permanentBurnDelegate,
    leafOwner: leafOwnerKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 4,
    nonce: 0,
    index: 0,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});
