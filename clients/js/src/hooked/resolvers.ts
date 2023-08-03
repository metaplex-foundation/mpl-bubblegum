import { MetadataArgsArgs } from '../generated';
import { hashMetadataCreators, hashMetadataData } from '../hash';

export const resolveDataHash = (
  context: any,
  accounts: any,
  args: { metadata: MetadataArgsArgs },
  programId: any,
  isWritable: boolean
): Uint8Array => hashMetadataData(args.metadata);

export const resolveCreatorHash = (
  context: any,
  accounts: any,
  args: { metadata: MetadataArgsArgs },
  programId: any,
  isWritable: boolean
): Uint8Array => hashMetadataCreators(args.metadata.creators);
