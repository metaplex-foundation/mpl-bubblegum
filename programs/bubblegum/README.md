# Bubblegum - Compressed Metaplex NFTs

In case you missed it, you can access [the official Bubblegum documentation on the Developer Hub](https://developers.metaplex.com/bubblegum).

## Testing

### BPF testing
From the repository root:
```bash
pnpm install
pnpm programs:build
pnpm programs:test
```

### JS client testing
See [CONTRIBUTING.md](https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/clients/js/CONTRIBUTING.md).

### Legacy Solita JS client testing
See [README.md](https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/clients/js-solita/README.md).

## Overview

`Bubblegum` is the Metaplex Protocol program for creating and interacting with compressed Metaplex NFTs.  Compressed NFTs are secured on-chain using Merkle trees.

With Bubblegum you can:
* Create a tree
* Delegate authority for a tree.
* Mint a compressed cNFT to a tree.
* Verify/unverify creators
* Verify/unverify membership of a cNFT to a Metaplex Verified Collection.
* Transfer ownership of a cNFT.
* Delegate authority for a cNFT.
* Burn a cNFT.
* Redeem a cNFT and decompress it into an uncompressed Metaplex cNFT.

## Background

Compressed NFTs differ from uncompressed NFTs in where their state (metadata, owner, etc.) is stored.  For uncompressed NFTs, all state data is stored in on-chain accounts.  This tends to be expensive at scale.  Compressed NFTs save space by encoding the state data into a Merkle tree.  This means that the detailed account data is not stored on-chain, but in data stores managed by RPC providers.

Compressed NFTs are secured on-chain by the hashing of the state data when it is added to the Merkle tree.  The Merkle root is a hash that cryptographically secures the state data for all of the leaves (NFTs) contained in the tree.

In the unlikely scenario that all RPC providers were to lose their data stores, the off-chain state of compressed NFTs could be recovered by replaying transactions (provided that the given tree was started from the beginning).

Compressed NFTs can also be losslessly decompressed into uncompressed Metaplex NFTs.  Decompression will cost rent for the Metadata and Master Edition `token-metadata` program accounts that need to be created.

## Basic operation

### Creating and minting to a tree

Anyone can create a tree using `create_tree` and then they are the tree owner.  They can also delegate authority to another wallet.

### Merkle proofs

After a cNFT is minted, for any operations that modify the cNFT, Merkle proofs must be provided with the instruction to validate the Merkle tree changes.  Bubblegum is an Anchor program and makes use of the remaining accounts feature for this purpose.  Merkle proofs are added as remaining account `Pubkey`s that are 32-byte Keccak256 hash values that represent the nodes from the Merkle tree that are required to calculate a new Merkle root.

### Creator verification

Creators are specified in a creators array in the metadata passed into the `mint_v1` instruction.  All creators for which `verified` is set to true in the creators array at the time of mint must be a signer of the transaction or the mint will fail.  Beyond the signers specified in the `MintV1` Account validation structure, the `mint_v1` instruction uses remaining accounts to optionally look for additional signing creators.  This does not conflict with the Merkle proofs requirement because proofs are not required for minting.

Beyond verifying creators at the time of mint, there are `verify_creator` and `unverify_creator` instructions that can be used on existing Compressed NFTs.

### Collection verification

Note that there is no such thing as compressed Verified Collections.  Collections are still NFTs created in the realm of Metadata and Master Edition `token-metadata` accounts. There are instructions to `verify_collection` and `unverify_collection`, as well as a `set_and_verify_collection` instruction for the case where the collection was set during the mint. `mint_to_collection_v1` is an instruction can be used to mint and verify a collection at the same time. Currently `decompress_v1` will fail for verified collection compressed assets, and will only be successful for unverified / no collection compressed assets. The complete flow for decompressing a verified asset would be to unverify its collection, decompress, and reverify collection through traditional means.
All of these require either the true Collection Authority to be a a signer, or a delegated Collection Authority to be a signer along with providing a Collection Authority Record PDA.  See the Metaplex documentation on [`Certified Collections`](https://docs.metaplex.com/programs/token-metadata/certified-collections) for more information on verifying collections.

### Transfer ownership, delegate authority, and burn a cNFT.

Compressed NFTs support transferring ownership, delegating authority, and burning the cNFT.  See the [Instructions](##Instructions) section below for details.

### Redeem a cNFT and decompress it into an uncompressed Metaplex cNFT

Redeeming a cNFT removes the leaf from the Merkle tree and creates a voucher PDA account.  The voucher account can be sent to the `decompress_v1` instruction to decompress the cNFT into an uncompressed Metaplex cNFT.  As mentioned above this will cost rent for the Metadata and Master Edition `token-metadata` accounts that are created during the decompression process.  Note that after a compressed cNFT is redeemed but before it is decompressed, the process can be reversed using `cancel_redeem`.  This puts the compressed cNFT back into the Merkle tree.

## Accounts

### 📄 `tree_authority`

The `tree_authority` PDA account data stores information about a Merkle tree.  It is initialized by `create_tree` and is updated by all other Bubblegum instructions except for decompression.
The account data is represented by the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) struct.

| Field                              | Offset | Size | Description
| ---------------------------------- | ------ | ---- | --
| &mdash;                            | 0      | 8    | Anchor account discriminator.
| `tree_creator`                     | 8      | 32   | `PubKey` of the creator/owner of the Merkle tree.
| `tree_delegate`                    | 40     | 32   | `PubKey` of the delegate authority of the tree.  Initially it is set to the `tree_creator`.
| `num_minted`                       | 72     | 8    | `u64` that keeps track of the number of NFTs minted into the tree.  This value is very important as it is used as a nonce ("number used once") value for leaf operations to ensure the Merkle tree leaves are unique.  The nonce is basically the tree-scoped unique ID of the asset.  In practice for each asset it is retrieved from off-chain data store.

### 📄 `voucher`

The `voucher` PDA account is used when a compressed cNFT is redeemed and decompressed.  It is initialized by `redeem` and represented by the [`Voucher`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L36) struct, which includes a reference to the [`LeafSchema`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/leaf_schema.rs#L45) struct.

| Field                             | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| &mdash;                           | 0      | 8    | Anchor account discriminator.
| `leaf_schema`                     | 8      | 32   | `PubKey` of the creator/owner of the Merkle tree.
| `index`                           | 40     | 32   | `PubKey` of the delegate authority of the tree.  Initially it is set to the `tree_creator`.
| `merkle_tree`                     | 72     | 32   | `PubKey` of the Merkle tree to which the leaf belonged before it was redeemed.

## Instructions

### 📄 `create_tree`

This instruction creates a Merkle Tree.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | :------: | :----: | :------: | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account that is initialized by this ed by this instruction.
| `merkle_tree`                     |    ✅    |        |          | The account that will contain the Merkle tree.
| `payer`                           |          |   ✅   |          | Payer.
| `tree_creator`                    |          |   ✅   |          | The creator/owner of the Merkle tree.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `max_depth`                       | 0      | 4    | The maximum depth of the Merkle tree.  The capacity of the Merkle tree is 2 ^ max_depth.
| `max_buffer_size`                 | 4      | 4    | The minimum concurrency limit of the Merkle tree.  See [Solana Program Library documentation](https://docs.rs/spl-account-compression/0.1.3/spl_account_compression/spl_account_compression/fn.init_empty_merkle_tree.html) on this for more details.

</details>

### 📄 `set_tree_delegate`

This instruction delegates authority for a previously created Merkle tree.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional |  Description
| --------------------------------- | :------: | :----: | :------: |  --
| `tree_authority`                  |    ✅    |        |          |  The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by ` create_tree`.
| `tree_creator`                    |          |   ✅   |          |  The creator/owner of the Merkle tree.
| `new_tree_delegate`               |          |        |          |  The wallet to which to delegate tree authority.
| `merkle_tree`                     |    ✅    |        |          |  The account that contains the Merkle tree, initialized by `create_tree`.
| `system_program`                  |          |        |          |  The Solana System Program ID.

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `mint_v1`

This instruction mints a compressed cNFT.  Note that Merkle proofs are *not* required for minting.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| -----------------------------     | :------: | :----: | :------: | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |        |          | The wallet that will be the cNFT owner.
| `leaf_delegate`                   |          |        |          | The wallet that will be the cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `payer`                           |          |   ✅   |          | Payer.
| `tree_delegate`                   |          |   ✅   |          | The owner or delegate authority of the Merkle tree.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `data`                            | 0      | ~    | [`MetadataArgs`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/metaplex_adapter.rs#L81) object.

</details>

### 📄 `mint_to_collection_v1`

This instruction mints a compressed cNFT.  Note that Merkle proofs are *not* required for minting.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| -----------------------------     | :------: | :----: | :------: | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |        |          | The wallet that will be the cNFT owner.
| `leaf_delegate`                   |          |        |          | The wallet that will be the cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `payer`                           |          |   ✅   |          | Payer.
| `tree_delegate`                   |          |   ✅   |          | The owner or delegate authority of the Merkle tree.
| `collection_authority`            |          |   ✅   |          | Either the collection update authority or a delegate.
| `collection_authority_record_pda` |          |        |    ✅    | Either a metadata delegate record PDA for a collection delegate, or a legacy collection authority record PDA.
| `collection_mint`                 |          |        |          | Mint account of the collection.
| `collection_metadata`             |   ❓✅   |        |          | Metadata account of the collection.  Modified in the case of a sized collection.
| `edition_account`                 |          |        |          | Master Edition account of the collection.
| `bubblegum_signer`                |          |        |          | Signing PDA used when doing a CPI into token-metadata to update the collection information.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `token_metadata_program`          |          |        |          | Metaplex `TokenMetadata` program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.

</details>

### 📄 `update_metadata`

This instruction updates the metadata for a compressed cNFT.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| -----------------------------     | :------: | :----: | :------: | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `authority`                       |          |   ✅   |          | Either a collection authority or tree owner/delegate.  If the item is in a verified collection, a valid collection authority must sign (collection update authority or a dey or a delegate).  Otherwise a tree/owner delegate must sign.
| `collection_mint`                 |          |        |    ✅    | Mint account of the collection.
| `collection_metadata`             |   ❓✅   |        |    ✅    | Metadata account of the collection.
| `collection_authority_record_pda` |          |        |    ✅    | Either a metadata delegate record PDA for a collection delegate, or a legacy collection authority record PDA.
| `leaf_owner`                      |          |        |          | The cNFT owner.
| `leaf_delegate`                   |          |        |          | The cNFT delegate.
| `payer`                           |          |   ✅   |          | Payer.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `token_metadata_program`          |          |        |          | Metaplex `TokenMetadata` program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `data`                            | 0      | ~    | [`MetadataArgs`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/metaplex_adapter.rs#L81) object.

</details>


### 📄 `verify_creator` and `unverify_creator`

Verify or unverify a creator that exists in the cNFT's creators array.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | :------: | :----: | :------: | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |        |          | The cNFT owner.
| `leaf_delegate`                   |          |        |          | The cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `payer`                           |          |   ✅   |          | Payer.
| `creator`                         |          |   ✅   |          | The cNFT creator that is signing so that the creator is set to `verified` for the cNFT.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |          | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.


</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| ----------------------------------| ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.
| `data_hash`                       | 32     | 32   | The Keccak256 hash of the NFTs existing metadata (**without** the `verified` flag for the creator changed).  The metadata is retrieved from off-chain data store.
| `creator_hash`                    | 64     | 32   | The Keccak256 hash of the NFTs existing creators array (**without** the `verified` flag for the creator changed).  The creators array is retrieved from off-chain data store.
| `nonce`                           | 96     | 8    | A nonce ("number used once") value used to make the Merkle tree leaves unique.  This is the value of `num_minted` for the tree stored in the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) account at the time the cNFT was minted.  The unique value for each asset can be retrieved from off-chain data store.
| `index`                           | 104    | 4    | The index of the leaf node in the Merkle tree.  Can be retrieved from off-chain data store.
| `data`                            | 108    | ~    | [`MetadataArgs`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/metaplex_adapter.rs#L81) object (**without** the `verified` flag for the creator changed).  Can be retrieved from off-chain data store.

</details>

### 📄 `verify_collection`, `unverify_collection`, and `set_and_verify_collection`

Verify or unverify a cNFT as a member of a Metaplex [`Certified Collection`](https://docs.metaplex.com/programs/token-metadata/certified-collections) when the collection is already set in the Metadata.  Or set a new collection in the metadata and verify the cNFT as a member of the new collection.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| ----------------------------------| :------: | :----: | :------: | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |        |          | The cNFT owner.
| `leaf_delegate`                   |          |        |          | The cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `payer`                           |          |   ✅   |          | Payer.
| `tree_delegate`                   |          |  ❓✅  |          | The owner or delegate authority of the Merkle tree.  This account is checked to be a signer in the case of `set_and_verify_collection` where we are actually changily changing the cNFT metadata.
| `collection_authority`            |          |   ✅   |          | Either the collection update authority or a delegate.
| `collection_authority_record_pda` |          |        |    ✅    | Either a metadata delegate record PDA for a collection delegate, or a legacy collection authority record PDA.
| `collection_mint`                 |          |        |          | Mint account of the collection.
| `collection_metadata`             |   ❓✅   |        |          | Metadata account of the collection.  Modified in the case of a sized collection.
| `edition_account`                 |          |        |          | Master Edition account of the collection.
| `bubblegum_signer`                |          |        |          | Signing PDA used when doing a CPI into token-metadata to update the collection information.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `token_metadata_program`          |          |        |          | Metaplex `TokenMetadata` program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.
| `data_hash`                       | 32     | 32   | The Keccak256 hash of the NFTs existing metadata (**without** the `verified` flag for the creator changed).  The metadata is retrieved from off-chain data store.
| `creator_hash`                    | 64     | 32   | The Keccak256 hash of the NFTs existing creators array (**without** the `verified` flag for the creator changed).  The creators array is retrieved from off-chain data store.
| `nonce`                           | 96     | 8    | A nonce ("number used once") value used to make the Merkle tree leaves unique.  This is the value of `num_minted` for the tree stored in the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) account at the time the cNFT was minted.  The unique value for each asset can be retrieved from off-chain data store.
| `index`                           | 104    | 4    | The index of the leaf node in the Merkle tree.  Can be retrieved from off-chain data store.
| `data`                            | 108    | ~    | [`MetadataArgs`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/metaplex_adapter.rs#L81) object (**without** the `verified` flag for the collection changed).  Can be retrieved from off-chain data store.
| _collection_                      | ~      | 32   | Mint address of a new Collection cNFT.  **Note this is only an argument for `set_and_verify_collection`**

</details>

### 📄 `transfer`

Transfer a cNFT to a different owner.  When NFTs are transferred there is no longer a delegate authority.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | -------- | ------ | -------- | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |  ❓✅  |          | The cNFT owner.  Transfers must be signed by either the cNFT owner or cNFT delegate.
| `leaf_delegate`                   |          |  ❓✅  |          | The cNFT delegate.  Transfers must be signed by either the cNFT owner or cNFT delegate.
| `new_leaf_owner`                  |          |        |          | The wallet that will be the new cNFT owner.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.
| `data_hash`                       | 32     | 32   | The Keccak256 hash of the NFTs existing metadata (**without** the `verified` flag for the creator changed).  The metadata is retrieved from off-chain data store.
| `creator_hash`                    | 64     | 32   | The Keccak256 hash of the NFTs existing creators array (**without** the `verified` flag for the creator changed).  The creators array is retrieved from off-chain data store.
| `nonce`                           | 96     | 8    | A nonce ("number used once") value used to make the Merkle tree leaves unique.  This is the value of `num_minted` for the tree stored in the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) account at the time the cNFT was minted.  The unique value for each asset can be retrieved from off-chain data store.
| `index`                           | 104    | 4    | The index of the leaf node in the Merkle tree.  Can be retrieved from off-chain data store.

</details>

### 📄 `delegate`

Delegate authority of a cNFT to a different wallet.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | -------- | ------ | -------- | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |   ✅   |          | The cNFT owner.
| `previous_leaf_delegate`          |          |        |          | The previous cNFT delegate.
| `new_leaf_delegate`               |          |        |          | The wallet that will be the new cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.
| `data_hash`                       | 32     | 32   | The Keccak256 hash of the NFTs existing metadata (**without** the `verified` flag for the creator changed).  The metadata is retrieved from off-chain data store.
| `creator_hash`                    | 64     | 32   | The Keccak256 hash of the NFTs existing creators array (**without** the `verified` flag for the creator changed).  The creators array is retrieved from off-chain data store.
| `nonce`                           | 96     | 8    | A nonce ("number used once") value used to make the Merkle tree leaves unique.  This is the value of `num_minted` for the tree stored in the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) account at the time the cNFT was minted.  The unique value for each asset can be retrieved from off-chain data store.
| `index`                           | 104    | 4    | The index of the leaf node in the Merkle tree.  Can be retrieved from off-chain data store.

</details>

### 📄 `burn`

Burn a cNFT.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | -------- | ------ | -------- | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |  ❓✅  |          | The cNFT owner.  Burn must be signed by either the cNFT owner or cNFT delegate.
| `leaf_delegate`                   |          |  ❓✅  |          | The cNFT delegate.  Burn must be signed by either the cNFT owner or cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.
| `data_hash`                       | 32     | 32   | The Keccak256 hash of the NFTs existing metadata (**without** the `verified` flag for the creator changed).  The metadata is retrieved from off-chain data store.
| `creator_hash`                    | 64     | 32   | The Keccak256 hash of the NFTs existing creators array (**without** the `verified` flag for the creator changed).  The creators array is retrieved from off-chain data store.
| `nonce`                           | 96     | 8    | A nonce ("number used once") value used to make the Merkle tree leaves unique.  This is the value of `num_minted` for the tree stored in the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) account at the time the cNFT was minted.  The unique value for each asset can be retrieved from off-chain data store.
| `index`                           | 104    | 4    | The index of the leaf node in the Merkle tree.  Can be retrieved from off-chain data store.

</details>

### 📄 `redeem`

Redeem a cNFT (remove from tree and store in a voucher PDA).

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | -------- | ------ | -------- | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by lized by `create_tree`.
| `leaf_owner`                      |          |  ✅    |          | The cNFT owner.
| `leaf_delegate`                   |          |        |          | The cNFT delegate.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `voucher`                         |    ✅    |        |          | [`Voucher`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L36) PDA account that is initialized by this instruct instruction.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.
| `data_hash`                       | 32     | 32   | The Keccak256 hash of the NFTs existing metadata (**without** the `verified` flag for the creator changed).  The metadata is retrieved from off-chain data store.
| `creator_hash`                    | 64     | 32   | The Keccak256 hash of the NFTs existing creators array (**without** the `verified` flag for the creator changed).  The creators array is retrieved from off-chain data store.
| `nonce`                           | 96     | 8    | A nonce ("number used once") value used to make the Merkle tree leaves unique.  This is the value of `num_minted` for the tree stored in the [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) account at the time the cNFT was minted.  The unique value for each asset can be retrieved from off-chain data store.
| `index`                           | 104    | 4    | The index of the leaf node in the Merkle tree.  Can be retrieved from off-chain data store.

</details>

### 📄 `cancel_redeem`

Cancel the redemption of a cNFT (Put the cNFT back into the Merkle tree).

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| --------------------------------- | -------- | ------ | -------- | --
| `tree_authority`                  |    ✅    |        |          | The [`TreeConfig`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L17) PDA account previously initialized by `create_tree`.
| `leaf_owner`                      |          |  ✅    |          | The cNFT owner.
| `merkle_tree`                     |    ✅    |        |          | The account that contains the Merkle tree, initialized by `create_tree`.
| `voucher`                         |    ✅    |        |          | [`Voucher`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L36) PDA account previously initialized by `redeem`.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.
| `compression_program`             |          |        |          | The Solana Program Library spl-account-compression program ID.
| `system_program`                  |          |        |          | The Solana System Program ID.
| _remaining accounts_              |          |        |    ✅    | `Pubkeys`(s) that are 32-byte Keccak256 hash values that represent the nodes for this cNFT's Merkle proof.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `root`                            | 0      | 32   | The Merkle root for the tree.  Can be retrieved from off-chain data store.

</details>

### 📄 `decompress_v1`

Decompress a cNFT into an uncompressed Metaplex cNFT.  This will cost rent for the token-metadata Metadata and Master Edition accounts that are created.  Note that Merkle proofs are *not* required for decompression because the leaf (cNFT) was already removed from the tree.

<details>
  <summary>Accounts</summary>

| Name                              | Writable | Signer | Optional | Description
| ----------------------------------| :------: | :----: | :------: | --
| `voucher`                         |    ✅    |        |          | [`Voucher`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/mod.rs#L36) PDA account previously initialized by `redeem`.redeem`.
| `leaf_owner`                      |          |   ✅   |          | The cNFT owner.
| `token_account`                   |    ✅    |        |          | Token account for the cNFT.  This is created if it doesn't exist.
| `mint`                            |    ✅    |        |          | Mint PDA account for the cNFT.  This is created if it doesn't exist.
| `mint_authority`                  |          |        |          | PDA account for mint authority.
| `metadata`                        |    ✅    |        |          | New token-metadata Metadata account for the cNFT.  Initialized in Token Metadata Program.
| `master_edition`                  |    ✅    |        |          | New Master Edition account for the cNFT.  Initialized in Token Metadata Program
| `system_program`                  |          |        |          | The Solana System Program ID.
| `sysvar_rent`                     |          |        |          | `Rent` account.
| `token_metadata_program`          |          |        |          | Metaplex `TokenMetadata` program ID.
| `token_program`                   |          |        |          | Solana Program Library spl-token program ID.
| `associated_token_program`        |          |        |          | Solana Program Library spl-associated-token-account program ID.
| `log_wrapper`                     |          |        |          | The Solana Program Library Wrapper (spl-noop) program ID.

</details>

<details>
  <summary>Arguments</summary>

| Argument                          | Offset | Size | Description
| --------------------------------- | ------ | ---- | --
| `data`                            | 0      | ~    | [`MetadataArgs`](https://github.com/metaplex-foundation/metaplex-program-library/blob/master/bubblegum/program/src/state/metaplex_adapter.rs#L81) object.

</details>
