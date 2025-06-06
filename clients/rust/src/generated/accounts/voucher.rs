//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::LeafSchema;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct Voucher {
    pub discriminator: [u8; 8],
    pub leaf_schema: LeafSchema,
    pub index: u32,
    #[cfg_attr(
        feature = "serde",
        serde(with = "serde_with::As::<serde_with::DisplayFromStr>")
    )]
    pub merkle_tree: Pubkey,
}

impl Voucher {
    pub fn create_pda(
        merkle_tree: Pubkey,
        nonce: u64,
        bump: u8,
    ) -> Result<solana_program::pubkey::Pubkey, solana_program::pubkey::PubkeyError> {
        solana_program::pubkey::Pubkey::create_program_address(
            &[
                "voucher".as_bytes(),
                merkle_tree.as_ref(),
                nonce.to_string().as_ref(),
                &[bump],
            ],
            &crate::MPL_BUBBLEGUM_ID,
        )
    }

    pub fn find_pda(merkle_tree: &Pubkey, nonce: u64) -> (solana_program::pubkey::Pubkey, u8) {
        solana_program::pubkey::Pubkey::find_program_address(
            &[
                "voucher".as_bytes(),
                merkle_tree.as_ref(),
                nonce.to_string().as_ref(),
            ],
            &crate::MPL_BUBBLEGUM_ID,
        )
    }

    #[inline(always)]
    pub fn from_bytes(data: &[u8]) -> Result<Self, std::io::Error> {
        let mut data = data;
        Self::deserialize(&mut data)
    }
}

impl<'a> TryFrom<&solana_program::account_info::AccountInfo<'a>> for Voucher {
    type Error = std::io::Error;

    fn try_from(
        account_info: &solana_program::account_info::AccountInfo<'a>,
    ) -> Result<Self, Self::Error> {
        let mut data: &[u8] = &(*account_info.data).borrow();
        Self::deserialize(&mut data)
    }
}
