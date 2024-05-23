use crate::{
    error::PrimitivesError,
    state::metaplex_adapter::{EdgeArgs, NodeArgs},
    utils::cmp_pubkeys,
};
use anchor_lang::prelude::*;
use mpl_token_metadata::{
    accounts::{CollectionAuthorityRecord, Metadata, MetadataDelegateRecord},
    types::{Collection, MetadataDelegateRole, TokenStandard},
};

/// Assert that the provided MetadataArgs are compatible with MPL `Data`
pub fn assert_metadata_is_node_compatible(metadata: &NodeArgs) -> Result<()> {
    if metadata.label.len() > mpl_token_metadata::MAX_NAME_LENGTH {
        return Err(PrimitivesError::MetadataNameTooLong.into());
    }
    // if !check_properties_size(&metadata.properties) {
    //     return Err(PrimitivesError::MetadataPropertiesTooLong.into());
    // }

    if !metadata.creators.is_empty() {
        if metadata.creators.len() > mpl_token_metadata::MAX_CREATOR_LIMIT {
            return Err(PrimitivesError::CreatorsTooLong.into());
        }

        let mut total: u8 = 0;
        for i in 0..metadata.creators.len() {
            let creator = &metadata.creators[i];
            for iter in metadata.creators.iter().skip(i + 1) {
                if iter.address == creator.address {
                    return Err(PrimitivesError::DuplicateCreatorAddress.into());
                }
            }
            total = total
                .checked_add(creator.share)
                .ok_or(PrimitivesError::CreatorShareTotalMustBe100)?;
        }
        if total != 100 {
            return Err(PrimitivesError::CreatorShareTotalMustBe100.into());
        }
    }
    Ok(())
}
/// Assert that the provided MetadataArgs are compatible with MPL `Data`
pub fn assert_edge_is_node_compatible(metadata: &EdgeArgs) -> Result<()> {
    if metadata.start_id.len() > mpl_token_metadata::MAX_NAME_LENGTH {
        return Err(PrimitivesError::MetadataNameTooLong.into());
    }
    if metadata.end_id.len() > mpl_token_metadata::MAX_NAME_LENGTH {
        return Err(PrimitivesError::MetadataNameTooLong.into());
    }
    // if !check_properties_size(&metadata.properties) {
    //     return Err(PrimitivesError::MetadataPropertiesTooLong.into());
    // }

    if !metadata.creators.is_empty() {
        if metadata.creators.len() > mpl_token_metadata::MAX_CREATOR_LIMIT {
            return Err(PrimitivesError::CreatorsTooLong.into());
        }

        let mut total: u8 = 0;
        for i in 0..metadata.creators.len() {
            let creator = &metadata.creators[i];
            for iter in metadata.creators.iter().skip(i + 1) {
                if iter.address == creator.address {
                    return Err(PrimitivesError::DuplicateCreatorAddress.into());
                }
            }
            total = total
                .checked_add(creator.share)
                .ok_or(PrimitivesError::CreatorShareTotalMustBe100)?;
        }
        if total != 100 {
            return Err(PrimitivesError::CreatorShareTotalMustBe100.into());
        }
    }
    Ok(())
}

// Assuming this function is called whenever properties are added or modified.
fn check_properties_size(properties: &Vec<(String, String)>) -> bool {
    if properties.len() > 10 {
        return false; // Too many properties.
    }

    for (key, value) in properties {
        if key.len() > mpl_token_metadata::MAX_URI_LENGTH
            || value.len() > mpl_token_metadata::MAX_URI_LENGTH
        {
            return false; // One of the properties exceeds the maximum size.
        }
    }

    true // All checks passed.
}

pub fn assert_pubkey_equal(
    a: &Pubkey,
    b: &Pubkey,
    error: Option<anchor_lang::error::Error>,
) -> Result<()> {
    if !cmp_pubkeys(a, b) {
        if let Some(err) = error {
            Err(err)
        } else {
            Err(PrimitivesError::PublicKeyMismatch.into())
        }
    } else {
        Ok(())
    }
}

