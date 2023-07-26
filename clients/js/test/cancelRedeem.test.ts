import { defaultPublicKey, publicKey } from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  cancelRedeem,
  fetchMerkleTree,
  findVoucherPda,
  getCurrentRoot,
  hashLeaf,
  hashMetadataCreators,
  hashMetadataData,
  redeem,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can cancel the redemption of a compressed NFT', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = await generateSignerWithSol(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // And given that NFT was redeemed.
  await redeem(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataData(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
  }).sendAndConfirm(umi);
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
  const [voucher] = findVoucherPda(umi, { merkleTree, nonce: leafIndex });
  t.true(await umi.rpc.accountExists(voucher));

  // When we cancel redeem the NFT.
  await cancelRedeem(umi, {
    leafOwner,
    merkleTree,
    voucher,
    root: getCurrentRoot(merkleTreeAccount.tree),
  }).sendAndConfirm(umi);

  // Then the leaf was added back to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(
    merkleTreeAccount.tree.rightMostPath.leaf,
    publicKey(
      hashLeaf(umi, {
        merkleTree,
        owner: leafOwner.publicKey,
        leafIndex,
        metadata,
      })
    )
  );

  // And the Voucher account was removed.
  t.false(await umi.rpc.accountExists(voucher));
});
