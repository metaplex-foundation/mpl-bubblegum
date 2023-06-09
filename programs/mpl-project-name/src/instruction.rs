use borsh::{BorshDeserialize, BorshSerialize};
use shank::ShankInstruction;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
};

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Eq, Debug, Clone)]
pub struct CreateArgs {
    /// Some description for foo.
    pub foo: u16,
    /// Some description for bar.
    pub bar: u32,
}

#[derive(Debug, Clone, ShankInstruction, BorshSerialize, BorshDeserialize)]
#[rustfmt::skip]
pub enum MplProjectNameInstruction {
    /// Create My Account.
    /// A detailed description of the instruction.
    #[account(0, writable, signer, name="address", desc = "The address of the new account")]
    #[account(1, name="authority", desc = "The authority of the new account")]
    #[account(2, writable, signer, name="payer", desc = "The account paying for the storage fees")]
    #[account(3, name="system_program", desc = "The system program")]
    Create(CreateArgs),
}
pub fn create(
    address: &Pubkey,
    authority: &Pubkey,
    payer: &Pubkey,
    args: CreateArgs,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(*address, true),
        AccountMeta::new_readonly(*authority, false),
        AccountMeta::new(*payer, true),
        AccountMeta::new_readonly(solana_program::system_program::ID, false),
    ];
    Instruction {
        program_id: crate::ID,
        accounts,
        data: MplProjectNameInstruction::Create(args)
            .try_to_vec()
            .unwrap(),
    }
}
