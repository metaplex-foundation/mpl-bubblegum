import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  updateAssetDataV2,
  hashLeafV2,
  hashMetadataCreators,
  hashMetadataDataV2,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it cannot update asset data using V2 instructions', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const leafOwner = generateSigner(umi);
  const { metadata, leafIndex } = await mintV2(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When the authority of the NFT attempts to update the asset data.
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = updateAssetDataV2(umi, {
    leafOwner: leafOwner.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  await t.throwsAsync(promise, { name: 'NotAvailable' });

  // Then the leaf not was updated in the merkle tree.
  const updatedLeaf = hashLeafV2(umi, {
    merkleTree,
    owner: leafOwner.publicKey,
    leafIndex,
    metadata,
    assetData: new Uint8Array(0),
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
