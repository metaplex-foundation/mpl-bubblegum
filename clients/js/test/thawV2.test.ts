import {
  generateSigner,
  publicKey,
  PublicKey,
  defaultPublicKey,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  delegateV2,
  hashLeafV2,
  findLeafAssetIdPda,
  hashMetadataCreators,
  hashMetadataDataV2,
  freezeV2,
  thawV2,
  getMerkleProof,
  getAssetWithProof,
  hashCollection,
  hashAssetData,
  canTransfer,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';
import {
  DasApiAsset,
  GetAssetProofRpcResponse,
} from '@metaplex-foundation/digital-asset-standard-api';

test('delegate can thaw a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
  const newDelegate = generateSigner(umi);
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

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When the delegate of the NFT freezes it.
  await freezeV2(umi, {
    authority: newDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: 1,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the delegate of the NFT thaws it.
  await thawV2(umi, {
    authority: newDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 1,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree with flags cleared.
  const unfrozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: 0,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(unfrozenLeaf));
});

test('owner cannot thaw a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
  const newDelegate = generateSigner(umi);
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

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // When the delegate of the NFT freezes it.
  await freezeV2(umi, {
    authority: newDelegate,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: 1,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the owner of the NFT attempts to unfreeze it.
  const promise = thawV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    leafDelegate: newDelegate.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidAuthority' });

  // And the leaf was not updated in the merkle tree.
  const stillFrozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate.publicKey,
    leafIndex,
    metadata,
    flags: 1,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(stillFrozenLeaf));
});

test('owner as default leaf delegate can thaw a compressed NFT it previously froze', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT freezes it.
  await freezeV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: leafOwner.publicKey,
    leafIndex,
    metadata,
    flags: 1,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // When the owner of the NFT thaws it.
  await thawV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    leafDelegate: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    flags: 1,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree with flags cleared.
  const unfrozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: leafOwner.publicKey,
    leafIndex,
    metadata,
    flags: 0,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(unfrozenLeaf));
});

test('can thaw a compressed NFT using the getAssetWithProof helper using V2 instructions', async (t) => {
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

  // And a 9th minted NFT owned by leafOwnerA.
  const leafOwner = generateSigner(umi);
  const { metadata, leaf, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
    leafIndex: 8,
  });

  // And given we mock the RPC client to return the following asset and proof.
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  let rpcAsset = {
    ownership: {
      owner: leafOwner.publicKey,
      frozen: false,
      non_transferable: false,
    },
    compression: {
      leaf_id: leafIndex,
      data_hash: publicKey(hashMetadataDataV2(metadata)),
      creator_hash: publicKey(hashMetadataCreators(metadata.creators)),
      collection_hash: publicKey(hashCollection(defaultPublicKey())),
      asset_data_hash: publicKey(hashAssetData()),
      flags: 0,
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
  let assetWithProof = await getAssetWithProof(umi, assetId);

  // And the owner of the NFT freezes it.
  await freezeV2(umi, {
    ...assetWithProof,
    authority: leafOwner,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const frozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex,
    metadata,
    flags: 1,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(frozenLeaf));

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);

  // When we get an updated value from the helper.
  rpcAsset.compression.flags = 1;
  rpcAsset.ownership.frozen = true;
  assetWithProof = await getAssetWithProof(umi, assetId);

  // Check using the `canTransfer` helper.
  t.is(canTransfer(assetWithProof), false);

  // And the owner of the NFT thaws it.
  await thawV2(umi, {
    ...assetWithProof,
    authority: leafOwner,
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree with flags cleared.
  const unfrozenLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex,
    metadata,
    flags: 0,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(unfrozenLeaf));

  // And the full asset and proof responses can be retrieved.
  t.is(assetWithProof.rpcAsset, rpcAsset);
  t.is(assetWithProof.rpcAssetProof, rpcAssetProof);
});
