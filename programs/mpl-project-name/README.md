# Mpl Project Name

My project description

## Building

This will build the program and output a `.so` file in a non-comitted `target/deploy` directory which is used by the `config/shank.cjs` configuration file to start a new local validator with the latest changes on the program.

```sh
cargo build-bpf
```

## Testing

You may run the following command to build the program and run its Rust tests.

```sh
cargo test-bpf
```
