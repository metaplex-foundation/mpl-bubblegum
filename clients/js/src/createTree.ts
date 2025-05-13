/* eslint-disable no-bitwise */
import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  Signer,
  TransactionBuilder,
  transactionBuilder,
  publicKey,
} from '@metaplex-foundation/umi';
import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  getMerkleTreeSize,
} from '@metaplex-foundation/spl-account-compression';
import { MPL_ACCOUNT_COMPRESSION_PROGRAM_ID } from '@metaplex-foundation/mpl-account-compression';
import { createTreeConfig, createTreeConfigV2 } from './generated';

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
    getMerkleTreeSize(input.maxDepth, input.maxBufferSize, input.canopyDepth);
  const lamports = await context.rpc.getRent(space);

  const programId = input.compressionProgram
    ? publicKey(input.compressionProgram)
    : context.programs.getPublicKey(
        'splAccountCompression',
        SPL_ACCOUNT_COMPRESSION_PROGRAM_ID
      );

  return (
    transactionBuilder()
      // Create the empty Merkle tree account.
      .add(
        createAccount(context, {
          payer: input.payer ?? context.payer,
          newAccount: input.merkleTree,
          lamports,
          space,
          programId,
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

export const createTreeV2 = async (
  context: Parameters<typeof createAccount>[0] &
    Parameters<typeof createTreeConfigV2>[0] &
    Pick<Context, 'rpc'>,
  input: Omit<Parameters<typeof createTreeConfigV2>[1], 'merkleTree'> & {
    merkleTree: Signer;
    merkleTreeSize?: number;
    canopyDepth?: number;
  }
): Promise<TransactionBuilder> => {
  const space =
    input.merkleTreeSize ??
    getMerkleTreeSize(input.maxDepth, input.maxBufferSize, input.canopyDepth);
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
            'mplAccountCompression',
            MPL_ACCOUNT_COMPRESSION_PROGRAM_ID
          ),
        })
      )
      // Create the tree config.
      .add(
        createTreeConfigV2(context, {
          ...input,
          merkleTree: input.merkleTree.publicKey,
        })
      )
  );
};
