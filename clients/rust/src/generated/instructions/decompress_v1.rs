//! This code was AUTOGENERATED using the kinobi library.
//! Please DO NOT EDIT THIS FILE, instead use visitors
//! to add features, then rerun kinobi to update it.
//!
//! [https://github.com/metaplex-foundation/kinobi]
//!

use crate::generated::types::MetadataArgs;
use borsh::BorshDeserialize;
use borsh::BorshSerialize;

/// Accounts.
pub struct DecompressV1 {
    pub voucher: solana_program::pubkey::Pubkey,

    pub leaf_owner: solana_program::pubkey::Pubkey,

    pub token_account: solana_program::pubkey::Pubkey,

    pub mint: solana_program::pubkey::Pubkey,

    pub mint_authority: solana_program::pubkey::Pubkey,

    pub metadata_account: solana_program::pubkey::Pubkey,

    pub master_edition: solana_program::pubkey::Pubkey,

    pub system_program: solana_program::pubkey::Pubkey,

    pub sysvar_rent: solana_program::pubkey::Pubkey,

    pub token_metadata_program: solana_program::pubkey::Pubkey,

    pub token_program: solana_program::pubkey::Pubkey,

    pub associated_token_program: solana_program::pubkey::Pubkey,

    pub log_wrapper: solana_program::pubkey::Pubkey,
}

impl DecompressV1 {
    #[allow(clippy::vec_init_then_push)]
    pub fn instruction(
        &self,
        args: DecompressV1InstructionArgs,
    ) -> solana_program::instruction::Instruction {
        let mut accounts = Vec::with_capacity(13);
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.voucher,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.leaf_owner,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.token_account,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.mint, false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.mint_authority,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.metadata_account,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            self.master_edition,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.system_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.sysvar_rent,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.token_metadata_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.token_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.associated_token_program,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            self.log_wrapper,
            false,
        ));
        let mut data = DecompressV1InstructionData::new().try_to_vec().unwrap();
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
struct DecompressV1InstructionData {
    discriminator: [u8; 8],
}

