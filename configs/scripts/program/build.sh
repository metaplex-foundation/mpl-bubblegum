#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
OUTPUT="./programs/.bin"

# go to parent folder
cd "$(dirname "$(dirname "$(dirname "${SCRIPT_DIR}")")")"

# saves external programs binaries to the output directory
"${SCRIPT_DIR}/dump.sh" "${OUTPUT}"

# Dump programs currently on devnet only
"${SCRIPT_DIR}/dump_devnet.sh" "${OUTPUT}"

if [ -z "${PROGRAMS+x}" ]; then
    PROGRAMS="$(grep "^PROGRAMS=" .github/.env | cut -d '=' -f 2)"
fi

# default to input from the command-line
ARGS=("$@")

# command-line arguments override env variable
if [ $# -gt 0 ]; then
    PROGRAMS="[\"${1}\"]"
    shift
    ARGS=("$@")
fi

PROGRAMS=$(printf '%s\n' "${PROGRAMS}" | jq -c '.[]' | sed 's/"//g')

# creates the output directory if it doesn't exist
if [ ! -d "${OUTPUT}" ]; then
    mkdir "${OUTPUT}"
fi

WORKING_DIR=$(pwd)
export SBF_OUT_DIR="${WORKING_DIR}/${OUTPUT}"

while IFS= read -r p; do
    cd "${WORKING_DIR}/programs/${p}/program"
    cargo build-sbf --sbf-out-dir "${WORKING_DIR}/${OUTPUT}" ${ARGS[@]+"${ARGS[@]}"}
done <<< "${PROGRAMS}"
