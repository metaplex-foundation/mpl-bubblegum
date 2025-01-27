#!/bin/bash

EXTERNAL_ID_MAINNET=("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK" "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV")
EXTERNAL_SO_MAINNET=("mpl_token_metadata.so" "spl_account_compression.so" "spl_noop.so")
EXTERNAL_ID_DEVNET=("mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW" "mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3")
EXTERNAL_SO_DEVNET=("mpl_account_compression.so" "mpl_noop.so")

# output colours
RED() { echo $'\e[1;31m'$1$'\e[0m'; }
GRN() { echo $'\e[1;32m'$1$'\e[0m'; }
YLW() { echo $'\e[1;33m'$1$'\e[0m'; }

CURRENT_DIR=$(pwd)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
# go to parent folder
cd $(dirname $(dirname $(dirname $SCRIPT_DIR)))

OUTPUT=$1

RPC_MAINNET="https://api.mainnet-beta.solana.com"
RPC_DEVNET="https://api.devnet.solana.com"

if [ -z "$OUTPUT" ]; then
    echo "missing output directory"
    cd ${CURRENT_DIR}
    exit 1
fi

# creates the output directory if it doesn't exist
if [ ! -d ${OUTPUT} ]; then
    mkdir ${OUTPUT}
fi

# copy external programs or accounts binaries from the chain
copy_from_chain() {
    RPC=$1
    ACCOUNT_ID=$2
    ACCOUNT_TYPE=`echo $3 | cut -d. -f2`
    PREFIX=$4

    case "$ACCOUNT_TYPE" in
        "bin")
            solana account -u "$RPC" "$ACCOUNT_ID" -o ${OUTPUT}/$4$3 > /dev/null || {
                echo $(RED "[  ERROR  ] Failed to dump program '$ACCOUNT_ID'")
                cd ${CURRENT_DIR}
                exit 1
            }
            ;;
        "so")
            solana program dump -u "$RPC" "$ACCOUNT_ID" ${OUTPUT}/$4$3 > /dev/null || {
                echo $(RED "[  ERROR  ] Failed to dump program '$ACCOUNT_ID'")
                cd ${CURRENT_DIR}
                exit 1
            }
            ;;
        *)
            echo $(RED "[  ERROR  ] unknown account type for '$3'")
            cd ${CURRENT_DIR}
            exit 1
            ;;
    esac

    if [ -z "$PREFIX" ]; then
        echo "Wrote account data to ${OUTPUT}/$4$3"
    fi
}

# only prints this if we have mainnet external programs
if [ ${#EXTERNAL_ID_MAINNET[@]} -gt 0 ]; then
    echo "Dumping external accounts from mainnet to '${OUTPUT}':"
fi

# dump mainnet external programs binaries if needed
for i in ${!EXTERNAL_ID_MAINNET[@]}; do
    if [ ! -f "${OUTPUT}/${EXTERNAL_SO_MAINNET[$i]}" ]; then
        copy_from_chain $RPC_MAINNET "${EXTERNAL_ID_MAINNET[$i]}" "${EXTERNAL_SO_MAINNET[$i]}"
    else
        copy_from_chain $RPC_MAINNET "${EXTERNAL_ID_MAINNET[$i]}" "${EXTERNAL_SO_MAINNET[$i]}" "onchain-"

        ON_CHAIN=`sha256sum -b ${OUTPUT}/onchain-${EXTERNAL_SO_MAINNET[$i]} | cut -d ' ' -f 1`
        LOCAL=`sha256sum -b ${OUTPUT}/${EXTERNAL_SO_MAINNET[$i]} | cut -d ' ' -f 1`

        if [ "$ON_CHAIN" != "$LOCAL" ]; then
            echo $(YLW "[ WARNING ] on-chain and local binaries are different for '${EXTERNAL_SO_MAINNET[$i]}'")
        else
            echo "$(GRN "[ SKIPPED ]") on-chain and local binaries are the same for '${EXTERNAL_SO_MAINNET[$i]}'"
        fi

        rm ${OUTPUT}/onchain-${EXTERNAL_SO_MAINNET[$i]}
    fi
done

# only prints this if we have devnet external programs
if [ ${#EXTERNAL_ID_DEVNET[@]} -gt 0 ]; then
    echo ""
    echo "Dumping external accounts from devnet to '${OUTPUT}':"
fi

# dump devnet external programs binaries if needed
for i in ${!EXTERNAL_ID_DEVNET[@]}; do
    if [ ! -f "${OUTPUT}/${EXTERNAL_SO_DEVNET[$i]}" ]; then
        copy_from_chain $RPC_DEVNET "${EXTERNAL_ID_DEVNET[$i]}" "${EXTERNAL_SO_DEVNET[$i]}"
    else
        copy_from_chain $RPC_DEVNET "${EXTERNAL_ID_DEVNET[$i]}" "${EXTERNAL_SO_DEVNET[$i]}" "onchain-"

        ON_CHAIN=`sha256sum -b ${OUTPUT}/onchain-${EXTERNAL_SO_DEVNET[$i]} | cut -d ' ' -f 1`
        LOCAL=`sha256sum -b ${OUTPUT}/${EXTERNAL_SO_DEVNET[$i]} | cut -d ' ' -f 1`

        if [ "$ON_CHAIN" != "$LOCAL" ]; then
            echo $(YLW "[ WARNING ] on-chain and local binaries are different for '${EXTERNAL_SO_DEVNET[$i]}'")
        else
            echo "$(GRN "[ SKIPPED ]") on-chain and local binaries are the same for '${EXTERNAL_SO_DEVNET[$i]}'"
        fi

        rm ${OUTPUT}/onchain-${EXTERNAL_SO_DEVNET[$i]}
    fi
done

# only prints this if we have external programs
if [ ${#EXTERNAL_ID_MAINNET[@]} -gt 0 ] || [ ${#EXTERNAL_ID_DEVNET[@]} -gt 0 ]; then
    echo ""
fi

cd ${CURRENT_DIR}
