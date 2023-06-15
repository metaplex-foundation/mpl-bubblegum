import { Context, PublicKey, mergeBytes } from '@metaplex-foundation/umi';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  MetadataArgsArgs,
  getCreatorSerializer,
  getMetadataArgsSerializer,
} from './generated';
import { findLeafAssetIdPda } from './leafAssetId';

export function hash(input: Uint8Array | Uint8Array[]): Uint8Array {
  return keccak_256(Array.isArray(input) ? mergeBytes(input) : input);
}

export function hashLeaf(
  context: Pick<Context, 'serializer' | 'eddsa' | 'programs'>,
  input: {
    merkleTree: PublicKey;
    owner: PublicKey;
    delegate?: PublicKey;
    leafIndex: number | bigint;
    metadata: MetadataArgsArgs;
    nftVersion?: number;
  }
): Uint8Array {
  const s = context.serializer;
  const delegate = input.delegate ?? input.owner;
  const nftVersion = input.nftVersion ?? 1;
  const [leafAssetId] = findLeafAssetIdPda(context, {
    tree: input.merkleTree,
    leafIndex: input.leafIndex,
  });

  return hash([
    s.u8().serialize(nftVersion),
    s.publicKey().serialize(leafAssetId),
    s.publicKey().serialize(input.owner),
    s.publicKey().serialize(delegate),
    s.u64().serialize(input.leafIndex),
    hashMetadata(context, input.metadata),
  ]);
}

export function hashMetadata(
  context: Pick<Context, 'serializer'>,
  metadata: MetadataArgsArgs
): Uint8Array {
  return mergeBytes([
    hashMetadataData(context, metadata),
    hashMetadataCreators(context, metadata.creators),
  ]);
}

export function hashMetadataData(
  context: Pick<Context, 'serializer'>,
  metadata: MetadataArgsArgs
): Uint8Array {
  const s = context.serializer;
  return hash([
    hash(getMetadataArgsSerializer(context).serialize(metadata)),
    s.u16().serialize(metadata.sellerFeeBasisPoints),
  ]);
}

export function hashMetadataCreators(
  context: Pick<Context, 'serializer'>,
  creators: MetadataArgsArgs['creators']
): Uint8Array {
  const s = context.serializer;
  return hash(
    s
      .array(getCreatorSerializer(context), { size: 'remainder' })
      .serialize(creators)
  );
}
