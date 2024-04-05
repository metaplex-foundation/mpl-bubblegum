/* eslint-disable no-await-in-loop */
import {
  defaultPublicKey,
  generateSigner,
  none,
  percentAmount,
} from '@metaplex-foundation/umi';
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import test from 'ava';
import {
  MetadataArgsArgs,
  fetchMerkleTree,
  findLeafAssetIdPda,
  mintToCollectionV1,
  mintV1,
  parseLeafFromMintToCollectionV1Transaction,
  parseLeafFromMintV1Transaction,
} from '../src';
import { createTree, createUmi } from './_setup';

test('it can parse the leaf from mint instructions', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  // Test with 10 different leaves to be sure they increment correctly.
  for (let nonce = 0; nonce < 10; nonce += 1) {
    const { signature } = await mintV1(umi, {
      leafOwner,
      merkleTree,
      metadata,
    }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
    const leaf = await parseLeafFromMintV1Transaction(umi, signature);
    const assetId = findLeafAssetIdPda(umi, { merkleTree, leafIndex: nonce });

    t.is(leafOwner, leaf.owner);
    t.is(Number(leaf.nonce), nonce);
    t.is(leaf.id, assetId[0]);
  }
});

test('it can parse the leaf from mintToCollection instructions)', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);
  t.is(merkleTreeAccount.tree.bufferSize, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 0);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata, with collection unverified.
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

  // Test with 10 different leaves to be sure they increment correctly.
  for (let nonce = 0; nonce < 10; nonce += 1) {
    const { signature } = await mintToCollectionV1(umi, {
      leafOwner,
      merkleTree,
      metadata,
      collectionMint: collectionMint.publicKey,
    }).sendAndConfirm(umi);

    const leaf = await parseLeafFromMintToCollectionV1Transaction(
      umi,
      signature
    );
    const assetId = findLeafAssetIdPda(umi, { merkleTree, leafIndex: nonce });

    t.is(leafOwner, leaf.owner);
    t.is(Number(leaf.nonce), nonce);
    t.is(leaf.id, assetId[0]);
  }
});
