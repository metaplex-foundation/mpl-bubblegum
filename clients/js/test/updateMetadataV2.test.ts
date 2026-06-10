import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core';
import {
  defaultPublicKey,
  generateSigner,
  none,
  some,
  publicKey,
  PublicKey,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  DasApiAsset,
  GetAssetProofRpcResponse,
} from '@metaplex-foundation/digital-asset-standard-api';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  UpdateArgsArgs,
  findLeafAssetIdPda,
  getAssetWithProof,
  getMerkleProof,
  hashMetadataCreators,
  MetadataArgsV2Args,
  hashLeafV2,
  updateMetadataV2,
  hashMetadataDataV2,
  mintV2 as baseMintV2,
  verifyCreatorV2,
  hashAssetData,
  hashCollection,
  LeafSchemaV2Flags,
  SELLER_FEE_BASIS_POINTS_INHERIT,
} from '../src';
import { mintV2 as mintV2WithInheritedSellerFees } from '../src/mintV2';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('tree owner can update the metadata of a minted compressed NFT using V2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);
  t.is(merkleTreeAccount.tree.bufferSize, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 0);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
  };
  await baseMintV2(umi, { leafOwner, merkleTree, metadata }).sendAndConfirm(
    umi
  );

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);
  t.is(merkleTreeAccount.tree.activeIndex, 1n);
  t.is(merkleTreeAccount.tree.bufferSize, 2n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 1);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // And when metadata is updated.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  await updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: {
      ...metadata,
      name: 'New name',
      uri: 'https://updated-example.com/my-nft.json',
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('asset owner cannot update the metadata of a minted compressed NFT using V2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
  };
  await baseMintV2(umi, {
    leafOwner: leafOwner.publicKey,
    merkleTree,
    metadata,
  }).sendAndConfirm(umi);

  // Then the hash of the metadata matches the new leaf.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex: 0,
    metadata,
  });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // And when metadata is updated.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  const promise = updateMetadataV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // We expect a failure.
  await t.throwsAsync(promise, { name: 'TreeAuthorityIncorrect' });

  // Then the leaf was not updated in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it can update metadata using the getAssetWithProof helper using V2 instructions', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi, { maxDepth: 5, maxBufferSize: 8 });
  const preMints = [
    await mintV2(umi, { merkleTree, leafIndex: 0 }),
    await mintV2(umi, { merkleTree, leafIndex: 1 }),
    await mintV2(umi, { merkleTree, leafIndex: 2 }),
    await mintV2(umi, { merkleTree, leafIndex: 3 }),
    await mintV2(umi, { merkleTree, leafIndex: 4 }),
    await mintV2(umi, { merkleTree, leafIndex: 5 }),
    await mintV2(umi, { merkleTree, leafIndex: 6 }),
    await mintV2(umi, { merkleTree, leafIndex: 7 }),
  ];

  // And a 9th minted NFT owned by leafOwner.
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leaf, leafIndex } = await mintV2(umi, {
    leafOwner,
    merkleTree,
    leafIndex: 8,
  });

  // And given we mock the RPC client to return the following asset and proof.
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  const rpcAsset = {
    ownership: { owner: leafOwner },
    compression: {
      leaf_id: leafIndex,
      data_hash: publicKey(hashMetadataDataV2(metadata)),
      creator_hash: publicKey(hashMetadataCreators(metadata.creators)),
      collection_hash: publicKey(hashCollection(defaultPublicKey())),
      asset_data_hash: publicKey(hashAssetData()),
      flags: LeafSchemaV2Flags.None,
    },
  } as DasApiAsset;

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const rpcAssetProof = {
    proof: getMerkleProof([...preMints.map((m) => m.leaf), leaf], 5, leaf),
    root: publicKey(getCurrentRoot(merkleTreeAccount.tree)),
    tree_id: merkleTree,
    node_index: leafIndex + 2 ** 5,
  } as GetAssetProofRpcResponse;
  umi.rpc = {
    ...umi.rpc,
    getAsset: async (params: {
      assetId: PublicKey;
      displayOptions?: { showUnverifiedCollections?: boolean };
    }) => {
      t.is(params.assetId, assetId);
      t.deepEqual(params.displayOptions, { showUnverifiedCollections: true });
      return rpcAsset;
    },
    getAssetProof: async (givenAssetId: PublicKey) => {
      t.is(givenAssetId, assetId);
      return rpcAssetProof;
    },
  };

  // When we use the getAssetWithProof helper.
  const assetWithProof = await getAssetWithProof(umi, assetId);

  // Then we can use it to update metadata for the NFT.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  await updateMetadataV2(umi, {
    // Pass parameters from the asset with proof.
    ...assetWithProof,
    leafOwner,
    currentMetadata: metadata,
    updateArgs,
  }).sendAndConfirm(umi);

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);
});

