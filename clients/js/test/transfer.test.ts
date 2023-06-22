import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  hashMetadataCreators,
  hashMetadataData,
  transfer,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can transfer a compressed NFT', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwnerA = generateSigner(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwnerA.publicKey,
  });

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transfer(umi, {
    leafOwner: leafOwnerA,
    newLeafOwner: leafOwnerB.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
  })
    .addRemainingAccounts([]) // <- Proof nodes would be added as remaining accounts.
    .sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwnerB.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