pub fn assert_derivation(
    program_id: &Pubkey,
    account: &AccountInfo,
    path: &[&[u8]],
    error: Option<error::Error>,
) -> Result<u8> {
    let (key, bump) = Pubkey::find_program_address(path, program_id);
    if !cmp_pubkeys(&key, account.key) {
        if let Some(err) = error {
            msg!("Derivation {:?}", err);
            Err(err)
        } else {
            msg!("DerivedKeyInvalid");
            Err(ProgramError::InvalidInstructionData.into())
        }
    } else {
        Ok(bump)
    }
}

pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> Result<()> {
    if !cmp_pubkeys(account.owner, owner) {
        //todo add better errors
        Err(ProgramError::IllegalOwner.into())
    } else {
        Ok(())
    }
}

// Checks both delegate types: old collection_authority_record and newer
// metadata_delegate
pub fn assert_has_collection_authority(
    collection_data: &Metadata,
    mint: &Pubkey,
    collection_authority: &Pubkey,
    delegate_record: Option<&AccountInfo>,
) -> Result<()> {
    // Mint is the correct one for the metadata account.
    if collection_data.mint != *mint {
        return Err(PrimitivesError::MetadataMintMismatch.into());
    }

    if let Some(record_info) = delegate_record {
        let (ca_pda, ca_bump) = CollectionAuthorityRecord::find_pda(mint, collection_authority);
        let (md_pda, md_bump) = MetadataDelegateRecord::find_pda(
            mint,
            MetadataDelegateRole::Collection,
            &collection_data.update_authority,
            collection_authority,
        );

        let data = record_info.try_borrow_data()?;
        if data.len() == 0 {
            return Err(PrimitivesError::InvalidCollectionAuthority.into());
        }

        if record_info.key == &ca_pda {
            let record = CollectionAuthorityRecord::safe_deserialize(&data)?;
            if record.bump != ca_bump {
                return Err(PrimitivesError::InvalidCollectionAuthority.into());
            }

            match record.update_authority {
                Some(update_authority) => {
                    if update_authority != collection_data.update_authority {
                        return Err(PrimitivesError::InvalidCollectionAuthority.into());
                    }
                }
                None => return Err(PrimitivesError::InvalidCollectionAuthority.into()),
            }
        } else if record_info.key == &md_pda {
            let record = MetadataDelegateRecord::safe_deserialize(&data)?;
            if record.bump != md_bump {
                return Err(PrimitivesError::InvalidCollectionAuthority.into());
            }

            if record.update_authority != collection_data.update_authority {
                return Err(PrimitivesError::InvalidCollectionAuthority.into());
            }
        } else {
            return Err(PrimitivesError::InvalidDelegateRecord.into());
        }
    } else if collection_data.update_authority != *collection_authority {
        return Err(PrimitivesError::InvalidCollectionAuthority.into());
    }
    Ok(())
}

pub fn assert_collection_membership(
    membership: &Option<Collection>,
    collection_metadata: &Metadata,
    collection_mint: &Pubkey,
    collection_edition: &AccountInfo,
) -> Result<()> {
    match membership {
        Some(collection) => {
            if collection.key != *collection_mint || collection_metadata.mint != *collection_mint {
                return Err(PrimitivesError::CollectionNotFound.into());
            }
        }
        None => {
            return Err(PrimitivesError::CollectionNotFound.into());
        }
    }

    let (expected, _) = mpl_token_metadata::accounts::MasterEdition::find_pda(collection_mint);

    if collection_edition.key != &expected {
        return Err(PrimitivesError::CollectionMasterEditionAccountInvalid.into());
    }

    let edition = mpl_token_metadata::accounts::MasterEdition::try_from(collection_edition)
        .map_err(|_err| PrimitivesError::CollectionMustBeAUniqueMasterEdition)?;

    match collection_metadata.token_standard {
        Some(TokenStandard::NonFungible) | Some(TokenStandard::ProgrammableNonFungible) => (),
        _ => return Err(PrimitivesError::CollectionMustBeAUniqueMasterEdition.into()),
    }

    if edition.max_supply != Some(0) {
        return Err(PrimitivesError::CollectionMustBeAUniqueMasterEdition.into());
    }

    Ok(())
}
