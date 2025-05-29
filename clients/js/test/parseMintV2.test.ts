/* eslint-disable no-await-in-loop */
import { createCollection } from '@metaplex-foundation/mpl-core';
import {
  defaultPublicKey,
  generateSigner,
  some,
  none,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchMerkleTree } from '@metaplex-foundation/spl-account-compression';
import {
  MetadataArgsV2Args,
  findLeafAssetIdPda,
  mintV2,
  parseLeafFromMintV2Transaction,
} from '../src';
import { createTreeV2, createUmi } from './_setup';

test('it can parse the leaf from mintV2 instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  // Test with 10 different leaves to be sure they increment correctly.
  for (let nonce = 0; nonce < 10; nonce += 1) {
    const { signature } = await mintV2(umi, {
      leafOwner,
      merkleTree,
      metadata,
    }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
    const leaf = await parseLeafFromMintV2Transaction(umi, signature);
    const assetId = findLeafAssetIdPda(umi, { merkleTree, leafIndex: nonce });

    t.is(leafOwner, leaf.owner);
    t.is(Number(leaf.nonce), nonce);
    t.is(leaf.id, assetId[0]);
  }
});

test('it can parse the leaf from mintV2 to collection instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);
  t.is(merkleTreeAccount.tree.bufferSize, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 0);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());

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

  // Test with 10 different leaves to be sure they increment correctly.
  for (let nonce = 0; nonce < 10; nonce += 1) {
    const { signature } = await mintV2(umi, {
      collectionAuthority: collectionUpdateAuthority,
      leafOwner,
      merkleTree,
      coreCollection: coreCollection.publicKey,
      metadata,
    }).sendAndConfirm(umi);

    const leaf = await parseLeafFromMintV2Transaction(umi, signature);
    const assetId = findLeafAssetIdPda(umi, { merkleTree, leafIndex: nonce });

    t.is(leafOwner, leaf.owner);
    t.is(Number(leaf.nonce), nonce);
    t.is(leaf.id, assetId[0]);
  }
});
