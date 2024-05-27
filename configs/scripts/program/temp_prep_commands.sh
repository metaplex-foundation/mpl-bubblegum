#!/bin/bash

# Build the Bubblegum program
./configs/scripts/program/build.sh

# Build the Account Compression program
cd solana-program-library/account-compression/programs/account-compression/ && cargo build-bpf

# Move back to the root
cd ../../../../

# Remove the existing binary, if it exists
rm ./programs/.bin/spl_account_compression.so

# Move the newly built binary to the expected location
mv solana-program-library/account-compression/target/deploy/spl_account_compression.so ./programs/.bin/