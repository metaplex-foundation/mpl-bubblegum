import { publicKeyBytes } from '@metaplex-foundation/umi';
import { array, struct, u64 } from '@metaplex-foundation/umi/serializers';
import { ChangeLog, ChangeLogArgs, getChangeLogSerializer } from './changeLog';
import { Path, PathArgs, getPathSerializer } from './path';

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
  maxDepth: number,
  maxBufferSize: number
) =>
  struct([
    ['sequenceNumber', u64()],
    ['activeIndex', u64()],
    ['bufferSize', u64()],
    [
      'changeLogs',
      array(getChangeLogSerializer(maxDepth), { size: maxBufferSize }),
    ],
    ['rightMostPath', getPathSerializer(maxDepth)],
  ]);

export const getCurrentRoot = (
  tree: Pick<ConcurrentMerkleTreeArgs, 'changeLogs' | 'activeIndex'>
): Uint8Array => publicKeyBytes(tree.changeLogs[Number(tree.activeIndex)].root);
