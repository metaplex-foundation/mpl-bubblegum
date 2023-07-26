import { Context, PublicKey } from '@metaplex-foundation/umi';
import {
  array,
  mergeBytes,
  publicKey,
  u16,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
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
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: {
    merkleTree: PublicKey;
    owner: PublicKey;
    delegate?: PublicKey;
    leafIndex: number | bigint;
    metadata: MetadataArgsArgs;
    nftVersion?: number;
  }
): Uint8Array {
  const delegate = input.delegate ?? input.owner;
  const nftVersion = input.nftVersion ?? 1;
  const [leafAssetId] = findLeafAssetIdPda(context, {
    merkleTree: input.merkleTree,
    leafIndex: input.leafIndex,
  });

  return hash([
    u8().serialize(nftVersion),
    publicKey().serialize(leafAssetId),
    publicKey().serialize(input.owner),
    publicKey().serialize(delegate),
    u64().serialize(input.leafIndex),
    hashMetadata(input.metadata),
  ]);
}

export function hashMetadata(metadata: MetadataArgsArgs): Uint8Array {
  return mergeBytes([
    hashMetadataData(metadata),
    hashMetadataCreators(metadata.creators),
  ]);
}

export function hashMetadataData(metadata: MetadataArgsArgs): Uint8Array {
  return hash([
    hash(getMetadataArgsSerializer().serialize(metadata)),
    u16().serialize(metadata.sellerFeeBasisPoints),
  ]);
}

export function hashMetadataCreators(
  creators: MetadataArgsArgs['creators']
): Uint8Array {
  return hash(
    array(getCreatorSerializer(), { size: 'remainder' }).serialize(creators)
  );
}
