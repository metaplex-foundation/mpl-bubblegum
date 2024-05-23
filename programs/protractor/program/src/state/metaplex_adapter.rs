use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub enum TokenProgramVersion {
    Original,
    Token2022,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    /// The percentage share.
    ///
    /// The value is a percentage, not basis points.
    pub share: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct Properties {
    pub key: String,
    pub value: String,
}

impl Creator {
    pub fn adapt(&self) -> mpl_token_metadata::types::Creator {
        mpl_token_metadata::types::Creator {
            address: self.address,
            verified: self.verified,
            share: self.share,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub enum TokenStandard {
    NonFungible,        // This is a master edition
    FungibleAsset,      // A token with metadata that can also have attributes
    Fungible,           // A token with simple metadata
    NonFungibleEdition, // This is a limited edition
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub enum UseMethod {
    Burn,
    Multiple,
    Single,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct Uses {
    // 17 bytes + Option byte
    pub use_method: UseMethod, //1
    pub remaining: u64,        //8
    pub total: u64,            //8
}

impl Uses {
    pub fn adapt(&self) -> mpl_token_metadata::types::Uses {
        mpl_token_metadata::types::Uses {
            use_method: match self.use_method {
                UseMethod::Burn => mpl_token_metadata::types::UseMethod::Burn,
                UseMethod::Multiple => mpl_token_metadata::types::UseMethod::Multiple,
                UseMethod::Single => mpl_token_metadata::types::UseMethod::Single,
            },
            remaining: self.remaining,
            total: self.total,
        }
    }
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct Collection {
    pub verified: bool,
    pub key: Pubkey,
}

impl Collection {
    pub fn adapt(&self) -> mpl_token_metadata::types::Collection {
        mpl_token_metadata::types::Collection {
            verified: self.verified,
            key: self.key,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct NodeArgs {
    /// The name of the asset
    pub label: String,
    // key value pair of properties
    pub properties: Vec<Properties>,
    // Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
    pub creators: Vec<Creator>,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone, Default)]
pub struct UpdateNodeArgs {
    /// The name of the asset
    pub label: String,
    // key value pair of properties
    pub properties: Vec<Properties>,
    // Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
    pub creators: Vec<Creator>,
}
#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct EdgeArgs {
    /// The name of the asset
    pub start_id: String,
    pub end_id: String,
    // key value pair of properties
    pub properties: Vec<Properties>,
    // Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
    pub creators: Vec<Creator>,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone, Default)]
pub struct UpdateEdgeArgs {
    /// The name of the asset
    pub label: String,
    // key value pair of properties
    pub properties: Vec<Properties>,
    // Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
    pub creators: Vec<Creator>,
}
