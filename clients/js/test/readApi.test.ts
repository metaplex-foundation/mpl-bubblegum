import { Umi, createUmi, publicKey } from '@metaplex-foundation/umi';
import { testPlugins } from '@metaplex-foundation/umi-bundle-tests';
import anyTest, { TestFn } from 'ava';
import {
  ReadApiAsset,
  ReadApiAssetCreator,
  ReadApiAssetGrouping,
  mplBubblegum,
  readApi,
} from '../src';

const test = anyTest as TestFn<{ umi: Umi }>;
const endpoint = process.env.READ_API_RPC_DEVNET;

test.before(async (t) => {
  t.context.umi = createUmi()
    .use(testPlugins(endpoint))
    .use(mplBubblegum())
    .use(readApi());
});

test('it can fetch a compressed asset by ID', async (t) => {
  // Given a minted NFT on devnet.
  const { umi } = t.context;
  const assetId = publicKey('BZHZ4GX7JZ1JxngRVtHJgUAnUZQ76ffBTsNXuqTVXvg5');

  // When we fetch data of the asset.
  const asset = await umi.rpc.getAsset(assetId);

  // Then we expect the following data.
  t.like(asset, <ReadApiAsset>{
    interface: 'V1_NFT',
    id: assetId,
    content: {
      json_uri: 'https://example.com/my-nft.json',
      metadata: { name: 'My NFT', symbol: '' },
    },
    authorities: [
      {
        address: 'GzLmvkKDrrvzQAg85C6LYF4LnkCkiPQw8dYpmPzEPXWV',
        scopes: ['full'],
      },
    ],
    compression: {
      eligible: false,
      compressed: true,
      data_hash: 'HB6sKWxroCdwkChjxckW3CF3fWupZHhPEua62GF46Ljs',
      creator_hash: 'EKDHSGbrGztomDfuiV4iqiZ6LschDJPsFiXjZ83f92Md',
      asset_hash: 'ATA3LjhmyvsuAVCwsnwyo5FbMFzK41a2mkng9SFy1jcX',
      tree: '6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E',
      seq: 1,
      leaf_id: 0,
    },
    grouping: [] as ReadApiAssetGrouping[],
    royalty: {
      royalty_model: 'creators',
      target: null,
      percent: 0.05,
      basis_points: 500,
      primary_sale_happened: false,
      locked: false,
    },
    creators: [] as ReadApiAssetCreator[],
    ownership: {
      frozen: false,
      delegated: false,
      delegate: null,
      ownership_model: 'single',
      owner: 'EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo',
    },
    supply: {
      print_max_supply: 0,
      print_current_supply: 0,
    },
    mutable: true,
  });
});
