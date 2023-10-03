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

test('it can fetch an nft assets by group', async (t) => {
  const { umi } = t.context;

  // Fetch the assets on devnet that have the following collection "C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr"
  const asset = await umi.rpc.getAssetsByGroup({
    groupKey: 'collection',
    groupValue: 'C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr',
    page: 1,
    limit: 100,
  });

  t.like(asset, {
    total: 2,
    limit: 100,
    page: 1,
    items: [
      {
        interface: 'Custom',
        id: 'DkiWKRi5j9j2h58XGSWwRBXDu5HgFJYLvAS2Z7kueiAK',
        content: {
          $schema: 'https://schema.metaplex.com/nft1.0.json',
          json_uri:
            'https://nftstorage.link/ipfs/bafybeifuxoy7pzi3mffx7vdjdrq6vdkxpybiscucrwzuc4j3lzfnvldt5i/3.json',
          files: [
            {
              uri: 'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/3.png',
              cdn_uri:
                'https://cdn.helius-rpc.com/cdn-cgi/image//https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/3.png',
              mime: 'image/png',
            },
          ],
          metadata: {
            attributes: [
              {
                value: 'True',
                trait_type: 'Background',
              },
            ],
            description: 'This is your NFT Description',
            name: 'Cloaked #4',
            symbol: '',
            token_standard: 'ProgrammableNonFungible',
          },
          links: {
            image:
              'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/3.png',
          },
        },
        authorities: [
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            scopes: ['full'],
          },
        ],
        compression: {
          eligible: false,
          compressed: false,
          data_hash: '',
          creator_hash: '',
          asset_hash: '',
          tree: '',
          seq: 0,
          leaf_id: 0,
        },
        grouping: [
          {
            group_key: 'collection',
            group_value: 'C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr',
          },
        ],
        royalty: {
          royalty_model: 'creators',
          target: null,
          percent: 0.01,
          basis_points: 100,
          primary_sale_happened: true,
          locked: false,
        },
        creators: [
          {
            address: '6usSN6vfYch3k4ue88rhmRnJ5DUm1ziYt9J5XzxRdpcG',
            share: 0,
            verified: true,
          },
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            share: 100,
            verified: false,
          },
        ],
        ownership: {
          frozen: true,
          delegated: false,
          delegate: null,
          ownership_model: 'single',
          owner: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
        },
        supply: null,
        mutable: true,
        burnt: false,
      },
      {
        interface: 'Custom',
        id: '6QnSsL9mqkzMpvhSWptU5XVs5pM3WLcoiTp8YykEn34D',
        content: {
          $schema: 'https://schema.metaplex.com/nft1.0.json',
          json_uri:
            'https://nftstorage.link/ipfs/bafybeifuxoy7pzi3mffx7vdjdrq6vdkxpybiscucrwzuc4j3lzfnvldt5i/2.json',
          files: [
            {
              uri: 'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/2.png',
              cdn_uri:
                'https://cdn.helius-rpc.com/cdn-cgi/image//https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/2.png',
              mime: 'image/png',
            },
          ],
          metadata: {
            attributes: [
              {
                value: 'True',
                trait_type: 'Background',
              },
            ],
            description: 'This is your NFT Description',
            name: 'Cloaked #3',
            symbol: '',
            token_standard: 'ProgrammableNonFungible',
          },
          links: {
            image:
              'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/2.png',
          },
        },
        authorities: [
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            scopes: ['full'],
          },
        ],
        compression: {
          eligible: false,
          compressed: false,
          data_hash: '',
          creator_hash: '',
          asset_hash: '',
          tree: '',
          seq: 0,
          leaf_id: 0,
        },
        grouping: [
          {
            group_key: 'collection',
            group_value: 'C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr',
          },
        ],
        royalty: {
          royalty_model: 'creators',
          target: null,
          percent: 0.01,
          basis_points: 100,
          primary_sale_happened: true,
          locked: false,
        },
        creators: [
          {
            address: '6usSN6vfYch3k4ue88rhmRnJ5DUm1ziYt9J5XzxRdpcG',
            share: 0,
            verified: true,
          },
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            share: 100,
            verified: false,
          },
        ],
        ownership: {
          frozen: false,
          delegated: false,
          delegate: null,
          ownership_model: 'single',
          owner: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
        },
        supply: null,
        mutable: true,
        burnt: false,
      },
    ],
  });
});

