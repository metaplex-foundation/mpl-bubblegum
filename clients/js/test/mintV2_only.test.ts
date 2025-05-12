import {
  defaultPublicKey,
  generateSigner,
  publicKey,
  sol,
} from '@metaplex-foundation/umi';
import test from 'ava';

import { fetchMerkleTree } from '@metaplex-foundation/mpl-account-compression';
import { AssetDataSchema, hashLeafV2 } from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can mint a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });

  // Then the leaf is in the merkle tree.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerA.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it can mint a compressed NFT with a separate payer', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const payer = generateSigner(umi);
  await umi.rpc.airdrop(payer.publicKey, sol(1));
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    payer,
    treeCreatorOrDelegate: umi.identity,
  });

  // Then the leaf is in the merkle tree.
  const leaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwnerA.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it cannot mint a compressed NFT with asset data using V2 instructions', async (t) => {
  // NOTE: This test verifies the current behavior where asset data is not yet supported.
  // In a future update, this functionality is expected to be implemented and this test
  // will need to be updated accordingly.

  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);

  const promise = mintV2(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
    assetData: new Uint8Array([1, 2, 3, 4]),
    assetDataSchema: AssetDataSchema.Json,
  });

  await t.throwsAsync(promise, { name: 'NotAvailable' });

  // Then the rightmost leaf is still the default `Publickey`.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(
    merkleTreeAccount.tree.rightMostPath.leaf,
    publicKey(defaultPublicKey())
  );
});
