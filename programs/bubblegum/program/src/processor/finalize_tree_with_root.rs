use std::str::FromStr;

use anchor_lang::{prelude::*, solana_program::clock::Clock, system_program::System};
use mplx_staking_states::state::{registrar::Registrar, Voter, REGISTRAR_DISCRIMINATOR};
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::{
    error::BubblegumError,
    state::{
        TreeConfig, MINIMUM_WEIGHTED_STAKE, PROTOCOL_FEE_PER_1024_ASSETS, VOTER_DISCRIMINATOR,
    },
};

use mpl_common_constants::constants::{DAO_GOVERNING_MINT, DAO_PUBKEY, FEE_RECEIVER};

const DISCRIMINATOR_LEN: usize = REGISTRAR_DISCRIMINATOR.len();
#[derive(Accounts)]
pub struct FinalizeTreeWithRoot<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(mut)]
    /// CHECK:
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub tree_delegate: Signer<'info>,
    pub staker: Signer<'info>,
    /// CHECK:
    pub registrar: UncheckedAccount<'info>,
    /// CHECK:
    pub voter: UncheckedAccount<'info>,
    /// CHECK:
    pub mining: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub fee_receiver: UncheckedAccount<'info>,
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
    let incoming_tree_delegate = ctx.accounts.tree_delegate.key();
    let authority = &mut ctx.accounts.tree_authority;

    require!(
        incoming_tree_delegate == authority.tree_delegate,
        BubblegumError::TreeAuthorityIncorrect,
    );

    require!(
        ctx.accounts.fee_receiver.key.to_bytes() == FEE_RECEIVER,
        BubblegumError::FeeReceiverMismatch
    );
    check_stake(
        &ctx.accounts.staker.to_account_info(),
        &ctx.accounts.registrar.to_account_info(),
        &ctx.accounts.voter.to_account_info(),
        &ctx.accounts.mining.to_account_info(),
    )?;

    let num_minted = (rightmost_index + 1) as u64;
    // charge protocol fees
    let fee = calculate_protocol_fee_lamports(num_minted);
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.payer.key(),
        &ctx.accounts.fee_receiver.key(),
        fee,
    );
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.fee_receiver.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let seed = merkle_tree.key();
    let seeds = &[seed.as_ref(), &[ctx.bumps.tree_authority]];

    if !authority.contains_mint_capacity(num_minted) {
        return Err(BubblegumError::InsufficientMintCapacity.into());
    }
    authority.increment_mint_count_by(num_minted);
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

