import { generateSigner, none } from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchMerkleTree, mintV1 } from '../src';
import { createTree, createUmi } from './_setup';

test('it can mint an NFT from a Bubblegum tree', async (t) => {
  // Given an existing Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // When
  await mintV1(umi, {
    leafOwner,
    merkleTree,
    message: {
      name: 'My NFT',
      uri: 'https://example.com/my-nft.json',
      sellerFeeBasisPoints: 500, // 5%
      collection: none(),
      creators: [],
    },
  }).sendAndConfirm(umi);

  // Then
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  console.log(merkleTreeAccount);
  t.pass();
});
