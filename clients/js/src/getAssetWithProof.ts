import {
  Context,
  PublicKey,
  none,
  publicKey,
  publicKeyBytes,
  some,
  wrapNullable,
} from '@metaplex-foundation/umi';
import {
  DasApiAsset,
  DasApiInterface,
  GetAssetProofRpcResponse,
} from '@metaplex-foundation/digital-asset-standard-api';
import { fetchMerkleTree } from '@metaplex-foundation/spl-account-compression';
import { LeafSchemaV2Flags, isValidLeafSchemaV2Flags } from './flags';
import {
  MetadataArgs,
  MetadataArgsV2Args,
  TokenProgramVersion,
  TokenStandard,
} from './generated';
import { SELLER_FEE_BASIS_POINTS_INHERIT, hashMetadataDataV2 } from './hash';

type DasRoyaltyWithRawSfbp = NonNullable<DasApiAsset['royalty']> & {
  basis_points_raw?: number;
  sfbp_inherited?: boolean;
};

type DasApiAssetWithRawSfbp = DasApiAsset & {
  royalty?: DasRoyaltyWithRawSfbp;
};

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export type AssetWithProof = {
  leafOwner: PublicKey;
  leafDelegate: PublicKey;
  merkleTree: PublicKey;
  root: Uint8Array;
  dataHash: Uint8Array;
  creatorHash: Uint8Array;
  collection_hash?: Uint8Array;
  asset_data_hash?: Uint8Array;
  flags?: number;
  nonce: number;
  index: number;
  proof: PublicKey[];
  metadata: MetadataArgs;
  currentMetadata: MetadataArgsV2Args;
  rpcAsset: DasApiAsset;
  rpcAssetProof: GetAssetProofRpcResponse;
};

type GetAssetWithProofOptions = {
  truncateCanopy?: boolean;
  resolveCollectionSellerFeeBasisPoints?: (
    collection: PublicKey,
    rpcAsset: DasApiAsset
  ) => number | Promise<number | undefined> | undefined;
};

