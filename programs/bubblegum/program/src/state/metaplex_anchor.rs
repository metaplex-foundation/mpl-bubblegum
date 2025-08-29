use anchor_lang::{prelude::*, solana_program::pubkey::Pubkey};
use std::ops::Deref;

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct MasterEdition(mpl_token_metadata::accounts::MasterEdition);

impl anchor_lang::AccountDeserialize for MasterEdition {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        mpl_token_metadata::accounts::MasterEdition::safe_deserialize(buf)
            .map(MasterEdition)
            .map_err(Into::into)
    }
}

impl anchor_lang::AccountSerialize for MasterEdition {}

impl anchor_lang::Owner for MasterEdition {
    fn owner() -> Pubkey {
        mpl_token_metadata::ID
    }
}

impl Deref for MasterEdition {
    type Target = mpl_token_metadata::accounts::MasterEdition;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone, AnchorDeserialize, AnchorSerialize)]
pub struct TokenMetadata(mpl_token_metadata::accounts::Metadata);

impl anchor_lang::AccountDeserialize for TokenMetadata {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        mpl_token_metadata::accounts::Metadata::safe_deserialize(buf)
            .map(TokenMetadata)
            .map_err(Into::into)
    }
}

impl anchor_lang::AccountSerialize for TokenMetadata {}

impl anchor_lang::Owner for TokenMetadata {
    fn owner() -> Pubkey {
        mpl_token_metadata::ID
    }
}

impl Deref for TokenMetadata {
    type Target = mpl_token_metadata::accounts::Metadata;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone)]
pub struct MplTokenMetadata;

impl anchor_lang::Id for MplTokenMetadata {
    fn id() -> Pubkey {
        mpl_token_metadata::ID
    }
}

#[derive(Clone)]
pub struct MplCore;

impl anchor_lang::Id for MplCore {
    fn id() -> Pubkey {
        mpl_core::ID
    }
}
