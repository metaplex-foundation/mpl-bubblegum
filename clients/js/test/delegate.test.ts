import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  delegate,
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  hashMetadataCreators,
  hashMetadataData,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can delegate a compressed NFT', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the owner of the NFT delegates it to another account.
  const newDelegate = generateSigner(umi).publicKey;
  await delegate(umi, {
    leafOwner,
    previousLeafDelegate: leafOwner.publicKey,
    newLeafDelegate: newDelegate,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    delegate: newDelegate,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
