#!/bin/bash

# Build the Bubblegum program
./configs/scripts/program/build.sh

# Build the Account Compression program

# Variables
REPO_URL="git@github.com:StanChe/solana-program-library.git"
REPO_DIR="solana-program-library"
BRANCH="feature/init_with_root"
SUBDIR="account-compression/programs/account-compression"
TARGET_FILE="solana-program-library/account-compression/target/deploy/spl_account_compression.so"
DEST_FILE="./programs/.bin/spl_account_compression.so"
# Save the current directory 
SCRIPT_DIR=$(pwd)
pushd $SCRIPT_DIR

# Clone the repository if it does not exist
if [ ! -d "$REPO_DIR" ]; then
  git clone $REPO_URL
fi
cd $REPO_DIR

# Fetch the latest changes and checkout the specified branch
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Navigate to the subdirectory
cd $SUBDIR

# Execute the build command
cargo build-bpf

# Create the destination directory if it doesn't exist
popd

# Move the file to the destination directory
mv -f $TARGET_FILE $DEST_FILE
