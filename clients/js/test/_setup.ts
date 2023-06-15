/* eslint-disable import/no-extraneous-dependencies */
import {
  Context,
  Pda,
  PublicKey,
  generateSigner,
  none,
  publicKey,
} from '@metaplex-foundation/umi';
import { createUmi as baseCreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import {
  MetadataArgsArgs,
  createTree as baseCreateTree,
  mintV1 as baseMintV1,
  fetchMerkleTree,
  findLeafAssetIdPda,
  hashLeaf,
  mplBubblegum,
} from '../src';

export const createUmi = async () =>
  (await baseCreateUmi()).use(mplBubblegum());

export const createTree = async (
  context: Context,
  input: Partial<Parameters<typeof baseCreateTree>[1]> = {}
): Promise<PublicKey> => {
  const merkleTree = generateSigner(context);
  const builder = await baseCreateTree(context, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    ...input,
  });
  await builder.sendAndConfirm(context);
  return merkleTree.publicKey;
};

export const mint = async (
  context: Context,
  input: Omit<Parameters<typeof baseMintV1>[1], 'message'> & {
    leafIndex?: number | bigint;
    message?: Partial<Parameters<typeof baseMintV1>[1]['message']>;
  }
): Promise<{
  metadata: MetadataArgsArgs;
  assetId: Pda;
  leaf: PublicKey;
  leafIndex: number;
}> => {
  const merkleTree = publicKey(input.merkleTree, false);
  const leafIndex = Number(
    input.leafIndex ??
      (await fetchMerkleTree(context, merkleTree)).tree.activeIndex
  );
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
    ...input.message,
  };

  await baseMintV1(context, {
    ...input,
    message: metadata,
  }).sendAndConfirm(context);

  return {
    metadata,
    assetId: findLeafAssetIdPda(context, { tree: merkleTree, leafIndex }),
    leafIndex,
    leaf: publicKey(
      hashLeaf(context, {
        merkleTree,
        owner: publicKey(input.leafOwner, false),
        delegate: publicKey(input.leafDelegate ?? input.leafOwner, false),
        leafIndex,
        metadata,
      })
    ),
  };
};
