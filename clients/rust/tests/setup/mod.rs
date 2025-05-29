mod tree_manager;
pub use tree_manager::*;

use solana_program::pubkey::Pubkey;
use solana_program_test::{ProgramTest, ProgramTestContext};
use solana_sdk::account::Account;

/// Asserts that a given error is a custom instruction error.
#[macro_export]
macro_rules! assert_custom_instruction_error {
    ($ix:expr, $error:expr, $matcher:pat) => {
        match $error {
            solana_program_test::BanksClientError::TransactionError(
                solana_sdk::transaction::TransactionError::InstructionError(
                    $ix,
                    solana_sdk::instruction::InstructionError::Custom(x),
                ),
            ) => match num_traits::FromPrimitive::from_i32(x as i32) {
                Some($matcher) => assert!(true),
                Some(other) => {
                    assert!(
                        false,
                        "Expected another custom instruction error than '{:#?}'",
                        other
                    )
                }
                None => assert!(false, "Expected custom instruction error"),
            },
            err => assert!(
                false,
                "Expected custom instruction error but got '{:#?}'",
                err
            ),
        };
    };
}

/// Setup a program test with the required programs.
pub fn create_program_test() -> ProgramTest {
    let mut program_test = ProgramTest::new("bubblegum", mpl_bubblegum::ID, None);
    program_test.add_program("spl_account_compression", spl_account_compression::ID, None);
    program_test.add_program("spl_noop", spl_noop::ID, None);
    program_test.add_program("mpl_account_compression", mpl_account_compression::ID, None);
    program_test.add_program("mpl_noop", mpl_noop::ID, None);
    program_test.add_program("mpl_core_program", mpl_core::ID, None);
    program_test
}

/// Looks up the account for a given pubkey.
pub async fn find_account(context: &mut ProgramTestContext, pubkey: &Pubkey) -> Option<Account> {
    context.banks_client.get_account(*pubkey).await.unwrap()
}

/// Returns the `Account` for a given pubkey.
pub async fn get_account(context: &mut ProgramTestContext, pubkey: &Pubkey) -> Account {
    context
        .banks_client
        .get_account(*pubkey)
        .await
        .unwrap()
        .expect("account not found")
}
