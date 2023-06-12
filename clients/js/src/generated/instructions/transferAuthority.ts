/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  AccountMeta,
  Context,
  PublicKey,
  Serializer,
  Signer,
  TransactionBuilder,
  mapSerializer,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { addObjectProperty, isWritable } from '../shared';

// Accounts.
export type TransferAuthorityInstructionAccounts = {
  merkleTree: PublicKey;
  authority?: Signer;
};

// Data.
export type TransferAuthorityInstructionData = {
  discriminator: Array<number>;
  newAuthority: PublicKey;
};

export type TransferAuthorityInstructionDataArgs = { newAuthority: PublicKey };

export function getTransferAuthorityInstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<
  TransferAuthorityInstructionDataArgs,
  TransferAuthorityInstructionData
> {
  const s = context.serializer;
  return mapSerializer<
    TransferAuthorityInstructionDataArgs,
    any,
    TransferAuthorityInstructionData
  >(
    s.struct<TransferAuthorityInstructionData>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['newAuthority', s.publicKey()],
      ],
      { description: 'TransferAuthorityInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [48, 169, 76, 72, 229, 180, 55, 161],
    })
  ) as Serializer<
    TransferAuthorityInstructionDataArgs,
    TransferAuthorityInstructionData
  >;
}

// Args.
export type TransferAuthorityInstructionArgs =
  TransferAuthorityInstructionDataArgs;

// Instruction.
export function transferAuthority(
  context: Pick<Context, 'serializer' | 'programs' | 'identity'>,
  input: TransferAuthorityInstructionAccounts & TransferAuthorityInstructionArgs
): TransactionBuilder {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId = {
    ...context.programs.getPublicKey(
      'splAccountCompression',
      'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
    ),
    isWritable: false,
  };

  // Resolved inputs.
  const resolvingAccounts = {};
  const resolvingArgs = {};
  addObjectProperty(
    resolvingAccounts,
    'authority',
    input.authority ?? context.identity
  );
  const resolvedAccounts = { ...input, ...resolvingAccounts };
  const resolvedArgs = { ...input, ...resolvingArgs };

  // Merkle Tree.
  keys.push({
    pubkey: resolvedAccounts.merkleTree,
    isSigner: false,
    isWritable: isWritable(resolvedAccounts.merkleTree, true),
  });

  // Authority.
  signers.push(resolvedAccounts.authority);
  keys.push({
    pubkey: resolvedAccounts.authority.publicKey,
    isSigner: true,
    isWritable: isWritable(resolvedAccounts.authority, false),
  });

  // Data.
  const data =
    getTransferAuthorityInstructionDataSerializer(context).serialize(
      resolvedArgs
    );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}