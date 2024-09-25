import {
  defaultPublicKey,
  generateSigner,
  none,
  publicKey,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  TokenStandard,
  MetadataArgsArgs,
  fetchMerkleTree,
  findLeafAssetIdPda,
  getLeafSchemaSerializer,
  hashLeaf,
  mintV1,
} from '../src';
import { createTree, createUmi, getReturnLog } from './_setup';

test('it can mint an NFT from a Bubblegum tree', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 0n);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);
  t.is(merkleTreeAccount.tree.bufferSize, 1n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 0);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
  };
  await mintV1(umi, { leafOwner, merkleTree, metadata }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.sequenceNumber, 1n);
  t.is(merkleTreeAccount.tree.activeIndex, 1n);
  t.is(merkleTreeAccount.tree.bufferSize, 2n);
  t.is(merkleTreeAccount.tree.rightMostPath.index, 1);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata,
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it cannot mint an NFT from a Bubblegum tree because token standard is empty', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
    tokenStandard: none(),
  };
  const promise = mintV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
  }).sendAndConfirm(umi);
  // Then we expect a program error because metadata's token standard is empty.
  await t.throwsAsync(promise, { name: 'InvalidTokenStandard' });
});

test('it cannot mint an NFT from a Bubblegum tree because token standard is wrong', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
    tokenStandard: some(TokenStandard.FungibleAsset),
  };
  const promise = mintV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
  }).sendAndConfirm(umi);
  // Then we expect a program error because metadata's token standard is FungibleAsset which is wrong.
  await t.throwsAsync(promise, { name: 'InvalidTokenStandard' });
});

test('it can get LeafSchema from mint without CPI', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();

  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // When we mint a new NFT from the tree using the following metadata.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
  };
  const transactionResult = await mintV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
  }).sendAndConfirm(umi);
  const transaction = await umi.rpc.getTransaction(transactionResult.signature);

  const unparsedLogs = getReturnLog(transaction);
  if (unparsedLogs != null) {
    const buffer = unparsedLogs[2];
    const leaf = getLeafSchemaSerializer().deserialize(buffer)[0];
    const assetId = findLeafAssetIdPda(umi, { merkleTree, leafIndex: 0 });

    t.is(leafOwner, leaf.owner);
    t.is(Number(leaf.nonce), 0);
    t.is(leaf.id, assetId[0]);
  } else {
    t.fail();
  }
});
