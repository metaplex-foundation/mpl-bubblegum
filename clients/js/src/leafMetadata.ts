import {
  isOption,
  none,
  some,
  unwrapOption,
  wrapNullable,
} from '@metaplex-foundation/umi';
import {
  Creator,
  MetadataArgs,
  MetadataArgsArgs,
  MetadataArgsV2Args,
} from './generated';

/** DAS-aligned leaf royalty companions (mirrors `basis_points_raw` / `creators_raw`). */
export type RoyaltyRawFields = {
  sellerFeeBasisPointsRaw?: number;
  creatorsRaw?: Array<Creator>;
};

/**
 * True when `metadata` is V1 `MetadataArgs` shape (has `tokenProgramVersion`),
 * as produced by `getAssetWithProof`.
 */
export const isV1MetadataArgs = (metadata: unknown): metadata is MetadataArgs =>
  typeof metadata === 'object' &&
  metadata !== null &&
  'tokenProgramVersion' in metadata;

/**
 * Merge optional leaf royalty companions into metadata, then strip them.
 * Resolution order: explicit `raw` arg → fields on `metadata`.
 */
export const resolveLeafRoyaltyFields = <
  T extends { sellerFeeBasisPoints: number; creators: Array<Creator> },
>(
  metadata: T & RoyaltyRawFields,
  raw?: RoyaltyRawFields
): T => {
  const sellerFeeBasisPointsRaw =
    raw?.sellerFeeBasisPointsRaw ?? metadata.sellerFeeBasisPointsRaw;
  const creatorsRaw = raw?.creatorsRaw ?? metadata.creatorsRaw;
  const rest = { ...metadata };
  delete rest.sellerFeeBasisPointsRaw;
  delete rest.creatorsRaw;

  if (sellerFeeBasisPointsRaw === undefined && creatorsRaw === undefined) {
    return rest as T;
  }
  return {
    ...(rest as T),
    sellerFeeBasisPoints:
      sellerFeeBasisPointsRaw ?? (rest as T).sellerFeeBasisPoints,
    creators: creatorsRaw ?? (rest as T).creators,
  };
};

/**
 * Build leaf-canonical V1 metadata for write instructions / hashing.
 * Pass AssetWithProof sibling raw fields as the second argument when present.
 */
export const toLeafMetadata = (
  metadata: MetadataArgsArgs & RoyaltyRawFields,
  raw?: RoyaltyRawFields
): MetadataArgsArgs => resolveLeafRoyaltyFields(metadata, raw);

/**
 * Build leaf-canonical V2 metadata for write instructions / hashing.
 * Accepts V1 `MetadataArgs` from `getAssetWithProof` (converts collection) or
 * native `MetadataArgsV2Args`, plus optional AssetWithProof sibling raw fields.
 */
export const toLeafMetadataV2 = (
  metadata: (MetadataArgsArgs | MetadataArgsV2Args) & RoyaltyRawFields,
  raw?: RoyaltyRawFields
): MetadataArgsV2Args => {
  if (isV1MetadataArgs(metadata)) {
    const leaf = resolveLeafRoyaltyFields(metadata, raw) as MetadataArgs;
    const collectionOption = isOption(leaf.collection)
      ? leaf.collection
      : wrapNullable(leaf.collection);
    const collection = unwrapOption(collectionOption, () => null);
    return {
      name: leaf.name,
      symbol: leaf.symbol,
      uri: leaf.uri,
      sellerFeeBasisPoints: leaf.sellerFeeBasisPoints,
      primarySaleHappened: leaf.primarySaleHappened,
      isMutable: leaf.isMutable,
      tokenStandard: leaf.tokenStandard,
      creators: leaf.creators,
      collection: collection ? some(collection.key) : none(),
    };
  }
  return resolveLeafRoyaltyFields(
    metadata as MetadataArgsV2Args & RoyaltyRawFields,
    raw
  );
};

/** Minimal shape for {@link asCurrentMetadata} / {@link asCurrentMetadataV2}. */
export type AssetRoyaltySource = {
  metadata: MetadataArgsArgs | MetadataArgsV2Args;
  sellerFeeBasisPointsRaw?: number;
  creatorsRaw?: Array<Creator>;
};

/**
 * Leaf-canonical V1 metadata for write ixs / hashing from an AssetWithProof-like
 * value using explicit `_raw` siblings.
 */
export const asCurrentMetadata = (asset: {
  metadata: MetadataArgsArgs;
  sellerFeeBasisPointsRaw?: number;
  creatorsRaw?: Array<Creator>;
}): MetadataArgsArgs =>
  toLeafMetadata(asset.metadata, {
    sellerFeeBasisPointsRaw: asset.sellerFeeBasisPointsRaw,
    creatorsRaw: asset.creatorsRaw,
  });

/**
 * Leaf-canonical V2 metadata for write ixs / hashing from an AssetWithProof-like
 * value (converts collection to pubkey option).
 */
export const asCurrentMetadataV2 = (
  asset: AssetRoyaltySource
): MetadataArgsV2Args =>
  toLeafMetadataV2(asset.metadata, {
    sellerFeeBasisPointsRaw: asset.sellerFeeBasisPointsRaw,
    creatorsRaw: asset.creatorsRaw,
  });
