import {
  Context,
  Pda,
  PublicKey,
  TransactionSignature,
} from '@metaplex-foundation/umi';
import { publicKey, string, u64 } from '@metaplex-foundation/umi/serializers';
import {
  LeafSchema,
  MPL_BUBBLEGUM_PROGRAM_ID,
  getLeafSchemaSerializer,
} from './generated';

export function findLeafAssetIdPda(
  context: Pick<Context, 'programs' | 'eddsa'>,
  seeds: {
    merkleTree: PublicKey;
    leafIndex: number | bigint;
  }
): Pda {
  const programId = context.programs.getPublicKey(
    'mplBubblegum',
    MPL_BUBBLEGUM_PROGRAM_ID
  );
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('asset'),
    publicKey().serialize(seeds.merkleTree),
    u64().serialize(seeds.leafIndex),
  ]);
}

export async function parseLeafFromMintV1Transaction(
  context: Pick<Context, 'programs' | 'eddsa' | 'rpc'>,
  signature: TransactionSignature
): Promise<LeafSchema> {
  const transaction = await context.rpc.getTransaction(signature);
  const innerInstructions = transaction?.meta.innerInstructions;

  if (innerInstructions) {
    const leaf = getLeafSchemaSerializer().deserialize(
      innerInstructions[0].instructions[0].data.slice(8)
    );
    return leaf[0];
  }

  throw new Error('Could not parse leaf from transaction');
}

export async function parseLeafFromMintToCollectionV1Transaction(
  context: Pick<Context, 'programs' | 'eddsa' | 'rpc'>,
  signature: TransactionSignature
): Promise<LeafSchema> {
  const transaction = await context.rpc.getTransaction(signature);
  if (!transaction) {
    throw new Error('Could not get transaction from signature');
  }

  const bubblegumProgramId = context.programs.getPublicKey(
    'mplBubblegum',
    MPL_BUBBLEGUM_PROGRAM_ID
  );

  // Find the outer instruction that invokes the Bubblegum program.
  const instructionIndex = transaction.message.instructions.findIndex(
    (ix) => transaction.message.accounts[ix.programIndex] === bubblegumProgramId
  );

  if (instructionIndex === -1) {
    throw new Error('Could not find mplBubblegum instruction');
  }

  // Find the corresponding inner instruction group for that instruction index.
  const innerInstructions = transaction.meta?.innerInstructions;
  if (innerInstructions) {
    const inner = innerInstructions.find((ix) => ix.index === instructionIndex);

    if (!inner || !inner.instructions[0]) {
      throw new Error('Could not find matching inner instruction');
    }

    const instructionData = inner.instructions[0].data;
    const leaf = getLeafSchemaSerializer().deserialize(
      instructionData.slice(8) // Skip discriminator
    );

    return leaf[0];
  }

  throw new Error('Could not parse leaf from transaction');
}

export async function parseLeafFromMintV2Transaction(
  context: Pick<Context, 'programs' | 'eddsa' | 'rpc'>,
  signature: TransactionSignature
): Promise<LeafSchema> {
  const transaction = await context.rpc.getTransaction(signature);
  if (!transaction) {
    throw new Error('Could not get transaction from signature');
  }

  const bubblegumProgramId = context.programs.getPublicKey(
    'mplBubblegum',
    MPL_BUBBLEGUM_PROGRAM_ID
  );

  // Find the outer instruction that invokes the Bubblegum program.
  const instructionIndex = transaction.message.instructions.findIndex(
    (ix) => transaction.message.accounts[ix.programIndex] === bubblegumProgramId
  );

  if (instructionIndex === -1) {
    throw new Error('Could not find mplBubblegum instruction');
  }

  const instruction = transaction.message.instructions[instructionIndex];

  if (instruction.accountIndexes.length <= 7) {
    throw new Error(
      'Instruction does not have a collection account at index 7'
    );
  }

  // Read the collection account from account index 7.
  const collectionIndex = instruction.accountIndexes[7];
  const collection = transaction.message.accounts[collectionIndex];

  if (!collection) {
    throw new Error('Collection account at index 7 is missing');
  }

  // Use index 0 or 1 into the inner instructions depending on whether the collection is set to the
  // Bubblegum program ID.
  const innerInstructionIndex = collection === bubblegumProgramId ? 0 : 1;

  // Find the inner instruction group corresponding to the Bubblegum outer instruction.
  const innerInstructions = transaction.meta?.innerInstructions;
  if (innerInstructions) {
    const inner = innerInstructions.find((ix) => ix.index === instructionIndex);

    if (!inner || !inner.instructions[innerInstructionIndex]) {
      throw new Error('Could not find matching inner instruction');
    }

    const instructionData = inner.instructions[innerInstructionIndex].data;
    const leaf = getLeafSchemaSerializer().deserialize(
      instructionData.slice(8) // Skip the 8-byte discriminator
    );

    return leaf[0];
  }

  throw new Error('Could not parse leaf from transaction');
}