impl DecompressV1InstructionData {
    fn new() -> Self {
        Self {
            discriminator: [54, 85, 76, 70, 228, 250, 164, 81],
        }
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct DecompressV1InstructionArgs {
    pub metadata: MetadataArgs,
}

/// Instruction builder.
#[derive(Default)]
pub struct DecompressV1Builder {
    voucher: Option<solana_program::pubkey::Pubkey>,
    leaf_owner: Option<solana_program::pubkey::Pubkey>,
    token_account: Option<solana_program::pubkey::Pubkey>,
    mint: Option<solana_program::pubkey::Pubkey>,
    mint_authority: Option<solana_program::pubkey::Pubkey>,
    metadata_account: Option<solana_program::pubkey::Pubkey>,
    master_edition: Option<solana_program::pubkey::Pubkey>,
    system_program: Option<solana_program::pubkey::Pubkey>,
    sysvar_rent: Option<solana_program::pubkey::Pubkey>,
    token_metadata_program: Option<solana_program::pubkey::Pubkey>,
    token_program: Option<solana_program::pubkey::Pubkey>,
    associated_token_program: Option<solana_program::pubkey::Pubkey>,
    log_wrapper: Option<solana_program::pubkey::Pubkey>,
    metadata: Option<MetadataArgs>,
}

impl DecompressV1Builder {
    pub fn new() -> Self {
        Self::default()
    }
    #[inline(always)]
    pub fn voucher(&mut self, voucher: solana_program::pubkey::Pubkey) -> &mut Self {
        self.voucher = Some(voucher);
        self
    }
    #[inline(always)]
    pub fn leaf_owner(&mut self, leaf_owner: solana_program::pubkey::Pubkey) -> &mut Self {
        self.leaf_owner = Some(leaf_owner);
        self
    }
    #[inline(always)]
    pub fn token_account(&mut self, token_account: solana_program::pubkey::Pubkey) -> &mut Self {
        self.token_account = Some(token_account);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint = Some(mint);
        self
    }
    #[inline(always)]
    pub fn mint_authority(&mut self, mint_authority: solana_program::pubkey::Pubkey) -> &mut Self {
        self.mint_authority = Some(mint_authority);
        self
    }
    #[inline(always)]
    pub fn metadata_account(
        &mut self,
        metadata_account: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.metadata_account = Some(metadata_account);
        self
    }
    #[inline(always)]
    pub fn master_edition(&mut self, master_edition: solana_program::pubkey::Pubkey) -> &mut Self {
        self.master_edition = Some(master_edition);
        self
    }
    #[inline(always)]
    pub fn system_program(&mut self, system_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn sysvar_rent(&mut self, sysvar_rent: solana_program::pubkey::Pubkey) -> &mut Self {
        self.sysvar_rent = Some(sysvar_rent);
        self
    }
    #[inline(always)]
    pub fn token_metadata_program(
        &mut self,
        token_metadata_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.token_metadata_program = Some(token_metadata_program);
        self
    }
    #[inline(always)]
    pub fn token_program(&mut self, token_program: solana_program::pubkey::Pubkey) -> &mut Self {
        self.token_program = Some(token_program);
        self
    }
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: solana_program::pubkey::Pubkey,
    ) -> &mut Self {
        self.associated_token_program = Some(associated_token_program);
        self
    }
    #[inline(always)]
    pub fn log_wrapper(&mut self, log_wrapper: solana_program::pubkey::Pubkey) -> &mut Self {
        self.log_wrapper = Some(log_wrapper);
        self
    }
    #[inline(always)]
    pub fn metadata(&mut self, metadata: MetadataArgs) -> &mut Self {
        self.metadata = Some(metadata);
        self
    }
    #[allow(clippy::clone_on_copy)]
    pub fn build(&self) -> solana_program::instruction::Instruction {
        let accounts =
            DecompressV1 {
                voucher: self.voucher.expect("voucher is not set"),
                leaf_owner: self.leaf_owner.expect("leaf_owner is not set"),
                token_account: self.token_account.expect("token_account is not set"),
                mint: self.mint.expect("mint is not set"),
                mint_authority: self.mint_authority.expect("mint_authority is not set"),
                metadata_account: self.metadata_account.expect("metadata_account is not set"),
                master_edition: self.master_edition.expect("master_edition is not set"),
                system_program: self
                    .system_program
                    .unwrap_or(solana_program::pubkey!("11111111111111111111111111111111")),
                sysvar_rent: self.sysvar_rent.unwrap_or(solana_program::pubkey!(
                    "SysvarRent111111111111111111111111111111111"
                )),
                token_metadata_program: self.token_metadata_program.unwrap_or(
                    solana_program::pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
                ),
                token_program: self.token_program.unwrap_or(solana_program::pubkey!(
                    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
                )),
                associated_token_program: self.associated_token_program.unwrap_or(
                    solana_program::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
                ),
                log_wrapper: self.log_wrapper.unwrap_or(solana_program::pubkey!(
                    "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
                )),
            };
        let args = DecompressV1InstructionArgs {
            metadata: self.metadata.clone().expect("metadata is not set"),
        };

        accounts.instruction(args)
    }
}

/// `decompress_v1` CPI instruction.
pub struct DecompressV1Cpi<'a> {
    /// The program to invoke.
    pub __program: &'a solana_program::account_info::AccountInfo<'a>,

    pub voucher: &'a solana_program::account_info::AccountInfo<'a>,

    pub leaf_owner: &'a solana_program::account_info::AccountInfo<'a>,

    pub token_account: &'a solana_program::account_info::AccountInfo<'a>,

    pub mint: &'a solana_program::account_info::AccountInfo<'a>,

    pub mint_authority: &'a solana_program::account_info::AccountInfo<'a>,

    pub metadata_account: &'a solana_program::account_info::AccountInfo<'a>,

    pub master_edition: &'a solana_program::account_info::AccountInfo<'a>,

    pub system_program: &'a solana_program::account_info::AccountInfo<'a>,

    pub sysvar_rent: &'a solana_program::account_info::AccountInfo<'a>,

    pub token_metadata_program: &'a solana_program::account_info::AccountInfo<'a>,

    pub token_program: &'a solana_program::account_info::AccountInfo<'a>,

    pub associated_token_program: &'a solana_program::account_info::AccountInfo<'a>,

    pub log_wrapper: &'a solana_program::account_info::AccountInfo<'a>,
    /// The arguments for the instruction.
    pub __args: DecompressV1InstructionArgs,
}

impl<'a> DecompressV1Cpi<'a> {
    pub fn invoke(&self) -> solana_program::entrypoint::ProgramResult {
        self.invoke_signed(&[])
    }
    #[allow(clippy::clone_on_copy)]
    #[allow(clippy::vec_init_then_push)]
    pub fn invoke_signed(
        &self,
        signers_seeds: &[&[&[u8]]],
    ) -> solana_program::entrypoint::ProgramResult {
        let mut accounts = Vec::with_capacity(13);
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.voucher.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.leaf_owner.key,
            true,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.token_account.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.mint.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.mint_authority.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.metadata_account.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new(
            *self.master_edition.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.system_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.sysvar_rent.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.token_metadata_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.token_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.associated_token_program.key,
            false,
        ));
        accounts.push(solana_program::instruction::AccountMeta::new_readonly(
            *self.log_wrapper.key,
            false,
        ));
        let mut data = DecompressV1InstructionData::new().try_to_vec().unwrap();
        let mut args = self.__args.try_to_vec().unwrap();
        data.append(&mut args);

