use anchor_lang::{prelude::*, solana_program::clock::Clock, system_program::System};
use mplx_staking_states::state::{
    registrar::Registrar, Voter, REGISTRAR_DISCRIMINATOR, VOTER_DISCRIMINATOR,
};
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::{
    error::BubblegumError,
    state::{TreeConfig, MINIMUM_STAKE, REALM, REALM_GOVERNING_MINT},
};

#[derive(Accounts)]
pub struct FinalizeTreeWithRoot<'info> {
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    /// CHECK:
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(mut)]
    pub staker: Signer<'info>,
    /// CHECK:
    pub registrar: UncheckedAccount<'info>,
    /// CHECK:
    pub voter: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn finalize_tree_with_root<'info>(
    ctx: Context<'_, '_, '_, 'info, FinalizeTreeWithRoot<'info>>,
    root: [u8; 32],
    rightmost_leaf: [u8; 32],
    rightmost_index: u32,
    _metadata_url: String,
    _metadata_hash: String,
) -> Result<()> {
    // TODO: charge protocol fees

    check_stake(
        &ctx.accounts.staker.to_account_info(),
        &ctx.accounts.registrar.to_account_info(),
        &ctx.accounts.voter.to_account_info(),
    )?;

    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let seed = merkle_tree.key();
    let seeds = &[seed.as_ref(), &[ctx.bumps.tree_authority]];

    let authority = &mut ctx.accounts.tree_authority;
    authority.set_inner(TreeConfig {
        tree_delegate: authority.tree_creator,
        num_minted: (rightmost_index + 1) as u64,
        ..**authority
    });
    let authority_pda_signer = &[&seeds[..]];

    finalize_tree(
        root,
        rightmost_leaf,
        rightmost_index,
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.tree_authority.to_account_info(),
        &merkle_tree,
        &ctx.accounts.log_wrapper.to_account_info(),
        authority_pda_signer,
        ctx.remaining_accounts,
    )
}

fn check_stake<'info>(
    staker_acc: &AccountInfo<'info>,
    registrar_acc: &AccountInfo<'info>,
    voter_acc: &AccountInfo<'info>,
) -> Result<()> {
    assert_eq!(registrar_acc.owner, &mplx_staking_states::ID);
    assert_eq!(voter_acc.owner, &mplx_staking_states::ID);

    let generated_registrar = Pubkey::find_program_address(
        &[
            REALM.to_bytes().as_ref(),
            b"registrar".as_ref(),
            REALM_GOVERNING_MINT.to_bytes().as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;
    assert_eq!(&generated_registrar, registrar_acc.key);

    let generated_voter_key = Pubkey::find_program_address(
        &[
            registrar_acc.key.to_bytes().as_ref(),
            b"voter".as_ref(),
            staker_acc.key.to_bytes().as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;
    assert_eq!(&generated_voter_key, voter_acc.key);

    let registrar_bytes = registrar_acc.to_account_info().data;

    assert_eq!((*registrar_bytes.borrow())[..8], REGISTRAR_DISCRIMINATOR);

    let registrar: Registrar = *bytemuck::from_bytes(&(*registrar_bytes.borrow())[8..]);

    assert_eq!(registrar.realm, REALM);
    assert_eq!(registrar.realm_governing_token_mint, REALM_GOVERNING_MINT);

    let voter_bytes = voter_acc.to_account_info().data;

    assert_eq!((*voter_bytes.borrow())[..8], VOTER_DISCRIMINATOR);

    let voter: Voter = *bytemuck::from_bytes(&(*voter_bytes.borrow())[8..]);

    assert_eq!(&voter.registrar, registrar_acc.key);
    assert_eq!(&voter.voter_authority, staker_acc.key);

    let clock = Clock::get()?;

    let amount_locked: u64 = voter
        .deposits
        .iter()
        .filter_map(|d| {
            if d.is_used
                && (d.lockup.end_ts > (clock.unix_timestamp as u64) && !d.lockup.cooldown_requested)
            {
                Some(d.amount_deposited_native)
            } else {
                None
            }
        })
        .sum();

    if amount_locked < MINIMUM_STAKE {
        return Err(BubblegumError::NotEnoughStakeForOperation.into());
    }

    Ok(())
}

fn finalize_tree<'info>(
    root: [u8; 32],
    rightmost_leaf: [u8; 32],
    rightmost_index: u32,
    compression_program: &AccountInfo<'info>,
    tree_authority: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    noop: &AccountInfo<'info>,
    authority_pda_signer: &[&[&[u8]]; 1],
    remaining_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    let cpi_ctx = CpiContext::new_with_signer(
        compression_program.clone(),
        spl_account_compression::cpi::accounts::Modify {
            merkle_tree: merkle_tree.clone(),
            authority: tree_authority.clone(),
            noop: noop.clone(),
        },
        authority_pda_signer,
    )
    .with_remaining_accounts(remaining_accounts.to_vec());
    spl_account_compression::cpi::finalize_merkle_tree_with_root(
        cpi_ctx,
        root,
        rightmost_leaf,
        rightmost_index,
    )
}
