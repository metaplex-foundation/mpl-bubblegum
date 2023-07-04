import { Umi, createUmi, publicKey } from '@metaplex-foundation/umi';
import { testPlugins } from '@metaplex-foundation/umi-bundle-tests';
import anyTest, { TestFn } from 'ava';
import {
  GetAssetProofRpcResponse,
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

  // When we fetch the asset using its ID.
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

test('it can fetch the proof of a compressed asset by ID', async (t) => {
  // Given a minted NFT on devnet.
  const { umi } = t.context;
  const assetId = publicKey('BZHZ4GX7JZ1JxngRVtHJgUAnUZQ76ffBTsNXuqTVXvg5');

  // When we fetch the proof of the asset using its ID.
  const asset = await umi.rpc.getAssetProof(assetId);

  // Then we expect the following data.
  t.like(asset, <GetAssetProofRpcResponse>{
    root: '2nbxuRGhqrQ2hmpYhr7AUVagsBWxW2srPfndr83a1Yaf',
    proof: [
      '11111111111111111111111111111111',
      'Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr',
      'DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1',
      '3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6',
      'GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh',
      'zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C',
      'ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91',
      'JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta',
      'BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc',
      'EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR',
      'HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL',
      'HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7',
      '4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq',
      'E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2',
    ],
    node_index: 16384,
    leaf: 'ATA3LjhmyvsuAVCwsnwyo5FbMFzK41a2mkng9SFy1jcX',
    tree_id: '6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E',
  });
});
