import { Context } from '@metaplex-foundation/umi';
import { Path, PathArgs, getPathSerializer } from './path';
import { ChangeLog, ChangeLogArgs, getChangeLogSerializer } from './changeLog';

export type ConcurrentMerkleTree = {
  sequenceNumber: bigint;
  activeIndex: bigint;
  bufferSize: bigint;
  changeLogs: ChangeLog[];
  rightMostPath: Path;
};

export type ConcurrentMerkleTreeArgs = {
  sequenceNumber: bigint | number;
  activeIndex: bigint | number;
  bufferSize: bigint | number;
  changeLogs: ChangeLogArgs[];
  rightMostPath: PathArgs;
};

export const getConcurrentMerkleTreeSerializer = (
  context: Pick<Context, 'serializer'>,
  maxDepth: number,
  maxBufferSize: number
) => {
  const s = context.serializer;
  return s.struct([
    ['sequenceNumber', s.u64()],
    ['activeIndex', s.u64()],
    ['bufferSize', s.u64()],
    [
      'changeLogs',
      s.array(getChangeLogSerializer(context, maxDepth), {
        size: maxBufferSize,
      }),
    ],
    ['rightMostPath', getPathSerializer(context, maxDepth)],
  ]);
};
