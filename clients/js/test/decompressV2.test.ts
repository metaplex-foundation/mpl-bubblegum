import { createCollection, fetchAsset } from '@metaplex-foundation/mpl-core';
import {
  defaultPublicKey,
  generateSigner,
  none,
  publicKey,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  decompressV2,
  delegateAndFreezeV2,
  delegateV2,
  freezeV2,
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  setNonTransferableV2,
  LeafSchemaV2Flags,
  MetadataArgsV2Args,
} from '../src';
import { createTree, createTreeV2, createUmi, mintV2 } from './_setup';

const buildCollectionWithBubblegum = async (umi: any) => {
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [{ type: 'BubblegumV2' }],
  }).sendAndConfirm(umi);
  return { coreCollection, collectionUpdateAuthority };
};

test('owner can decompress a v2 leaf into the same Core collection', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Decompress Me',
    uri: 'https://example.com/decompress.json',
    sellerFeeBasisPoints: 500,
    collection: some(coreCollection.publicKey),
    creators: [],
  };

  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  const newAsset = generateSigner(umi);
  await decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Leaf is gone from the tree.
  const after = await fetchMerkleTree(umi, merkleTree);
  t.is(after.tree.rightMostPath.leaf, defaultPublicKey());

  // Core asset exists, in the right collection, owned by the leaf owner.
  const asset = await fetchAsset(umi, newAsset.publicKey);
  t.is(asset.owner, leafOwner.publicKey);
  t.is(asset.updateAuthority.type, 'Collection');
  if (asset.updateAuthority.type === 'Collection') {
    t.is(asset.updateAuthority.address, coreCollection.publicKey);
  }
  t.is(asset.name, metadata.name);
  t.is(asset.uri, metadata.uri);
});

test('leaf delegate can decompress', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const leafDelegate = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Delegated',
    uri: 'https://example.com/d.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafDelegate.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  await decompressV2(umi, {
    leafAuthority: leafDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafDelegate.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  const asset = await fetchAsset(umi, newAsset.publicKey);
  t.is(asset.owner, leafOwner.publicKey);

  // Delegate is preserved as TransferDelegate + BurnDelegate plugins on the
  // resulting Core asset, both pointing at the original leaf delegate.
  t.truthy(asset.transferDelegate);
  t.is(
    asset.transferDelegate?.authority.type === 'Address'
      ? asset.transferDelegate.authority.address
      : null,
    leafDelegate.publicKey
  );
  t.truthy(asset.burnDelegate);
  t.is(
    asset.burnDelegate?.authority.type === 'Address'
      ? asset.burnDelegate.authority.address
      : null,
    leafDelegate.publicKey
  );
});

test('non-owner non-delegate cannot decompress', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Nope',
    uri: 'https://example.com/nope.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const stranger = generateSigner(umi);
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  const promise = decompressV2(umi, {
    leafAuthority: stranger,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'InvalidAuthority' });

  // Leaf is still there.
  const stillThere = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex,
    metadata,
  });
  const after = await fetchMerkleTree(umi, merkleTree);
  t.is(after.tree.rightMostPath.leaf, publicKey(stillThere));
});

test('cannot decompress with a different collection than the leaf metadata', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);
  const otherCollection = (await buildCollectionWithBubblegum(umi))
    .coreCollection;

  const metadata: MetadataArgsV2Args = {
    name: 'Wrong Collection',
    uri: 'https://example.com/wc.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: otherCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'CollectionMismatch' });
});

test('cannot decompress a leaf that has no collection', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection } = await buildCollectionWithBubblegum(umi);

  // Mint a leaf with no collection.
  const metadata: MetadataArgsV2Args = {
    name: 'Lonely',
    uri: 'https://example.com/lonely.json',
    sellerFeeBasisPoints: 0,
    collection: none(),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    leafOwner: leafOwner.publicKey,
    merkleTree,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'CollectionNotFound' });
});

