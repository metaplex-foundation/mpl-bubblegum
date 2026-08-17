import test from 'ava';
import { none, publicKey, some, unwrapOption } from '@metaplex-foundation/umi';
import {
  MetadataArgs,
  SELLER_FEE_BASIS_POINTS_INHERIT,
  TokenProgramVersion,
  TokenStandard,
  asCurrentMetadata,
  asCurrentMetadataV2,
  toLeafMetadata,
  toLeafMetadataV2,
} from '../src';

const coreCollection = publicKey(
  '7USYF5BnFo4FuE8eRoEqEvSvZSEaMG5AqPCQbLQ5BxPL'
);
const payee = publicKey('HjzLbPCVGFjXAo5HXS5fpQmXjQE6FMgDEPvFZon7rC7G');

const resolvedMetadata: MetadataArgs = {
  name: 'My NFT',
  symbol: '',
  uri: 'https://example.com/my-nft.json',
  sellerFeeBasisPoints: 500,
  primarySaleHappened: false,
  isMutable: true,
  editionNonce: none(),
  tokenStandard: some(TokenStandard.NonFungible),
  collection: some({ key: coreCollection, verified: true }),
  uses: none(),
  tokenProgramVersion: TokenProgramVersion.Original,
  creators: [{ address: payee, share: 100, verified: true }],
};

test('toLeafMetadata applies explicit sibling raw fields', (t) => {
  const leaf = toLeafMetadata(resolvedMetadata, {
    sellerFeeBasisPointsRaw: SELLER_FEE_BASIS_POINTS_INHERIT,
    creatorsRaw: [],
  });
  t.is(leaf.sellerFeeBasisPoints, SELLER_FEE_BASIS_POINTS_INHERIT);
  t.deepEqual(leaf.creators, []);
  t.is(resolvedMetadata.sellerFeeBasisPoints, 500);
});

test('toLeafMetadataV2 converts getAssetWithProof metadata + sibling raw', (t) => {
  const leaf = toLeafMetadataV2(resolvedMetadata, {
    sellerFeeBasisPointsRaw: SELLER_FEE_BASIS_POINTS_INHERIT,
    creatorsRaw: [],
  });
  t.is(leaf.sellerFeeBasisPoints, SELLER_FEE_BASIS_POINTS_INHERIT);
  t.deepEqual(leaf.creators, []);
  t.is(unwrapOption(leaf.collection), coreCollection);
  t.false('tokenProgramVersion' in leaf);
});

test('asCurrentMetadata / asCurrentMetadataV2 sugar', (t) => {
  const asset = {
    metadata: resolvedMetadata,
    sellerFeeBasisPointsRaw: SELLER_FEE_BASIS_POINTS_INHERIT,
    creatorsRaw: [] as MetadataArgs['creators'],
    inherited: true,
  };
  t.is(
    asCurrentMetadata(asset).sellerFeeBasisPoints,
    SELLER_FEE_BASIS_POINTS_INHERIT
  );
  t.is(
    unwrapOption(asCurrentMetadataV2(asset).collection),
    coreCollection
  );
});

test('toLeafMetadata leaves explicit leaf metadata unchanged without raw', (t) => {
  const explicit: MetadataArgs = {
    name: 'X',
    symbol: '',
    uri: 'https://example.com/x.json',
    sellerFeeBasisPoints: 550,
    primarySaleHappened: false,
    isMutable: true,
    editionNonce: none(),
    tokenStandard: some(TokenStandard.NonFungible),
    collection: none(),
    uses: none(),
    tokenProgramVersion: TokenProgramVersion.Original,
    creators: [{ address: payee, share: 100, verified: false }],
  };
  const leaf = toLeafMetadata(explicit);
  t.is(leaf.sellerFeeBasisPoints, 550);
  t.is(leaf.creators.length, 1);
});

test('toLeafMetadataV2 accepts native MetadataArgsV2Args', (t) => {
  const v2 = {
    name: 'V2 NFT',
    uri: 'https://example.com/v2.json',
    sellerFeeBasisPoints: 500,
    collection: some(coreCollection),
    creators: [{ address: payee, share: 100, verified: true }],
  };
  const leaf = toLeafMetadataV2(v2, {
    sellerFeeBasisPointsRaw: SELLER_FEE_BASIS_POINTS_INHERIT,
    creatorsRaw: [],
  });
  t.is(leaf.sellerFeeBasisPoints, SELLER_FEE_BASIS_POINTS_INHERIT);
  t.deepEqual(leaf.creators, []);
  t.is(unwrapOption(leaf.collection), coreCollection);
});

test('toLeafMetadataV2 handles null and plain collection values', (t) => {
  const withNullCollection = {
    ...resolvedMetadata,
    collection: null,
  };
  t.is(unwrapOption(toLeafMetadataV2(withNullCollection).collection), null);

  const withPlainCollection = {
    ...resolvedMetadata,
    collection: { key: coreCollection, verified: true },
  };
  t.is(
    unwrapOption(toLeafMetadataV2(withPlainCollection).collection),
    coreCollection
  );
});