test('it can fetch an nft assets by group with a sort', async (t) => {
  const { umi } = t.context;

  // Fetch the assets on devnet that have the following collection "C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr"
  const asset = await umi.rpc.getAssetsByGroup({
    groupKey: 'collection',
    groupValue: 'C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr',
    page: 1,
    sortBy: {
      sortBy: 'created',
      sortDirection: 'desc',
    },
  });

  t.like(asset, {
    total: 2,
    limit: 1000,
    page: 1,
    items: [
      {
        interface: 'Custom',
        id: '6QnSsL9mqkzMpvhSWptU5XVs5pM3WLcoiTp8YykEn34D',
        content: {
          $schema: 'https://schema.metaplex.com/nft1.0.json',
          json_uri:
            'https://nftstorage.link/ipfs/bafybeifuxoy7pzi3mffx7vdjdrq6vdkxpybiscucrwzuc4j3lzfnvldt5i/2.json',
          files: [
            {
              uri: 'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/2.png',
              cdn_uri:
                'https://cdn.helius-rpc.com/cdn-cgi/image//https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/2.png',
              mime: 'image/png',
            },
          ],
          metadata: {
            attributes: [
              {
                value: 'True',
                trait_type: 'Background',
              },
            ],
            description: 'This is your NFT Description',
            name: 'Cloaked #3',
            symbol: '',
            token_standard: 'ProgrammableNonFungible',
          },
          links: {
            image:
              'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/2.png',
          },
        },
        authorities: [
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            scopes: ['full'],
          },
        ],
        compression: {
          eligible: false,
          compressed: false,
          data_hash: '',
          creator_hash: '',
          asset_hash: '',
          tree: '',
          seq: 0,
          leaf_id: 0,
        },
        grouping: [
          {
            group_key: 'collection',
            group_value: 'C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr',
          },
        ],
        royalty: {
          royalty_model: 'creators',
          target: null,
          percent: 0.01,
          basis_points: 100,
          primary_sale_happened: true,
          locked: false,
        },
        creators: [
          {
            address: '6usSN6vfYch3k4ue88rhmRnJ5DUm1ziYt9J5XzxRdpcG',
            share: 0,
            verified: true,
          },
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            share: 100,
            verified: false,
          },
        ],
        ownership: {
          frozen: false,
          delegated: false,
          delegate: null,
          ownership_model: 'single',
          owner: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
        },
        supply: null,
        mutable: true,
        burnt: false,
      },
      {
        interface: 'Custom',
        id: 'DkiWKRi5j9j2h58XGSWwRBXDu5HgFJYLvAS2Z7kueiAK',
        content: {
          $schema: 'https://schema.metaplex.com/nft1.0.json',
          json_uri:
            'https://nftstorage.link/ipfs/bafybeifuxoy7pzi3mffx7vdjdrq6vdkxpybiscucrwzuc4j3lzfnvldt5i/3.json',
          files: [
            {
              uri: 'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/3.png',
              cdn_uri:
                'https://cdn.helius-rpc.com/cdn-cgi/image//https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/3.png',
              mime: 'image/png',
            },
          ],
          metadata: {
            attributes: [
              {
                value: 'True',
                trait_type: 'Background',
              },
            ],
            description: 'This is your NFT Description',
            name: 'Cloaked #4',
            symbol: '',
            token_standard: 'ProgrammableNonFungible',
          },
          links: {
            image:
              'https://nftstorage.link/ipfs/bafybeihummjrhhje4jfmu6mqjdmvmiu7j4k4j22xkpqmxsrmfj5yldq354/3.png',
          },
        },
        authorities: [
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            scopes: ['full'],
          },
        ],
        compression: {
          eligible: false,
          compressed: false,
          data_hash: '',
          creator_hash: '',
          asset_hash: '',
          tree: '',
          seq: 0,
          leaf_id: 0,
        },
        grouping: [
          {
            group_key: 'collection',
            group_value: 'C7JjL4tXgqDKsek44AoNQBEME2aCvry6xZdKA8CxLoZr',
          },
        ],
        royalty: {
          royalty_model: 'creators',
          target: null,
          percent: 0.01,
          basis_points: 100,
          primary_sale_happened: true,
          locked: false,
        },
        creators: [
          {
            address: '6usSN6vfYch3k4ue88rhmRnJ5DUm1ziYt9J5XzxRdpcG',
            share: 0,
            verified: true,
          },
          {
            address: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
            share: 100,
            verified: false,
          },
        ],
        ownership: {
          frozen: true,
          delegated: false,
          delegate: null,
          ownership_model: 'single',
          owner: '5oCPMdoLFqXTvQ6n2x4XvJELnatBdG6N6D9EWyhvv8sK',
        },
        supply: null,
        mutable: true,
        burnt: false,
      },
    ],
  });
});