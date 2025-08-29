import { PublicKey } from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  publicKey,
  struct,
  u32,
} from '@metaplex-foundation/umi/serializers';

export type Path = {
  proof: PublicKey[];
  leaf: PublicKey;
  index: number;
};

export type PathArgs = Path;

export function getPathSerializer(
  maxDepth: number
): Serializer<PathArgs, Path> {
  return mapSerializer(
    struct<Path & { padding: number }>(
      [
        ['proof', array(publicKey(), { size: maxDepth })],
        ['leaf', publicKey()],
        ['index', u32()],
        ['padding', u32()],
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