test('decompress preserves the FreezeDelegate state when leaf is frozen by owner', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const leafDelegate = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Frozen',
    uri: 'https://example.com/frozen.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };

  // Mint, then delegate-and-freeze in one shot.
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await delegateAndFreezeV2(umi, {
    leafOwner,
    newLeafDelegate: leafDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Decompress as the leaf delegate (who is allowed to act on a frozen leaf).
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  await decompressV2(umi, {
    leafAuthority: leafDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafDelegate.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByOwner,
    proof: [],
  }).sendAndConfirm(umi);

  const asset = await fetchAsset(umi, newAsset.publicKey);
  t.truthy(asset.freezeDelegate);
  t.is(asset.freezeDelegate?.frozen, true);
  t.is(
    asset.freezeDelegate?.authority.type === 'Address'
      ? asset.freezeDelegate.authority.address
      : null,
    leafDelegate.publicKey
  );
});

test('cannot decompress a soulbound (non-transferable) leaf', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const permanentFreezeDelegate = generateSigner(umi);

  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'C',
    uri: 'https://example.com/c.json',
    plugins: [
      { type: 'BubblegumV2' },
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

  const metadata: MetadataArgsV2Args = {
    name: 'Soulbound',
    uri: 'https://example.com/sb.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await setNonTransferableV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.NonTransferable,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'AssetIsNonTransferable' });
});

test('cannot decompress a leaf frozen by the collection permanent freeze delegate', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const permanentFreezeDelegate = generateSigner(umi);

  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'C',
    uri: 'https://example.com/c.json',
    plugins: [
      { type: 'BubblegumV2' },
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

  const metadata: MetadataArgsV2Args = {
    name: 'Perm Frozen',
    uri: 'https://example.com/pf.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  // Permanently freeze the asset via the collection delegate (perm-freeze
  // delegate signs against the bubblegum freezeV2 ix).
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await freezeV2(umi, {
    authority: permanentFreezeDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    flags: LeafSchemaV2Flags.FrozenByPermDelegate,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'AssetIsFrozen' });
});

test('decompress preserves royalties and creator splits as a Royalties plugin', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Royal',
    uri: 'https://example.com/royal.json',
    sellerFeeBasisPoints: 750,
    collection: some(coreCollection.publicKey),
    creators: [
      { address: creatorA.publicKey, share: 60, verified: false },
      { address: creatorB.publicKey, share: 40, verified: false },
    ],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  await decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  const asset = await fetchAsset(umi, newAsset.publicKey);
  t.truthy(asset.royalties);
  t.is(asset.royalties?.basisPoints, 750);
  t.is(asset.royalties?.creators.length, 2);
  t.deepEqual(
    asset.royalties?.creators.map((c) => ({
      address: c.address,
      percentage: c.percentage,
    })),
    [
      { address: creatorA.publicKey, percentage: 60 },
      { address: creatorB.publicKey, percentage: 40 },
    ]
  );
});

test('decompressV2 rejects v1 trees', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTree(umi); // v1 tree
  const leafOwner = generateSigner(umi);
  const { coreCollection } = await buildCollectionWithBubblegum(umi);

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  const metadata: MetadataArgsV2Args = {
    name: 'V1',
    uri: 'https://example.com/v1.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0n,
    index: 0,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'UnsupportedSchemaVersion' });
});

test('cannot decompress with a tampered metadata hash', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Original',
    uri: 'https://example.com/orig.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  // Pass tampered metadata (different name) -> the merkle proof check fails
  // because the recomputed leaf hash will not match what's in the tree.
  const tampered: MetadataArgsV2Args = { ...metadata, name: 'Tampered' };
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata: tampered,
    proof: [],
  }).sendAndConfirm(umi);

  // mpl-account-compression rejects the proof — exact name varies, just assert
  // it threw something.
  await t.throwsAsync(promise);
});

test('cannot decompress the same leaf twice', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Once',
    uri: 'https://example.com/once.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const firstAsset = generateSigner(umi);
  await decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset: firstAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const secondAsset = generateSigner(umi);
  const promise = decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset: secondAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // The leaf is now empty so the merkle proof reconstruction won't match.
  await t.throwsAsync(promise);
});

test('it can re-delegate after decompressing into Core (round-trip sanity)', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const newDelegate = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Round',
    uri: 'https://example.com/round.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  // Set a delegate before decompressing.
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await delegateV2(umi, {
    leafOwner,
    newLeafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  await decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  const asset = await fetchAsset(umi, newAsset.publicKey);
  t.is(
    asset.transferDelegate?.authority.type === 'Address'
      ? asset.transferDelegate.authority.address
      : null,
    newDelegate.publicKey
  );
});

test('payer covers asset rent independently of leaf authority', async (t) => {
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { coreCollection, collectionUpdateAuthority } =
    await buildCollectionWithBubblegum(umi);

  const metadata: MetadataArgsV2Args = {
    name: 'Pay',
    uri: 'https://example.com/pay.json',
    sellerFeeBasisPoints: 0,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const { leafIndex } = await mintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const newAsset = generateSigner(umi);
  // umi.payer (the default funded keypair) pays; leafOwner only signs as auth.
  await decompressV2(umi, {
    leafAuthority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    newAsset,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  const asset = await fetchAsset(umi, newAsset.publicKey);
  t.is(asset.owner, leafOwner.publicKey);
});
