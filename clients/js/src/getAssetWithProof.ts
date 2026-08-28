import {
  Context,
  Option,
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
  isInheritedSfbpRoyalty,
  SELLER_FEE_BASIS_POINTS_INHERIT,
} from '@metaplex-foundation/digital-asset-standard-api';
import {
  fetchMerkleTree,
  getConcurrentMerkleTreeHeaderSerializer,
  getMerkleTreeSize,
} from '@metaplex-foundation/spl-account-compression';
import { base64 } from '@metaplex-foundation/umi/serializers';
import { LeafSchemaV2Flags, isValidLeafSchemaV2Flags } from './flags';
import {
  Collection,
  Creator,
  MetadataArgs,
  MetadataArgsV2Args,
  TokenProgramVersion,
  TokenStandard,
} from './generated';
import { asCurrentMetadataV2 } from './leafMetadata';

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
  /**
   * Display-aligned metadata mirroring DAS main fields
   * (`royalty.basis_points`, `creators`). Type stays `MetadataArgs`.
   * When SFBP is inherited this holds the collection-resolved rate and payees.
   */
  metadata: MetadataArgs;
  /**
   * Canonical leaf metadata for V2 hash and write instructions.
   * Uses DAS `_raw` royalty fields when royalties are inherited.
   */
  currentMetadata: MetadataArgsV2Args;
  /**
   * Leaf SFBP from DAS `royalty.basis_points_raw`. Set only when DAS provides
   * `_raw` / inherited SFBP (omitted for ordinary assets, like DAS).
   */
  sellerFeeBasisPointsRaw?: number;
  /**
   * Leaf creators from DAS `creators_raw`. Set only when DAS provides
   * `creators_raw` / inherited SFBP (omitted for ordinary assets, like DAS).
   */
  creatorsRaw?: Array<Creator>;
  /**
   * Sugar for `rpcAsset.royalty.inherited` / inherit-sentinel detection.
   */
  inherited: boolean;
  rpcAsset: DasApiAsset;
  rpcAssetProof: GetAssetProofRpcResponse;
};

type GetAssetWithProofOptions = {
  truncateCanopy?: boolean;
};

type GetAccountInfoResult = {
  value?: {
    data?: [string, string];
    space?: number;
  } | null;
};

const MERKLE_TREE_HEADER_SIZE =
  getConcurrentMerkleTreeHeaderSerializer().fixedSize ?? 56;

/** Canopy nodes occupy 32 * ((1 << (depth + 1)) - 2) bytes after the tree body. */
const canopyDepthFromNodeCount = (canopyNodes: number): number | null => {
  if (canopyNodes <= 0) return 0;
  const canopyDepth = Math.log2(canopyNodes + 2) - 1;
  return Number.isInteger(canopyDepth) && canopyDepth >= 0 ? canopyDepth : null;
};

/**
 * Resolve canopy depth without downloading the full merkle tree account.
 * Tree accounts with a canopy are large enough that `getAccountInfo` often
 * socket-timeouts on DAS / public RPCs (and on CI).
 */
const getCanopyDepth = async (
  context: Pick<Context, 'rpc'>,
  merkleTree: PublicKey
): Promise<number> => {
  try {
    const result = await context.rpc.call<GetAccountInfoResult>(
      'getAccountInfo',
      [
        merkleTree,
        {
          encoding: 'base64',
          dataSlice: { offset: 0, length: MERKLE_TREE_HEADER_SIZE },
        },
      ]
    );
    const value = result?.value;
    if (value?.data?.[0] != null && value.space != null) {
      const headerBytes = base64.serialize(value.data[0]);
      const [{ header }] =
        getConcurrentMerkleTreeHeaderSerializer().deserialize(headerBytes);
      if (header.__kind === 'V1') {
        const sizeWithoutCanopy = getMerkleTreeSize(
          header.maxDepth,
          header.maxBufferSize,
          0
        );
        const canopyNodes = (value.space - sizeWithoutCanopy) / 32;
        const canopyDepth = canopyDepthFromNodeCount(canopyNodes);
        if (canopyDepth != null) return canopyDepth;
      }
    }
  } catch {
    // Fall back to a full account fetch if the sliced RPC path is unavailable.
  }

  const merkleTreeAccount = await fetchMerkleTree(context, merkleTree);
  return canopyDepthFromNodeCount(merkleTreeAccount.canopy.length) ?? 0;
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

  let { proof } = rpcAssetProof;
  if (options?.truncateCanopy) {
    const canopyDepth = await getCanopyDepth(context, rpcAssetProof.tree_id);
    proof = rpcAssetProof.proof.slice(
      0,
      canopyDepth === 0 ? undefined : -canopyDepth
    );
  }

  const collectionGroup = (rpcAsset.grouping ?? []).find(
    (group) => group.group_key === 'collection' && group.group_value != null
  );

  const collection: Option<Collection> = collectionGroup
    ? some({
        key: publicKey(collectionGroup.group_value as string),
        verified: collectionGroup.verified ?? false,
      })
    : none();

  const { royalty } = rpcAsset;
  const inherited = royalty
    ? isInheritedSfbpRoyalty(royalty) ||
      royalty.basis_points === SELLER_FEE_BASIS_POINTS_INHERIT
    : false;

  // Main / display fields (DAS `basis_points`, `creators`).
  const sellerFeeBasisPoints = royalty?.basis_points ?? 0;
  const { creators } = rpcAsset;

  // Leaf `_raw` — only when DAS exposes them or SFBP is inherited (DAS omission).
  let sellerFeeBasisPointsRaw: number | undefined;
  let creatorsRaw: Array<Creator> | undefined;
  if (royalty?.basis_points_raw != null) {
    sellerFeeBasisPointsRaw = royalty.basis_points_raw;
  } else if (inherited) {
    sellerFeeBasisPointsRaw = SELLER_FEE_BASIS_POINTS_INHERIT;
  }
  if (rpcAsset.creators_raw != null) {
    creatorsRaw = rpcAsset.creators_raw;
  } else if (inherited) {
    creatorsRaw = [];
  }

  const metadata: MetadataArgs = {
    name: rpcAsset.content?.metadata?.name ?? '',
    symbol: rpcAsset.content?.metadata?.symbol ?? '',
    uri: rpcAsset.content?.json_uri,
    sellerFeeBasisPoints,
    primarySaleHappened: royalty?.primary_sale_happened,
    isMutable: rpcAsset.mutable,
    editionNonce: wrapNullable(rpcAsset.supply?.edition_nonce),
    tokenStandard: some(TokenStandard.NonFungible),
    collection,
    uses: none(),
    tokenProgramVersion: TokenProgramVersion.Original,
    creators,
  };

  const currentMetadata = asCurrentMetadataV2({
    metadata,
    sellerFeeBasisPointsRaw,
    creatorsRaw,
  });

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
    dataHash: publicKeyBytes(rpcAsset.compression.data_hash),
    creatorHash: publicKeyBytes(rpcAsset.compression.creator_hash),
    collection_hash: collectionHashBytes,
    asset_data_hash: assetDataHashBytes,
    flags: flagsValue,
    nonce: rpcAsset.compression.leaf_id,
    index: rpcAssetProof.node_index - 2 ** rpcAssetProof.proof.length,
    proof,
    metadata,
    currentMetadata,
    sellerFeeBasisPointsRaw,
    creatorsRaw,
    inherited,
    rpcAsset,
    rpcAssetProof,
  };
};
