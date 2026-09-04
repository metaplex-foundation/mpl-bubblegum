import {
  DigitalAsset,
  fetchDigitalAsset,
  findMasterEditionPda,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import { defaultPublicKey, none, some, sol } from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  fetchMerkleTree,
  getCurrentRoot,
} from '@metaplex-foundation/spl-account-compression';
import {
  decompressV1,
  findLeafAssetIdPda,
  findMintAuthorityPda,
  findVoucherPda,
  hashMetadataCreators,
  hashMetadataData,
  redeem,
} from '../src';
import { createTree, createUmi, mint } from './_setup';

// The decompressed token mint is an spl-token `Mint`, whose account is
// `Mint::LEN` (82) bytes.
const MINT_LEN = 82;

test('it can decompress a redeemed compressed NFT', async (t) => {
  // Given a tree with a minted NFT.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = await generateSignerWithSol(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  // And given that NFT was redeemed.
  let merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

test('it can decompress when the mint PDA already holds lamports', async (t) => {
  // Given a tree with a minted NFT that has been redeemed.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = await generateSignerWithSol(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  const [voucher] = findVoucherPda(umi, { merkleTree, nonce: leafIndex });
  t.true(await umi.rpc.accountExists(voucher));

  // And given the mint PDA already holds some lamports. Its address is a
  // deterministic PDA, so its balance is not guaranteed to be zero at
  // decompression time.
  const [decompressedMint] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  await umi.rpc.airdrop(decompressedMint, sol(0.001));
  t.true(await umi.rpc.accountExists(decompressedMint));

  // When we decompress the NFT.
  await decompressV1(umi, {
    leafOwner,
    voucher,
    metadata,
    mint: decompressedMint,
  }).sendAndConfirm(umi);

  // Then decompression still succeeds and a valid mint is created.
  const nft = await fetchDigitalAsset(umi, decompressedMint);
  t.is(nft.mint.supply, 1n);
  t.is(nft.mint.decimals, 0);
  t.true(nft.mint.isInitialized);

  // And the pre-existing lamports were absorbed toward the mint's rent.
  const mintBalance = await umi.rpc.getBalance(decompressedMint);
  const mintRent = await umi.rpc.getRent(MINT_LEN);
  t.deepEqual(mintBalance, mintRent);

  // And the Voucher account was removed.
  t.false(await umi.rpc.accountExists(voucher));
});

test('it can decompress when the mint PDA holds more than its rent', async (t) => {
  // Given a tree with a minted NFT that has been redeemed.
  const umi = await createUmi();
  const merkleTree = await createTree(umi);
  const leafOwner = await generateSignerWithSol(umi);
  const { metadata, leafIndex } = await mint(umi, {
    merkleTree,
    leafOwner: leafOwner.publicKey,
  });

  const merkleTreeAccount = await fetchMerkleTree(umi, merkleTree);
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

  const [voucher] = findVoucherPda(umi, { merkleTree, nonce: leafIndex });
  t.true(await umi.rpc.accountExists(voucher));

  // And given the mint PDA already holds more than the Mint account's
  // rent-exempt minimum.
  const [decompressedMint] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
  const prefundedAmount = sol(0.002);
  const mintRent = await umi.rpc.getRent(MINT_LEN);
  t.true(prefundedAmount.basisPoints > mintRent.basisPoints);
  await umi.rpc.airdrop(decompressedMint, prefundedAmount);

  // When we decompress the NFT.
  await decompressV1(umi, {
    leafOwner,
    voucher,
    metadata,
    mint: decompressedMint,
  }).sendAndConfirm(umi);

  // Then decompression still succeeds and a valid mint is created.
  const nft = await fetchDigitalAsset(umi, decompressedMint);
  t.is(nft.mint.supply, 1n);
  t.is(nft.mint.decimals, 0);
  t.true(nft.mint.isInitialized);

  // And no rent top-up was needed, so the surplus above the rent-exempt
  // minimum stays locked in the mint account.
  const mintBalance = await umi.rpc.getBalance(decompressedMint);
  t.deepEqual(mintBalance, prefundedAmount);

  // And the Voucher account was removed.
  t.false(await umi.rpc.accountExists(voucher));
});
