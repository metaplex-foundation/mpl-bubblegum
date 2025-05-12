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
  const innerInstructions = transaction?.meta.innerInstructions;

  if (innerInstructions) {
    const leaf = getLeafSchemaSerializer().deserialize(
      innerInstructions[0].instructions[0].data.slice(8)
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

  const instruction = transaction.message.instructions[0];
  const collectionIndex = instruction.accountIndexes[7];
  const collection = transaction.message.accounts[collectionIndex];

  if (!collection) {
    throw new Error('Account at index 7 is missing');
  }

  const programId = context.programs.getPublicKey(
    'mplBubblegum',
    MPL_BUBBLEGUM_PROGRAM_ID
  );

  const instructionIndex = collection === programId ? 0 : 1;
  const { innerInstructions } = transaction.meta;
  if (innerInstructions) {
    const leaf = getLeafSchemaSerializer().deserialize(
      innerInstructions[0].instructions[instructionIndex].data.slice(8)
    );
    return leaf[0];
  }

  throw new Error('Could not parse leaf from transaction');
}
