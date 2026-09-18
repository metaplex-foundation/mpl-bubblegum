import {
  addAmounts,
  defaultPublicKey,
  generateSigner,
  publicKey,
  sol,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/mpl-account-compression';
import {
  burnV2,
  closeTreeV2,
  findTreeConfigPda,
  hashMetadataCreators,
  hashMetadataDataV2,
} from '../src';
import { createTreeV2, createUmi, mintV2 } from './_setup';

const COLLECT_RECIPIENT = publicKey(
  '2dgJVPC5fjLTBTmMvKDRig9JJUGK2Fgwr3EHShFxckhv'
);

// The tree config PDA is a `TreeConfig` account, whose account size is
// `TREE_AUTHORITY_SIZE` (96) bytes.
const TREE_CONFIG_SIZE = 96;

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

test('closing a tree sweeps uncollected fees to the protocol recipient', async (t) => {
  // Given a V2 tree with a single minted leaf, which adds the 90,000 lamport
  // mint fee to the tree config PDA.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const [treeConfig] = findTreeConfigPda(umi, { merkleTree });
  const { metadata, leafIndex } = await mintV2(umi, { merkleTree });

  const mintFee = sol(0.00009);
  const treeConfigBalance = await umi.rpc.getBalance(treeConfig);
  const treeConfigRent = await umi.rpc.getRent(TREE_CONFIG_SIZE);
  t.deepEqual(treeConfigBalance, addAmounts(treeConfigRent, mintFee));

  // And the protocol recipient is pre-funded so it is rent exempt.
  await umi.rpc.airdrop(COLLECT_RECIPIENT, sol(0.1));
  const protocolBalanceBefore = await umi.rpc.getBalance(COLLECT_RECIPIENT);

  // And we record the creator's balance and the tree rent before closing.
  const merkleTreeBalance = await umi.rpc.getBalance(merkleTree);
  const creatorBalanceBefore = await umi.rpc.getBalance(umi.identity.publicKey);

  // When the tree creator burns the only leaf and closes the tree in the same
  // transaction.
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  await burnV2(umi, {
    leafOwner: umi.identity.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  })
    .add(closeTreeV2(umi, { merkleTree, recipient: umi.identity.publicKey }))
    .sendAndConfirm(umi);

  // Then both accounts are closed.
  t.false(await umi.rpc.accountExists(merkleTree));
  t.false(await umi.rpc.accountExists(treeConfig));

  // And the creator got back exactly the tree rent and config PDA rent (minus
  // the 5000 lamport tx fee), proving the mint fee did not go to the creator.
  // The creator's keypair is unique to this test, so this cannot race with
  // other test files.
  const creatorBalanceAfter = await umi.rpc.getBalance(umi.identity.publicKey);
  t.is(
    creatorBalanceAfter.basisPoints - creatorBalanceBefore.basisPoints,
    merkleTreeBalance.basisPoints + treeConfigRent.basisPoints - 5000n
  );

  // And the uncollected mint fee went to the protocol recipient. Other test
  // files (e.g. collectV2) credit the same shared address in parallel and its
  // balance only ever increases, so assert a lower bound rather than an exact
  // delta.
  const protocolBalanceAfter = await umi.rpc.getBalance(COLLECT_RECIPIENT);
  t.true(
    protocolBalanceAfter.basisPoints >=
      protocolBalanceBefore.basisPoints + mintFee.basisPoints
  );
});

test('it cannot close a tree using a non-protocol fee recipient', async (t) => {
  // Given a V2 tree with a single minted leaf, so the tree config PDA holds
  // an uncollected mint fee.
  const umi = await createUmi();
  const merkleTree = await createTreeV2(umi);
  const [treeConfig] = findTreeConfigPda(umi, { merkleTree });
  const { metadata, leafIndex } = await mintV2(umi, { merkleTree });

  // When the tree creator burns the only leaf and tries to close the tree
  // routing the fees to themselves instead of the protocol recipient.
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const promise = burnV2(umi, {
    leafOwner: umi.identity.publicKey,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash: hashMetadataDataV2(metadata),
    creatorHash: hashMetadataCreators(metadata.creators),
    nonce: leafIndex,
    index: leafIndex,
    proof: [],
  })
    .add(
      closeTreeV2(umi, {
        merkleTree,
        recipient: umi.identity.publicKey,
        feeRecipient: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the address constraint on the fee recipient to fail.
  const error = await t.throwsAsync(promise);
  const logs =
    (error as { logs?: string[]; cause?: { logs?: string[] } })?.logs ??
    (error as { logs?: string[]; cause?: { logs?: string[] } })?.cause?.logs ??
    [];
  t.true(
    logs.some((log) => log.includes('ConstraintAddress')),
    `Unexpected logs: ${logs.join('\n')}`
  );
  t.true(await umi.rpc.accountExists(merkleTree));
  t.true(await umi.rpc.accountExists(treeConfig));
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
