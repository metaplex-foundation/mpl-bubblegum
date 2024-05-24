import { PublicKey, RpcInterface } from '@metaplex-foundation/umi';
import { ReadApiError } from './errors';
import { NodeArgsArgs } from './generated';

/**
 * Representation of an asset.
 */
export type GraphApiNodeAsset = {
  /**
   * The asset Id.
   */
  id: PublicKey;

  /**
   * The asset content.
   */
  content: NodeArgsArgs;

  /**
   * Indicates whether the asset's metadata is mutable or not.
   */
  mutable: boolean;

  /**
   * Indicates whether the asset is burnt or not.
   */
  burnt: boolean;
};

export interface GraphApiInterface {
  /**
   * Return the metadata information of a compressed/standard asset.
   *
   * @param assetId the id of the asset to fetch
   */
  getNode(assetId: PublicKey): Promise<GraphApiNodeAsset>;

  /**
   * Return the merkle tree proof information for a compressed asset.
   *
   * @param assetId the id of the asset to fetch the proof for
   */
  //   getAssetProof(assetId: PublicKey): Promise<GetAssetProofRpcResponse>;

  /**
   * Return the list of assets given an authority address.
   *
   * @param input the input parameters for the RPC call
   */
  //   getAssetsByAuthority(
  //     input: GetAssetsByAuthorityRpcInput
  //   ): Promise<DasApiAssetList>;

  /**
   * Return the list of assets given a creator address.
   *
   * @param input the input parameters for the RPC call
   */
  //   getAssetsByCreator(
  //     input: GetAssetsByCreatorRpcInput
  //   ): Promise<DasApiAssetList>;

  /**
   * Return the list of assets given a group (key, value) pair.
   *
   * @param input the input parameters for the RPC call
   */
  //   getAssetsByGroup(input: GetAssetsByGroupRpcInput): Promise<DasApiAssetList>;

  /**
   * Return the list of assets given an owner address.
   *
   * @param input the input parameters for the RPC call
   */
  //   getAssetsByOwner(input: GetAssetsByOwnerRpcInput): Promise<DasApiAssetList>;

  /**
   * Return the list of assets given a search criteria.
   *
   * @param input the input parameters for the RPC call
   */
  //   searchAssets(input: SearchAssetsRpcInput): Promise<DasApiAssetList>;
}