test('getAssetWithProof infers inherited seller fee metadata from the data hash', async (t) => {
  // Given a DAS asset whose royalty basis points are resolved from the collection.
  const assetId = publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo');
  const merkleTree = publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU');
  const leafOwner = publicKey('HjzLbPCVGFjXAo5HXS5fpQmXjQE6FMgDEPvFZon7rC7G');
  const coreCollection = publicKey(
    '7USYF5BnFo4FuE8eRoEqEvSvZSEaMG5AqPCQbLQ5BxPL'
  );
  const canonicalMetadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS_INHERIT,
    collection: some(coreCollection),
    creators: [],
  };
  const rpcAsset = {
    ownership: { owner: leafOwner },
    content: {
      metadata: { name: 'My NFT', symbol: '' },
      json_uri: 'https://example.com/my-nft.json',
    },
    royalty: {
      basis_points: 500,
      primary_sale_happened: false,
    },
    mutable: true,
    supply: {},
    creators: [],
    grouping: [
      {
        group_key: 'collection',
        group_value: coreCollection,
        verified: true,
      },
    ],
    compression: {
      leaf_id: 0,
      data_hash: publicKey(hashMetadataDataV2(canonicalMetadata)),
      creator_hash: defaultPublicKey(),
      collection_hash: publicKey(hashCollection(coreCollection)),
      asset_data_hash: publicKey(hashAssetData()),
      flags: LeafSchemaV2Flags.None,
    },
  } as unknown as DasApiAsset;
  const rpcAssetProof = {
    proof: [],
    root: defaultPublicKey(),
    tree_id: merkleTree,
    node_index: 1,
  } as unknown as GetAssetProofRpcResponse;
  const context = {
    rpc: {
      getAsset: async () => rpcAsset,
      getAssetProof: async () => rpcAssetProof,
    },
  } as unknown as Parameters<typeof getAssetWithProof>[0];

  // When we use the getAssetWithProof helper.
  const assetWithProof = await getAssetWithProof(context, assetId);

  // Then metadata uses the resolved value, while currentMetadata keeps the sentinel for hashing.
  t.is(assetWithProof.metadata.sellerFeeBasisPoints, 500);
  t.is(
    assetWithProof.currentMetadata.sellerFeeBasisPoints,
    SELLER_FEE_BASIS_POINTS_INHERIT
  );
  t.deepEqual(assetWithProof.currentMetadata.collection, some(coreCollection));
  t.is(assetWithProof.rpcAsset.royalty?.basis_points, 500);
});

