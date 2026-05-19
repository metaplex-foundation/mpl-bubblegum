#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR=$(dirname "$(dirname "$(dirname "${SCRIPT_DIR}")")")

fail() {
    echo "error: $*" >&2
    exit 1
}

assert_file_exists() {
    local file="$1"

    [ -f "${ROOT_DIR}/${file}" ] || fail "expected ${file} to exist"
}

assert_executable() {
    local file="$1"

    [ -x "${ROOT_DIR}/${file}" ] || fail "expected ${file} to be executable"
}

assert_contains() {
    local file="$1"
    local pattern="$2"
    local description="$3"

    grep -Eq -- "${pattern}" "${ROOT_DIR}/${file}" || fail "expected ${file} to contain ${description}"
}

assert_file_exists ".github/workflows/verify-program.yml"
assert_file_exists "configs/scripts/program/verify-from-repo.sh"
assert_executable "configs/scripts/program/verify-from-repo.sh"

bash -n "${ROOT_DIR}/configs/scripts/program/build.sh"
bash -n "${ROOT_DIR}/configs/scripts/program/verify-from-repo.sh"

assert_contains ".github/.env" "^SOLANA_VERIFY_VERSION=" "a pinned solana-verify version"
assert_contains ".github/.env" "^SOLANA_VERIFY_RUST_VERSION=" "a pinned solana-verify Rust version"
assert_contains ".github/.env" "^SOLANA_VERIFY_BASE_IMAGE=" "a pinned solana-verify base image"
assert_contains "configs/scripts/program/build.sh" "solana-verify build" "deterministic solana-verify builds"
assert_contains "configs/scripts/program/build.sh" "--base-image" "base image forwarding"
assert_contains "configs/scripts/program/build.sh" "programs/\\$\\{program_dir\\}/program/Cargo.toml" "Bubblegum program Cargo.toml discovery"
assert_contains "configs/scripts/program/verify-from-repo.sh" "LIBRARY_NAME=\"bubblegum\"" "Bubblegum library default"
assert_contains "configs/scripts/program/verify-from-repo.sh" "MOUNT_PATH=\"programs/bubblegum\"" "Bubblegum workspace mount default"
assert_contains "configs/scripts/program/verify-from-repo.sh" "PACKAGE_NAME=\"bubblegum\"" "Bubblegum package default"
assert_contains "configs/scripts/program/verify-from-repo.sh" "--package" "package verification argument"
assert_contains "package.json" "\"programs:verify\"" "program verification npm script"
assert_contains ".github/workflows/verify-program.yml" "solana-verify export-pda-tx" "Squads PDA transaction export"
assert_contains ".github/workflows/verify-program.yml" "SQUADS_VAULT" "Squads vault uploader"
assert_contains ".github/workflows/verify-program.yml" "submit_remote_job" "remote verification submission gate"
assert_contains ".github/workflows/verify-program.yml" "solana-verify remote submit-job" "remote verification job submission"
