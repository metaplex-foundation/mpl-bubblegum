import { PublicKey } from '@metaplex-foundation/umi';
import {
  array,
  fixSerializer,
  publicKey,
  struct,
  u32,
} from '@metaplex-foundation/umi/serializers';

export type ChangeLog = {
  root: PublicKey;
  pathNodes: PublicKey[];
  index: number;
};

export type ChangeLogArgs = ChangeLog;

export const getChangeLogSerializer = (maxDepth: number) =>
  struct([
    ['root', publicKey()],
    ['pathNodes', array(publicKey(), { size: maxDepth })],
    ['index', fixSerializer(u32(), 8)],
  ]);
