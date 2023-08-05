import { PublicKey, publicKey, publicKeyBytes } from '@metaplex-foundation/umi';
import { keccak_256 } from '@noble/hashes/sha3';
import { MerkleTree } from 'merkletreejs';

/**
 * Creates a Merkle Tree from the provided data.
 */
const getMerkleTree = (leaves: PublicKey[], maxDepth: number): MerkleTree =>
  new MerkleTree(
    [
      ...leaves.map((leaf) => publicKeyBytes(leaf)),
      ...Array(2 ** maxDepth - leaves.length)
        .fill(0)
        .map(() => new Uint8Array(32).fill(0)),
    ],
    keccak_256
  );

/**
 * Creates a Merkle Root from the provided data.
 *
 * This root provides a short identifier for the
 * provided data that is unique and deterministic.
 * This means, we can use this root to verify that
 * a given data is part of the original data set.
 */
export const getMerkleRoot = (
  leaves: PublicKey[],
  maxDepth: number
): PublicKey => publicKey(getMerkleTree(leaves, maxDepth).getRoot());

/**
 * Creates a Merkle Proof for a given data item.
 *
 * This proof can be used to verify that the given
 * data item is part of the original data set.
 */
export const getMerkleProof = (
  leaves: PublicKey[],
  maxDepth: number,
  leaf: PublicKey,
  index?: number
): PublicKey[] =>
  getMerkleTree(leaves, maxDepth)
    .getProof(Buffer.from(publicKeyBytes(leaf)), index)
    .map((proofItem) => publicKey(proofItem.data));

/**
 * Creates a Merkle Proof for a data item at a given index.
 *
 * This proof can be used to verify that the data item at
 * the given index is part of the original data set.
 */
export const getMerkleProofAtIndex = (
  leaves: PublicKey[],
  maxDepth: number,
  index: number
): PublicKey[] => getMerkleProof(leaves, maxDepth, leaves[index], index);
