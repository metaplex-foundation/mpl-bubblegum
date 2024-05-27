use anchor_lang::{prelude::*, solana_program::clock::Clock, system_program::System};
use mplx_staking_states::state::{
    registrar::Registrar, Voter, REGISTRAR_DISCRIMINATOR, VOTER_DISCRIMINATOR,
};
use spl_account_compression::{program::SplAccountCompression, Noop};

use crate::state::FEE_RECEIVER;
use crate::{
    error::BubblegumError,
    state::{
        DecompressibleState, TreeConfig, MINIMUM_STAKE, REALM, REALM_GOVERNING_MINT,
        TREE_AUTHORITY_SIZE,
    },
};

const PROTOCOL_FEE_PER_1024_ASSETS: u64 = 1_280_000; // 0.00128 SOL in lamports

#[derive(Accounts)]
pub struct CreateTreeWithRoot<'info> {
    #[account(
        init,
        seeds = [merkle_tree.key().as_ref()],
        payer = payer,
        space = TREE_AUTHORITY_SIZE,
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    #[account(zero)]
    /// CHECK: This account must be all zeros
    pub merkle_tree: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK:
    #[account(mut)]
    pub tree_creator: Signer<'info>,
    /// CHECK:
    pub registrar: UncheckedAccount<'info>,
    /// CHECK:
    pub voter: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub fee_receiver: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn create_tree_with_root<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateTreeWithRoot<'info>>,
    max_depth: u32,
    max_buffer_size: u32,
    num_minted: u64,
    root: [u8; 32],
    leaf: [u8; 32],
    index: u32,
    _metadata_url: String,
    _metadata_hash: String,
    public: Option<bool>,
) -> Result<()> {
    assert_eq!(ctx.accounts.registrar.owner, &mplx_staking_states::ID);
    assert_eq!(ctx.accounts.voter.owner, &mplx_staking_states::ID);
    assert_eq!(ctx.accounts.fee_receiver.key, &FEE_RECEIVER);

    let fee = calculate_protocol_fee_lamports(num_minted);
    let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.tree_creator.key(),
        &ctx.accounts.fee_receiver.key(),
        fee,
    );
    anchor_lang::solana_program::program::invoke(
        &transfer_instruction,
        &[
            ctx.accounts.tree_creator.to_account_info(),
            ctx.accounts.fee_receiver.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let generated_registrar = Pubkey::find_program_address(
        &[
            REALM.to_bytes().as_ref(),
            b"registrar".as_ref(),
            REALM_GOVERNING_MINT.to_bytes().as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;
    assert_eq!(&generated_registrar, ctx.accounts.registrar.key);

    let generated_voter_key = Pubkey::find_program_address(
        &[
            ctx.accounts.registrar.key.to_bytes().as_ref(),
            b"voter".as_ref(),
            ctx.accounts.payer.key.to_bytes().as_ref(),
        ],
        &mplx_staking_states::ID,
    )
    .0;
    assert_eq!(&generated_voter_key, ctx.accounts.voter.key);

    let registrar_bytes = ctx.accounts.registrar.to_account_info().data;

    assert_eq!((*registrar_bytes.borrow())[..8], REGISTRAR_DISCRIMINATOR);

    let registrar: Registrar = *bytemuck::from_bytes(&(*registrar_bytes.borrow())[8..]);

    assert_eq!(registrar.realm, REALM);
    assert_eq!(registrar.realm_governing_token_mint, REALM_GOVERNING_MINT);

    let voter_bytes = ctx.accounts.voter.to_account_info().data;

    assert_eq!((*voter_bytes.borrow())[..8], VOTER_DISCRIMINATOR);

    let voter: Voter = *bytemuck::from_bytes(&(*voter_bytes.borrow())[8..]);

    assert_eq!(&voter.registrar, ctx.accounts.registrar.key);
    assert_eq!(&voter.voter_authority, ctx.accounts.payer.key);

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

    let merkle_tree = ctx.accounts.merkle_tree.to_account_info();
    let seed = merkle_tree.key();
    let seeds = &[seed.as_ref(), &[ctx.bumps.tree_authority]];
    let authority = &mut ctx.accounts.tree_authority;
    authority.set_inner(TreeConfig {
        tree_creator: ctx.accounts.tree_creator.key(),
        tree_delegate: ctx.accounts.tree_creator.key(),
        total_mint_capacity: 1 << max_depth,
        num_minted,
        is_public: public.unwrap_or(false),
        is_decompressible: DecompressibleState::Disabled,
    });
    let authority_pda_signer = &[&seeds[..]];

    init_tree(
        max_depth,
        max_buffer_size,
        root,
        leaf,
        index,
        &ctx.accounts.compression_program.to_account_info(),
        &ctx.accounts.tree_authority.to_account_info(),
        &merkle_tree,
        &ctx.accounts.log_wrapper.to_account_info(),
        authority_pda_signer,
        ctx.remaining_accounts,
    )
}

fn init_tree<'info>(
    max_depth: u32,
    max_buffer_size: u32,
    root: [u8; 32],
    leaf: [u8; 32],
    index: u32,
    compression_program: &AccountInfo<'info>,
    tree_authority: &AccountInfo<'info>,
    merkle_tree: &AccountInfo<'info>,
    noop: &AccountInfo<'info>,
    authority_pda_signer: &[&[&[u8]]; 1],
    remaining_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    let cpi_ctx = CpiContext::new_with_signer(
        compression_program.clone(),
        spl_account_compression::cpi::accounts::InitializeWithRoot {
            merkle_tree: merkle_tree.clone(),
            authority: tree_authority.clone(),
            noop: noop.clone(),
        },
        authority_pda_signer,
    )
    .with_remaining_accounts(remaining_accounts.to_vec());
    spl_account_compression::cpi::init_merkle_tree_with_root(
        cpi_ctx,
        max_depth,
        max_buffer_size,
        root,
        leaf,
        index,
    )
}

fn calculate_protocol_fee_lamports(number_of_assets: u64) -> u64 {
    // Round to the nearest higher multiple of 1024
    let num_1024_chunks = (number_of_assets + 1023) / 1024;
    num_1024_chunks * PROTOCOL_FEE_PER_1024_ASSETS
}