test('getAssetWithProof resolves inherited seller fee basis points with a collection resolver', async (t) => {
  // Given a DAS asset whose royalty basis points are still the raw sentinel.
  const assetId = publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo');
  const merkleTree = publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU');
  const leafOwner = publicKey('HjzLbPCVGFjXAo5HXS5fpQmXjQE6FMgDEPvFZon7rC7G');
  const coreCollection = publicKey(
    '7USYF5BnFo4FuE8eRoEqEvSvZSEaMG5AqPCQbLQ5BxPL'
  );
  const rpcAsset = {
    ownership: { owner: leafOwner },
    content: {
      metadata: { name: 'My NFT', symbol: '' },
      json_uri: 'https://example.com/my-nft.json',
    },
    royalty: {
      basis_points: SELLER_FEE_BASIS_POINTS_INHERIT,
      primary_sale_happened: false,
    },
    mutable: true,
    supply: {},
    creators: [],
    grouping: [
      {
        group_key: 'collection',
        group_value: coreCollection,
        verified: true,
      },
    ],
    compression: {
      leaf_id: 0,
      data_hash: defaultPublicKey(),
      creator_hash: defaultPublicKey(),
      collection_hash: publicKey(hashCollection(coreCollection)),
      asset_data_hash: publicKey(hashAssetData()),
      flags: LeafSchemaV2Flags.None,
    },
  } as unknown as DasApiAsset;
  const rpcAssetProof = {
    proof: [],
    root: defaultPublicKey(),
    tree_id: merkleTree,
    node_index: 1,
  } as unknown as GetAssetProofRpcResponse;
  const context = {
    rpc: {
      getAsset: async () => rpcAsset,
      getAssetProof: async () => rpcAssetProof,
    },
  } as unknown as Parameters<typeof getAssetWithProof>[0];

  // When we use the getAssetWithProof helper with a collection royalty resolver.
  const assetWithProof = await getAssetWithProof(context, assetId, {
    resolveCollectionSellerFeeBasisPoints: (collection) => {
      t.is(collection, coreCollection);
      return 500;
    },
  });

  // Then metadata uses the resolved value, while currentMetadata keeps the sentinel for hashing.
  t.is(assetWithProof.metadata.sellerFeeBasisPoints, 500);
  t.is(
    assetWithProof.currentMetadata.sellerFeeBasisPoints,
    SELLER_FEE_BASIS_POINTS_INHERIT
  );
  t.deepEqual(assetWithProof.currentMetadata.collection, some(coreCollection));
});

