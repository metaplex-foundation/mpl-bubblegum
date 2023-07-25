import { MetadataArgsArgs } from '../generated';
import { hashMetadataCreators, hashMetadataData } from '../hash';

export const resolveDataHash = (
  context: any,
  accounts: any,
  args: { message: MetadataArgsArgs },
  programId: any,
  isWritable: boolean
): Uint8Array => hashMetadataData(args.message);

export const resolveCreatorHash = (
  context: any,
  accounts: any,
  args: { message: MetadataArgsArgs },
  programId: any,
  isWritable: boolean
): Uint8Array => hashMetadataCreators(args.message.creators);