        let instruction = solana_program::instruction::Instruction {
            program_id: crate::MPL_BUBBLEGUM_ID,
            accounts,
            data,
        };
        let mut account_infos = Vec::with_capacity(13 + 1);
        account_infos.push(self.__program.clone());
        account_infos.push(self.voucher.clone());
        account_infos.push(self.leaf_owner.clone());
        account_infos.push(self.token_account.clone());
        account_infos.push(self.mint.clone());
        account_infos.push(self.mint_authority.clone());
        account_infos.push(self.metadata_account.clone());
        account_infos.push(self.master_edition.clone());
        account_infos.push(self.system_program.clone());
        account_infos.push(self.sysvar_rent.clone());
        account_infos.push(self.token_metadata_program.clone());
        account_infos.push(self.token_program.clone());
        account_infos.push(self.associated_token_program.clone());
        account_infos.push(self.log_wrapper.clone());

        if signers_seeds.is_empty() {
            solana_program::program::invoke(&instruction, &account_infos)
        } else {
            solana_program::program::invoke_signed(&instruction, &account_infos, signers_seeds)
        }
    }
}

/// `decompress_v1` CPI instruction builder.
pub struct DecompressV1CpiBuilder<'a> {
    instruction: Box<DecompressV1CpiBuilderInstruction<'a>>,
}

