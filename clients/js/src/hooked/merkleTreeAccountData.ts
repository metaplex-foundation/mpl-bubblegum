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
  ConcurrentMerkleTreeHeaderDataV1Args,
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
            value.treeHeader.fields[0]
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
            header.fields[0]
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
  { maxDepth, maxBufferSize }: ConcurrentMerkleTreeHeaderDataV1Args
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

export const getMerkleTreeSize = (): number => {
  const foo = 42; // TODO
  return foo;
};

// ['discriminator', beet.u8],
// ['headerVersion', beet.u8],
// Header Data V1.
//   ['maxBufferSize', beet.u32],
//   ['maxDepth', beet.u32],
//   ['authority', beetSolana.publicKey],
//   ['creationSlot', beet.u64],
//   ['padding', beet.uniformFixedSizeArray(beet.u8, 6)],
// Concurrent Merkle Tree.
//   ['sequenceNumber', beet.u64],
//   ['activeIndex', beet.u64],
//   ['bufferSize', beet.u64],
//   ['changeLogs', beet.array(getChangeLogSerializer(), {size: maxBufferSize })],
//   ['rightMostPath', getPathSerializer(umi, maxDepth)],
// Canopy.
//   ['canopy', s.bytes({ size: 'remainder' })], -> Initially: Math.max(((1 << (canopyDepth + 1)) - 2), 0) * 32 // Maybe best as array of 32 bytes.
