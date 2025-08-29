use anchor_lang::prelude::*;

use crate::state::leaf_schema::Version;

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
pub struct MetadataArgs {
    /// The name of the asset
    pub name: String,
    /// The symbol for the asset
    pub symbol: String,
    /// URI pointing to JSON representing the asset
    pub uri: String,
    /// Royalty basis points that goes to creators in secondary sales (0-10000)
    pub seller_fee_basis_points: u16,
    /// Immutable, once flipped, all sales of this metadata are considered secondary.
    pub primary_sale_happened: bool,
    /// Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
    /// nonce for easy calculation of editions, if present
    pub edition_nonce: Option<u8>,
    /// Token standard.  Currently only `NonFungible` is allowed.
    pub token_standard: Option<TokenStandard>,
    /// Collection
    pub collection: Option<Collection>,
    /// Uses
    pub uses: Option<Uses>,
    pub token_program_version: TokenProgramVersion,
    pub creators: Vec<Creator>,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct MetadataArgsV2 {
    /// The name of the asset
    pub name: String,
    /// The symbol for the asset
    pub symbol: String,
    /// URI pointing to JSON representing the asset
    pub uri: String,
    /// Royalty basis points that goes to creators in secondary sales (0-10000)
    pub seller_fee_basis_points: u16,
    /// Immutable, once flipped, all sales of this metadata are considered secondary.
    pub primary_sale_happened: bool,
    /// Whether or not the data struct is mutable, default is not
    pub is_mutable: bool,
    /// Token standard.  Currently only `NonFungible` is allowed.
    pub token_standard: Option<TokenStandard>,
    /// Creator array
    pub creators: Vec<Creator>,
    /// Collection.  Note in V2 its just a `Pubkey` and is always considered verified.
    pub collection: Option<Pubkey>,
}

pub trait MetadataArgsCommon: AnchorSerialize + AnchorDeserialize {
    fn version(&self) -> Version;

    fn name(&self) -> &str;
    fn set_name(&mut self, name: String);

    fn symbol(&self) -> &str;
    fn set_symbol(&mut self, symbol: String);

    fn uri(&self) -> &str;
    fn set_uri(&mut self, uri: String);

    fn seller_fee_basis_points(&self) -> u16;
    fn set_seller_fee_basis_points(&mut self, fee: u16);

    fn primary_sale_happened(&self) -> bool;
    fn set_primary_sale_happened(&mut self, primary_sale_happened: bool);

    fn is_mutable(&self) -> bool;
    fn set_is_mutable(&mut self, is_mutable: bool);

    fn token_standard(&self) -> Option<&TokenStandard>;
    fn set_token_standard(&mut self, standard: Option<TokenStandard>);

    fn creators(&self) -> &Vec<Creator>;
    fn set_creators(&mut self, creators: Vec<Creator>);

    fn collection_key(&self) -> Option<Pubkey>;
    fn collection_verified(&self) -> bool;
}

impl MetadataArgsCommon for MetadataArgs {
    fn version(&self) -> Version {
        Version::V1
    }

    fn name(&self) -> &str {
        &self.name
    }
    fn set_name(&mut self, name: String) {
        self.name = name;
    }

    fn symbol(&self) -> &str {
        &self.symbol
    }
    fn set_symbol(&mut self, symbol: String) {
        self.symbol = symbol;
    }

    fn uri(&self) -> &str {
        &self.uri
    }
    fn set_uri(&mut self, uri: String) {
        self.uri = uri;
    }

    fn seller_fee_basis_points(&self) -> u16 {
        self.seller_fee_basis_points
    }
    fn set_seller_fee_basis_points(&mut self, fee: u16) {
        self.seller_fee_basis_points = fee;
    }

    fn primary_sale_happened(&self) -> bool {
        self.primary_sale_happened
    }
    fn set_primary_sale_happened(&mut self, primary_sale_happened: bool) {
        self.primary_sale_happened = primary_sale_happened;
    }

    fn is_mutable(&self) -> bool {
        self.is_mutable
    }
    fn set_is_mutable(&mut self, is_mutable: bool) {
        self.is_mutable = is_mutable;
    }

    fn token_standard(&self) -> Option<&TokenStandard> {
        self.token_standard.as_ref()
    }
    fn set_token_standard(&mut self, standard: Option<TokenStandard>) {
        self.token_standard = standard;
    }

    fn creators(&self) -> &Vec<Creator> {
        &self.creators
    }
    fn set_creators(&mut self, creators: Vec<Creator>) {
        self.creators = creators;
    }

    fn collection_key(&self) -> Option<Pubkey> {
        self.collection.as_ref().map(|collection| collection.key)
    }
    fn collection_verified(&self) -> bool {
        self.collection
            .as_ref()
            .map_or(false, |collection| collection.verified)
    }
}

impl MetadataArgsCommon for MetadataArgsV2 {
    fn version(&self) -> Version {
        Version::V2
    }

    fn name(&self) -> &str {
        &self.name
    }
    fn set_name(&mut self, name: String) {
        self.name = name;
    }

    fn symbol(&self) -> &str {
        &self.symbol
    }
    fn set_symbol(&mut self, symbol: String) {
        self.symbol = symbol;
    }

    fn uri(&self) -> &str {
        &self.uri
    }
    fn set_uri(&mut self, uri: String) {
        self.uri = uri;
    }

    fn seller_fee_basis_points(&self) -> u16 {
        self.seller_fee_basis_points
    }
    fn set_seller_fee_basis_points(&mut self, fee: u16) {
        self.seller_fee_basis_points = fee;
    }

    fn primary_sale_happened(&self) -> bool {
        self.primary_sale_happened
    }
    fn set_primary_sale_happened(&mut self, primary_sale_happened: bool) {
        self.primary_sale_happened = primary_sale_happened;
    }

    fn is_mutable(&self) -> bool {
        self.is_mutable
    }
    fn set_is_mutable(&mut self, is_mutable: bool) {
        self.is_mutable = is_mutable;
    }

    fn token_standard(&self) -> Option<&TokenStandard> {
        self.token_standard.as_ref()
    }
    fn set_token_standard(&mut self, standard: Option<TokenStandard>) {
        self.token_standard = standard;
    }

    fn creators(&self) -> &Vec<Creator> {
        &self.creators
    }
    fn set_creators(&mut self, creators: Vec<Creator>) {
        self.creators = creators;
    }

    fn collection_key(&self) -> Option<Pubkey> {
        self.collection
    }
    fn collection_verified(&self) -> bool {
        self.collection.is_some()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone, Default)]
pub struct UpdateArgs {
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub uri: Option<String>,
    pub creators: Option<Vec<Creator>>,
    pub seller_fee_basis_points: Option<u16>,
    pub primary_sale_happened: Option<bool>,
    pub is_mutable: Option<bool>,
}
