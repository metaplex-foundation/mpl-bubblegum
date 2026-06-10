import { Context, TransactionBuilder } from '@metaplex-foundation/umi';
import {
  MetadataArgsV2Args,
  MintV2InstructionAccounts,
  MintV2InstructionArgs as GeneratedMintV2InstructionArgs,
  mintV2 as generatedMintV2,
} from './generated';
import { SELLER_FEE_BASIS_POINTS_INHERIT } from './hash';

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
