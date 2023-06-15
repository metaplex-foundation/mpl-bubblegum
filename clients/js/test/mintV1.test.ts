import { generateSigner, none, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import { MetadataArgsArgs, fetchMerkleTree, hashLeaf, mintV1 } from '../src';
import { createTree, createUmi } from './_setup';

test('it can mint an NFT from a Bubblegum tree', async (t) => {
  // Given an existing Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  console.log(merkleTreeAccount);

  // When
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 500, // 5%
    collection: none(),
    creators: [],
  };
  await mintV1(umi, {
    leafOwner,
    merkleTree,
    message: metadata,
  }).sendAndConfirm(umi);

  // Then
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  console.log(merkleTreeAccount);
  t.pass();

  // Debug
  const leafHash = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata,
  });
  console.log('leafHash', publicKey(leafHash));
});
