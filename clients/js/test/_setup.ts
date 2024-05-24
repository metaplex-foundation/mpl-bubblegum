/* eslint-disable import/no-extraneous-dependencies */
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  Context,
  Pda,
  PublicKey,
  SolAmount,
  generateSigner,
  publicKey,
} from '@metaplex-foundation/umi';
import { createUmi as baseCreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import {
  NodeArgsArgs,
  createTree as baseCreateTree,
  fetchMerkleTree,
  findLeafAssetIdPda,
  hashLeaf,
  mintNodeV1,
  primitivesProtractor,
} from '../src';

export const createUmi = async (endpoint?: string, airdropAmount?: SolAmount) =>
  (await baseCreateUmi(endpoint, undefined, airdropAmount))
    .use(mplTokenMetadata())
    .use(primitivesProtractor());

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
  input: Omit<Parameters<typeof mintNodeV1>[1], 'metadata' | 'leafOwner'> & {
    leafIndex?: number | bigint;
    metadata?: Partial<Parameters<typeof mintNodeV1>[1]['metadata']>;
    leafOwner?: PublicKey;
  }
): Promise<{
  metadata: NodeArgsArgs;
  assetId: Pda;
  leaf: PublicKey;
  leafIndex: number;
}> => {
  const merkleTree = publicKey(input.merkleTree, false);
  const leafOwner = input.leafOwner ?? context.identity.publicKey;
  const leafIndex = Number(
    input.leafIndex ??
      (await fetchMerkleTree(context, merkleTree)).tree.activeIndex
  );
  const metadata: NodeArgsArgs = {
    label: 'My NFT',
    properties: [
      {
        key: 'test',
        value: 'test2',
      },
    ],
    isMutable: true,
    creators: [],
  };

  await mintNodeV1(context, {
    ...input,
    metadata,
    leafOwner,
  }).sendAndConfirm(context);

  return {
    metadata,
    assetId: findLeafAssetIdPda(context, { merkleTree, leafIndex }),
    leafIndex,
    leaf: publicKey(
      hashLeaf(context, {
        merkleTree,
        owner: publicKey(leafOwner, false),
        delegate: publicKey(input.leafDelegate ?? leafOwner, false),
        leafIndex,
        metadata,
      })
    ),
  };
};