pub(crate) fn check_stake<'info>(
    staker_acc: &AccountInfo<'info>,
    registrar_acc: &AccountInfo<'info>,
    voter_acc: &AccountInfo<'info>,
    mining_acc: &AccountInfo<'info>,
) -> Result<()> {
    require!(
        registrar_acc.owner == &mplx_staking_states::ID,
        BubblegumError::StakingRegistrarMismatch
    );
    require!(
        voter_acc.owner == &mplx_staking_states::ID,
        BubblegumError::StakingVoterMismatch
    );
    require!(
        mining_acc.owner == &mplx_rewards::ID,
        BubblegumError::MiningOwnerMismatch
    );

    let generated_registrar = Pubkey::find_program_address(
        &[
            DAO_PUBKEY.as_ref(),
            b"registrar".as_ref(),
            DAO_GOVERNING_MINT.as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;
    require!(
        &generated_registrar == registrar_acc.key,
        BubblegumError::StakingRegistrarMismatch
    );

    let generated_voter_key = Pubkey::find_program_address(
        &[
            registrar_acc.key.to_bytes().as_ref(),
            b"voter".as_ref(),
            staker_acc.key.to_bytes().as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;
    require!(
        &generated_voter_key == voter_acc.key,
        BubblegumError::StakingVoterMismatch
    );

    let registrar_bytes = registrar_acc.to_account_info().data;
    let registrar_bytes = registrar_bytes.borrow();
    require!(
        registrar_bytes[..DISCRIMINATOR_LEN] == REGISTRAR_DISCRIMINATOR,
        BubblegumError::StakingRegistrarDiscriminatorMismatch
    );

    let registrar: &Registrar = bytemuck::from_bytes(&registrar_bytes[DISCRIMINATOR_LEN..]);

    require!(
        registrar.realm.to_bytes() == DAO_PUBKEY,
        BubblegumError::StakingRegistrarRealmMismatch
    );
    require!(
        registrar.realm_governing_token_mint.to_bytes() == DAO_GOVERNING_MINT,
        BubblegumError::StakingRegistrarRealmMismatch
    );
    let voter_bytes = voter_acc.to_account_info().data;

    let voter_bytes = voter_bytes.borrow();
    require!(
        voter_bytes[..DISCRIMINATOR_LEN] == VOTER_DISCRIMINATOR,
        BubblegumError::StakingVoterDiscriminatorMismatch
    );
    let voter: &Voter = bytemuck::from_bytes(&voter_bytes[DISCRIMINATOR_LEN..]);

    require!(
        &voter.registrar == registrar_acc.key,
        BubblegumError::StakingVoterRegistrarMismatch
    );
    require!(
        &voter.voter_authority == staker_acc.key,
        BubblegumError::StakingVoterAuthorityMismatch
    );
    let mining_data = mining_acc.data.borrow();
    let mining = mplx_rewards::state::WrappedImmutableMining::from_bytes(&mining_data)?;
    require!(
        &mining.mining.owner == staker_acc.key,
        BubblegumError::MiningOwnerMismatch
    );
    let clock = Clock::get()?;
    let curr_ts = clock.unix_timestamp as u64;
    let weighted_sum: u64 = voter
        .deposits
        .iter()
        .map(|d| d.weighted_stake(curr_ts))
        .sum();

    if weighted_sum
        .checked_add(mining.mining.stake_from_others)
        .ok_or(BubblegumError::NumericalOverflowError)?
        < MINIMUM_WEIGHTED_STAKE
    {
        return Err(BubblegumError::NotEnoughStakeForOperation.into());
    }

    Ok(())
}

pub(crate) fn finalize_tree<'info>(
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
    spl_account_compression::cpi::init_prepared_tree_with_root(
        cpi_ctx,
        root,
        rightmost_leaf,
        rightmost_index,
    )
}

fn calculate_protocol_fee_lamports(number_of_assets: u64) -> u64 {
    // Round to the nearest higher multiple of 1024
    let num_1024_chunks = (number_of_assets + 1023) / 1024;
    num_1024_chunks * PROTOCOL_FEE_PER_1024_ASSETS
}

#[test]
fn test_calculate_protocol_fee_lamports() {
    let mut number_of_assets = 1;
    let lamports_fee_for_single_asset_tree = calculate_protocol_fee_lamports(number_of_assets);
    assert_eq!(
        lamports_fee_for_single_asset_tree,
        PROTOCOL_FEE_PER_1024_ASSETS
    );

    number_of_assets = 1023;
    let lamports_fee_for_1023_assets_tree = calculate_protocol_fee_lamports(number_of_assets);
    assert_eq!(
        lamports_fee_for_1023_assets_tree,
        PROTOCOL_FEE_PER_1024_ASSETS
    );

    number_of_assets = 1024;
    let lamports_fee_for_1024_assets_tree = calculate_protocol_fee_lamports(number_of_assets);
    assert_eq!(
        lamports_fee_for_1024_assets_tree,
        PROTOCOL_FEE_PER_1024_ASSETS
    );

    number_of_assets = 1025;
    let lamports_fee_for_1025_assets_tree = calculate_protocol_fee_lamports(number_of_assets);
    assert_eq!(
        lamports_fee_for_1025_assets_tree,
        PROTOCOL_FEE_PER_1024_ASSETS * 2
    );

    number_of_assets = 1_000_000;
    let lamports_fee_for_million_assets_tree = calculate_protocol_fee_lamports(number_of_assets);
    assert_eq!(lamports_fee_for_million_assets_tree, 1250560000);
}
