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
  Creator,
  MetadataArgsArgs,
  MetadataArgsV2Args,
  getCreatorSerializer,
  getMetadataArgsSerializer,
  getMetadataArgsV2Serializer,
} from './generated';
import { findLeafAssetIdPda } from './leafAssetId';
import { LeafSchemaV2Flags, isValidLeafSchemaV2Flags } from './flags';
import {
  RoyaltyRawFields,
  toLeafMetadata,
  toLeafMetadataV2,
} from './leafMetadata';

export const SELLER_FEE_BASIS_POINTS_INHERIT = 0xffff;

export function hash(input: Uint8Array | Uint8Array[]): Uint8Array {
  return keccak_256(Array.isArray(input) ? mergeBytes(input) : input);
}

type V2OrV1Metadata = MetadataArgsV2Args | MetadataArgsArgs;

export function hashLeaf(
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: {
    merkleTree: PublicKey;
    owner: PublicKey;
    delegate?: PublicKey;
    leafIndex: number | bigint;
    metadata: MetadataArgsArgs;
    sellerFeeBasisPointsRaw?: number;
    creatorsRaw?: Array<Creator>;
    nftVersion?: number;
  }
): Uint8Array {
  const delegate = input.delegate ?? input.owner;
  const nftVersion = input.nftVersion ?? 1;
  const [leafAssetId] = findLeafAssetIdPda(context, {
    merkleTree: input.merkleTree,
    leafIndex: input.leafIndex,
  });
  const metadata = toLeafMetadata(input.metadata, {
    sellerFeeBasisPointsRaw: input.sellerFeeBasisPointsRaw,
    creatorsRaw: input.creatorsRaw,
  });

  return hash([
    u8().serialize(nftVersion),
    publicKeySerializer().serialize(leafAssetId),
    publicKeySerializer().serialize(input.owner),
    publicKeySerializer().serialize(delegate),
    u64().serialize(input.leafIndex),
    hashMetadata(metadata),
  ]);
}

type HashLeafV2Input = {
  merkleTree: PublicKey;
  owner: PublicKey;
  delegate?: PublicKey;
  leafIndex: number | bigint;
  sellerFeeBasisPointsRaw?: number;
  creatorsRaw?: Array<Creator>;
  assetData?: string | Uint8Array;
  flags?: LeafSchemaV2Flags;
  nftVersion?: number;
};

export function hashLeafV2(
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: HashLeafV2Input & { metadata: MetadataArgsV2Args }
): Uint8Array;
export function hashLeafV2(
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: HashLeafV2Input & { metadata: MetadataArgsArgs }
): Uint8Array;
export function hashLeafV2(
  context: Pick<Context, 'eddsa' | 'programs'>,
  input: HashLeafV2Input & { metadata: V2OrV1Metadata }
): Uint8Array {
  const delegate = input.delegate ?? input.owner;
  const nftVersion = input.nftVersion ?? 2;
  const [leafAssetId] = findLeafAssetIdPda(context, {
    merkleTree: input.merkleTree,
    leafIndex: input.leafIndex,
  });
  const metadata = toLeafMetadataV2(input.metadata, {
    sellerFeeBasisPointsRaw: input.sellerFeeBasisPointsRaw,
    creatorsRaw: input.creatorsRaw,
  });

  const collectionOption = isOption(metadata.collection)
    ? metadata.collection
    : wrapNullable(metadata.collection);

  const collection = unwrapOption(collectionOption, () => defaultPublicKey());

  const flags = input.flags ?? LeafSchemaV2Flags.None;

  if (!isValidLeafSchemaV2Flags(flags)) {
    throw new Error(`Invalid flags value: ${flags}`);
  }

  return hash([
    u8().serialize(nftVersion),
    publicKeySerializer().serialize(leafAssetId),
    publicKeySerializer().serialize(input.owner),
    publicKeySerializer().serialize(delegate),
    u64().serialize(input.leafIndex),
    hashMetadataV2(metadata),
    hashCollection(collection),
    hashAssetData(input.assetData),
    u8().serialize(flags),
  ]);
}

export function hashMetadata(
  metadata: MetadataArgsArgs,
  raw?: RoyaltyRawFields
): Uint8Array {
  const leaf = toLeafMetadata(metadata, raw);
  return mergeBytes([
    hashMetadataData(leaf),
    hashMetadataCreators(leaf.creators),
  ]);
}

export function hashMetadataV2(
  metadata: MetadataArgsV2Args,
  raw?: RoyaltyRawFields
): Uint8Array;
export function hashMetadataV2(
  metadata: MetadataArgsArgs,
  raw?: RoyaltyRawFields
): Uint8Array;
export function hashMetadataV2(
  metadata: V2OrV1Metadata,
  raw?: RoyaltyRawFields
): Uint8Array {
  const leaf = toLeafMetadataV2(metadata, raw);
  return mergeBytes([
    hashMetadataDataV2(leaf),
    hashMetadataCreators(leaf.creators),
  ]);
}

export function hashMetadataData(
  metadata: MetadataArgsArgs,
  raw?: RoyaltyRawFields
): Uint8Array {
  const leaf = toLeafMetadata(metadata, raw);
  return hash([
    hash(getMetadataArgsSerializer().serialize(leaf)),
    u16().serialize(leaf.sellerFeeBasisPoints),
  ]);
}

export function hashMetadataDataV2(
  metadata: MetadataArgsV2Args,
  raw?: RoyaltyRawFields
): Uint8Array;
export function hashMetadataDataV2(
  metadata: MetadataArgsArgs,
  raw?: RoyaltyRawFields
): Uint8Array;
export function hashMetadataDataV2(
  metadata: V2OrV1Metadata,
  raw?: RoyaltyRawFields
): Uint8Array {
  const leaf = toLeafMetadataV2(metadata, raw);
  return hash([
    hash(getMetadataArgsV2Serializer().serialize(leaf)),
    u16().serialize(leaf.sellerFeeBasisPoints),
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
