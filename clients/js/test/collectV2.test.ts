import {
  generateSigner,
  publicKey,
  sol,
  addAmounts,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { collectV2, findTreeConfigPda } from '../src';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  hashLeafV2,
  transferV2,
  hashMetadataDataV2,
  hashMetadataCreators,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can mint a compressed NFT and collect', async (t) => {
  // Given a tree with a minted NFT owned by leafOwnerA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const [treeConfig] = findTreeConfigPda(umi, { merkleTree });

  // The tree config has the rent amount.
  let treeConfigBalance = await umi.rpc.getBalance(treeConfig);
  const rentAmount = 0.00155904;
  t.deepEqual(treeConfigBalance, sol(rentAmount));

  // When we mint a new NFT from the tree.
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
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));

  // And tree config has the `mintV2` fee added.
  treeConfigBalance = await umi.rpc.getBalance(treeConfig);
  let collectAmount = 0.00009;
  t.deepEqual(treeConfigBalance, sol(rentAmount + collectAmount));

  // When leafOwnerA transfers the NFT to leafOwnerB.
  const leafOwnerB = generateSigner(umi);
  await transferV2(umi, {
    authority: leafOwnerA,
    leafOwner: leafOwnerA.publicKey,
    newLeafOwner: leafOwnerB.publicKey,
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
    owner: leafOwnerB.publicKey,
    leafIndex,
    metadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));

  // And tree config has the `transferV2` fee added.
  treeConfigBalance = await umi.rpc.getBalance(treeConfig);
  collectAmount = collectAmount + 0.000006;
  t.deepEqual(treeConfigBalance, sol(rentAmount + collectAmount));

  // When the destination account is airdropped the exact rent amount.
  const destination = publicKey('2dgJVPC5fjLTBTmMvKDRig9JJUGK2Fgwr3EHShFxckhv');
  await umi.rpc.airdrop(destination, sol(0.1));
  const originalDestinationBalance = await umi.rpc.getBalance(destination);

  // When we collect from the merkle tree.
  await collectV2(umi, { treeConfig }).sendAndConfirm(umi);

  // Then the tree config has only the rent amount.
  treeConfigBalance = await umi.rpc.getBalance(treeConfig);
  t.deepEqual(treeConfigBalance, sol(rentAmount));

  // And the destination has the fee amount.
  const destinationBalance = await umi.rpc.getBalance(destination);
  t.deepEqual(
    destinationBalance,
    addAmounts(originalDestinationBalance, sol(collectAmount))
  );
});