test('getAssetWithProof currentMetadata can update inherited seller fee assets', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // And a Bubblegum V2 Core collection with royalties.
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV2',
      },
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [
          { address: collectionUpdateAuthority.publicKey, percentage: 100 },
        ],
        ruleSet: ruleSet('None'),
      },
    ],
  }).sendAndConfirm(umi);

  // And a minted NFT that defaults to inheriting seller fees from the collection.
  const metadata = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  await mintV2WithInheritedSellerFees(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  const canonicalMetadata: MetadataArgsV2Args = {
    ...metadata,
    sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS_INHERIT,
  };
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const assetId = findLeafAssetIdPda(umi, { merkleTree, leafIndex: 0 })[0];
  const rpcAsset = {
    ownership: { owner: leafOwner },
    content: {
      metadata: { name: 'My NFT', symbol: '' },
      json_uri: 'https://example.com/my-nft.json',
    },
    royalty: {
      basis_points: 500,
      primary_sale_happened: false,
      basis_points_raw: SELLER_FEE_BASIS_POINTS_INHERIT,
      sfbp_inherited: true,
    },
    mutable: true,
    supply: {},
    creators: [],
    grouping: [
      {
        group_key: 'collection',
        group_value: coreCollection.publicKey,
        verified: true,
      },
    ],
    compression: {
      leaf_id: 0,
      data_hash: publicKey(hashMetadataDataV2(canonicalMetadata)),
      creator_hash: publicKey(hashMetadataCreators(canonicalMetadata.creators)),
      collection_hash: publicKey(hashCollection(coreCollection.publicKey)),
      asset_data_hash: publicKey(hashAssetData()),
      flags: LeafSchemaV2Flags.None,
    },
  } as unknown as DasApiAsset;
  const rpcAssetProof = {
    proof: [],
    root: publicKey(getCurrentRoot(merkleTreeAccount.tree)),
    tree_id: merkleTree,
    node_index: 1,
  } as unknown as GetAssetProofRpcResponse;
  const context = {
    rpc: {
      getAsset: async () => rpcAsset,
      getAssetProof: async () => rpcAssetProof,
    },
  } as unknown as Parameters<typeof getAssetWithProof>[0];

  // When we update from the helper output without overriding currentMetadata.
  const assetWithProof = await getAssetWithProof(context, assetId);
  t.is(assetWithProof.metadata.sellerFeeBasisPoints, 500);
  t.is(
    assetWithProof.currentMetadata.sellerFeeBasisPoints,
    SELLER_FEE_BASIS_POINTS_INHERIT
  );

  await updateMetadataV2(umi, {
    ...assetWithProof,
    authority: collectionUpdateAuthority,
    coreCollection: coreCollection.publicKey,
    updateArgs: {
      name: some('New name'),
    },
  }).sendAndConfirm(umi);

  // Then the leaf was updated using the sentinel-based metadata hash.
  const updatedMetadata: MetadataArgsV2Args = {
    ...canonicalMetadata,
    name: 'New name',
  };
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: updatedMetadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can update metadata using collection update authority if NFT is in a collection', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

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
        type: 'BubblegumV2',
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
  await baseMintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // And when metadata is updated.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    authority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: {
      ...metadata,
      name: 'New name',
      uri: 'https://updated-example.com/my-nft.json',
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can update a collected NFT to inherit seller fee basis points', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

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
        type: 'BubblegumV2',
      },
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [
          { address: collectionUpdateAuthority.publicKey, percentage: 100 },
        ],
        ruleSet: ruleSet('None'),
      },
    ],
  }).sendAndConfirm(umi);

  // And a minted NFT in the collection with an explicit seller fee.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  await baseMintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // When the collection authority updates the NFT to inherit seller fees.
  const updateArgs: UpdateArgsArgs = {
    sellerFeeBasisPoints: some(SELLER_FEE_BASIS_POINTS_INHERIT),
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    authority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf uses the inherited seller fee sentinel in its hash.
  const updatedMetadata: MetadataArgsV2Args = {
    ...metadata,
    sellerFeeBasisPoints: SELLER_FEE_BASIS_POINTS_INHERIT,
  };
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: updatedMetadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it cannot update a collected NFT to inherit seller fees from a collection without royalties', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // And a Collection NFT without the Royalties plugin.
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV2',
      },
    ],
  }).sendAndConfirm(umi);

  // And a minted NFT in the collection with an explicit seller fee.
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550,
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  await baseMintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // When the collection authority tries to switch the NFT to inherited seller fees.
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = updateMetadataV2(umi, {
    authority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs: {
      sellerFeeBasisPoints: some(SELLER_FEE_BASIS_POINTS_INHERIT),
    },
  }).sendAndConfirm(umi);

  // Then the program rejects the collection because there is nothing to inherit.
  await t.throwsAsync(promise, { name: 'CollectionMustHaveRoyaltiesPlugin' });
});

