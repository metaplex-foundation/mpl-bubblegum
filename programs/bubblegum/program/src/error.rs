use anchor_lang::prelude::*;
use mpl_token_metadata::errors::MplTokenMetadataError;
use num_traits::FromPrimitive;

#[error_code]
pub enum BubblegumError {
    #[msg("Asset Owner Does not match")]
    AssetOwnerMismatch,
    #[msg("PublicKeyMismatch")]
    PublicKeyMismatch,
    #[msg("Hashing Mismatch Within Leaf Schema")]
    HashingMismatch,
    #[msg("Unsupported Schema Version")]
    UnsupportedSchemaVersion,
    #[msg("Creator shares must sum to 100")]
    CreatorShareTotalMustBe100,
    #[msg("No duplicate creator addresses in metadata")]
    DuplicateCreatorAddress,
    #[msg("Creator did not verify the metadata")]
    CreatorDidNotVerify,
    #[msg("Creator not found in creator Vec")]
    CreatorNotFound,
    #[msg("No creators in creator Vec")]
    NoCreatorsPresent,
    #[msg("User-provided creator Vec must result in same user-provided creator hash")]
    CreatorHashMismatch,
    #[msg("User-provided metadata must result in same user-provided data hash")]
    DataHashMismatch,
    #[msg("Creators list too long")]
    CreatorsTooLong,
    #[msg("Name in metadata is too long")]
    MetadataNameTooLong,
    #[msg("Symbol in metadata is too long")]
    MetadataSymbolTooLong,
    #[msg("Uri in metadata is too long")]
    MetadataUriTooLong,
    #[msg("Basis points in metadata cannot exceed 10000")]
    MetadataBasisPointsTooHigh,
    #[msg("Tree creator or tree delegate must sign.")]
    TreeAuthorityIncorrect,
    #[msg("Not enough unapproved mints left")]
    InsufficientMintCapacity,
    #[msg("NumericalOverflowError")]
    NumericalOverflowError,
    #[msg("Incorrect account owner")]
    IncorrectOwner,
    #[msg("Cannot Verify Collection in this Instruction")]
    CollectionCannotBeVerifiedInThisInstruction,
    #[msg("Collection Not Found on Metadata")]
    CollectionNotFound,
    #[msg("Collection item is already verified.")]
    AlreadyVerified,
    #[msg("Collection item is already unverified.")]
    AlreadyUnverified,
    #[msg("Incorrect leaf metadata update authority.")]
    UpdateAuthorityIncorrect,
    #[msg("This transaction must be signed by either the leaf owner or leaf delegate")]
    LeafAuthorityMustSign,
    #[msg("Collection Not Compatable with Compression, Must be Sized")]
    CollectionMustBeSized,
    #[msg("Metadata mint does not match collection mint")]
    MetadataMintMismatch,
    #[msg("Invalid collection authority")]
    InvalidCollectionAuthority,
    #[msg("Invalid delegate record pda derivation")]
    InvalidDelegateRecord,
    #[msg("Edition account doesnt match collection")]
    CollectionMasterEditionAccountInvalid,
    #[msg("Collection Must Be a Unique Master Edition v2")]
    CollectionMustBeAUniqueMasterEdition,
    #[msg("Could not convert external error to BubblegumError")]
    UnknownExternalError,
    #[msg("Decompression is disabled for this tree.")]
    DecompressionDisabled,
    #[msg("Missing collection mint account")]
    MissingCollectionMintAccount,
    #[msg("Missing collection metadata account")]
    MissingCollectionMetadataAccount,
    #[msg("Collection mismatch")]
    CollectionMismatch,
    #[msg("Metadata not mutable")]
    MetadataImmutable,
    #[msg("Can only update primary sale to true")]
    PrimarySaleCanOnlyBeFlippedToTrue,
    #[msg("Creator did not unverify the metadata")]
    CreatorDidNotUnverify,
    #[msg("Only NonFungible standard is supported")]
    InvalidTokenStandard,
    #[msg("Canopy size should be set bigger for this tree")]
    InvalidCanopySize,
    #[msg("Invalid log wrapper program")]
    InvalidLogWrapper,
    #[msg("Invalid compression program")]
    InvalidCompressionProgram,
    #[msg("Leaf must be delegated to someone other than the leaf owner")]
    LeafMustBeDelegated,
    #[msg("Asset is frozen")]
    AssetIsFrozen,
    #[msg("Asset is non-transferable")]
    AssetIsNonTransferable,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Collection is frozen")]
    CollectionIsFrozen,
    #[msg("Core collections must have the Bubblegum V2 plugin on them")]
    CollectionMustHaveBubblegumPlugin,
    #[msg("Feature not currently available")]
    NotAvailable,
    #[msg("Missing collection account")]
    MissingCollectionAccount,
    #[msg("Asset data length too long")]
    AssetDataLengthTooLong,
    #[msg("Item is already in the collection")]
    AlreadyInCollection,
    #[msg("Item is already not in a collection")]
    AlreadyNotInCollection,
    #[msg("Missing mpl-core CPI signer account")]
    MissingMplCoreCpiSignerAccount,
    #[msg("Asset is not frozen")]
    AssetIsNotFrozen,
}

// Converts certain Token Metadata errors into Bubblegum equivalents
pub fn metadata_error_into_bubblegum(error: ProgramError) -> BubblegumError {
    match error {
        ProgramError::Custom(e) => {
            let metadata_error =
                FromPrimitive::from_u32(e).expect("Unknown error code from token-metadata");

            match metadata_error {
                MplTokenMetadataError::CollectionNotFound => BubblegumError::CollectionNotFound,
                MplTokenMetadataError::CollectionMustBeAUniqueMasterEdition => {
                    BubblegumError::CollectionMustBeAUniqueMasterEdition
                }

                MplTokenMetadataError::CollectionMasterEditionAccountInvalid => {
                    BubblegumError::CollectionMasterEditionAccountInvalid
                }

                _ => BubblegumError::UnknownExternalError,
            }
        }
        _ => panic!("Unsupported program error code"),
    }
}
