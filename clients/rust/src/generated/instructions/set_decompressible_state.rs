//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::DecompressibleState;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct SetDecompressibleState {
    pub tree_config: solana_program::pubkey::Pubkey,

    pub tree_creator: solana_program::pubkey::Pubkey,
}

impl SetDecompressibleState {
    pub fn instruction(
        &self,
        args: SetDecompressibleStateInstructionArgs,
    ) -> solana_program::instruction::Instruction {
        self.instruction_with_remaining_accounts(args, &[])
    }
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction_with_remaining_accounts(
        &self,
        args: SetDecompressibleStateInstructionArgs,
        remaining_accounts: &[solana_program::instruction::AccountMeta],
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(2 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.tree_config,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.tree_creator,
            true,
        ));
        accounts.extend_from_slice(remaining_accounts);
        let mut data = SetDecompressibleStateInstructionData::new()
            .try_to_vec()
            .unwrap();
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
struct SetDecompressibleStateInstructionData {
    discriminator: [u8; 8],
}

impl SetDecompressibleStateInstructionData {
    fn new() -> Self {
        Self {
            discriminator: [82, 104, 152, 6, 149, 111, 100, 13],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct SetDecompressibleStateInstructionArgs {
    pub decompressable_state: DecompressibleState,
}

/// Instruction builder.
#[derive(Default)]
pub struct SetDecompressibleStateBuilder {
    tree_config: Option<solana_program::pubkey::Pubkey>,
    tree_creator: Option<solana_program::pubkey::Pubkey>,
    decompressable_state: Option<DecompressibleState>,
    __remaining_accounts: Vec<solana_program::instruction::AccountMeta>,
}

impl SetDecompressibleStateBuilder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn tree_config(&mut self, tree_config: solana_program::pubkey::Pubkey) -> &mut Self {
        self.tree_config = Some(tree_config);
        self
    }
    #[inline(always)]
    pub fn tree_creator(&mut self, tree_creator: solana_program::pubkey::Pubkey) -> &mut Self {
        self.tree_creator = Some(tree_creator);
        self
    }
    #[inline(always)]
    pub fn decompressable_state(&mut self, decompressable_state: DecompressibleState) -> &mut Self {
        self.decompressable_state = Some(decompressable_state);
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
        let accounts = SetDecompressibleState {
            tree_config: self.tree_config.expect("tree_config is not set"),
            tree_creator: self.tree_creator.expect("tree_creator is not set"),
        };
        let args = SetDecompressibleStateInstructionArgs {
            decompressable_state: self
                .decompressable_state
                .clone()
                .expect("decompressable_state is not set"),
        };

        accounts.instruction_with_remaining_accounts(args, &self.__remaining_accounts)
    }
}

/// `set_decompressible_state` CPI accounts.
pub struct SetDecompressibleStateCpiAccounts<'a, 'b> {
    pub tree_config: &'b solana_program::account_info::AccountInfo<'a>,

    pub tree_creator: &'b solana_program::account_info::AccountInfo<'a>,
}

/// `set_decompressible_state` CPI instruction.
pub struct SetDecompressibleStateCpi<'a, 'b> {
    /// The program to invoke.
    pub __program: &'b solana_program::account_info::AccountInfo<'a>,

    pub tree_config: &'b solana_program::account_info::AccountInfo<'a>,

    pub tree_creator: &'b solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: SetDecompressibleStateInstructionArgs,
}

impl<'a, 'b> SetDecompressibleStateCpi<'a, 'b> {
    pub fn new(
        program: &'b solana_program::account_info::AccountInfo<'a>,
        accounts: SetDecompressibleStateCpiAccounts<'a, 'b>,
        args: SetDecompressibleStateInstructionArgs,
    ) -> Self {
        Self {
            __program: program,
            tree_config: accounts.tree_config,
            tree_creator: accounts.tree_creator,
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
        let mut accounts = Vec::with_capacity(2 + remaining_accounts.len());
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.tree_config.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.tree_creator.key,
            true,
        ));
        remaining_accounts.iter().for_each(|remaining_account| {
            accounts.push(solana_program::instruction::AccountMeta {
                pubkey: *remaining_account.0.key,
                is_signer: remaining_account.1,
                is_writable: remaining_account.2,
            })
        });
        let mut data = SetDecompressibleStateInstructionData::new()
            .try_to_vec()
            .unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::MPL_BUBBLEGUM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(2 + 1 + remaining_accounts.len());
        account_infos.push(self.__program.clone());
        account_infos.push(self.tree_config.clone());
        account_infos.push(self.tree_creator.clone());
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

/// `set_decompressible_state` CPI instruction builder.
pub struct SetDecompressibleStateCpiBuilder<'a, 'b> {
    instruction: Box<SetDecompressibleStateCpiBuilderInstruction<'a, 'b>>,
}

impl<'a, 'b> SetDecompressibleStateCpiBuilder<'a, 'b> {
    pub fn new(program: &'b solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(SetDecompressibleStateCpiBuilderInstruction {
            __program: program,
            tree_config: None,
            tree_creator: None,
            decompressable_state: None,
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
    pub fn tree_creator(
        &mut self,
        tree_creator: &'b solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.tree_creator = Some(tree_creator);
        self
    }
    #[inline(always)]
    pub fn decompressable_state(&mut self, decompressable_state: DecompressibleState) -> &mut Self {
        self.instruction.decompressable_state = Some(decompressable_state);
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
        let args = SetDecompressibleStateInstructionArgs {
            decompressable_state: self
                .instruction
                .decompressable_state
                .clone()
                .expect("decompressable_state is not set"),
        };
        let instruction = SetDecompressibleStateCpi {
            __program: self.instruction.__program,

            tree_config: self
                .instruction
                .tree_config
                .expect("tree_config is not set"),

            tree_creator: self
                .instruction
                .tree_creator
                .expect("tree_creator is not set"),
            __args: args,
        };
        instruction.invoke_signed_with_remaining_accounts(
            signers_seeds,
            &self.instruction.__remaining_accounts,
        )
    }
}

struct SetDecompressibleStateCpiBuilderInstruction<'a, 'b> {
    __program: &'b solana_program::account_info::AccountInfo<'a>,
    tree_config: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    tree_creator: Option<&'b solana_program::account_info::AccountInfo<'a>>,
    decompressable_state: Option<DecompressibleState>,
    /// Additional instruction accounts `(AccountInfo, is_writable, is_signer)`.
    __remaining_accounts: Vec<(
        &'b solana_program::account_info::AccountInfo<'a>,
        bool,
        bool,
    )>,
}
