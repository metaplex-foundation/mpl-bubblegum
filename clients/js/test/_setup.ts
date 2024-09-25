/* eslint-disable import/no-extraneous-dependencies */
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  Context,
  Pda,
  PublicKey,
  SolAmount,
  TransactionWithMeta,
  generateSigner,
  none,
  publicKey,
} from '@metaplex-foundation/umi';
import { createUmi as baseCreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import {
  DecompressibleState,
  MetadataArgsArgs,
  createTree as baseCreateTree,
  mintV1 as baseMintV1,
  fetchMerkleTree,
  findLeafAssetIdPda,
  findTreeConfigPda,
  hashLeaf,
  mplBubblegum,
  setDecompressibleState,
} from '../src';

export const createUmi = async (endpoint?: string, airdropAmount?: SolAmount) =>
  (await baseCreateUmi(endpoint, undefined, airdropAmount))
    .use(mplTokenMetadata())
    .use(mplBubblegum());

export const createTree = async (
  context: Context,
  input: Partial<Parameters<typeof baseCreateTree>[1]> = {}
): Promise<PublicKey> => {
  const merkleTree = generateSigner(context);
  let builder = await baseCreateTree(context, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    ...input,
  });
  builder = builder.append(
    setDecompressibleState(context, {
      treeConfig:
        input.treeConfig ??
        findTreeConfigPda(context, { merkleTree: merkleTree.publicKey }),
      treeCreator: input.treeCreator ?? context.identity,
      decompressableState: DecompressibleState.Enabled,
    })
  );
  await builder.sendAndConfirm(context);
  return merkleTree.publicKey;
};

export const mint = async (
  context: Context,
  input: Omit<Parameters<typeof baseMintV1>[1], 'metadata' | 'leafOwner'> & {
    leafIndex?: number | bigint;
    metadata?: Partial<Parameters<typeof baseMintV1>[1]['metadata']>;
    leafOwner?: PublicKey;
  }
): Promise<{
  metadata: MetadataArgsArgs;
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
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
    ...input.metadata,
  };

  await baseMintV1(context, {
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

// TransactionWithMeta doesn't have ReturnData field that is discribed in
// https://solana.com/docs/rpc/http/gettransaction#result
// so ugly log parsing is provided
export function getReturnLog(
  transaction: TransactionWithMeta | null
): null | [string, string, Buffer] {
  if (transaction === null) {
    return null;
  }
  const prefix = 'Program return: ';
  let log = transaction.meta.logs.find((logs) => logs.startsWith(prefix));
  if (log === undefined) {
    return null;
  }
  log = log.slice(prefix.length);
  const [key, data] = log.split(' ', 2);
  const buffer = Buffer.from(data, 'base64');
  return [key, data, buffer];
}
