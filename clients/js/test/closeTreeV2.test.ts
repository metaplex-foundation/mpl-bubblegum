import {
  defaultPublicKey,
  generateSigner,
  publicKey,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchMerkleTree } from '@metaplex-foundation/mpl-account-compression';
import { closeTreeV2, findTreeConfigPda } from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

test('it can close an empty Bubblegum tree', async (t) => {
  // Given a V2 Bubblegum tree with no leaves.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const [treeConfig] = findTreeConfigPda(umi, { merkleTree });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(
    merkleTreeAccount.tree.rightMostPath.leaf,
    publicKey(defaultPublicKey())
  );
  t.true(await umi.rpc.accountExists(treeConfig));

  // And we record the balances before closing.
  const recipient = umi.identity.publicKey;
  const merkleTreeBalance = await umi.rpc.getBalance(merkleTree);
  const treeConfigBalance = await umi.rpc.getBalance(treeConfig);
  const recipientBalanceBefore = await umi.rpc.getBalance(recipient);

  // When we close the tree.
  await closeTreeV2(umi, {
    merkleTree,
    recipient,
  }).sendAndConfirm(umi);

  // Then the tree and config accounts are closed.
  t.false(await umi.rpc.accountExists(merkleTree));
  t.false(await umi.rpc.accountExists(treeConfig));

  // And the recipient reclaimed the rent minus the 5000 lamport tx fee.
  const recipientBalanceAfter = await umi.rpc.getBalance(recipient);
  const reclaimedLamports =
    merkleTreeBalance.basisPoints + treeConfigBalance.basisPoints;
  const balanceDiff =
    recipientBalanceAfter.basisPoints - recipientBalanceBefore.basisPoints;
  t.is(balanceDiff, reclaimedLamports - 5000n);
});

test('it cannot close a non-empty Bubblegum tree', async (t) => {
  // Given a V2 Bubblegum tree with a minted leaf.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const [treeConfig] = findTreeConfigPda(umi, { merkleTree });
  await mintV2(umi, { merkleTree });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.not(
    merkleTreeAccount.tree.rightMostPath.leaf,
    publicKey(defaultPublicKey())
  );

  // When we try to close the non-empty tree.
  const promise = closeTreeV2(umi, {
    merkleTree,
    recipient: umi.identity.publicKey,
  }).sendAndConfirm(umi);

  // Then we expect a program error with logs indicating the tree is not empty.
  const error = await t.throwsAsync(promise);
  const logs =
    (error as { logs?: string[]; cause?: { logs?: string[] } })?.logs ??
    (error as { logs?: string[]; cause?: { logs?: string[] } })?.cause?.logs ??
    [];
  t.true(
    logs.some((log) => log.includes('Tree is not empty')),
    `Unexpected logs: ${logs.join('\n')}`
  );
  t.true(await umi.rpc.accountExists(merkleTree));
  t.true(await umi.rpc.accountExists(treeConfig));
});

test('it cannot close a Bubblegum tree as a non-authority', async (t) => {
  // Given a V2 Bubblegum tree with no leaves.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const [treeConfig] = findTreeConfigPda(umi, { merkleTree });
  const nonAuthority = generateSigner(umi);
  t.true(await umi.rpc.accountExists(merkleTree));
  t.true(await umi.rpc.accountExists(treeConfig));

  // When a non-authority tries to close the tree.
  const promise = closeTreeV2(umi, {
    authority: nonAuthority,
    merkleTree,
    recipient: umi.identity.publicKey,
  }).sendAndConfirm(umi);

  // Then we expect an InvalidAuthority error.
  await t.throwsAsync(promise, { name: 'InvalidAuthority' });
  t.true(await umi.rpc.accountExists(merkleTree));
  t.true(await umi.rpc.accountExists(treeConfig));
});
