import {
  createNft,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  defaultPublicKey,
  generateSigner,
  none,
  some,
  publicKey,
  PublicKey,
  percentAmount,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  MetadataArgsArgs,
  UpdateArgsArgs,
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  updateMetadata,
  mintV1,
  findLeafAssetIdPda,
  getAssetWithProof,
  getMerkleProof,
  hashMetadataCreators,
  hashMetadataData,
  mintToCollectionV1,
} from '../src';
import { mint, createTree, createUmi } from './_setup';
import {
  DasApiAsset,
  GetAssetProofRpcResponse,
} from '@metaplex-foundation/digital-asset-standard-api';

test('it can update the metadata of a minted compressed NFT', async (t) => {
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

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
  };
  await mintV1(umi, { leafOwner, merkleTree, metadata }).sendAndConfirm(umi);

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
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // And when metadata is updated.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  await updateMetadata(umi, {
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
  const updatedLeaf = hashLeaf(umi, {
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

test('it can update metadata using the getAssetWithProof helper', async (t) => {
  // Given we increase the timeout for this test.
  t.timeout(20000);

  // And given a tree with several minted NFTs so that the proof is required.
  const umi = await createUmi();
  const merkleTree = await createTree(umi, { maxDepth: 5, maxBufferSize: 8 });
  const preMints = [
    await mint(umi, { merkleTree, leafIndex: 0 }),
    await mint(umi, { merkleTree, leafIndex: 1 }),
    await mint(umi, { merkleTree, leafIndex: 2 }),
    await mint(umi, { merkleTree, leafIndex: 3 }),
    await mint(umi, { merkleTree, leafIndex: 4 }),
    await mint(umi, { merkleTree, leafIndex: 5 }),
    await mint(umi, { merkleTree, leafIndex: 6 }),
    await mint(umi, { merkleTree, leafIndex: 7 }),
  ];

  // And a 9th minted NFT owned by leafOwner.
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leaf, leafIndex } = await mint(umi, {
    leafOwner,
    merkleTree,
    leafIndex: 8,
  });

  // And given we mock the RPC client to return the following asset and proof.
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  const rpcAsset = {
    ownership: { owner: leafOwner },
    compression: {
      leaf_id: leafIndex,
      data_hash: publicKey(hashMetadataData(metadata)),
      creator_hash: publicKey(hashMetadataCreators(metadata.creators)),
    },
  } as DasApiAsset;
  const rpcAssetProof = {
    proof: getMerkleProof([...preMints.map((m) => m.leaf), leaf], 5, leaf),
    root: publicKey(getCurrentRoot(merkleTreeAccount.tree)),
    tree_id: merkleTree,
    node_index: leafIndex + 2 ** 5,
  } as GetAssetProofRpcResponse;
  umi.rpc = {
    ...umi.rpc,
    getAsset: async (givenAssetId: PublicKey) => {
      t.is(givenAssetId, assetId);
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
  await updateMetadata(umi, {
    ...assetWithProof,
    leafOwner,
    currentMetadata: metadata,
    updateArgs,
  }).sendAndConfirm(umi);

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);
});

test('it cannot update metadata using collection update authority when collection not verified', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  const collectionAuthority = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    authority: collectionAuthority,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree with an unverified collection.
  const { metadata, leafIndex } = await mint(umi, {
    leafOwner,
    merkleTree,
    metadata: {
      collection: some({ key: collectionMint.publicKey, verified: false }),
    },
  });

  // Then we attempt to update metadata using the collection update authority.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  let promise = updateMetadata(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
    authority: collectionAuthority,
    collectionMint: collectionMint.publicKey,
    collectionMetadata: findMetadataPda(umi, {
      mint: collectionMint.publicKey,
    }),
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'TreeAuthorityIncorrect' });

  // And the leaf was not updated in the merkle tree.
  const notUpdatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(notUpdatedLeaf));
});

test('it can update metadata using collection update authority when collection is verified', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  const collectionAuthority = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    authority: collectionAuthority,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata, with collection verified.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: true,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
    collectionAuthority: collectionAuthority,
  }).sendAndConfirm(umi);

  // And when metadata is updated.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  await updateMetadata(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
    authority: collectionAuthority,
    collectionMint: collectionMint.publicKey,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
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

test('it cannot update metadata using tree owner when collection is verified', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const treeCreator = await generateSignerWithSol(umi);
  const merkleTree = await createTree(umi, { treeCreator });
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  const collectionAuthority = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    authority: collectionAuthority,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata, with collection verified.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: true,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
    collectionAuthority: collectionAuthority,
    treeCreatorOrDelegate: treeCreator,
  }).sendAndConfirm(umi);

  // Then we attempt to update metadata using the tree owner.
  const updateArgs: UpdateArgsArgs = {
    name: some('New name'),
    uri: some('https://updated-example.com/my-nft.json'),
  };
  let promise = updateMetadata(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: 0,
    index: 0,
    currentMetadata: metadata,
    proof: [],
    updateArgs,
    authority: treeCreator,
    collectionMint: collectionMint.publicKey,
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidCollectionAuthority' });

  // And the leaf was not updated in the merkle tree.
  const notUpdatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(notUpdatedLeaf));
});
