import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  Context,
  Signer,
  TransactionBuilder,
  transactionBuilder,
  PublicKey,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  TreeConfig,
  createTree,
  createTreeConfig,
  fetchTreeConfigFromSeeds,
  safeFetchTreeConfigFromSeeds,
  getMerkleTreeSize,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  getCompressionPrograms,
  MPL_NOOP_PROGRAM_ID,
  MPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
} from '../src';
import { createUmi } from './_setup';

const createTreeWithSpecificMerkleOwner = async (
  context: Parameters<typeof createAccount>[0] &
    Parameters<typeof createTreeConfig>[0] &
    Pick<Context, 'rpc'>,
  input: Omit<Parameters<typeof createTreeConfig>[1], 'merkleTree'> & {
    merkleTree: Signer;
    merkleTreeSize?: number;
    canopyDepth?: number;
    merkleTreeOwner?: PublicKey;
  }
): Promise<TransactionBuilder> => {
  const space =
    input.merkleTreeSize ??
    getMerkleTreeSize(input.maxDepth, input.maxBufferSize, input.canopyDepth);
  const lamports = await context.rpc.getRent(space);

  let programId;
  if (input.compressionProgram) {
    programId = Array.isArray(input.compressionProgram)
      ? input.compressionProgram[0]
      : input.compressionProgram;
  } else {
    programId = context.programs.getPublicKey(
      'splAccountCompression',
      SPL_ACCOUNT_COMPRESSION_PROGRAM_ID
    );
  }

  return (
    transactionBuilder()
      // Create the empty Merkle tree account.
      .add(
        createAccount(context, {
          payer: input.payer ?? context.payer,
          newAccount: input.merkleTree,
          lamports,
          space,
          programId: input.merkleTreeOwner ? input.merkleTreeOwner : programId,
        })
      )
      // Create the tree config.
      .add(
        createTreeConfig(context, {
          ...input,
          merkleTree: input.merkleTree.publicKey,
        })
      )
  );
};

test('it can create a Bubblegum tree', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
  });
  await builder.sendAndConfirm(umi);

  // Then an account exists at the merkle tree address.
  t.true(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was created with the correct data.
  const treeConfig = await fetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: publicKey(umi.identity),
    treeDelegate: publicKey(umi.identity),
    totalMintCapacity: 2n ** 14n,
    numMinted: 0n,
    isPublic: false,
  });
});

test('it can create a Bubblegum tree using a newer size', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 6,
    maxBufferSize: 16,
  });
  await builder.sendAndConfirm(umi);

  // Then an account exists at the merkle tree address.
  t.true(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was created with the correct data.
  const treeConfig = await fetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: publicKey(umi.identity),
    treeDelegate: publicKey(umi.identity),
    totalMintCapacity: 2n ** 6n,
    numMinted: 0n,
    isPublic: false,
  });
});

test('it can create a Bubblegum tree using mpl-account-compression and mpl-noop', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // For these tests, make sure `getCompressionPrograms` doesn't return spl programs.
  const { logWrapper, compressionProgram } = await getCompressionPrograms(umi);
  t.is(logWrapper, MPL_NOOP_PROGRAM_ID);
  t.is(compressionProgram, MPL_ACCOUNT_COMPRESSION_PROGRAM_ID);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    ...(await getCompressionPrograms(umi)),
  });
  await builder.sendAndConfirm(umi);

  // Then an account exists at the merkle tree address.
  t.true(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was created with the correct data.
  const treeConfig = await fetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.like(treeConfig, <TreeConfig>{
    treeCreator: publicKey(umi.identity),
    treeDelegate: publicKey(umi.identity),
    totalMintCapacity: 2n ** 14n,
    numMinted: 0n,
    isPublic: false,
  });
});

test('it cannot create a Bubblegum tree using invalid logWrapper with spl-account-compression', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    logWrapper: generateSigner(umi).publicKey,
  });

  const promise = builder.sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidLogWrapper' });

  // And an account does not exist at the merkle tree address.
  t.false(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was not created with the correct data.
  const treeConfig = await safeFetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.is(treeConfig, null);
});

test('it cannot create a Bubblegum tree using invalid logWrapper with mpl-account-compression', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    logWrapper: generateSigner(umi).publicKey,
    compressionProgram: MPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  });

  const promise = builder.sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidLogWrapper' });

  // And an account does not exist at the merkle tree address.
  t.false(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was not created with the correct data.
  const treeConfig = await safeFetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.is(treeConfig, null);
});

test('it cannot create a Bubblegum tree when compression program does not match tree owned by spl-account-compression', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTreeWithSpecificMerkleOwner(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    compressionProgram: generateSigner(umi).publicKey,
    merkleTreeOwner: umi.programs.getPublicKey(
      'splAccountCompression',
      SPL_ACCOUNT_COMPRESSION_PROGRAM_ID
    ),
  });

  const promise = builder.sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidCompressionProgram' });

  // And an account does not exist at the merkle tree address.
  t.false(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was not created with the correct data.
  const treeConfig = await safeFetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.is(treeConfig, null);
});

test('it cannot create a Bubblegum tree when compression program does not match tree owned by mpl-account-compression', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTreeWithSpecificMerkleOwner(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    logWrapper: MPL_NOOP_PROGRAM_ID,
    compressionProgram: generateSigner(umi).publicKey,
    merkleTreeOwner: MPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  });

  const promise = builder.sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'InvalidCompressionProgram' });

  // And an account does not exist at the merkle tree address.
  t.false(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was not created with the correct data.
  const treeConfig = await safeFetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.is(treeConfig, null);
});

test('it cannot create a Bubblegum tree with incorrect Merkle tree owner', async (t) => {
  // Given a brand new merkle tree signer.
  const umi = await createUmi();
  const merkleTree = generateSigner(umi);

  // When we create a tree at this address.
  const builder = await createTreeWithSpecificMerkleOwner(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    merkleTreeOwner: generateSigner(umi).publicKey,
  });

  const promise = builder.sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'IncorrectOwner' });

  // And an account does not exist at the merkle tree address.
  t.false(await umi.rpc.accountExists(merkleTree.publicKey));

  // And a tree config was not created with the correct data.
  const treeConfig = await safeFetchTreeConfigFromSeeds(umi, {
    merkleTree: merkleTree.publicKey,
  });
  t.is(treeConfig, null);
});
