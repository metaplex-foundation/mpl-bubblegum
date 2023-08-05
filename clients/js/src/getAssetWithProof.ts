import { Context, PublicKey, publicKeyBytes } from '@metaplex-foundation/umi';
import { ReadApiInterface } from './readApiDecorator';
import { GetAssetProofRpcResponse, ReadApiAsset } from './readApiTypes';

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
  rpcAsset: ReadApiAsset;
  rpcAssetProof: GetAssetProofRpcResponse;
};

export const getAssetWithProof = async (
  context: Pick<Context, 'rpc'> & { rpc: ReadApiInterface },
  assetId: PublicKey
): Promise<AssetWithProof> => {
  const [rpcAsset, rpcAssetProof] = await Promise.all([
    context.rpc.getAsset(assetId),
    context.rpc.getAssetProof(assetId),
  ]);

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
    index: rpcAsset.compression.leaf_id, // TODO: convert rpcAssetProof.node_index to leaf_index using: leaf_index = node_index - 2^tree_height
    proof: rpcAssetProof.proof,
    rpcAsset,
    rpcAssetProof,
  };
};
