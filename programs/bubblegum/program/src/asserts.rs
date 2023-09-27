use crate::{error::BubblegumError, state::metaplex_adapter::MetadataArgs, utils::cmp_pubkeys};
use anchor_lang::prelude::*;
use mpl_token_metadata::{
    instruction::MetadataDelegateRole,
    pda::{find_collection_authority_account, find_metadata_delegate_record_account},
    state::{CollectionAuthorityRecord, Metadata, MetadataDelegateRecord, TokenMetadataAccount},
};

/// Assert that the provided MetadataArgs are compatible with MPL `Data`
pub fn assert_metadata_is_mpl_compatible(metadata: &MetadataArgs) -> Result<()> {
    if metadata.name.len() > mpl_token_metadata::state::MAX_NAME_LENGTH {
        return Err(BubblegumError::MetadataNameTooLong.into());
    }

    if metadata.symbol.len() > mpl_token_metadata::state::MAX_SYMBOL_LENGTH {
        return Err(BubblegumError::MetadataSymbolTooLong.into());
    }

    if metadata.uri.len() > mpl_token_metadata::state::MAX_URI_LENGTH {
        return Err(BubblegumError::MetadataUriTooLong.into());
    }

    if metadata.seller_fee_basis_points > 10000 {
        return Err(BubblegumError::MetadataBasisPointsTooHigh.into());
    }
    if !metadata.creators.is_empty() {
        if metadata.creators.len() > mpl_token_metadata::state::MAX_CREATOR_LIMIT {
            return Err(BubblegumError::CreatorsTooLong.into());
        }

        let mut total: u8 = 0;
        for i in 0..metadata.creators.len() {
            let creator = &metadata.creators[i];
            for iter in metadata.creators.iter().skip(i + 1) {
                if iter.address == creator.address {
                    return Err(BubblegumError::DuplicateCreatorAddress.into());
                }
            }
            total = total
                .checked_add(creator.share)
                .ok_or(BubblegumError::CreatorShareTotalMustBe100)?;
        }
        if total != 100 {
            return Err(BubblegumError::CreatorShareTotalMustBe100.into());
        }
    }
    Ok(())
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
            Err(BubblegumError::PublicKeyMismatch.into())
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
        return Err(BubblegumError::MetadataMintMismatch.into());
    }

    if let Some(record_info) = delegate_record {
        let (ca_pda, ca_bump) = find_collection_authority_account(mint, collection_authority);
        let (md_pda, md_bump) = find_metadata_delegate_record_account(
            mint,
            MetadataDelegateRole::Collection,
            &collection_data.update_authority,
            collection_authority,
        );

        let data = record_info.try_borrow_data()?;
        if data.len() == 0 {
            return Err(BubblegumError::InvalidCollectionAuthority.into());
        }

        if record_info.key == &ca_pda {
            let record = CollectionAuthorityRecord::safe_deserialize(&data)?;
            if record.bump != ca_bump {
                return Err(BubblegumError::InvalidCollectionAuthority.into());
            }

            match record.update_authority {
                Some(update_authority) => {
                    if update_authority != collection_data.update_authority {
                        return Err(BubblegumError::InvalidCollectionAuthority.into());
                    }
                }
                None => return Err(BubblegumError::InvalidCollectionAuthority.into()),
            }
        } else if record_info.key == &md_pda {
            let record = MetadataDelegateRecord::safe_deserialize(&data)?;
            if record.bump != md_bump {
                return Err(BubblegumError::InvalidCollectionAuthority.into());
            }

            if record.update_authority != collection_data.update_authority {
                return Err(BubblegumError::InvalidCollectionAuthority.into());
            }
        } else {
            return Err(BubblegumError::InvalidDelegateRecord.into());
        }
    } else if collection_data.update_authority != *collection_authority {
        return Err(BubblegumError::InvalidCollectionAuthority.into());
    }
    Ok(())
}
