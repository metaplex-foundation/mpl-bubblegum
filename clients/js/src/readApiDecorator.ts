import { PublicKey, RpcInterface } from '@metaplex-foundation/umi';
import { ReadApiError } from './errors';
import {
  GetAssetProofRpcResponse,
  GetAssetsByGroupRpcInput,
  GetAssetsByOwnerRpcInput,
  ReadApiAsset,
  ReadApiAssetList,
} from './readApiTypes';

export interface ReadApiInterface {
  getAsset(assetId: PublicKey): Promise<ReadApiAsset>;
  getAssetProof(assetId: PublicKey): Promise<GetAssetProofRpcResponse>;
  getAssetsByGroup(input: GetAssetsByGroupRpcInput): Promise<ReadApiAssetList>;
  getAssetsByOwner(input: GetAssetsByOwnerRpcInput): Promise<ReadApiAssetList>;
}

export const createReadApiDecorator = (
  rpc: RpcInterface
): RpcInterface & ReadApiInterface => ({
  ...rpc,
  getAsset: async (assetId: PublicKey) => {
    const asset = await rpc.call<ReadApiAsset | null>('getAsset', [assetId]);
    if (!asset) throw new ReadApiError(`Asset not found: ${assetId}`);
    return asset;
  },
  getAssetProof: async (assetId: PublicKey) => {
    const proof = await rpc.call<GetAssetProofRpcResponse | null>(
      'getAssetProof',
      [assetId]
    );
    if (!proof) throw new ReadApiError(`No proof found for asset: ${assetId}`);
    return proof;
  },
  getAssetsByGroup: async (input: GetAssetsByGroupRpcInput) => {
    if (typeof input.page === 'number' && (input.before || input.after)) {
      throw new ReadApiError(
        'Pagination Error. Please use either page or before/after, but not both.'
      );
    }
    const assetList = await rpc.call<ReadApiAssetList | null>(
      'getAssetsByGroup',
      [
        input.groupKey,
        input.groupValue,
        input.sortBy ?? null,
        input.limit ?? null,
        input.page ?? 1,
        input.before ?? null,
        input.after ?? null,
      ]
    );
    if (!assetList) {
      throw new ReadApiError(
        `No assets found for group: ${input.groupKey} => ${input.groupValue}`
      );
    }
    return assetList;
  },
  getAssetsByOwner: async (input: GetAssetsByOwnerRpcInput) => {
    if (typeof input.page === 'number' && (input.before || input.after)) {
      throw new ReadApiError(
        'Pagination Error. Please use either page or before/after, but not both.'
      );
    }
    const assetList = await rpc.call<ReadApiAssetList | null>(
      'getAssetsByOwner',
      [
        input.owner,
        input.after ?? null,
        input.before ?? null,
        input.limit ?? null,
        input.page ?? 0,
        input.sortBy ?? null,
      ]
    );
    if (!assetList) {
      throw new ReadApiError(`No assets found for owner: ${input.owner}`);
    }
    return assetList;
  },
});
