import {
  Umi,
  createUmi,
  none,
  publicKey,
  publicKeyBytes,
  some,
} from '@metaplex-foundation/umi';
import { testPlugins } from '@metaplex-foundation/umi-bundle-tests';
import anyTest, { TestFn } from 'ava';
import {
  DasApiAsset,
  DasApiAssetCreator,
  DasApiAssetGrouping,
  GetAssetProofRpcResponse,
  dasApi,
} from '@metaplex-foundation/digital-asset-standard-api';
import {
  AssetWithProof,
  getAssetWithProof,
  mplBubblegum,
  TokenProgramVersion,
  TokenStandard,
} from '../src';

const test = anyTest as TestFn<{ umi: Umi }>;
const endpoint = process.env.READ_API_RPC_DEVNET;

test.before(async (t) => {
  t.context.umi = createUmi()
    .use(testPlugins(endpoint))
    .use(mplBubblegum())
    .use(dasApi());
});

test('it can fetch a compressed asset by ID', async (t) => {
  // Given a minted NFT on devnet.
  const { umi } = t.context;
  const assetId = publicKey('BZHZ4GX7JZ1JxngRVtHJgUAnUZQ76ffBTsNXuqTVXvg5');

  // When we fetch the asset using its ID.
  const asset = await umi.rpc.getAsset(assetId);

  // Then we expect the following data.
  t.like(asset, <DasApiAsset>{
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
    grouping: [] as DasApiAssetGrouping[],
    royalty: {
      royalty_model: 'creators',
      target: null,
      percent: 0.05,
      basis_points: 500,
      primary_sale_happened: false,
      locked: false,
    },
    creators: [] as DasApiAssetCreator[],
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

test('it can fetch the proof of a compressed asset', async (t) => {
  // Given a minted NFT on devnet.
  // and a tree with depth 14 and canopy depth 0.
  const { umi } = t.context;
  const assetId = publicKey('BZHZ4GX7JZ1JxngRVtHJgUAnUZQ76ffBTsNXuqTVXvg5');

  // When we fetch the proof of the asset using its ID with no truncation.
  const asset = await getAssetWithProof(umi, assetId);

  // Then we expect the following data
  // with a proof length of 14.
  t.like(asset, <AssetWithProof>{
    leafOwner: publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo'),
    leafDelegate: publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo'),
    merkleTree: publicKey('6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E'),
    root: publicKeyBytes('2nbxuRGhqrQ2hmpYhr7AUVagsBWxW2srPfndr83a1Yaf'),
    dataHash: publicKeyBytes('HB6sKWxroCdwkChjxckW3CF3fWupZHhPEua62GF46Ljs'),
    creatorHash: publicKeyBytes('EKDHSGbrGztomDfuiV4iqiZ6LschDJPsFiXjZ83f92Md'),
    nonce: 0,
    index: 0,
    proof: [
      publicKey('11111111111111111111111111111111'),
      publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
      publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
      publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
      publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
      publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
      publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
      publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
      publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
      publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
      publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
      publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
      publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
      publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
    ],
    metadata: {
      name: 'My NFT',
      symbol: '',
      uri: 'https://example.com/my-nft.json',
      sellerFeeBasisPoints: 500,
      primarySaleHappened: false,
      isMutable: true,
      editionNonce: none(),
      tokenStandard: some(TokenStandard.NonFungible),
      collection: none(),
      uses: none(),
      tokenProgramVersion: TokenProgramVersion.Original,
      creators: [],
    },
    rpcAsset: {
      interface: 'V1_NFT',
      id: assetId,
      content: {
        json_uri: 'https://example.com/my-nft.json',
        metadata: { name: 'My NFT', symbol: '' },
      },
      authorities: [
        {
          address: publicKey('GzLmvkKDrrvzQAg85C6LYF4LnkCkiPQw8dYpmPzEPXWV'),
          scopes: ['full'],
        },
      ],
      compression: {
        eligible: false,
        compressed: true,
        data_hash: publicKey('HB6sKWxroCdwkChjxckW3CF3fWupZHhPEua62GF46Ljs'),
        creator_hash: publicKey('EKDHSGbrGztomDfuiV4iqiZ6LschDJPsFiXjZ83f92Md'),
        asset_hash: publicKey('ATA3LjhmyvsuAVCwsnwyo5FbMFzK41a2mkng9SFy1jcX'),
        tree: publicKey('6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E'),
        seq: 1,
        leaf_id: 0,
      },
      grouping: [] as DasApiAssetGrouping[],
      royalty: {
        royalty_model: 'creators',
        target: null,
        percent: 0.05,
        basis_points: 500,
        primary_sale_happened: false,
        locked: false,
      },
      creators: [] as DasApiAssetCreator[],
      ownership: {
        frozen: false,
        delegated: false,
        delegate: null,
        ownership_model: 'single',
        owner: publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo'),
      },
      supply: {
        print_max_supply: 0,
        print_current_supply: 0,
        edition_nonce: null,
      },
      mutable: true,
      burnt: false,
    },
    rpcAssetProof: {
      root: publicKey('2nbxuRGhqrQ2hmpYhr7AUVagsBWxW2srPfndr83a1Yaf'),
      proof: [
        publicKey('11111111111111111111111111111111'),
        publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
        publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
        publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
        publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
        publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
        publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
        publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
        publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
        publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
        publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
        publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
        publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
        publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
      ],
      node_index: 16384,
      leaf: publicKey('ATA3LjhmyvsuAVCwsnwyo5FbMFzK41a2mkng9SFy1jcX'),
      tree_id: publicKey('6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E'),
    },
  });
});

test('it can fetch the truncated proof of a compressed asset with canopy depth 0', async (t) => {
  // Given a minted NFT on devnet
  // and a tree with depth 14 and canopy depth 0.
  const { umi } = t.context;
  const assetId = publicKey('BZHZ4GX7JZ1JxngRVtHJgUAnUZQ76ffBTsNXuqTVXvg5');

  // When we fetch the proof of the asset using its ID with truncation.
  const asset = await getAssetWithProof(umi, assetId, { truncateCanopy: true });

  // Then we expect the following data
  // with a proof length of 14.
  t.like(asset, <AssetWithProof>{
    leafOwner: publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo'),
    leafDelegate: publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo'),
    merkleTree: publicKey('6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E'),
    root: publicKeyBytes('2nbxuRGhqrQ2hmpYhr7AUVagsBWxW2srPfndr83a1Yaf'),
    dataHash: publicKeyBytes('HB6sKWxroCdwkChjxckW3CF3fWupZHhPEua62GF46Ljs'),
    creatorHash: publicKeyBytes('EKDHSGbrGztomDfuiV4iqiZ6LschDJPsFiXjZ83f92Md'),
    nonce: 0,
    index: 0,
    proof: [
      publicKey('11111111111111111111111111111111'),
      publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
      publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
      publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
      publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
      publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
      publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
      publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
      publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
      publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
      publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
      publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
      publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
      publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
    ],
    metadata: {
      name: 'My NFT',
      symbol: '',
      uri: 'https://example.com/my-nft.json',
      sellerFeeBasisPoints: 500,
      primarySaleHappened: false,
      isMutable: true,
      editionNonce: none(),
      tokenStandard: some(TokenStandard.NonFungible),
      collection: none(),
      uses: none(),
      tokenProgramVersion: TokenProgramVersion.Original,
      creators: [],
    },
    rpcAsset: {
      interface: 'V1_NFT',
      id: assetId,
      content: {
        json_uri: 'https://example.com/my-nft.json',
        metadata: { name: 'My NFT', symbol: '' },
      },
      authorities: [
        {
          address: publicKey('GzLmvkKDrrvzQAg85C6LYF4LnkCkiPQw8dYpmPzEPXWV'),
          scopes: ['full'],
        },
      ],
      compression: {
        eligible: false,
        compressed: true,
        data_hash: publicKey('HB6sKWxroCdwkChjxckW3CF3fWupZHhPEua62GF46Ljs'),
        creator_hash: publicKey('EKDHSGbrGztomDfuiV4iqiZ6LschDJPsFiXjZ83f92Md'),
        asset_hash: publicKey('ATA3LjhmyvsuAVCwsnwyo5FbMFzK41a2mkng9SFy1jcX'),
        tree: publicKey('6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E'),
        seq: 1,
        leaf_id: 0,
      },
      grouping: [] as DasApiAssetGrouping[],
      royalty: {
        royalty_model: 'creators',
        target: null,
        percent: 0.05,
        basis_points: 500,
        primary_sale_happened: false,
        locked: false,
      },
      creators: [] as DasApiAssetCreator[],
      ownership: {
        frozen: false,
        delegated: false,
        delegate: null,
        ownership_model: 'single',
        owner: publicKey('EczRmPqSEWBXtcMKVK1avV87EXH5JZrRbTVdUJdnYaKo'),
      },
      supply: {
        print_max_supply: 0,
        print_current_supply: 0,
        edition_nonce: null,
      },
      mutable: true,
      burnt: false,
    },
    rpcAssetProof: {
      root: publicKey('2nbxuRGhqrQ2hmpYhr7AUVagsBWxW2srPfndr83a1Yaf'),
      proof: [
        publicKey('11111111111111111111111111111111'),
        publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
        publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
        publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
        publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
        publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
        publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
        publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
        publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
        publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
        publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
        publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
        publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
        publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
      ],
      node_index: 16384,
      leaf: publicKey('ATA3LjhmyvsuAVCwsnwyo5FbMFzK41a2mkng9SFy1jcX'),
      tree_id: publicKey('6tPxkhcjcfR7rXsnGwzh8rPnkiYt2r6tDGN1TUv4T15E'),
    },
  });
});

test('it can fetch the proof of a compressed asset with nonzero canopy depth', async (t) => {
  // Given a minted NFT on devnet
  // and a tree with depth 14 and canopy depth 9.
  const { umi } = t.context;
  const assetId = publicKey('3UowCweYWKsZKXmnYvq5jwsyD2eNtshjhjGEwk6yteEP');

  // When we fetch the proof of the asset using its ID with no truncation.
  const asset = await getAssetWithProof(umi, assetId);

  // Then we expect the following data
  // with a proof length of 14.
  t.like(asset, <AssetWithProof>{
    leafOwner: publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU'),
    leafDelegate: publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU'),
    merkleTree: publicKey('B6RTei821Mi4ZAFqXGCCeHMJbixnweFJMY49UZBs4LWN'),
    root: publicKeyBytes('5YBtsaLbRgdhQVnzrVx3x3EACYHbnr1A41W2dEuy6JAB'),
    dataHash: publicKeyBytes('4a2qppASrq9T3wPro2U5ZzqQBDHSkbZEhxGkBSBzXmyN'),
    creatorHash: publicKeyBytes('Gk76AHtMYsTR4pgtuCQ1Rg8u9Mdc4ko29jVPKgGrrYMK'),
    nonce: 0,
    index: 0,
    proof: [
      publicKey('68QTh52yKHqXWFiEZz7gnwSrBuiiuK43nWF6nGY2KMHK'),
      publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
      publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
      publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
      publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
      publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
      publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
      publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
      publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
      publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
      publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
      publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
      publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
      publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
    ],
    metadata: {
      name: 'Welcome to Creator Studio',
      symbol: 'CS',
      uri: 'https://arweave.net/0h9bJ_dST9JN7jdYgfW5SoTQ5b_6zYkpX7x5nLkeeD0',
      sellerFeeBasisPoints: 0,
      primarySaleHappened: false,
      isMutable: false,
      editionNonce: some(0),
      tokenStandard: some(TokenStandard.NonFungible),
      collection: some({
        verified: true,
        key: publicKey('5141VSFjgYFEKTy45aT1tUEeApwQ1eXPEfzRdRVt7xTL'),
      }),
      uses: none(),
      tokenProgramVersion: TokenProgramVersion.Original,
      creators: [
        {
          address: publicKey('3HxqsUguP6E7CNqjvpEAnJ8v86qbyJgWvN2idAKygLdD'),
          share: 100,
          verified: false,
        },
        {
          address: publicKey('792RcrqqmoWUh6LbijAfpAkxR2kVCoBGrmshWzfy7HgD'),
          share: 0,
          verified: false,
        },
      ],
    },
    rpcAsset: {
      interface: 'V1_NFT',
      id: assetId,
      content: {
        json_uri:
          'https://arweave.net/0h9bJ_dST9JN7jdYgfW5SoTQ5b_6zYkpX7x5nLkeeD0',
        metadata: { name: 'Welcome to Creator Studio', symbol: 'CS' },
      },
      authorities: [
        {
          address: publicKey('EMNC5LShRmEBaPbG9xSnALaFjkMtuFbQ8ehZLEzkWPfW'),
          scopes: ['full'],
        },
      ],
      compression: {
        eligible: false,
        compressed: true,
        data_hash: publicKey('4a2qppASrq9T3wPro2U5ZzqQBDHSkbZEhxGkBSBzXmyN'),
        creator_hash: publicKey('Gk76AHtMYsTR4pgtuCQ1Rg8u9Mdc4ko29jVPKgGrrYMK'),
        asset_hash: publicKey('GBfJEitNVPm8mADUCP67c2RG1FGmyFteBZqTeMCQL2xR'),
        tree: publicKey('B6RTei821Mi4ZAFqXGCCeHMJbixnweFJMY49UZBs4LWN'),
        seq: 3,
        leaf_id: 0,
      },
      grouping: [
        {
          group_key: 'collection',
          group_value: '5141VSFjgYFEKTy45aT1tUEeApwQ1eXPEfzRdRVt7xTL',
        },
      ] as DasApiAssetGrouping[],
      royalty: {
        royalty_model: 'creators',
        target: null,
        percent: 0,
        basis_points: 0,
        primary_sale_happened: false,
        locked: false,
      },
      creators: [
        {
          address: publicKey('3HxqsUguP6E7CNqjvpEAnJ8v86qbyJgWvN2idAKygLdD'),
          share: 100,
          verified: false,
        },
        {
          address: publicKey('792RcrqqmoWUh6LbijAfpAkxR2kVCoBGrmshWzfy7HgD'),
          share: 0,
          verified: false,
        },
      ] as DasApiAssetCreator[],
      ownership: {
        frozen: false,
        delegated: false,
        delegate: null,
        ownership_model: 'single',
        owner: publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU'),
      },
      supply: {
        print_max_supply: 0,
        print_current_supply: 0,
        edition_nonce: 0,
      },
      mutable: false,
      burnt: false,
    },
    rpcAssetProof: {
      root: publicKey('5YBtsaLbRgdhQVnzrVx3x3EACYHbnr1A41W2dEuy6JAB'),
      proof: [
        publicKey('68QTh52yKHqXWFiEZz7gnwSrBuiiuK43nWF6nGY2KMHK'),
        publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
        publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
        publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
        publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
        publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
        publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
        publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
        publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
        publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
        publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
        publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
        publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
        publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
      ],
      node_index: 16384,
      leaf: publicKey('GBfJEitNVPm8mADUCP67c2RG1FGmyFteBZqTeMCQL2xR'),
      tree_id: publicKey('B6RTei821Mi4ZAFqXGCCeHMJbixnweFJMY49UZBs4LWN'),
    },
  });
});

test('it can fetch the truncated proof of a compressed asset with nonzero canopy depth', async (t) => {
  // Given a minted NFT on devnet
  // and a tree with depth 14 and canopy depth 9.
  const { umi } = t.context;
  const assetId = publicKey('3UowCweYWKsZKXmnYvq5jwsyD2eNtshjhjGEwk6yteEP');

  // When we fetch the proof of the asset using its ID with truncation.
  const asset = await getAssetWithProof(umi, assetId, { truncateCanopy: true });

  // Then we expect the following data
  // with a proof length of 5.
  t.like(asset, <AssetWithProof>{
    leafOwner: publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU'),
    leafDelegate: publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU'),
    merkleTree: publicKey('B6RTei821Mi4ZAFqXGCCeHMJbixnweFJMY49UZBs4LWN'),
    root: publicKeyBytes('5YBtsaLbRgdhQVnzrVx3x3EACYHbnr1A41W2dEuy6JAB'),
    dataHash: publicKeyBytes('4a2qppASrq9T3wPro2U5ZzqQBDHSkbZEhxGkBSBzXmyN'),
    creatorHash: publicKeyBytes('Gk76AHtMYsTR4pgtuCQ1Rg8u9Mdc4ko29jVPKgGrrYMK'),
    nonce: 0,
    index: 0,
    proof: [
      publicKey('68QTh52yKHqXWFiEZz7gnwSrBuiiuK43nWF6nGY2KMHK'),
      publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
      publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
      publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
      publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
    ],
    metadata: {
      name: 'Welcome to Creator Studio',
      symbol: 'CS',
      uri: 'https://arweave.net/0h9bJ_dST9JN7jdYgfW5SoTQ5b_6zYkpX7x5nLkeeD0',
      sellerFeeBasisPoints: 0,
      primarySaleHappened: false,
      isMutable: false,
      editionNonce: some(0),
      tokenStandard: some(TokenStandard.NonFungible),
      collection: some({
        verified: true,
        key: publicKey('5141VSFjgYFEKTy45aT1tUEeApwQ1eXPEfzRdRVt7xTL'),
      }),
      uses: none(),
      tokenProgramVersion: TokenProgramVersion.Original,
      creators: [
        {
          address: publicKey('3HxqsUguP6E7CNqjvpEAnJ8v86qbyJgWvN2idAKygLdD'),
          share: 100,
          verified: false,
        },
        {
          address: publicKey('792RcrqqmoWUh6LbijAfpAkxR2kVCoBGrmshWzfy7HgD'),
          share: 0,
          verified: false,
        },
      ],
    },
    rpcAsset: {
      interface: 'V1_NFT',
      id: assetId,
      content: {
        json_uri:
          'https://arweave.net/0h9bJ_dST9JN7jdYgfW5SoTQ5b_6zYkpX7x5nLkeeD0',
        metadata: { name: 'Welcome to Creator Studio', symbol: 'CS' },
      },
      authorities: [
        {
          address: publicKey('EMNC5LShRmEBaPbG9xSnALaFjkMtuFbQ8ehZLEzkWPfW'),
          scopes: ['full'],
        },
      ],
      compression: {
        eligible: false,
        compressed: true,
        data_hash: publicKey('4a2qppASrq9T3wPro2U5ZzqQBDHSkbZEhxGkBSBzXmyN'),
        creator_hash: publicKey('Gk76AHtMYsTR4pgtuCQ1Rg8u9Mdc4ko29jVPKgGrrYMK'),
        asset_hash: publicKey('GBfJEitNVPm8mADUCP67c2RG1FGmyFteBZqTeMCQL2xR'),
        tree: publicKey('B6RTei821Mi4ZAFqXGCCeHMJbixnweFJMY49UZBs4LWN'),
        seq: 3,
        leaf_id: 0,
      },
      grouping: [
        {
          group_key: 'collection',
          group_value: '5141VSFjgYFEKTy45aT1tUEeApwQ1eXPEfzRdRVt7xTL',
        },
      ] as DasApiAssetGrouping[],
      royalty: {
        royalty_model: 'creators',
        target: null,
        percent: 0,
        basis_points: 0,
        primary_sale_happened: false,
        locked: false,
      },
      creators: [
        {
          address: publicKey('3HxqsUguP6E7CNqjvpEAnJ8v86qbyJgWvN2idAKygLdD'),
          share: 100,
          verified: false,
        },
        {
          address: publicKey('792RcrqqmoWUh6LbijAfpAkxR2kVCoBGrmshWzfy7HgD'),
          share: 0,
          verified: false,
        },
      ] as DasApiAssetCreator[],
      ownership: {
        frozen: false,
        delegated: false,
        delegate: null,
        ownership_model: 'single',
        owner: publicKey('BJjUoux3xacYcRZV31Ytsi4haJb3HgyzmweVDHutiLWU'),
      },
      supply: {
        print_max_supply: 0,
        print_current_supply: 0,
        edition_nonce: 0,
      },
      mutable: false,
      burnt: false,
    },
    rpcAssetProof: {
      root: publicKey('5YBtsaLbRgdhQVnzrVx3x3EACYHbnr1A41W2dEuy6JAB'),
      proof: [
        publicKey('68QTh52yKHqXWFiEZz7gnwSrBuiiuK43nWF6nGY2KMHK'),
        publicKey('Cf5tmmFZ4D31tviuJezHdFLf5WF7yFvzfxNyftKsqTwr'),
        publicKey('DAbAU9srHpEUogXWuhy5VZ7g8UX9STymELtndcx1xgP1'),
        publicKey('3HCYqQRcQSChEuAw1ybNYHibrTNNjzbYzm56cmEmivB6'),
        publicKey('GSz87YKd3YoZWcEKhnjSsYJwv8o5aWGdBdGGYUphRfTh'),
        publicKey('zLUDhASAn7WA1Aqc724azRpZjKCjMQNATApe74JMg8C'),
        publicKey('ABnEXHmveD6iuMwfw2po7t6TPjn5kYMVwYJMi3fa9K91'),
        publicKey('JDh7eiWiUWtiWn623iybHqjQ6AQ6c2Czz8m6ZxwSCkta'),
        publicKey('BFvmeiEuzAYcMR8YxcuCMGYPDpjcmP5hsNbcswgQ8pMc'),
        publicKey('EvxphsdRErrDMs9nhFfF4nzq8i1C2KSogA7uB96TPpPR'),
        publicKey('HpMJWAzQv9HFgHBqY1o8V1B27sCYPFHJdGivDA658jEL'),
        publicKey('HjnrJn5vBUUzpCxzjjM9ZnCPuXei2cXKJjX468B9yWD7'),
        publicKey('4YCF1CSyTXm1Yi9W9JeYevawupkomdgy2dLxEBHL9euq'),
        publicKey('E3oMtCuPEauftdZLX8EZ8YX7BbFzpBCVRYEiLxwPJLY2'),
      ],
      node_index: 16384,
      leaf: publicKey('GBfJEitNVPm8mADUCP67c2RG1FGmyFteBZqTeMCQL2xR'),
      tree_id: publicKey('B6RTei821Mi4ZAFqXGCCeHMJbixnweFJMY49UZBs4LWN'),
    },
  });
});
