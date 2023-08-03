import {
  DigitalAsset,
  fetchDigitalAsset,
  findMasterEditionPda,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { defaultPublicKey, none, some } from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  decompressV1,
  fetchMerkleTree,
  findLeafAssetIdPda,
  findMintAuthorityPda,
  findVoucherPda,
  getCurrentRoot,
  hashMetadataCreators,
  hashMetadataData,
  redeem,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

test('it can decompress a redeemed compressed NFT', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  const leafOwner = await generateSignerWithSol(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // And given that NFT was redeemed.
  const dataHash = hashMetadataData(metadata);
  const creatorHash = hashMetadataCreators(metadata.creators);
  await redeem(umi, {
    leafOwner,
    merkleTree,
    root: getCurrentRoot(merkleTreeAccount.tree),
    dataHash,
    creatorHash,
    nonce: leafIndex,
    index: leafIndex,
  }).sendAndConfirm(umi);
  merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
  t.is(merkleTreeAccount.tree.rightMostPath.leaf, defaultPublicKey());
  const [voucher] = findVoucherPda(umi, { merkleTree, nonce: leafIndex });
  t.true(await umi.rpc.accountExists(voucher));

  // When we decompress the NFT.
  const [decompressedMint] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  await decompressV1(umi, {
    leafOwner,
    voucher,
    metadata,
    mint: decompressedMint,
  }).sendAndConfirm(umi);

  // Then a new decompressed NFT was created.
  const nft = await fetchDigitalAsset(umi, decompressedMint);
  const [mintAuthority] = findMintAuthorityPda(umi, { mint: decompressedMint });
  const [edition] = findMasterEditionPda(umi, { mint: decompressedMint });
  t.like(nft, <DigitalAsset>{
    publicKey: decompressedMint,
    mint: {
      publicKey: decompressedMint,
      mintAuthority: some(edition),
      freezeAuthority: some(edition),
      supply: 1n,
      decimals: 0,
      isInitialized: true,
    },
    metadata: {
      publicKey: findMetadataPda(umi, { mint: decompressedMint })[0],
      updateAuthority: mintAuthority,
      mint: decompressedMint,
      name: metadata.name,
      symbol: metadata.symbol ?? '',
      uri: metadata.uri,
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      creators: metadata.creators.length > 0 ? some(metadata.creators) : none(),
      primarySaleHappened: metadata.primarySaleHappened ?? false,
      isMutable: metadata.isMutable ?? true,
      collection: metadata.collection,
      uses: none(),
      collectionDetails: none(),
      programmableConfig: none(),
    },
    edition: {
      publicKey: edition,
      isOriginal: true,
      supply: 0n,
      maxSupply: some(0n),
    },
  });

  // And the Voucher account was removed.
  t.false(await umi.rpc.accountExists(voucher));
});
