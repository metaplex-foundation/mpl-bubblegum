import { defaultPublicKey } from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  LeafSchema,
  Voucher,
  fetchMerkleTree,
  fetchVoucherFromSeeds,
  findLeafAssetIdPda,
  getCurrentRoot,
  hashMetadataCreators,
  hashMetadataData,
  redeem,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can redeem a compressed NFT', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = await generateSignerWithSol(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // When leaf owner redeems the compressed NFT.
  const dataHash = hashMetadataData(metadata);
  const creatorHash = hashMetadataCreators(metadata.creators);
  await redeem(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash,
    creatorHash,
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  }).sendAndConfirm(umi);

  // Then the leaf was removed from the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());

  // And a new Voucher account was created.
  const voucher = await fetchVoucherFromSeeds(umi, {
    merkleTree,
    nonce: leafIndex,
  });
  t.like(voucher, <Voucher>{
    merkleTree,
    index: leafIndex,
    leafSchema: <LeafSchema>{
      __kind: 'V1',
      id: findLeafAssetIdPda(umi, { merkleTree, leafIndex })[0],
      owner: leafOwner.publicKey,
      delegate: leafOwner.publicKey,
      nonce: BigInt(leafIndex),
      dataHash,
      creatorHash,
    },
  });
});
