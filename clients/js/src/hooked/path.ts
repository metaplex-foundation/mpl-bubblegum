import {
  Context,
  PublicKey,
  Serializer,
  mapSerializer,
} from '@metaplex-foundation/umi';

export type Path = {
  proof: PublicKey[];
  leaf: PublicKey;
  index: number;
};

export type PathArgs = Path;

export function getPathSerializer(
  context: Pick<Context, 'serializer'>,
  maxDepth: number
): Serializer<PathArgs, Path> {
  const s = context.serializer;
  return mapSerializer(
    s.struct<Path & { padding: number }>(
      [
        ['proof', s.array(s.publicKey(), { size: maxDepth })],
        ['leaf', s.publicKey()],
        ['index', s.u32()],
        ['padding', s.u32()],
      ],
      { description: 'Path' }
    ),
    (path) => ({ ...path, padding: 0 }),
    (pathWithPadding) => {
      const { padding, ...path } = pathWithPadding;
      return path;
    }
  ) as Serializer<PathArgs, Path>;
}