test('it can update metadata using collection update delegate when NFT is in a collection', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // And a Collection NFT with update delegate.
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  const updateDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV2',
      },
      {
        type: 'UpdateDelegate',
        additionalDelegates: [],
        authority: {
          type: 'Address',
          address: updateDelegate.publicKey,
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
  await baseMintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // And when metadata is updated by the collection's update delegate.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    authority: updateDelegate,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: {
      ...metadata,
      name: 'New name',
      uri: 'https://updated-example.com/my-nft.json',
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can update metadata using collection update delegate additional delegate when NFT is in a collection', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // And a Collection NFT with update delegate.
  const coreCollection = generateSigner(umi);
  const collectionUpdateAuthority = generateSigner(umi);
  const updateDelegate = generateSigner(umi);
  await createCollection(umi, {
    collection: coreCollection,
    updateAuthority: collectionUpdateAuthority.publicKey,
    name: 'Test Collection',
    uri: 'https://example.com/collection.json',
    plugins: [
      {
        type: 'BubblegumV2',
      },
      {
        type: 'UpdateDelegate',
        additionalDelegates: [updateDelegate.publicKey],
        authority: {
          type: 'UpdateAuthority',
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
  await baseMintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // And when metadata is updated by the collection's update delegate.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    authority: updateDelegate,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: {
      ...metadata,
      name: 'New name',
      uri: 'https://updated-example.com/my-nft.json',
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can update metadata using the getAssetWithProof helper with collection', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi, { maxDepth: 5, maxBufferSize: 8 });
  const preMints = [
    await mintV2(umi, { merkleTree, leafIndex: 0 }),
    await mintV2(umi, { merkleTree, leafIndex: 1 }),
    await mintV2(umi, { merkleTree, leafIndex: 2 }),
    await mintV2(umi, { merkleTree, leafIndex: 3 }),
    await mintV2(umi, { merkleTree, leafIndex: 4 }),
    await mintV2(umi, { merkleTree, leafIndex: 5 }),
    await mintV2(umi, { merkleTree, leafIndex: 6 }),
    await mintV2(umi, { merkleTree, leafIndex: 7 }),
  ];

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
        type: 'BubblegumV2',
      },
    ],
  }).sendAndConfirm(umi);

  // And a 9th minted NFT owned by leafOwner
  const metadata: MetadataArgsV2Args = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: some(coreCollection.publicKey),
    creators: [],
  };
  const leafOwner = generateSigner(umi).publicKey;
  const leafIndex = 8;
  await baseMintV2(umi, {
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  const leaf = publicKey(
    hashLeafV2(umi, {
      merkleTree,
      owner: leafOwner,
      leafIndex,
      metadata,
    })
  );

  // And given we mock the RPC client to return the following asset and proof.
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  const rpcAsset = {
    ownership: { owner: leafOwner },
    compression: {
      leaf_id: leafIndex,
      data_hash: publicKey(hashMetadataDataV2(metadata)),
      creator_hash: publicKey(hashMetadataCreators(metadata.creators)),
      collection_hash: publicKey(hashCollection(defaultPublicKey())),
      asset_data_hash: publicKey(hashAssetData()),
      flags: LeafSchemaV2Flags.None,
    },
  } as DasApiAsset;

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const rpcAssetProof = {
    proof: getMerkleProof([...preMints.map((m) => m.leaf), leaf], 5, leaf),
    root: publicKey(getCurrentRoot(merkleTreeAccount.tree)),
    tree_id: merkleTree,
    node_index: leafIndex + 2 ** 5,
  } as GetAssetProofRpcResponse;
  umi.rpc = {
    ...umi.rpc,
    getAsset: async (params: {
      assetId: PublicKey;
      displayOptions?: { showUnverifiedCollections?: boolean };
    }) => {
      t.is(params.assetId, assetId);
      t.deepEqual(params.displayOptions, { showUnverifiedCollections: true });
      return rpcAsset;
    },
    getAssetProof: async (givenAssetId: PublicKey) => {
      t.is(givenAssetId, assetId);
      return rpcAssetProof;
    },
  };

  // When we use the getAssetWithProof helper.
  const assetWithProof = await getAssetWithProof(umi, assetId);

  // Then we can use it to update metadata for the NFT using collection authority.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };

  await updateMetadataV2(umi, {
    // Pass parameters from the asset with proof.
    ...assetWithProof,
    authority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    currentMetadata: metadata,
    updateArgs,
  }).sendAndConfirm(umi);

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);
});

test('it cannot update metadata using tree owner when NFT is in collection', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const treeCreator = await generateSignerWithSol(umi);
  const merkleTree = await createTreeV2(umi, { treeCreator });
  const leafOwner = generateSigner(umi).publicKey;

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
        type: 'BubblegumV2',
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
  await baseMintV2(umi, {
    treeCreatorOrDelegate: treeCreator,
    collectionAuthority: collectionUpdateAuthority,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    metadata,
  }).sendAndConfirm(umi);

  // Then we attempt to update metadata using the tree owner.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = updateMetadataV2(umi, {
    authority: treeCreator,
    leafOwner,
    merkleTree,
    coreCollection: coreCollection.publicKey,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidCollectionAuthority' });

  // And the leaf was not updated in the merkle tree.
  const notUpdatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(notUpdatedLeaf));
});

