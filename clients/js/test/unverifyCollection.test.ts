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
  setAndVerifyCollection,
  unverifyCollection,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can unverify the collection of a minted compressed NFT', async (t) => {
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

  // And a tree with a minted NFT that has a verified collection.
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mint(umi, { merkleTree, leafOwner });
  await setAndVerifyCollection(umi, {
    leafOwner,
    collectionMint: collectionMint.publicKey,
    collectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    message: metadata,
  }).sendAndConfirm(umi);
  const verifiedMetadata = {
    ...metadata,
    collection: {
      key: collectionMint.publicKey,
      verified: true,
    },
  };

  // When the collection authority unverifies the collection.
  await unverifyCollection(umi, {
    leafOwner,
    collectionMint: collectionMint.publicKey,
    collectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    message: verifiedMetadata,
  })
    .addRemainingAccounts([]) // <- Proof nodes would be added as remaining accounts.
    .sendAndConfirm(umi);

  // Then the leaf was updated in the merkle tree.
  const updatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: {
      ...verifiedMetadata,
      collection: {
        key: collectionMint.publicKey,
        verified: false,
      },
    },
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(updatedLeaf));
});
