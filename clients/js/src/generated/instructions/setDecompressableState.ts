/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';
import {
  DecompressableState,
  DecompressableStateArgs,
  getDecompressableStateSerializer,
} from '../types';

// Accounts.
export type SetDecompressableStateInstructionAccounts = {
  treeConfig: PublicKey | Pda;
  treeCreator?: Signer;
};

// Data.
export type SetDecompressableStateInstructionData = {
  discriminator: Array<number>;
  decompressableState: DecompressableState;
};

export type SetDecompressableStateInstructionDataArgs = {
  decompressableState: DecompressableStateArgs;
};

export function getSetDecompressableStateInstructionDataSerializer(): Serializer<
  SetDecompressableStateInstructionDataArgs,
  SetDecompressableStateInstructionData
> {
  return mapSerializer<
    SetDecompressableStateInstructionDataArgs,
    any,
    SetDecompressableStateInstructionData
  >(
    struct<SetDecompressableStateInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['decompressableState', getDecompressableStateSerializer()],
      ],
      { description: 'SetDecompressableStateInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [18, 135, 238, 168, 246, 195, 61, 115],
    })
  ) as Serializer<
    SetDecompressableStateInstructionDataArgs,
    SetDecompressableStateInstructionData
  >;
}

// Args.
export type SetDecompressableStateInstructionArgs =
  SetDecompressableStateInstructionDataArgs;

// Instruction.
export function setDecompressableState(
  context: Pick<Context, 'identity' | 'programs'>,
  input: SetDecompressableStateInstructionAccounts &
    SetDecompressableStateInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplBubblegum',
    'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    treeConfig: { index: 0, isWritable: true, value: input.treeConfig ?? null },
    treeCreator: {
      index: 1,
      isWritable: false,
      value: input.treeCreator ?? null,
    },
  };

  // Arguments.
  const resolvedArgs: SetDecompressableStateInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.treeCreator.value) {
    resolvedAccounts.treeCreator.value = context.identity;
  }

  // Accounts in order.
  const orderedAccounts: ResolvedAccount[] = Object.values(
    resolvedAccounts
  ).sort((a, b) => a.index - b.index);

  // Keys and Signers.
  const [keys, signers] = getAccountMetasAndSigners(
    orderedAccounts,
    'programId',
    programId
  );

  // Data.
  const data = getSetDecompressableStateInstructionDataSerializer().serialize(
    resolvedArgs as SetDecompressableStateInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}