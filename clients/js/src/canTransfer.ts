import { DasApiAsset } from '@metaplex-foundation/digital-asset-standard-api';
import { AssetWithProof } from './getAssetWithProof';

function isAssetWithProof(
  asset: AssetWithProof | DasApiAsset
): asset is AssetWithProof {
  return 'rpcAsset' in asset;
}

export function canTransfer(asset: AssetWithProof | DasApiAsset): boolean {
  const ownership = isAssetWithProof(asset)
    ? asset.rpcAsset.ownership
    : asset.ownership;

  const isFrozen =
    ownership.frozen === true || ownership.non_transferable === true;
  return !isFrozen;
}
