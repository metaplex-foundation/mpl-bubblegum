import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  percentAmount,
  publicKey,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  verifyCollection,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can verify the collection of a minted compressed NFT', async (t) => {
  // Given a Collection NFT.
  const umi = await createUmi();
  const collectionMint = generateSigner(umi);
  const collectionAuthority = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    authority: collectionAuthority,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // And a tree with a minted NFT that has an unverified collection.
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner,
    message: {
      collection: {
        key: collectionMint.publicKey,
        verified: false,
      },
    },
  });

  // When the collection authority verifies the collection.
  await verifyCollection(umi, {
    leafOwner,
    collectionMint: collectionMint.publicKey,
    collectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    message: metadata,
  })
    .addRemainingAccounts([]) // <- Proof nodes would be added as remaining accounts.
    .sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: {
      ...metadata,
      collection: {
        key: collectionMint.publicKey,
        verified: true,
      },
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
