import {
  Context,
  defaultPublicKey,
  isOption,
  PublicKey,
  unwrapOption,
  wrapNullable,
} from '@metaplex-foundation/umi';
import {
  array,
  mergeBytes,
  publicKey as publicKeySerializer,
  u16,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { keccak_256 } from '@noble/hashes/sha3';
import {
  MetadataArgsArgs,
  MetadataArgsV2Args,
  getCreatorSerializer,
  getMetadataArgsSerializer,
  getMetadataArgsV2Serializer,
} from './generated';
import { findLeafAssetIdPda } from './leafAssetId';
import { LeafSchemaV2Flags, isValidLeafSchemaV2Flags } from './flags';

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
    publicKeySerializer().serialize(leafAssetId),
    publicKeySerializer().serialize(input.owner),
    publicKeySerializer().serialize(delegate),
    u64().serialize(input.leafIndex),
    hashMetadata(input.metadata),
  ]);
}

export function hashLeafV2(
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: {
    merkleTree: PublicKey;
    owner: PublicKey;
    delegate?: PublicKey;
    leafIndex: number | bigint;
    metadata: MetadataArgsV2Args;
    assetData?: string | Uint8Array;
    flags?: LeafSchemaV2Flags;
    nftVersion?: number;
  }
): Uint8Array {
  const delegate = input.delegate ?? input.owner;
  const nftVersion = input.nftVersion ?? 2;
  const [leafAssetId] = findLeafAssetIdPda(context, {
    merkleTree: input.merkleTree,
    leafIndex: input.leafIndex,
  });

  const collectionOption = isOption(input.metadata.collection)
    ? input.metadata.collection
    : wrapNullable(input.metadata.collection);

  const collection = unwrapOption(collectionOption, () => defaultPublicKey());

  const flags = input.flags ?? 0;
  if (flags < 0 || flags > 0xff) {
    throw new Error(
      `Flags value ${flags} is out of range – expected 0‑255 (fits in u8).`
    );
  }

  if (!isValidLeafSchemaV2Flags(flags)) {
    throw new Error(`Invalid flags value: ${flags}`);
  }

  return hash([
    u8().serialize(nftVersion),
    publicKeySerializer().serialize(leafAssetId),
    publicKeySerializer().serialize(input.owner),
    publicKeySerializer().serialize(delegate),
    u64().serialize(input.leafIndex),
    hashMetadataV2(input.metadata),
    hashCollection(collection),
    hashAssetData(input.assetData),
    u8().serialize(flags),
  ]);
}

export function hashMetadata(metadata: MetadataArgsArgs): Uint8Array {
  return mergeBytes([
    hashMetadataData(metadata),
    hashMetadataCreators(metadata.creators),
  ]);
}

export function hashMetadataV2(metadata: MetadataArgsV2Args): Uint8Array {
  return mergeBytes([
    hashMetadataDataV2(metadata),
    hashMetadataCreators(metadata.creators),
  ]);
}

export function hashMetadataData(metadata: MetadataArgsArgs): Uint8Array {
  return hash([
    hash(getMetadataArgsSerializer().serialize(metadata)),
    u16().serialize(metadata.sellerFeeBasisPoints),
  ]);
}

export function hashMetadataDataV2(metadata: MetadataArgsV2Args): Uint8Array {
  return hash([
    hash(getMetadataArgsV2Serializer().serialize(metadata)),
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

export function hashCollection(collection: PublicKey): Uint8Array {
  return hash(publicKeySerializer().serialize(collection));
}

export function hashAssetData(assetData?: string | Uint8Array): Uint8Array {
  let dataBytes: Uint8Array;

  if (assetData === undefined || assetData === null) {
    dataBytes = new Uint8Array(0);
  } else if (typeof assetData === 'string') {
    dataBytes = new TextEncoder().encode(assetData);
  } else {
    dataBytes = assetData;
  }

  return hash(dataBytes);
}
