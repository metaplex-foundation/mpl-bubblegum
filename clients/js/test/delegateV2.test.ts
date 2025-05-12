import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  delegateV2,
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can delegate a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
  const newDelegate = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await delegateV2(umi, {
    leafOwner,
    newLeafDelegate: newDelegate,
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
    delegate: newDelegate,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});

test('unauthorized user cannot delegate a compressed NFT using V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When an unauthorized user attempts to delegate.
  const nonOwner = generateSigner(umi);
  const newDelegate = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = delegateV2(umi, {
    leafOwner: nonOwner,
    newLeafDelegate: newDelegate,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // We expect the Merkle root to be wrong.
  await t.throwsAsync(promise, { name: 'PublicKeyMismatch' });

  // Then the leaf was not updated in the merkle tree.
  const notUpdatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: leafOwner.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(notUpdatedLeaf));
});