test('it cannot update immutable metadata using V2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // When we mint a new NFT from the tree.
  const { metadata, leafIndex } = await mintV2(umi, {
    leafOwner,
    merkleTree,
  });

  // And we set the NFT to immutable.
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: metadata,
    proof: [],
    updateArgs: { isMutable: false },
  }).sendAndConfirm(umi);

  // And the leaf was updated to be immutable in the merkle tree.
  const immutableMetadata = {
    ...metadata,
    isMutable: false,
  };
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: immutableMetadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // Then we attempt to update metadata.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  const promise = updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: immutableMetadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // And we expect a program error.
  await t.throwsAsync(promise, { name: 'MetadataImmutable' });

  // And the leaf was not updated in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 2n);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it cannot verify currently unverified creator if not signer using V2 instructions', async (t) => {
  const umi = await createUmi();
  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
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

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: {
      ...metadata,
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
    proof: [],
    updateArgs: {
      name: 'New name',
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: true, share: 40 },
      ],
    },
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'CreatorDidNotVerify' });
});

test('it can verify currently unverified creator if signer using V2 instructions', async (t) => {
  const umi = await createUmi();
  const creatorA = umi.identity;
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
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

  const updateArgs = {
    name: 'New name',
    creators: [
      { address: creatorA.publicKey, verified: true, share: 60 },
      { address: creatorB.publicKey, verified: false, share: 40 },
    ],
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: {
      ...metadata,
      ...updateArgs,
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it cannot unverify currently verified creator if not signer using V2 instructions', async (t) => {
  const umi = await createUmi();
  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
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

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  const updateArgs = {
    name: 'New name',
    creators: [
      { address: creatorA.publicKey, verified: false, share: 60 },
      { address: creatorB.publicKey, verified: false, share: 40 },
    ],
  };

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: {
      ...metadata,
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'CreatorDidNotUnverify' });
});

test('it can unverify currently verified creator if signer using V2 instructions', async (t) => {
  const umi = await createUmi();
  const creatorA = umi.identity;
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner,
    metadata: {
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
  });

  const updateArgs = {
    name: 'New name',
    creators: [
      { address: creatorA.publicKey, verified: false, share: 60 },
      { address: creatorB.publicKey, verified: false, share: 40 },
    ],
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: {
      ...metadata,
      ...updateArgs,
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it can remove currently verified creator using empty creator array if signer using V2 instructions', async (t) => {
  const umi = await createUmi();
  const creatorA = umi.identity;
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner,
    metadata: {
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
  });

  const updateArgs = {
    name: 'New name',
    creators: [],
  };

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: {
      ...metadata,
      ...updateArgs,
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('it cannot unverify currently verified creator using empty creator array if not signer using V2 instructions', async (t) => {
  const umi = await createUmi();
  const creatorA = generateSigner(umi);
  const creatorB = generateSigner(umi);
  const merkleTree = await createTreeV2(umi);
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

  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  const updateArgs = {
    name: 'New name',
    creators: [],
  };

  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = updateMetadataV2(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: {
      ...metadata,
      creators: [
        { address: creatorA.publicKey, verified: true, share: 60 },
        { address: creatorB.publicKey, verified: false, share: 40 },
      ],
    },
    proof: [],
    updateArgs,
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'CreatorDidNotUnverify' });

  // And the leaf was not updated in the merkle tree.
  const notUpdatedLeaf = hashLeafV2(umi, {
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
  t.is(merkleTreeAccount.tree.sequenceNumber, 2n);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(notUpdatedLeaf));
});
