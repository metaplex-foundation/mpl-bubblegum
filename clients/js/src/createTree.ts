/* eslint-disable no-bitwise */
import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  createTreeConfig,
} from './generated';

export const createTree = async (
  context: Parameters<typeof createAccount>[0] &
    Parameters<typeof createTreeConfig>[0] &
    Pick<Context, 'rpc'>,
  input: Omit<Parameters<typeof createTreeConfig>[1], 'merkleTree'> & {
    merkleTree: Signer;
    merkleTreeSize?: number;
    canopyDepth?: number;
  }
): Promise<TransactionBuilder> => {
  const space =
    input.merkleTreeSize ??
    getMerkleTreeAccountSize(
      input.maxDepth,
      input.maxBufferSize,
      input.canopyDepth
    );
  const lamports = await context.rpc.getRent(space);

  return (
    transactionBuilder()
      // Create the empty Merkle tree account.
      .add(
        createAccount(context, {
          payer: input.payer ?? context.payer,
          newAccount: input.merkleTree,
          lamports,
          space,
          programId: context.programs.getPublicKey(
            'splAccountCompression',
            SPL_ACCOUNT_COMPRESSION_PROGRAM_ID
          ),
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

export const getMerkleTreeAccountSize = (
  maxDepth: number,
  maxBufferSize: number,
  canopyDepth?: number
): number =>
  1 + // Account discriminant.
  1 + // Header version.
  54 + // Merkle tree header V1.
  8 + // Merkle tree > sequenceNumber.
  8 + // Merkle tree > activeIndex.
  8 + // Merkle tree > bufferSize.
  (40 + 32 * maxDepth) * maxBufferSize + // Merkle tree > changeLogs.
  (32 * maxDepth + 40) + // Merkle tree > rightMostPath.
  (canopyDepth ? Math.max(((1 << (canopyDepth + 1)) - 2) * 32, 0) : 0);