export const getAssetWithProof = async (
  context: Pick<Context, 'rpc'> & { rpc: DasApiInterface },
  assetId: PublicKey,
  options?: GetAssetWithProofOptions
): Promise<AssetWithProof> => {
  const [rpcAsset, rpcAssetProof] = await Promise.all([
    context.rpc.getAsset({
      assetId,
      displayOptions: { showUnverifiedCollections: true },
    }),
    context.rpc.getAssetProof(assetId),
  ]);
  const rpcAssetWithRawSfbp = rpcAsset as DasApiAssetWithRawSfbp;

  let { proof } = rpcAssetProof;
  if (options?.truncateCanopy) {
    const merkleTreeAccount = await fetchMerkleTree(
      context,
      rpcAssetProof.tree_id
    );
    const canopyDepth = Math.log2(merkleTreeAccount.canopy.length + 2) - 1;
    proof = rpcAssetProof.proof.slice(
      0,
      canopyDepth === 0 ? undefined : -canopyDepth
    );
  }

  const collectionGroup = (rpcAsset.grouping ?? []).find(
    (group) => group.group_key === 'collection'
  );
  const collection = collectionGroup
    ? {
        key: publicKey(collectionGroup.group_value),
        verified: collectionGroup.verified ?? false,
      }
    : undefined;

  const rawSellerFeeBasisPoints =
    rpcAssetWithRawSfbp.royalty?.basis_points_raw ??
    (rpcAssetWithRawSfbp.royalty?.sfbp_inherited
      ? SELLER_FEE_BASIS_POINTS_INHERIT
      : rpcAssetWithRawSfbp.royalty?.basis_points);
  const sellerFeeBasisPointsInherited =
    rpcAssetWithRawSfbp.royalty?.sfbp_inherited ??
    rawSellerFeeBasisPoints === SELLER_FEE_BASIS_POINTS_INHERIT;
  let resolvedSellerFeeBasisPoints = rpcAssetWithRawSfbp.royalty?.basis_points;
  if (
    sellerFeeBasisPointsInherited &&
    resolvedSellerFeeBasisPoints === SELLER_FEE_BASIS_POINTS_INHERIT &&
    collection &&
    options?.resolveCollectionSellerFeeBasisPoints
  ) {
    resolvedSellerFeeBasisPoints =
      (await options.resolveCollectionSellerFeeBasisPoints(
        collection.key,
        rpcAsset
      )) ?? resolvedSellerFeeBasisPoints;
  }

  const metadata: MetadataArgs = {
    name: rpcAsset.content?.metadata?.name ?? '',
    symbol: rpcAsset.content?.metadata?.symbol ?? '',
    uri: rpcAsset.content?.json_uri,
    sellerFeeBasisPoints:
      resolvedSellerFeeBasisPoints ?? rawSellerFeeBasisPoints,
    primarySaleHappened: rpcAsset.royalty?.primary_sale_happened,
    isMutable: rpcAsset.mutable,
    editionNonce: wrapNullable(rpcAsset.supply?.edition_nonce),
    tokenStandard: some(TokenStandard.NonFungible),
    collection: collection ? some(collection) : none(),
    uses: none(),
    tokenProgramVersion: TokenProgramVersion.Original,
    creators: rpcAsset.creators,
  };
  const buildCurrentMetadata = (
    sellerFeeBasisPoints: number
  ): MetadataArgsV2Args => ({
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    sellerFeeBasisPoints,
    primarySaleHappened: metadata.primarySaleHappened,
    isMutable: metadata.isMutable,
    tokenStandard: metadata.tokenStandard,
    creators: metadata.creators,
    collection: collection ? some(collection.key) : none(),
  });

  const expectedDataHash = publicKeyBytes(rpcAsset.compression.data_hash);
  let currentMetadata = buildCurrentMetadata(
    rawSellerFeeBasisPoints ?? resolvedSellerFeeBasisPoints
  );
  if (
    collection &&
    currentMetadata.sellerFeeBasisPoints !== SELLER_FEE_BASIS_POINTS_INHERIT &&
    !bytesEqual(hashMetadataDataV2(currentMetadata), expectedDataHash)
  ) {
    const inheritedMetadata = buildCurrentMetadata(
      SELLER_FEE_BASIS_POINTS_INHERIT
    );
    if (bytesEqual(hashMetadataDataV2(inheritedMetadata), expectedDataHash)) {
      currentMetadata = inheritedMetadata;
    }
  }

  const collectionHashBytes = rpcAsset.compression.collection_hash
    ? publicKeyBytes(rpcAsset.compression.collection_hash)
    : undefined;
  const assetDataHashBytes = rpcAsset.compression.asset_data_hash
    ? publicKeyBytes(rpcAsset.compression.asset_data_hash)
    : undefined;

  const rawFlags = rpcAsset.compression.flags;
  const flagsValue = isValidLeafSchemaV2Flags(rawFlags)
    ? (rawFlags as LeafSchemaV2Flags)
    : undefined;

  return {
    leafOwner: rpcAsset.ownership.owner,
    leafDelegate: rpcAsset.ownership.delegate
      ? rpcAsset.ownership.delegate
      : rpcAsset.ownership.owner,
    merkleTree: rpcAssetProof.tree_id,
    root: publicKeyBytes(rpcAssetProof.root),
    dataHash: expectedDataHash,
    creatorHash: publicKeyBytes(rpcAsset.compression.creator_hash),
    collection_hash: collectionHashBytes,
    asset_data_hash: assetDataHashBytes,
    flags: flagsValue,
    nonce: rpcAsset.compression.leaf_id,
    index: rpcAssetProof.node_index - 2 ** rpcAssetProof.proof.length,
    proof,
    metadata,
    currentMetadata,
    rpcAsset,
    rpcAssetProof,
  };
};
