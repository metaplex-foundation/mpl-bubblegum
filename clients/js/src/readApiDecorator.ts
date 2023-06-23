import { PublicKey, RpcInterface } from '@metaplex-foundation/umi';
import {
  GetAssetProofRpcResponse,
  // GetAssetsByGroupRpcInput,
  // GetAssetsByOwnerRpcInput,
  ReadApiAsset,
  // ReadApiAssetList,
} from './readApiTypes';
import { ReadApiError } from './errors';

export interface ReadApiInterface {
  getAsset(assetId: PublicKey): Promise<ReadApiAsset>;
  getAssetProof(assetId: PublicKey): Promise<GetAssetProofRpcResponse>;
  // getAssetsByGroup(input: GetAssetsByGroupRpcInput): Promise<ReadApiAssetList>;
  // getAssetsByOwner(input: GetAssetsByOwnerRpcInput): Promise<ReadApiAssetList>;
}

export const readApiDecorator = (
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
  // getAssetsByGroup: async (input: GetAssetsByGroupRpcInput) => {},
  // getAssetsByOwner: async (input: GetAssetsByOwnerRpcInput) => {},
});
