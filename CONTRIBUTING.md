# Contributing to Metaplex Bubblegum

This is a quick guide to help you contribute to Metaplex Bubblegum.

## Getting started

The root folder has a private `package.json` containing a few scripts and JavaScript dependencies that help generate IDLs; clients and start a local validator. First, [ensure you have pnpm installed](https://pnpm.io/installation) and run the following command to install the dependencies.

```sh
pnpm install
```

You will then have access to the following commands.

- `pnpm programs:build` - Builds all programs.
- `pnpm programs:test` - Runs BPF tests for all programs (logs disabled).
- `pnpm programs:debug` - Runs BPF tests for all programs.
- `pnpm programs:clean` - Deletes all generated program binaries.
- `pnpm clients:rust:test` - Runs BPF tests for the Rust client SDK.
- `pnpm clients:js:test` - Runs the JavaScript tests (you must first start the local validator `pnpm validator`).
- `pnpm generate` - Shortcut for `pnpm generate:idls && pnpm generate:clients`.
- `pnpm generate:idls` - Generate IDLs for all programs, as configured in the `configs/shank.cjs` file.
- `pnpm generate:clients` - Generate clients using Kinobi, as configured in the `configs/kinobi.cjs` file.
- `pnpm validator` - Start a local validator using Amman, as configured in the `configs/validator.cjs` file (logs disabled).
- `pnpm validator:debug` - Start a local validator using Amman, as configured in the `configs/validator.cjs` file.
- `pnpm validator:stop` - Stop the local validator.
- `pnpm validator:logs` - Show the logs of the local validator.

## Managing clients

Each client has its own README with instructions on how to get started. You can find them in the `clients` folder.

- [JavaScript client](./clients/js/README.md)
- [Rust client](./clients/rust/README.md)

## Setting up CI/CD using GitHub actions

Most of the CI/CD should already be set up for you and the `.github/.env` file can be used to tweak the variables of the workflows.

However, the "Deploy JS Client" workflow — configured in `.github/workflows/deploy-js.yml` — requires a few more steps to work. See the [CONTRIBUTING.md file of the JavaScript client](./clients/js/CONTRIBUTING.md#setting-up-github-actions) for more information.
