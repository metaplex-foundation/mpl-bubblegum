#!/bin/bash

CURRENT_DIR=$(pwd)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
# go to parent folder
cd $(dirname $(dirname $SCRIPT_DIR))

OUTPUT=$1
EXTERNAL_ID=("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK" "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV")
EXTERNAL_SO=("mpl_token_metadata.so" "spl_account_compression.so" "spl_noop.so")

if [ -z ${RPC+x} ]; then
    RPC="https://api.mainnet-beta.solana.com"
fi

if [ -z "$OUTPUT" ]; then
    echo "missing output directory"
    exit 1
fi

# creates the output directory if it doesn't exist
if [ ! -d ${OUTPUT} ]; then
    mkdir ${OUTPUT}
fi

# dump external programs binaries if needed
for i in ${!EXTERNAL_ID[@]}; do
    if [ ! -f "${OUTPUT}/${EXTERNAL_SO[$i]}" ]; then
        solana program dump -u $RPC ${EXTERNAL_ID[$i]} ${OUTPUT}/${EXTERNAL_SO[$i]}
    fi
done

cd ${CURRENT_DIR}
