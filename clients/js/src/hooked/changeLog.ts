import { Context, PublicKey, fixSerializer } from '@metaplex-foundation/umi';

export type ChangeLog = {
  root: PublicKey;
  pathNodes: PublicKey[];
  index: number;
};

export type ChangeLogArgs = ChangeLog;

export const getChangeLogSerializer = (
  context: Pick<Context, 'serializer'>,
  maxDepth: number
) => {
  const s = context.serializer;
  return s.struct([
    ['root', s.publicKey()],
    ['pathNodes', s.array(s.publicKey(), { size: maxDepth })],
    ['index', fixSerializer(s.u32(), 8)],
  ]);
};
