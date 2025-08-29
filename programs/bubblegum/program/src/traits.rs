use anchor_lang::prelude::*;
use mpl_core::{types::RuleSet, AuthorityType, Collection};

#[derive(Eq, PartialEq, Debug, Clone, Copy)]
pub(crate) enum ValidationResult {
    /// The plugin approves the lifecycle action.
    Approved,
    /// The plugin rejects the lifecycle action.
    Rejected,
    /// The plugin abstains from approving or rejecting the lifecycle action.
    Abstain,
    /// The plugin force approves the lifecycle action.
    ForceApproved,
}

pub(crate) trait MplCorePluginValidation<'info> {
    fn validate_add_to_collection(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
    ) -> Result<ValidationResult> {
        Ok(ValidationResult::Abstain)
    }
    fn validate_transfer(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
        _leaf_owner_owner: &AccountInfo<'info>,
        _new_leaf_owner_owner: &AccountInfo<'info>,
    ) -> Result<ValidationResult> {
        Ok(ValidationResult::Abstain)
    }
    fn validate_burn(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
        _leaf_owner: Pubkey,
    ) -> Result<ValidationResult> {
        Ok(ValidationResult::Abstain)
    }
    fn validate_freeze(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
    ) -> Result<ValidationResult> {
        Ok(ValidationResult::Abstain)
    }
    fn validate_update_metadata(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
    ) -> Result<ValidationResult> {
        Ok(ValidationResult::Abstain)
    }
}

impl<'info> MplCorePluginValidation<'info> for mpl_core::UpdateDelegatePlugin {
    fn validate_add_to_collection(
        &self,
        collection: &Collection,
        authority: Pubkey,
    ) -> Result<ValidationResult> {
        match self.base.authority.authority_type {
            AuthorityType::None | AuthorityType::Owner => (),
            AuthorityType::UpdateAuthority => {
                if collection.base.update_authority.key() == authority {
                    return Ok(ValidationResult::Approved);
                }
            }
            AuthorityType::Address => {
                if let Some(address) = self.base.authority.address {
                    if address == authority {
                        return Ok(ValidationResult::Approved);
                    }
                }
            }
        }

        if self
            .update_delegate
            .additional_delegates
            .contains(&authority.key())
        {
            return Ok(ValidationResult::Approved);
        }

        Ok(ValidationResult::Abstain)
    }

    fn validate_update_metadata(
        &self,
        collection: &Collection,
        authority: Pubkey,
    ) -> Result<ValidationResult> {
        match self.base.authority.authority_type {
            AuthorityType::None | AuthorityType::Owner => (),
            AuthorityType::UpdateAuthority => {
                if collection.base.update_authority.key() == authority {
                    return Ok(ValidationResult::Approved);
                }
            }
            AuthorityType::Address => {
                if let Some(address) = self.base.authority.address {
                    if address == authority {
                        return Ok(ValidationResult::Approved);
                    }
                }
            }
        }

        if self
            .update_delegate
            .additional_delegates
            .contains(&authority.key())
        {
            return Ok(ValidationResult::Approved);
        }

        Ok(ValidationResult::Abstain)
    }
}

impl<'info> MplCorePluginValidation<'info> for mpl_core::PermanentTransferDelegatePlugin {
    fn validate_transfer(
        &self,
        collection: &Collection,
        authority: Pubkey,
        _leaf_owner_owner: &AccountInfo<'info>,
        _new_leaf_owner_owner: &AccountInfo<'info>,
    ) -> Result<ValidationResult> {
        match self.base.authority.authority_type {
            AuthorityType::None | AuthorityType::Owner => (),
            AuthorityType::UpdateAuthority => {
                if collection.base.update_authority.key() == authority {
                    return Ok(ValidationResult::ForceApproved);
                }
            }
            AuthorityType::Address => {
                if let Some(address) = self.base.authority.address {
                    if address == authority {
                        return Ok(ValidationResult::ForceApproved);
                    }
                }
            }
        }

        Ok(ValidationResult::Abstain)
    }
}

impl<'info> MplCorePluginValidation<'info> for mpl_core::RoyaltiesPlugin {
    fn validate_transfer(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
        leaf_owner: &AccountInfo<'info>,
        new_leaf_owner: &AccountInfo<'info>,
    ) -> Result<ValidationResult> {
        match &self.royalties.rule_set {
            RuleSet::None => (),
            RuleSet::ProgramAllowList(allow_list) => {
                if !allow_list.contains(leaf_owner.owner)
                    || !allow_list.contains(new_leaf_owner.owner)
                {
                    return Ok(ValidationResult::Rejected);
                }
            }
            RuleSet::ProgramDenyList(deny_list) => {
                if deny_list.contains(leaf_owner.owner) || deny_list.contains(new_leaf_owner.owner)
                {
                    return Ok(ValidationResult::Rejected);
                }
            }
        }

        Ok(ValidationResult::Abstain)
    }
}

impl<'info> MplCorePluginValidation<'info> for mpl_core::PermanentFreezeDelegatePlugin {
    fn validate_transfer(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
        _leaf_owner: &AccountInfo<'info>,
        _new_leaf_owner: &AccountInfo<'info>,
    ) -> Result<ValidationResult> {
        if self.permanent_freeze_delegate.frozen {
            return Ok(ValidationResult::Rejected);
        }

        Ok(ValidationResult::Abstain)
    }

    fn validate_burn(
        &self,
        _collection: &Collection,
        _authority: Pubkey,
        _leaf_owner: Pubkey,
    ) -> Result<ValidationResult> {
        if self.permanent_freeze_delegate.frozen {
            return Ok(ValidationResult::Rejected);
        }

        Ok(ValidationResult::Abstain)
    }

    fn validate_freeze(
        &self,
        collection: &Collection,
        authority: Pubkey,
    ) -> Result<ValidationResult> {
        match self.base.authority.authority_type {
            AuthorityType::None | AuthorityType::Owner => (),
            AuthorityType::UpdateAuthority => {
                if collection.base.update_authority.key() == authority {
                    return Ok(ValidationResult::ForceApproved);
                }
            }
            AuthorityType::Address => {
                if let Some(address) = self.base.authority.address {
                    if address == authority {
                        return Ok(ValidationResult::ForceApproved);
                    }
                }
            }
        }

        Ok(ValidationResult::Abstain)
    }
}

impl<'info> MplCorePluginValidation<'info> for mpl_core::PermanentBurnDelegatePlugin {
    fn validate_burn(
        &self,
        collection: &Collection,
        authority: Pubkey,
        _leaf_owner: Pubkey,
    ) -> Result<ValidationResult> {
        match self.base.authority.authority_type {
            AuthorityType::None | AuthorityType::Owner => (),
            AuthorityType::UpdateAuthority => {
                if collection.base.update_authority.key() == authority {
                    return Ok(ValidationResult::ForceApproved);
                }
            }
            AuthorityType::Address => {
                if let Some(address) = self.base.authority.address {
                    if address == authority {
                        return Ok(ValidationResult::ForceApproved);
                    }
                }
            }
        }

        Ok(ValidationResult::Abstain)
    }
}
