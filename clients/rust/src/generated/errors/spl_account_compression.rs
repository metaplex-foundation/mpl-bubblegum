//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use num_derive::FromPrimitive;
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum SplAccountCompressionError {
    /// 6000 (0x1770) - Incorrect leaf length. Expected vec of 32 bytes
    #[error("Incorrect leaf length. Expected vec of 32 bytes")]
    IncorrectLeafLength,
    /// 6001 (0x1771) - Concurrent merkle tree error
    #[error("Concurrent merkle tree error")]
    ConcurrentMerkleTreeError,
    /// 6002 (0x1772) - Issue zero copying concurrent merkle tree data
    #[error("Issue zero copying concurrent merkle tree data")]
    ZeroCopyError,
    /// 6003 (0x1773) - An unsupported max depth or max buffer size constant was provided
    #[error("An unsupported max depth or max buffer size constant was provided")]
    ConcurrentMerkleTreeConstantsError,
    /// 6004 (0x1774) - Expected a different byte length for the merkle tree canopy
    #[error("Expected a different byte length for the merkle tree canopy")]
    CanopyLengthMismatch,
    /// 6005 (0x1775) - Provided authority does not match expected tree authority
    #[error("Provided authority does not match expected tree authority")]
    IncorrectAuthority,
    /// 6006 (0x1776) - Account is owned by a different program, expected it to be owned by this program
    #[error("Account is owned by a different program, expected it to be owned by this program")]
    IncorrectAccountOwner,
    /// 6007 (0x1777) - Account provided has incorrect account type
    #[error("Account provided has incorrect account type")]
    IncorrectAccountType,
    /// 6008 (0x1778) - Leaf index of concurrent merkle tree is out of bounds
    #[error("Leaf index of concurrent merkle tree is out of bounds")]
    LeafIndexOutOfBounds,
    /// 6009 (0x1779) - Tree was initialized without allocating space for the canopy
    #[error("Tree was initialized without allocating space for the canopy")]
    CanopyNotAllocated,
    /// 6010 (0x177A) - Tree was already initialized
    #[error("Tree was already initialized")]
    TreeAlreadyInitialized,
    /// 6011 (0x177B) - Tree header was not initialized for batch processing
    #[error("Tree header was not initialized for batch processing")]
    BatchNotInitialized,
    /// 6012 (0x177C) - Canopy root does not match the root of the tree
    #[error("Canopy root does not match the root of the tree")]
    CanopyRootMismatch,
    /// 6013 (0x177D) - Canopy contains nodes to the right of the rightmost leaf of the tree
    #[error("Canopy contains nodes to the right of the rightmost leaf of the tree")]
    CanopyRightmostLeafMismatch,
}

impl solana_program::program_error::PrintProgramError for SplAccountCompressionError {
    fn print<E>(&self) {
        solana_program::msg!(&self.to_string());
    }
}
