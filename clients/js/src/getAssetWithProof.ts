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
import { MetadataArgs, TokenProgramVersion, TokenStandard } from './generated';

export type AssetWithProof = {
  leafOwner: PublicKey;
  leafDelegate: PublicKey;
  merkleTree: PublicKey;
  root: Uint8Array;
  dataHash: Uint8Array;
  creatorHash: Uint8Array;
  nonce: number;
  index: number;
  proof: PublicKey[];
  metadata: MetadataArgs;
  rpcAsset: DasApiAsset;
  rpcAssetProof: GetAssetProofRpcResponse;
};

export const getAssetWithProof = async (
  context: Pick<Context, 'rpc'> & { rpc: DasApiInterface },
  assetId: PublicKey
): Promise<AssetWithProof> => {
  const [rpcAsset, rpcAssetProof] = await Promise.all([
    context.rpc.getAsset(assetId),
    context.rpc.getAssetProof(assetId),
  ]);

  const collectionString = (rpcAsset.grouping ?? []).find(
    (group) => group.group_key === 'collection'
  )?.group_value;

  const metadata: MetadataArgs = {
    name: rpcAsset.content?.metadata?.name ?? '',
    symbol: rpcAsset.content?.metadata?.symbol ?? '',
    uri: rpcAsset.content?.json_uri,
    sellerFeeBasisPoints: rpcAsset.royalty?.basis_points,
    primarySaleHappened: rpcAsset.royalty?.primary_sale_happened,
    isMutable: rpcAsset.mutable,
    editionNonce: wrapNullable(rpcAsset.supply?.edition_nonce),
    tokenStandard: some(TokenStandard.NonFungible),
    collection: collectionString
      ? some({ key: publicKey(collectionString), verified: true })
      : none(),
    uses: none(),
    tokenProgramVersion: TokenProgramVersion.Original,
    creators: rpcAsset.creators,
  };

  return {
    leafOwner: rpcAsset.ownership.owner,
    leafDelegate: rpcAsset.ownership.delegate
      ? rpcAsset.ownership.delegate
      : rpcAsset.ownership.owner,
    merkleTree: rpcAssetProof.tree_id,
    root: publicKeyBytes(rpcAssetProof.root),
    dataHash: publicKeyBytes(rpcAsset.compression.data_hash),
    creatorHash: publicKeyBytes(rpcAsset.compression.creator_hash),
    nonce: rpcAsset.compression.leaf_id,
    index: rpcAssetProof.node_index - 2 ** rpcAssetProof.proof.length,
    proof: rpcAssetProof.proof,
    metadata,
    rpcAsset,
    rpcAssetProof,
  };
};
