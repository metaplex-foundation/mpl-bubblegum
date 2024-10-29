use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use mpl_token_metadata::{
    instructions::{CreateMasterEditionV3CpiBuilder, CreateMetadataAccountV3CpiBuilder},
    types::DataV2,
};
use solana_program::{
    program::{invoke, invoke_signed},
    program_pack::Pack,
    system_instruction,
};
use spl_token::state::Mint;

use crate::{
    error::BubblegumError,
    state::{
        leaf_schema::LeafSchema,
        metaplex_adapter::{MetadataArgs, TokenProgramVersion},
        metaplex_anchor::MplTokenMetadata,
        Voucher, ASSET_PREFIX, VOUCHER_PREFIX,
    },
    utils::{cmp_bytes, cmp_pubkeys, hash_metadata},
};

#[derive(Accounts)]
pub struct DecompressV1<'info> {
    #[account(
        mut,
        close = leaf_owner,
        seeds = [
            VOUCHER_PREFIX.as_ref(),
            voucher.merkle_tree.as_ref(),
            voucher.leaf_schema.nonce().to_le_bytes().as_ref()
        ],
        bump
    )]
    pub voucher: Box<Account<'info, Voucher>>,
    #[account(mut)]
    pub leaf_owner: Signer<'info>,
    /// CHECK: versioning is handled in the instruction
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,
    /// CHECK: versioning is handled in the instruction
    #[account(
        mut,
        seeds = [
            ASSET_PREFIX.as_ref(),
            voucher.merkle_tree.as_ref(),
            voucher.leaf_schema.nonce().to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub mint: UncheckedAccount<'info>,
    /// CHECK:
    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: Initialized in Token Metadata Program
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub sysvar_rent: Sysvar<'info, Rent>,
    /// CHECK:
    pub token_metadata_program: Program<'info, MplTokenMetadata>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Program is not used in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
}

pub(crate) fn decompress_v1(ctx: Context<DecompressV1>, metadata: MetadataArgs) -> Result<()> {
    // Validate the incoming metadata

    match ctx.accounts.voucher.leaf_schema {
        LeafSchema::V1 {
            owner, data_hash, ..
        } => {
            let incoming_data_hash = hash_metadata(&metadata)?;

            if !cmp_bytes(&data_hash, &incoming_data_hash, 32) {
                return Err(BubblegumError::HashingMismatch.into());
            }
            if !cmp_pubkeys(&owner, ctx.accounts.leaf_owner.key) {
                return Err(BubblegumError::AssetOwnerMismatch.into());
            }
        }
    }

    let voucher = &ctx.accounts.voucher;
    match metadata.token_program_version {
        TokenProgramVersion::Original => {
            if ctx.accounts.mint.data_is_empty() {
                invoke_signed(
                    &system_instruction::create_account(
                        &ctx.accounts.leaf_owner.key(),
                        &ctx.accounts.mint.key(),
                        Rent::get()?.minimum_balance(Mint::LEN),
                        Mint::LEN as u64,
                        &spl_token::id(),
                    ),
                    &[
                        ctx.accounts.leaf_owner.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[
                        ASSET_PREFIX.as_bytes(),
                        voucher.merkle_tree.key().as_ref(),
                        voucher.leaf_schema.nonce().to_le_bytes().as_ref(),
                        &[ctx.bumps.mint],
                    ]],
                )?;
                invoke(
                    &spl_token::instruction::initialize_mint2(
                        &spl_token::id(),
                        &ctx.accounts.mint.key(),
                        &ctx.accounts.mint_authority.key(),
                        Some(&ctx.accounts.mint_authority.key()),
                        0,
                    )?,
                    &[
                        ctx.accounts.token_program.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                    ],
                )?;
            }
            if ctx.accounts.token_account.data_is_empty() {
                invoke(
                    &spl_associated_token_account::instruction::create_associated_token_account(
                        &ctx.accounts.leaf_owner.key(),
                        &ctx.accounts.leaf_owner.key(),
                        &ctx.accounts.mint.key(),
                        &spl_token::ID,
                    ),
                    &[
                        ctx.accounts.leaf_owner.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                        ctx.accounts.token_account.to_account_info(),
                        ctx.accounts.token_program.to_account_info(),
                        ctx.accounts.associated_token_program.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                        ctx.accounts.sysvar_rent.to_account_info(),
                    ],
                )?;
            }
            // SPL token will check that the associated token account is initialized, that it
            // has the correct owner, and that the mint (which is a PDA of this program)
            // matches.

            invoke_signed(
                &spl_token::instruction::mint_to(
                    &spl_token::id(),
                    &ctx.accounts.mint.key(),
                    &ctx.accounts.token_account.key(),
                    &ctx.accounts.mint_authority.key(),
                    &[],
                    1,
                )?,
                &[
                    ctx.accounts.mint.to_account_info(),
                    ctx.accounts.token_account.to_account_info(),
                    ctx.accounts.mint_authority.to_account_info(),
                    ctx.accounts.token_program.to_account_info(),
                ],
                &[&[
                    ctx.accounts.mint.key().as_ref(),
                    &[ctx.bumps.mint_authority],
                ]],
            )?;
        }
        TokenProgramVersion::Token2022 => return Err(ProgramError::InvalidArgument.into()),
    }

    invoke_signed(
        &system_instruction::assign(&ctx.accounts.mint_authority.key(), &crate::id()),
        &[ctx.accounts.mint_authority.to_account_info()],
        &[&[
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.mint_authority],
        ]],
    )?;

    msg!("Creating metadata");
    CreateMetadataAccountV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .metadata(&ctx.accounts.metadata)
        .mint(&ctx.accounts.mint)
        .mint_authority(&ctx.accounts.mint_authority)
        .payer(&ctx.accounts.leaf_owner)
        .update_authority(&ctx.accounts.mint_authority, true)
        .system_program(&ctx.accounts.system_program)
        .data(DataV2 {
            name: metadata.name.clone(),
            symbol: metadata.symbol.clone(),
            uri: metadata.uri.clone(),
            creators: if metadata.creators.is_empty() {
                None
            } else {
                Some(metadata.creators.iter().map(|c| c.adapt()).collect())
            },
            collection: metadata.collection.map(|c| c.adapt()),
            seller_fee_basis_points: metadata.seller_fee_basis_points,
            uses: metadata.uses.map(|u| u.adapt()),
        })
        .is_mutable(metadata.is_mutable)
        .invoke_signed(&[&[
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.mint_authority],
        ]])?;

    msg!("Creating master edition");
    CreateMasterEditionV3CpiBuilder::new(&ctx.accounts.token_metadata_program)
        .edition(&ctx.accounts.master_edition)
        .mint(&ctx.accounts.mint)
        .mint_authority(&ctx.accounts.mint_authority)
        .update_authority(&ctx.accounts.mint_authority)
        .metadata(&ctx.accounts.metadata)
        .payer(&ctx.accounts.leaf_owner)
        .system_program(&ctx.accounts.system_program)
        .token_program(&ctx.accounts.token_program)
        .max_supply(0)
        .invoke_signed(&[&[
            ctx.accounts.mint.key().as_ref(),
            &[ctx.bumps.mint_authority],
        ]])?;

    ctx.accounts
        .mint_authority
        .to_account_info()
        .assign(&System::id());

    Ok(())
}
