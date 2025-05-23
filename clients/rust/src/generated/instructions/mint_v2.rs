//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::AssetDataSchema;
use crate::generated::types::MetadataArgsV2;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct MintV2 {
    pub tree_config: solana_program::pubkey::Pubkey,

    pub payer: solana_program::pubkey::Pubkey,
    /// Optional tree delegate, defaults to `payer`
    pub tree_creator_or_delegate: Option<solana_program::pubkey::Pubkey>,
    /// Optional collection authority, defaults to `tree_delegate`
    pub collection_authority: Option<solana_program::pubkey::Pubkey>,

    pub leaf_owner: solana_program::pubkey::Pubkey,

    pub leaf_delegate: Option<solana_program::pubkey::Pubkey>,

    pub merkle_tree: solana_program::pubkey::Pubkey,

    pub core_collection: Option<solana_program::pubkey::Pubkey>,

    pub mpl_core_cpi_signer: Option<solana_program::pubkey::Pubkey>,

    pub log_wrapper: solana_program::pubkey::Pubkey,

    pub compression_program: solana_program::pubkey::Pubkey,

    pub mpl_core_program: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,
}

impl MintV2 {
    pub fn instruction(
        &self,
        args: MintV2InstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: MintV2InstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(13 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.tree_config,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.payer, true,
        ));
        if let Some(tree_creator_or_delegate) = self.tree_creator_or_delegate {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                tree_creator_or_delegate,
                true,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        if let Some(collection_authority) = self.collection_authority {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                collection_authority,
                true,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.leaf_owner,
            false,
        ));
        if let Some(leaf_delegate) = self.leaf_delegate {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                leaf_delegate,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.merkle_tree,
            false,
        ));
        if let Some(core_collection) = self.core_collection {
            accounts.push(solana_program::instruction::AccountMeta::new(
                core_collection,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        if let Some(mpl_core_cpi_signer) = self.mpl_core_cpi_signer {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                mpl_core_cpi_signer,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.log_wrapper,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.compression_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.mpl_core_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = MintV2InstructionData::new().try_to_vec().unwrap();
        let mut args = args.try_to_vec().unwrap();
        data.append(&mut args);

        solana_program::instruction::Instruction {
            program_id: crate::MPL_BUBBLEGUM_ID,
            accounts,
            data,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize)]
struct MintV2InstructionData {
    discriminator: [u8; 8],
}

impl MintV2InstructionData {
    fn new() -> Self {
        Self {
            discriminator: [120, 121, 23, 146, 173, 110, 199, 205],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MintV2InstructionArgs {
    pub metadata: MetadataArgsV2,
    pub asset_data: Option<Vec<u8>>,
    pub asset_data_schema: Option<AssetDataSchema>,
}

/// Instruction builder.
#[derive(Default)]
pub struct MintV2Builder {
    tree_config: Option<solana_program::pubkey::Pubkey>,
    payer: Option<solana_program::pubkey::Pubkey>,
    tree_creator_or_delegate: Option<solana_program::pubkey::Pubkey>,
    collection_authority: Option<solana_program::pubkey::Pubkey>,
    leaf_owner: Option<solana_program::pubkey::Pubkey>,
    leaf_delegate: Option<solana_program::pubkey::Pubkey>,
    merkle_tree: Option<solana_program::pubkey::Pubkey>,
    core_collection: Option<solana_program::pubkey::Pubkey>,
    mpl_core_cpi_signer: Option<solana_program::pubkey::Pubkey>,
    log_wrapper: Option<solana_program::pubkey::Pubkey>,
    compression_program: Option<solana_program::pubkey::Pubkey>,
    mpl_core_program: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    metadata: Option<MetadataArgsV2>,
    asset_data: Option<Vec<u8>>,
    asset_data_schema: Option<AssetDataSchema>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl MintV2Builder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn tree_config(&mut self, tree_config: solana_program::pubkey::Pubkey) -> &mut Self {
        self.tree_config = Some(tree_config);
        self
    }
    #[inline(always)]
    pub fn payer(&mut self, payer: solana_program::pubkey::Pubkey) -> &mut Self {
        self.payer = Some(payer);
        self
    }
    /// `[optional account]`
    /// Optional tree delegate, defaults to `payer`
    #[inline(always)]
    pub fn tree_creator_or_delegate(
        &mut self,
        tree_creator_or_delegate: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.tree_creator_or_delegate = tree_creator_or_delegate;
        self
    }
    /// `[optional account]`
    /// Optional collection authority, defaults to `tree_delegate`
    #[inline(always)]
    pub fn collection_authority(
        &mut self,
        collection_authority: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.collection_authority = collection_authority;
        self
    }
    #[inline(always)]
    pub fn leaf_owner(&mut self, leaf_owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.leaf_owner = Some(leaf_owner);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn leaf_delegate(
        &mut self,
        leaf_delegate: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.leaf_delegate = leaf_delegate;
        self
    }
    #[inline(always)]
    pub fn merkle_tree(&mut self, merkle_tree: solana_program::pubkey::Pubkey) -> &mut Self {
        self.merkle_tree = Some(merkle_tree);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn core_collection(
        &mut self,
        core_collection: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.core_collection = core_collection;
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn mpl_core_cpi_signer(
        &mut self,
        mpl_core_cpi_signer: Option<solana_program::pubkey::Pubkey>,
    ) -> &mut Self {
        self.mpl_core_cpi_signer = mpl_core_cpi_signer;
        self
    }
    /// `[optional account, default to 'mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3']`
    #[inline(always)]
    pub fn log_wrapper(&mut self, log_wrapper: solana_program::pubkey::Pubkey) -> &mut Self {
        self.log_wrapper = Some(log_wrapper);
        self
    }
    /// `[optional account, default to 'mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW']`
    #[inline(always)]
    pub fn compression_program(
        &mut self,
        compression_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.compression_program = Some(compression_program);
        self
    }
    /// `[optional account, default to 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d']`
    #[inline(always)]
    pub fn mpl_core_program(
        &mut self,
        mpl_core_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.mpl_core_program = Some(mpl_core_program);
        self
    }
    /// `[optional account, default to '11111111111111111111111111111111']`
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn metadata(&mut self, metadata: MetadataArgsV2) -> &mut Self {
        self.metadata = Some(metadata);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn asset_data(&mut self, asset_data: Vec<u8>) -> &mut Self {
        self.asset_data = Some(asset_data);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn asset_data_schema(&mut self, asset_data_schema: AssetDataSchema) -> &mut Self {
        self.asset_data_schema = Some(asset_data_schema);
        self
    }
    /// Add an aditional account to the instruction.
    #[inline(always)]
    pub fn add_remaining_account(
        &mut self,
        account: solana_program::instruction::AccountMeta,
    ) -> &mut Self {
        self.__remaining_accounts.push(account);
        self
    }
    /// Add additional accounts to the instruction.
    #[inline(always)]
    pub fn add_remaining_accounts(
        &mut self,
        accounts: &[solana_program::instruction::AccountMeta],
    ) -> &mut Self {
        self.__remaining_accounts.extend_from_slice(accounts);
        self
    }
    #[allow(clippy::clone_on_copy)]
    pub fn instruction(&self) -> solana_program::instruction::Instruction {
        let accounts = MintV2 {
            tree_config: self.tree_config.expect("tree_config is not set"),
            payer: self.payer.expect("payer is not set"),
            tree_creator_or_delegate: self.tree_creator_or_delegate,
            collection_authority: self.collection_authority,
            leaf_owner: self.leaf_owner.expect("leaf_owner is not set"),
            leaf_delegate: self.leaf_delegate,
            merkle_tree: self.merkle_tree.expect("merkle_tree is not set"),
            core_collection: self.core_collection,
            mpl_core_cpi_signer: self.mpl_core_cpi_signer,
            log_wrapper: self.log_wrapper.unwrap_or(solana_program::pubkey!(
                "mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3"
            )),
            compression_program: self.compression_program.unwrap_or(solana_program::pubkey!(
                "mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW"
            )),
            mpl_core_program: self.mpl_core_program.unwrap_or(solana_program::pubkey!(
                "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
            )),
            system_program: self
                .system_program
                .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
        };
        let args = MintV2InstructionArgs {
            metadata: self.metadata.clone().expect("metadata is not set"),
            asset_data: self.asset_data.clone(),
            asset_data_schema: self.asset_data_schema.clone(),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `mint_v2` CPI accounts.
pub struct MintV2CpiAccounts<'a, 'b> {
    pub tree_config: &'b solana_program::account_info::AccountInfo<'a>,

    pub payer: &'b solana_program::account_info::AccountInfo<'a>,
    /// Optional tree delegate, defaults to `payer`
    pub tree_creator_or_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Optional collection authority, defaults to `tree_delegate`
    pub collection_authority: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub leaf_owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub leaf_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub merkle_tree: &'b solana_program::account_info::AccountInfo<'a>,

    pub core_collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub mpl_core_cpi_signer: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub log_wrapper: &'b solana_program::account_info::AccountInfo<'a>,

    pub compression_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub mpl_core_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `mint_v2` CPI instruction.
pub struct MintV2Cpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub tree_config: &'b solana_program::account_info::AccountInfo<'a>,

    pub payer: &'b solana_program::account_info::AccountInfo<'a>,
    /// Optional tree delegate, defaults to `payer`
    pub tree_creator_or_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    /// Optional collection authority, defaults to `tree_delegate`
    pub collection_authority: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub leaf_owner: &'b solana_program::account_info::AccountInfo<'a>,

    pub leaf_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub merkle_tree: &'b solana_program::account_info::AccountInfo<'a>,

    pub core_collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub mpl_core_cpi_signer: Option<&'b solana_program::account_info::AccountInfo<'a>>,

    pub log_wrapper: &'b solana_program::account_info::AccountInfo<'a>,

    pub compression_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub mpl_core_program: &'b solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: MintV2InstructionArgs,
}

impl<'a, 'b> MintV2Cpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: MintV2CpiAccounts<'a, 'b>,
        args: MintV2InstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            tree_config: accounts.tree_config,
            payer: accounts.payer,
            tree_creator_or_delegate: accounts.tree_creator_or_delegate,
            collection_authority: accounts.collection_authority,
            leaf_owner: accounts.leaf_owner,
            leaf_delegate: accounts.leaf_delegate,
            merkle_tree: accounts.merkle_tree,
            core_collection: accounts.core_collection,
            mpl_core_cpi_signer: accounts.mpl_core_cpi_signer,
            log_wrapper: accounts.log_wrapper,
            compression_program: accounts.compression_program,
            mpl_core_program: accounts.mpl_core_program,
            system_program: accounts.system_program,
            __args: args,
        }
    }
    #[inline(always)]
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(&[], &[])
    }
    #[inline(always)]
    pub fn invoke_with_remaining_accounts(
        &self,
        remaining_accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(&[], remaining_accounts)
    }
    #[inline(always)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed_with_remaining_accounts(signers_seeds, &[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed_with_remaining_accounts(
        &self,
        signers_seeds: &[&[&[u8]]],
        remaining_accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> solana_program::entrypoint::ProgramResult {
        let mut accounts = Vec::with_capacity(13 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.tree_config.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.payer.key,
            true,
        ));
        if let Some(tree_creator_or_delegate) = self.tree_creator_or_delegate {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *tree_creator_or_delegate.key,
                true,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        if let Some(collection_authority) = self.collection_authority {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *collection_authority.key,
                true,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.leaf_owner.key,
            false,
        ));
        if let Some(leaf_delegate) = self.leaf_delegate {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *leaf_delegate.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.merkle_tree.key,
            false,
        ));
        if let Some(core_collection) = self.core_collection {
            accounts.push(solana_program::instruction::AccountMeta::new(
                *core_collection.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        if let Some(mpl_core_cpi_signer) = self.mpl_core_cpi_signer {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                *mpl_core_cpi_signer.key,
                false,
            ));
        } else {
            accounts.push(solana_program::instruction::AccountMeta::new_readonly(
                crate::MPL_BUBBLEGUM_ID,
                false,
            ));
        }
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.log_wrapper.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.compression_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.mpl_core_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.system_program.key,
            false,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = MintV2InstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::MPL_BUBBLEGUM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(13 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.tree_config.clone());
        account_infos.push(self.payer.clone());
        if let Some(tree_creator_or_delegate) = self.tree_creator_or_delegate {
            account_infos.push(tree_creator_or_delegate.clone());
        }
        if let Some(collection_authority) = self.collection_authority {
            account_infos.push(collection_authority.clone());
        }
        account_infos.push(self.leaf_owner.clone());
        if let Some(leaf_delegate) = self.leaf_delegate {
            account_infos.push(leaf_delegate.clone());
        }
        account_infos.push(self.merkle_tree.clone());
        if let Some(core_collection) = self.core_collection {
            account_infos.push(core_collection.clone());
        }
        if let Some(mpl_core_cpi_signer) = self.mpl_core_cpi_signer {
            account_infos.push(mpl_core_cpi_signer.clone());
        }
        account_infos.push(self.log_wrapper.clone());
        account_infos.push(self.compression_program.clone());
        account_infos.push(self.mpl_core_program.clone());
        account_infos.push(self.system_program.clone());
        remaining_accounts
            .iter()
            .for_each(|remaining_account| account_infos.push(remaining_account.0.clone()));

        if signers_seeds.is_empty() {
            solana_program::program::invoke(&instruction, &account_infos)
        } else {
            solana_program::program::invoke_signed(&instruction, &account_infos, signers_seeds)
        }
    }
}

/// `mint_v2` CPI instruction builder.
pub struct MintV2CpiBuilder<'a, 'b> {
    instruction: Box<MintV2CpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> MintV2CpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(MintV2CpiBuilderInstruction {
            __program: program,
            tree_config: None,
            payer: None,
            tree_creator_or_delegate: None,
            collection_authority: None,
            leaf_owner: None,
            leaf_delegate: None,
            merkle_tree: None,
            core_collection: None,
            mpl_core_cpi_signer: None,
            log_wrapper: None,
            compression_program: None,
            mpl_core_program: None,
            system_program: None,
            metadata: None,
            asset_data: None,
            asset_data_schema: None,
            __remaining_accounts: Vec::new(),
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn tree_config(
        &mut self,
        tree_config: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.tree_config = Some(tree_config);
        self
    }
    #[inline(always)]
    pub fn payer(&mut self, payer: &'b solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.payer = Some(payer);
        self
    }
    /// `[optional account]`
    /// Optional tree delegate, defaults to `payer`
    #[inline(always)]
    pub fn tree_creator_or_delegate(
        &mut self,
        tree_creator_or_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.tree_creator_or_delegate = tree_creator_or_delegate;
        self
    }
    /// `[optional account]`
    /// Optional collection authority, defaults to `tree_delegate`
    #[inline(always)]
    pub fn collection_authority(
        &mut self,
        collection_authority: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.collection_authority = collection_authority;
        self
    }
    #[inline(always)]
    pub fn leaf_owner(
        &mut self,
        leaf_owner: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.leaf_owner = Some(leaf_owner);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn leaf_delegate(
        &mut self,
        leaf_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.leaf_delegate = leaf_delegate;
        self
    }
    #[inline(always)]
    pub fn merkle_tree(
        &mut self,
        merkle_tree: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.merkle_tree = Some(merkle_tree);
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn core_collection(
        &mut self,
        core_collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.core_collection = core_collection;
        self
    }
    /// `[optional account]`
    #[inline(always)]
    pub fn mpl_core_cpi_signer(
        &mut self,
        mpl_core_cpi_signer: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    ) -> &mut Self {
        self.instruction.mpl_core_cpi_signer = mpl_core_cpi_signer;
        self
    }
    #[inline(always)]
    pub fn log_wrapper(
        &mut self,
        log_wrapper: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.log_wrapper = Some(log_wrapper);
        self
    }
    #[inline(always)]
    pub fn compression_program(
        &mut self,
        compression_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.compression_program = Some(compression_program);
        self
    }
    #[inline(always)]
    pub fn mpl_core_program(
        &mut self,
        mpl_core_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.mpl_core_program = Some(mpl_core_program);
        self
    }
    #[inline(always)]
    pub fn system_program(
        &mut self,
        system_program: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn metadata(&mut self, metadata: MetadataArgsV2) -> &mut Self {
        self.instruction.metadata = Some(metadata);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn asset_data(&mut self, asset_data: Vec<u8>) -> &mut Self {
        self.instruction.asset_data = Some(asset_data);
        self
    }
    /// `[optional argument]`
    #[inline(always)]
    pub fn asset_data_schema(&mut self, asset_data_schema: AssetDataSchema) -> &mut Self {
        self.instruction.asset_data_schema = Some(asset_data_schema);
        self
    }
    /// Add an additional account to the instruction.
    #[inline(always)]
    pub fn add_remaining_account(
        &mut self,
        account: &'b solana_program::account_info::AccountInfo<'a>,
        is_writable: bool,
        is_signer: bool,
    ) -> &mut Self {
        self.instruction
            .__remaining_accounts
            .push((account, is_writable, is_signer));
        self
    }
    /// Add additional accounts to the instruction.
    ///
    /// Each account is represented by a tuple of the `AccountInfo`, a `bool` indicating whether the account is writable or not,
    /// and a `bool` indicating whether the account is a signer or not.
    #[inline(always)]
    pub fn add_remaining_accounts(
        &mut self,
        accounts: &[(
            &'b solana_program::account_info::AccountInfo<'a>,
            bool,
            bool,
        )],
    ) -> &mut Self {
        self.instruction
            .__remaining_accounts
            .extend_from_slice(accounts);
        self
    }
    #[inline(always)]
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed(&[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        let args = MintV2InstructionArgs {
            metadata: self
                .instruction
                .metadata
                .clone()
                .expect("metadata is not set"),
            asset_data: self.instruction.asset_data.clone(),
            asset_data_schema: self.instruction.asset_data_schema.clone(),
        };
        let instruction = MintV2Cpi {
            __program: self.instruction.__program,

            tree_config: self
                .instruction
                .tree_config
                .expect("tree_config is not set"),

            payer: self.instruction.payer.expect("payer is not set"),

            tree_creator_or_delegate: self.instruction.tree_creator_or_delegate,

            collection_authority: self.instruction.collection_authority,

            leaf_owner: self.instruction.leaf_owner.expect("leaf_owner is not set"),

            leaf_delegate: self.instruction.leaf_delegate,

            merkle_tree: self
                .instruction
                .merkle_tree
                .expect("merkle_tree is not set"),

            core_collection: self.instruction.core_collection,

            mpl_core_cpi_signer: self.instruction.mpl_core_cpi_signer,

            log_wrapper: self
                .instruction
                .log_wrapper
                .expect("log_wrapper is not set"),

            compression_program: self
                .instruction
                .compression_program
                .expect("compression_program is not set"),

            mpl_core_program: self
                .instruction
                .mpl_core_program
                .expect("mpl_core_program is not set"),

            system_program: self
                .instruction
                .system_program
                .expect("system_program is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct MintV2CpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    tree_config: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    payer: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    tree_creator_or_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    collection_authority: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    leaf_owner: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    leaf_delegate: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    merkle_tree: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    core_collection: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mpl_core_cpi_signer: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    log_wrapper: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    compression_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    mpl_core_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    metadata: Option<MetadataArgsV2>,
    asset_data: Option<Vec<u8>>,
    asset_data_schema: Option<AssetDataSchema>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
