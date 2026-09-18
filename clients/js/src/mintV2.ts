import { Context, TransactionBuilder } from '@metaplex-foundation/umi';
import { MetadataArgsV2Args } from './generated';
import {
  MintV2InstructionAccounts,
  MintV2InstructionArgs as GeneratedMintV2InstructionArgs,
  mintV2 as generatedMintV2,
} from './generated/instructions/mintV2';
import { SELLER_FEE_BASIS_POINTS_INHERIT } from './hash';

// Re-export the generated mintV2 helpers that are no longer star-exported
// from ./generated/instructions since this wrapper replaced the generated
// mintV2 function. Note the generated MintV2InstructionArgs is intentionally
// superseded by the widened type below, which makes sellerFeeBasisPoints
// optional when a core collection is provided.
export {
  getMintV2InstructionDataSerializer,
  type MintV2InstructionAccounts,
  type MintV2InstructionData,
  type MintV2InstructionDataArgs,
} from './generated/instructions/mintV2';

export type MintV2InstructionArgs = Omit<
  GeneratedMintV2InstructionArgs,
  'metadata'
> & {
  metadata: Omit<MetadataArgsV2Args, 'sellerFeeBasisPoints'> & {
    sellerFeeBasisPoints?: number;
  };
};

export function mintV2(
  context: Pick<Context, 'eddsa' | 'payer' | 'programs'>,
  input: MintV2InstructionAccounts & MintV2InstructionArgs
): TransactionBuilder {
  const hasCoreCollection = input.coreCollection !== undefined;
  const sellerFeeBasisPoints =
    input.metadata.sellerFeeBasisPoints ??
    (hasCoreCollection ? SELLER_FEE_BASIS_POINTS_INHERIT : undefined);

  if (sellerFeeBasisPoints === undefined) {
    throw new Error(
      'metadata.sellerFeeBasisPoints is required unless coreCollection is provided'
    );
  }

  return generatedMintV2(context, {
    ...input,
    metadata: {
      ...input.metadata,
      sellerFeeBasisPoints,
    },
  });
}
