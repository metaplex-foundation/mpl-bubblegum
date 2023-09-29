<h1>
  Metaplex Bubblegum SDK
</h1>
<p>
  Rust library for interacting with <a href="https://github.com/metaplex-foundation/mpl-bubblegum">Metaplex Bublegum</a> program.
</p>

## Getting started

From your project folder:

```bash
cargo add mpl-bubblegum
```

> **Note**
> If you are using a `solana-program` version prior to `1.16`, first add the `solana-program` dependency to your project and then add `mpl-bubblegum`. This will make sure you only have a single copy of the `borsh` crate.

## Structure

The client SDK is divided into several modules:

- `accounts`: structs representing the accounts of the program
- `errors`: enums representing the program errors
- `instructions`: structs to facilitate the creation of instructions, instruction arguments and CPI instructions
- `types`: structs representing types used by the program

## Instruction Builders

One of the main features of the client SDK is to facilitate the creation of instructions. There are two "types" of instruction builders automatically generated – both support passing accounts by name and optional positional.

### _Client_ instruction builders

This are intended to be used by off-chain client code. Each instruction is represented by a corresponding struct – e.g., `MintV1`:

```rust
pub struct MintV1 {
    pub tree_config: solana_program::pubkey::Pubkey,

    pub leaf_owner: solana_program::pubkey::Pubkey,

    pub leaf_delegate: solana_program::pubkey::Pubkey,

    pub merkle_tree: solana_program::pubkey::Pubkey,

    pub payer: solana_program::pubkey::Pubkey,

    pub tree_creator_or_delegate: solana_program::pubkey::Pubkey,

    pub log_wrapper: solana_program::pubkey::Pubkey,

    pub compression_program: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,
}
```

After filling in the instruction account fields, you can use the `instruction(...)` method to generate the corresponding `solana_program::instruction::Instruction`:

```rust
// instruction args
let metadata = MetadataArgs {
    name,
    uri,
    creators,
    ...
};

// instruction accounts
let mint_ix = MintV1 {
    tree_config,
    leaf_owner,
    leaf_delegate,
    merkle_tree,
    payer,
    tree_creator_or_delegate,
    log_wrapper: spl_noop::ID,
    compression_program: spl_account_compression::ID,
    system_program: system_program::ID,
};

// creates the instruction
let create_ix = create_ix.instruction(
    MintV1InstructionArgs {
        metadata,
    });
```

Alternatively, you can use the `MintV1Builder` to create the appropriate instruction:

```rust
let mint_ix = MintV1Builder::new()
    .tree_config(tree_config)
    .leaf_owner(leaf_owner)
    .leaf_delegate(leaf_delegate)
    .merkle_tree(merkle_tree)
    .payer(payer_pubkey)
    .tree_creator_or_delegate(tree_creator)
    .metadata(metadata)
    .instruction();
```

### _CPI_ instruction builders

These are builders to be used by on-chain code, which will CPI into Bubblegum. Similarly to "off-chain" builders, each instruction has a struct to invoke CPI instructions – e.g., `MintV1Cpi`:

```rust
pub struct MintV1Cpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub tree_config: &'b solana_program::account_info::AccountInfo<'a>,

    pub leaf_owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub leaf_delegate: &'b solana_program::account_info::AccountInfo<'a>,

    pub merkle_tree: &'b solana_program::account_info::AccountInfo<'a>,

    pub payer: &'b solana_program::account_info::AccountInfo<'a>,

    pub tree_creator_or_delegate: &'b solana_program::account_info::AccountInfo<'a>,

    pub log_wrapper: &'b solana_program::account_info::AccountInfo<'a>,

    pub compression_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: MintV1InstructionArgs,
}
```

After filling in the program, instruction accounts and argument fields, you can use the `invoke()` or `invoke_signed(...)` method to perform the CPI:

```rust
// instruction args
let metadata = MetadataArgs {
    name,
    uri,
    creators,
    ...
    };

// instruction accounts
let cpi_mint = MintV1Cpi::new(
    bubblegum_info,
    MintV1CpiAccounts {
        compression_program: spl_account_compression_info,
        leaf_delegate: authority_info,
        leaf_owner: authority_info,
        log_wrapper: spl_noop_info,
        merkle_tree: merkle_tree_info,
        payer: payer_info,
        system_program: system_program_info,
        tree_config: tree_config_info,
        tree_creator_or_delegate: delegate_info,
    },
    MintV1InstructionArgs { metadata },
);

// performs the CPI
cpi_mint.invoke_signed(&[&signer_seeds])
```

You can also use the `MintV1CpiBuilder` to simplify the process:

```rust
let cpi_mint = MintV1CpiBuilder::new(ctx.accounts.bubblegum)
    .compression_program(compression_program_info)
    .leaf_delegate(leaf_delegate_info)
    .leaf_owner(leaf_owner_info)
    .log_wrapper(log_wrapper_info)
    .merkle_tree(merkle_tree_info)
    .payer(payer_info)
    .system_program(system_program_info)
    .tree_config(tree_config_info)
    .metadata(metadata);

// performs the CPI
cpi_mint.invoke_signed(&[&signer_seeds])
```

> **Note** > `*Builder` provide a simplified way to create the required structs, since they take advantage of any default value set on the Kinobi config and do not require to set a `None` value to optional fields.

## PDA helpers

Account types (e.g., `TreeConfig`) have associated functions to find PDA or to create PDA `TreeConfig`s:

```rust
impl TreeConfig {
    pub fn create_pda(
        merkle_tree: Pubkey,
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &[merkle_tree.as_ref(), &[bump]],
            &crate::MPL_BUBBLEGUM_ID,
        )
    }

    pub fn find_pda(merkle_tree: &Pubkey) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &[merkle_tree.as_ref()],
            &crate::MPL_BUBBLEGUM_ID,
        )
    }
}
```

> If a bump seed is known, it is _cheaper_ (in terms of compute units) to use the `create_pda` function, in particular for on-chain code.

## Testing

To run the SDK tests, run the following from the root directory of the repository:

```bash
pnpm install
```

and then:

```bash
pnpm clients:rust:test
```

## Documentation

The crate documentation can be found [here](https://docs.rs/mpl-bubblegum/latest/mpl_bubblegum/).