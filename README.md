<h1 align="center">
 Primitives Protocol 
</h1>
<p>
  Create and manage compressed NFTs on Solana. Compressed NFTs make it possible to scale the creation of NFTs to new orders of magnitude by rethinking the way we store data on-chain.
</p>
<p align="center">
  <img width="600" alt="Primitives Protocol" src="graph.jpeg" />
</p>

## Getting Started

The packages below can be use to interact with the Protractor program.

### TypeScript

```sh
npm install @metaplex-foundation/mpl-bubblegum
```

[See typedoc documentation](https://mpl-bubblegum-js-docs.vercel.app/).

### Rust

```sh
cargo add mpl-bubblegum
```

[See crate documentation](https://docs.rs/mpl-bubblegum/latest/mpl_bubblegum/).

## Documentation

Developer documentation for Bubblegum can be found [here](https://developers.metaplex.com/bubblegum).

## Building

From the root directory of the repository:

- Install the required packges:

```sh
pnpm install
```

- Build the program:

```sh
pnpm programs:build
```

This will create the program binary at `<ROOT>/programs/.bin`

## Testing

Bubblegum includes two set of tests: BPF and TypeScript.

### BPF

From the root directory of the repository:

```sh
pnpm programs:test
```

### TypeScript

From the root directory of the repository:

```sh
pnpm validator
```

This will start a local validator using [Amman](https://github.com/metaplex-foundation/amman).

After starting the validator, go to the folder `<ROOT>/clients/js` and run:

```sh
pnpm install
```

This will install the required packages for the tests. Then, run:

```sh
pnpm build && pnpm test
```

## Security

To report a security issue, please follow the guidance on our [bug bounty program](https://www.metaplex.com/bounty-program) page.

## License

The Rust/Cargo programs are licensed under the
"Apache-style" [Metaplex(TM) NFT Open Source License](https://github.com/metaplex-foundation/mpl-token-metadata/blob/master/LICENSE) and the JS/TS client libraries are licensed
under either the [MIT](https://www.mit.edu/~amini/LICENSE.md) or the [Apache](https://www.apache.org/licenses/LICENSE-2.0.txt) licenses.

## Contributing

Check out the [Contributing Guide](./CONTRIBUTING.md) the learn more about how to contribute to this project.
