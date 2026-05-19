#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
OUTPUT="./programs/.bin"
# saves external programs binaries to the output directory
"${SCRIPT_DIR}/dump.sh" "${OUTPUT}"

# Dump programs currently on devnet only
"${SCRIPT_DIR}/dump_devnet.sh" "${OUTPUT}"

# go to parent folder
cd "$(dirname "$(dirname "$(dirname "${SCRIPT_DIR}")")")"

if [ -z "${PROGRAMS+x}" ]; then
    PROGRAMS="$(grep "^PROGRAMS=" .github/.env | cut -d '=' -f 2)"
fi

# default to input from the command-line
ARGS=("$@")

# command-line arguments override env variable
if [ ${#ARGS[@]} -gt 0 ]; then
    PROGRAMS="[\"${1}\"]"
    shift
    ARGS=("$@")
fi

# parse the JSON array into a bash array
PROGRAM_LINES="$(
    printf '%s\n' "${PROGRAMS}" |
        jq -cer 'if type == "array" and length > 0 then .[] else error("PROGRAMS must be a non-empty JSON array") end'
)"
PROGRAM_LIST=()
while IFS= read -r program; do
    PROGRAM_LIST+=("${program}")
done <<EOF
${PROGRAM_LINES}
EOF

# creates the output directory if it doesn't exist
mkdir -p "${OUTPUT}"

WORKING_DIR=$(pwd)
BASE_IMAGE_ARGS=()

if [ -n "${SOLANA_VERIFY_BASE_IMAGE:-}" ]; then
    BASE_IMAGE_ARGS=(--base-image "${SOLANA_VERIFY_BASE_IMAGE}")
fi

resolve_workspace_dir() {
    local program_dir="$1"
    local workspace_dir="${WORKING_DIR}/programs/${program_dir}"

    if [ ! -f "${workspace_dir}/Cargo.toml" ]; then
        echo "error: missing Cargo workspace for program '${program_dir}'" >&2
        exit 1
    fi

    echo "${workspace_dir}"
}

resolve_program_cargo_toml() {
    local program_dir="$1"
    local nested_cargo_toml="${WORKING_DIR}/programs/${program_dir}/program/Cargo.toml"
    local workspace_cargo_toml="${WORKING_DIR}/programs/${program_dir}/Cargo.toml"

    if [ -f "${nested_cargo_toml}" ]; then
        echo "${nested_cargo_toml}"
    else
        echo "${workspace_cargo_toml}"
    fi
}

resolve_library_name() {
    local program_dir="$1"
    local cargo_toml="$2"
    local lib_name=""

    lib_name=$(awk '
        /^\[lib\]/ { in_lib = 1; next }
        /^\[/      { in_lib = 0 }
        in_lib && /^[[:space:]]*name[[:space:]]*=/ {
            sub(/#.*/, "", $0)
            gsub(/[" ]/, "", $0)
            split($0, parts, "=")
            print parts[2]
            exit
        }
    ' "${cargo_toml}")

    if [ -z "${lib_name}" ]; then
        lib_name="${program_dir//-/_}"
    fi

    echo "${lib_name}"
}

resolve_package_name() {
    local program_dir="$1"
    local cargo_toml="$2"
    local package_name=""

    package_name=$(awk '
        /^\[package\]/ { in_package = 1; next }
        /^\[/         { in_package = 0 }
        in_package && /^[[:space:]]*name[[:space:]]*=/ {
            sub(/#.*/, "", $0)
            gsub(/[" ]/, "", $0)
            split($0, parts, "=")
            print parts[2]
            exit
        }
    ' "${cargo_toml}")

    if [ -z "${package_name}" ]; then
        package_name="${program_dir}-program"
    fi

    echo "${package_name}"
}

for p in "${PROGRAM_LIST[@]}"; do
    WORKSPACE_DIR=$(resolve_workspace_dir "${p}")
    CARGO_TOML=$(resolve_program_cargo_toml "${p}")
    LIB_NAME=$(resolve_library_name "${p}" "${CARGO_TOML}")
    PACKAGE_NAME=$(resolve_package_name "${p}" "${CARGO_TOML}")

    echo "Building verified program: ${p} (library: ${LIB_NAME}, package: ${PACKAGE_NAME})"

    # `solana-verify build` runs the build inside a deterministic docker image
    # so the resulting .so hash matches a remote verification of the same
    # source. Bubblegum's Cargo workspace lives under programs/bubblegum, so the
    # build must run from that directory instead of the repository root.
    (
        cd "${WORKSPACE_DIR}"
        solana-verify build "${BASE_IMAGE_ARGS[@]}" --library-name "${LIB_NAME}" -- --package "${PACKAGE_NAME}" ${ARGS[@]+"${ARGS[@]}"}
    )

    cp "${WORKSPACE_DIR}/target/deploy/${LIB_NAME}.so" "${WORKING_DIR}/${OUTPUT}/${LIB_NAME}.so"
done