impl<'a> DecompressV1CpiBuilder<'a> {
    pub fn new(program: &'a solana_program::account_info::AccountInfo<'a>) -> Self {
        let instruction = Box::new(DecompressV1CpiBuilderInstruction {
            __program: program,
            voucher: None,
            leaf_owner: None,
            token_account: None,
            mint: None,
            mint_authority: None,
            metadata_account: None,
            master_edition: None,
            system_program: None,
            sysvar_rent: None,
            token_metadata_program: None,
            token_program: None,
            associated_token_program: None,
            log_wrapper: None,
            metadata: None,
        });
        Self { instruction }
    }
    #[inline(always)]
    pub fn voucher(
        &mut self,
        voucher: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.voucher = Some(voucher);
        self
    }
    #[inline(always)]
    pub fn leaf_owner(
        &mut self,
        leaf_owner: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.leaf_owner = Some(leaf_owner);
        self
    }
    #[inline(always)]
    pub fn token_account(
        &mut self,
        token_account: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_account = Some(token_account);
        self
    }
    #[inline(always)]
    pub fn mint(&mut self, mint: &'a solana_program::account_info::AccountInfo<'a>) -> &mut Self {
        self.instruction.mint = Some(mint);
        self
    }
    #[inline(always)]
    pub fn mint_authority(
        &mut self,
        mint_authority: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.mint_authority = Some(mint_authority);
        self
    }
    #[inline(always)]
    pub fn metadata_account(
        &mut self,
        metadata_account: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.metadata_account = Some(metadata_account);
        self
    }
    #[inline(always)]
    pub fn master_edition(
        &mut self,
        master_edition: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.master_edition = Some(master_edition);
        self
    }
    #[inline(always)]
    pub fn system_program(
        &mut self,
        system_program: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.system_program = Some(system_program);
        self
    }
    #[inline(always)]
    pub fn sysvar_rent(
        &mut self,
        sysvar_rent: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.sysvar_rent = Some(sysvar_rent);
        self
    }
    #[inline(always)]
    pub fn token_metadata_program(
        &mut self,
        token_metadata_program: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_metadata_program = Some(token_metadata_program);
        self
    }
    #[inline(always)]
    pub fn token_program(
        &mut self,
        token_program: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.token_program = Some(token_program);
        self
    }
    #[inline(always)]
    pub fn associated_token_program(
        &mut self,
        associated_token_program: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.associated_token_program = Some(associated_token_program);
        self
    }
    #[inline(always)]
    pub fn log_wrapper(
        &mut self,
        log_wrapper: &'a solana_program::account_info::AccountInfo<'a>,
    ) -> &mut Self {
        self.instruction.log_wrapper = Some(log_wrapper);
        self
    }
    #[inline(always)]
    pub fn metadata(&mut self, metadata: MetadataArgs) -> &mut Self {
        self.instruction.metadata = Some(metadata);
        self
    }
    #[allow(clippy::clone_on_copy)]
    pub fn build(&self) -> DecompressV1Cpi<'a> {
        let args = DecompressV1InstructionArgs {
            metadata: self
                .instruction
                .metadata
                .clone()
                .expect("metadata is not set"),
        };

        DecompressV1Cpi {
            __program: self.instruction.__program,

            voucher: self.instruction.voucher.expect("voucher is not set"),

            leaf_owner: self.instruction.leaf_owner.expect("leaf_owner is not set"),

            token_account: self
                .instruction
                .token_account
                .expect("token_account is not set"),

            mint: self.instruction.mint.expect("mint is not set"),

            mint_authority: self
                .instruction
                .mint_authority
                .expect("mint_authority is not set"),

            metadata_account: self
                .instruction
                .metadata_account
                .expect("metadata_account is not set"),

            master_edition: self
                .instruction
                .master_edition
                .expect("master_edition is not set"),

            system_program: self
                .instruction
                .system_program
                .expect("system_program is not set"),

            sysvar_rent: self
                .instruction
                .sysvar_rent
                .expect("sysvar_rent is not set"),

            token_metadata_program: self
                .instruction
                .token_metadata_program
                .expect("token_metadata_program is not set"),

            token_program: self
                .instruction
                .token_program
                .expect("token_program is not set"),

            associated_token_program: self
                .instruction
                .associated_token_program
                .expect("associated_token_program is not set"),

            log_wrapper: self
                .instruction
                .log_wrapper
                .expect("log_wrapper is not set"),
            __args: args,
        }
    }
}

struct DecompressV1CpiBuilderInstruction<'a> {
    __program: &'a solana_program::account_info::AccountInfo<'a>,
    voucher: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    leaf_owner: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    token_account: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    mint: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    mint_authority: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    metadata_account: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    master_edition: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    system_program: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    sysvar_rent: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    token_metadata_program: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    token_program: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    associated_token_program: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    log_wrapper: Option<&'a solana_program::account_info::AccountInfo<'a>>,
    metadata: Option<MetadataArgs>,
}