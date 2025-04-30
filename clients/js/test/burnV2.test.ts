import { createCollection } from '@metaplex-foundation/mpl-core';
import {
  defaultPublicKey,
  generateSigner,
  publicKey,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  burnV2,
  delegateV2,
  hashMetadataCreators,
  hashMetadataDataV2,
  hashLeafV2,
  setNonTransferableV2,
  mintV2 as baseMintV2,
  MetadataArgsV2Args,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('owner can burn a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT burns it.
  await burnV2(umi, {
    authority: leafOwner,
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});

test('delegated authority can burn a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a delegated compressed NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi);
  const delegateAuthority = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  await delegateV2(umi, {
    leafOwner,
    newLeafDelegate: delegateAuthority.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // When the delegated authority burns the NFT.
  await burnV2(umi, {
    authority: delegateAuthority,
    leafOwner: leafOwner.publicKey,
    leafDelegate: delegateAuthority.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was deleted in the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
});

test('item set to non-transferrable can be burnt by owner', async (t) => {
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
  await baseMintV2(umi, {
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

  // When the owner of the NFT burns it.
  await burnV2(umi, {
    authority: leafOwner,
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
