import {
  Context,
  PublicKey,
  Serializer,
  mapSerializer,
} from '@metaplex-foundation/umi';
import {
  CompressionAccountType,
  ConcurrentMerkleTreeHeaderData,
  ConcurrentMerkleTreeHeaderDataArgs,
  getConcurrentMerkleTreeHeaderDataSerializer,
  getConcurrentMerkleTreeHeaderSerializer,
} from '../generated';
import {
  ConcurrentMerkleTree,
  ConcurrentMerkleTreeArgs,
  getConcurrentMerkleTreeSerializer,
} from './concurrentMerkleTree';

export type MerkleTreeAccountData = {
  discriminator: CompressionAccountType;
  treeHeader: ConcurrentMerkleTreeHeaderData;
  tree: ConcurrentMerkleTree;
  canopy: PublicKey[];
};

export type MerkleTreeAccountDataArgs = {
  treeHeader: ConcurrentMerkleTreeHeaderDataArgs;
  tree: ConcurrentMerkleTreeArgs;
  canopy: PublicKey[];
};

export const getMerkleTreeAccountDataSerializer = (
  context: Pick<Context, 'serializer'>
): Serializer<MerkleTreeAccountDataArgs, MerkleTreeAccountData> => {
  const headerSerializer = getConcurrentMerkleTreeHeaderSerializer(context);
  return {
    description: 'MerkleTreeAccountData',
    fixedSize: null,
    maxSize: null,
    serialize: (value: MerkleTreeAccountDataArgs) => {
      switch (value.treeHeader.__kind) {
        case 'V1':
          return getMerkleTreeAccountDataV1Serializer(
            context,
            value.treeHeader.maxDepth,
            value.treeHeader.maxBufferSize
          ).serialize(value);
        default:
          throw new Error(
            `Unknown MerkleTreeAccountData version: ${value.treeHeader.__kind}`
          );
      }
    },
    deserialize: (bytes: Uint8Array, offset = 0) => {
      const { header } = headerSerializer.deserialize(bytes, offset)[0];
      switch (header.__kind) {
        case 'V1':
          return getMerkleTreeAccountDataV1Serializer(
            context,
            header.maxDepth,
            header.maxBufferSize
          ).deserialize(bytes, offset);
        default:
          throw new Error(
            `Unknown MerkleTreeAccountData version: ${header.__kind}`
          );
      }
    },
  };
};

export const getMerkleTreeAccountDataV1Serializer = (
  context: Pick<Context, 'serializer'>,
  maxDepth: number,
  maxBufferSize: number
): Serializer<MerkleTreeAccountDataArgs, MerkleTreeAccountData> => {
  const s = context.serializer;
  return mapSerializer(
    s.struct<
      MerkleTreeAccountDataArgs & { discriminator: number },
      MerkleTreeAccountData
    >([
      ['discriminator', s.u8()],
      ['treeHeader', getConcurrentMerkleTreeHeaderDataSerializer(context)],
      [
        'tree',
        getConcurrentMerkleTreeSerializer(context, maxDepth, maxBufferSize),
      ],
      ['canopy', s.array(s.publicKey(), { size: 'remainder' })],
    ]),
    (
      value: MerkleTreeAccountDataArgs
    ): MerkleTreeAccountDataArgs & { discriminator: number } => ({
      ...value,
      discriminator: CompressionAccountType.ConcurrentMerkleTree,
    })
  );
};

export const getMerkleTreeSize = (
  context: Pick<Context, 'serializer'>,
  maxDepth: number,
  maxBufferSize: number,
  canopyDepth = 0
): number => {
  const discriminatorSize = 1;
  const headerSize = getConcurrentMerkleTreeHeaderDataSerializer(context)
    .fixedSize as number;
  const treeSize = getConcurrentMerkleTreeSerializer(
    context,
    maxDepth,
    maxBufferSize
  ).fixedSize as number;
  // eslint-disable-next-line no-bitwise
  const canopySize = 32 * Math.max((1 << (canopyDepth + 1)) - 2, 0);
  return discriminatorSize + headerSize + treeSize + canopySize;
};
