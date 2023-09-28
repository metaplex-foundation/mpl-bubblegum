import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  percentAmount,
  publicKey,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
  hashLeaf,
  setAndVerifyCollection,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can set and verify the collection of a minted compressed NFT', async (t) => {
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

  // And a tree with a minted NFT that has no collection.
  const treeCreator = await generateSignerWithSol(umi);
  const merkleTree = await createTree(umi, { treeCreator });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    treeCreatorOrDelegate: treeCreator,
    leafOwner,
  });

  // When the collection authority sets and verifies the collection.
  await setAndVerifyCollection(umi, {
    leafOwner,
    treeCreatorOrDelegate: treeCreator,
    collectionMint: collectionMint.publicKey,
    collectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

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

test('it cannot set and verify the collection if the tree creator or delegate does not sign', async (t) => {
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

  // And a tree with a minted NFT that has no collection.
  const treeCreator = await generateSignerWithSol(umi);
  const merkleTree = await createTree(umi, { treeCreator });
  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    treeCreatorOrDelegate: treeCreator,
    leafOwner,
  });

  // When the collection authority sets and verifies the collection
  // without the tree creator signing.
  const promise = setAndVerifyCollection(umi, {
    leafOwner,
    treeCreatorOrDelegate: treeCreator.publicKey, // <-- Here, we pass the tree creator as a public key.
    collectionMint: collectionMint.publicKey,
    collectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'UpdateAuthorityIncorrect' });
});

test('it cannot set and verify the collection if there is already a verified collection', async (t) => {
  // Given a first Collection NFT.
  const umi = await createUmi();
  const firstCollectionMint = generateSigner(umi);
  const firstCollectionAuthority = generateSigner(umi);
  await createNft(umi, {
    mint: firstCollectionMint,
    authority: firstCollectionAuthority,
    name: 'My Collection 1',
    uri: 'https://example.com/my-collection-1.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // And a tree with a minted NFT that has a verified collection of that first Collection NFT.
  const treeCreator = await generateSignerWithSol(umi);
  const merkleTree = await createTree(umi, { treeCreator });
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = generateSigner(umi).publicKey;
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    treeCreatorOrDelegate: treeCreator,
    leafOwner,
  });
  await setAndVerifyCollection(umi, {
    leafOwner,
    treeCreatorOrDelegate: treeCreator,
    collectionMint: firstCollectionMint.publicKey,
    collectionAuthority: firstCollectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata,
  }).sendAndConfirm(umi);
  const firstCollectionVerifiedMetadata = {
    ...metadata,
    collection: {
      key: firstCollectionMint.publicKey,
      verified: true,
    },
  };

  // And then given a second Collection NFT.
  const secondCollectionMint = generateSigner(umi);
  const secondCollectionAuthority = generateSigner(umi);
  await createNft(umi, {
    mint: secondCollectionMint,
    authority: secondCollectionAuthority,
    name: 'My Collection 2',
    uri: 'https://example.com/my-collection-2.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When the second collection authority attempts to set and verify the second collection.
  let promise = setAndVerifyCollection(umi, {
    leafOwner,
    treeCreatorOrDelegate: treeCreator,
    collectionMint: secondCollectionMint.publicKey,
    collectionAuthority: secondCollectionAuthority,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    nonce: leafIndex,
    index: leafIndex,
    metadata: firstCollectionVerifiedMetadata,
    proof: [],
  }).sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { name: 'AlreadyVerified' });

  // And the leaf was not updated in the merkle tree.
  const notUpdatedLeaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex,
    metadata: firstCollectionVerifiedMetadata,
  });
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(notUpdatedLeaf));
});