export const createGraphApiDecorator = (
  rpc: RpcInterface
): RpcInterface & GraphApiInterface => ({
  ...rpc,
  getNode: async (assetId: PublicKey) => {
    const asset = await rpc.call<GraphApiNodeAsset | null>('getNode', [
      assetId,
    ]);
    if (!asset) throw new ReadApiError(`Node not found: ${assetId}`);
    return asset;
  },
  //   getAssetProof: async (assetId: PublicKey) => {
  //     const proof = await rpc.call<GetAssetProofRpcResponse | null>(
  //       'getAssetProof',
  //       [assetId]
  //     );
  //     if (!proof) throw new DasApiError(`No proof found for asset: ${assetId}`);
  //     return proof;
  //   },
  //   getAssetsByAuthority: async (input: GetAssetsByAuthorityRpcInput) => {
  //     if (typeof input.page === 'number' && (input.before || input.after)) {
  //       throw new DasApiError(
  //         'Pagination Error. Please use either page or before/after, but not both.'
  //       );
  //     }
  //     const assetList = await rpc.call<DasApiAssetList | null>(
  //       'getAssetsByAuthority',
  //       [
  //         input.authority,
  //         input.sortBy ?? null,
  //         input.limit ?? null,
  //         input.page ?? 1,
  //         input.before ?? null,
  //         input.after ?? null,
  //       ]
  //     );
  //     if (!assetList) {
  //       throw new DasApiError(
  //         `No assets found for authority: ${input.authority}`
  //       );
  //     }
  //     return assetList;
  //   },
  //   getAssetsByCreator: async (input: GetAssetsByCreatorRpcInput) => {
  //     if (typeof input.page === 'number' && (input.before || input.after)) {
  //       throw new DasApiError(
  //         'Pagination Error. Please use either page or before/after, but not both.'
  //       );
  //     }
  //     const assetList = await rpc.call<DasApiAssetList | null>(
  //       'getAssetsByCreator',
  //       [
  //         input.creator,
  //         input.onlyVerified,
  //         input.sortBy ?? null,
  //         input.limit ?? null,
  //         input.page ?? 1,
  //         input.before ?? null,
  //         input.after ?? null,
  //       ]
  //     );
  //     if (!assetList) {
  //       throw new DasApiError(`No assets found for creator: ${input.creator}`);
  //     }
  //     return assetList;
  //   },
  //   getAssetsByGroup: async (input: GetAssetsByGroupRpcInput) => {
  //     if (typeof input.page === 'number' && (input.before || input.after)) {
  //       throw new DasApiError(
  //         'Pagination Error. Please use either page or before/after, but not both.'
  //       );
  //     }
  //     const assetList = await rpc.call<DasApiAssetList | null>(
  //       'getAssetsByGroup',
  //       [
  //         input.groupKey,
  //         input.groupValue,
  //         input.sortBy ?? null,
  //         input.limit ?? null,
  //         input.page ?? 1,
  //         input.before ?? null,
  //         input.after ?? null,
  //       ]
  //     );
  //     if (!assetList) {
  //       throw new DasApiError(
  //         `No assets found for group: ${input.groupKey} => ${input.groupValue}`
  //       );
  //     }
  //     return assetList;
  //   },
  //   getAssetsByOwner: async (input: GetAssetsByOwnerRpcInput) => {
  //     if (typeof input.page === 'number' && (input.before || input.after)) {
  //       throw new DasApiError(
  //         'Pagination Error. Please use either page or before/after, but not both.'
  //       );
  //     }
  //     const assetList = await rpc.call<DasApiAssetList | null>(
  //       'getAssetsByOwner',
  //       [
  //         input.owner,
  //         input.sortBy ?? null,
  //         input.limit ?? null,
  //         input.page ?? 1,
  //         input.before ?? null,
  //         input.after ?? null,
  //       ]
  //     );
  //     if (!assetList) {
  //       throw new DasApiError(`No assets found for owner: ${input.owner}`);
  //     }
  //     return assetList;
  //   },
  //   searchAssets: async (input: SearchAssetsRpcInput) => {
  //     if (typeof input.page === 'number' && (input.before || input.after)) {
  //       throw new DasApiError(
  //         'Pagination Error. Please use either page or before/after, but not both.'
  //       );
  //     }
  //     const assetList = await rpc.call<DasApiAssetList | null>('searchAssets', [
  //       input.negate ?? null,
  //       input.conditionType ?? null,
  //       input.interface ?? null,
  //       input.owner ?? null,
  //       input.ownerType ?? null,
  //       input.creator ?? null,
  //       input.creatorVerified ?? null,
  //       input.authority ?? null,
  //       input.grouping ?? null,
  //       input.delegate ?? null,
  //       input.frozen ?? null,
  //       input.supply ?? null,
  //       input.supplyMint ?? null,
  //       input.compressed ?? null,
  //       input.compressible ?? null,
  //       input.royaltyModel ?? null,
  //       input.royaltyTarget ?? null,
  //       input.royaltyAmount ?? null,
  //       input.burnt ?? null,
  //       input.sortBy ?? null,
  //       input.limit ?? null,
  //       input.page ?? 1,
  //       input.before ?? null,
  //       input.after ?? null,
  //       input.jsonUri ?? null,
  //     ]);
  //     if (!assetList) {
  //       throw new DasApiError('No assets found for the given search criteria');
  //     }
  //     return assetList;
  //   },
});
