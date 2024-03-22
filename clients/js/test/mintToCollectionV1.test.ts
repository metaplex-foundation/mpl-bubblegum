import {
  MetadataDelegateRole,
  TokenStandard,
  approveCollectionAuthority,
  createNft,
  delegateCollectionV1,
  findCollectionAuthorityRecordPda,
  findMetadataDelegateRecordPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  defaultPublicKey,
  generateSigner,
  percentAmount,
  publicKey,
  some,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  MetadataArgsArgs,
  fetchMerkleTree,
  findLeafAssetIdPda,
  getLeafSchemaSerializer,
  hashLeaf,
  mintToCollectionV1,
} from '../src';
import { createTree, createUmi, getReturnLog } from './_setup';

test('it can mint an NFT from a collection (collection unverified in passed-in metadata)', async (t) => {
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

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata, with collection unverified.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: false,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
  }).sendAndConfirm(umi);

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
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it can mint an NFT from a collection (collection verified in passed-in metadata)', async (t) => {
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

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata, with collection verified.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: true,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
  }).sendAndConfirm(umi);

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
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it can mint an NFT from a collection using a collection delegate', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);

  // And a delegated Collection NFT.
  const collectionDelegate = generateSigner(umi);
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  })
    .add(
      delegateCollectionV1(umi, {
        mint: collectionMint.publicKey,
        delegate: collectionDelegate.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      })
    )
    .sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the collection delegate.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: false,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
    collectionAuthority: collectionDelegate,
    collectionAuthorityRecordPda: findMetadataDelegateRecordPda(umi, {
      mint: collectionMint.publicKey,
      delegateRole: MetadataDelegateRole.Collection,
      delegate: collectionDelegate.publicKey,
      updateAuthority: umi.identity.publicKey,
    }),
  }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.activeIndex, 1n);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it can mint an NFT from a collection using a legacy collection delegate', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.activeIndex, 0n);

  // And a delegated Collection NFT.
  const collectionMint = generateSigner(umi);
  const collectionDelegate = generateSigner(umi);
  const collectionAuthorityRecordPda = findCollectionAuthorityRecordPda(umi, {
    mint: collectionMint.publicKey,
    collectionAuthority: collectionDelegate.publicKey,
  });
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  })
    .add(
      approveCollectionAuthority(umi, {
        mint: collectionMint.publicKey,
        newCollectionAuthority: collectionDelegate.publicKey,
        collectionAuthorityRecord: collectionAuthorityRecordPda,
      })
    )
    .sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the collection delegate.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: false,
    },
    creators: [],
  };
  await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
    collectionAuthority: collectionDelegate,
    collectionAuthorityRecordPda,
  }).sendAndConfirm(umi);

  // Then a new leaf was added to the merkle tree.
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.activeIndex, 1n);

  // And the hash of the metadata matches the new leaf.
  const leaf = hashLeaf(umi, {
    merkleTree,
    owner: leafOwner,
    leafIndex: 0,
    metadata: {
      ...metadata,
      collection: some({ key: collectionMint.publicKey, verified: true }),
    },
  });
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, publicKey(leaf));
});

test('it can mint an NFT from a collection (collection verified in passed-in metadata) && can get created LeafSchema from returnedValue ', async (t) => {
  // Given an empty Bubblegum tree.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = generateSigner(umi).publicKey;

  // And a Collection NFT.
  const collectionMint = generateSigner(umi);
  await createNft(umi, {
    mint: collectionMint,
    name: 'My Collection',
    uri: 'https://example.com/my-collection.json',
    sellerFeeBasisPoints: percentAmount(5.5), // 5.5%
    isCollection: true,
  }).sendAndConfirm(umi);

  // When we mint a new NFT from the tree using the following metadata, with collection verified.
  const metadata: MetadataArgsArgs = {
    name: 'My NFT',
    uri: 'https://example.com/my-nft.json',
    sellerFeeBasisPoints: 550, // 5.5%
    collection: {
      key: collectionMint.publicKey,
      verified: true,
    },
    creators: [],
  };

  const transactionResult = await mintToCollectionV1(umi, {
    leafOwner,
    merkleTree,
    metadata,
    collectionMint: collectionMint.publicKey,
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
