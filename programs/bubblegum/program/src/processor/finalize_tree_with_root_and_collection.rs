use crate::asserts::assert_has_collection_authority;
use crate::processor::{check_stake, finalize_tree};
use crate::state::metaplex_anchor::TokenMetadata;
use crate::{error::BubblegumError, state::TreeConfig};
use anchor_lang::{prelude::*, system_program::System};
use mpl_token_metadata::types::TokenStandard;
use spl_account_compression::{program::SplAccountCompression, Noop};

#[derive(Accounts)]
pub struct FinalizeTreeWithRootAndCollection<'info> {
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
    pub collection_authority: Signer<'info>,
    /// CHECK:
    pub registrar: UncheckedAccount<'info>,
    /// CHECK:
    pub voter: UncheckedAccount<'info>,
    /// CHECK:
    #[account(mut)]
    pub fee_receiver: UncheckedAccount<'info>,
    /// CHECK: Optional collection authority record PDA.
    /// If there is no collecton authority record PDA then
    /// this must be the Bubblegum program address.
    pub collection_authority_record_pda: UncheckedAccount<'info>,
    /// CHECK: This account is checked in the instruction
    pub collection_mint: UncheckedAccount<'info>,
    #[account(mut)]
    pub collection_metadata: Box<Account<'info, TokenMetadata>>,
    /// CHECK: This account is checked in the instruction
    pub edition_account: UncheckedAccount<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn finalize_tree_with_root_and_collection<'info>(
    ctx: Context<'_, '_, '_, 'info, FinalizeTreeWithRootAndCollection<'info>>,
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

    validate_collection(
        &ctx.accounts.collection_metadata,
        &ctx.accounts.collection_authority.to_account_info(),
        &ctx.accounts.collection_mint.to_account_info(),
        &ctx.accounts
            .collection_authority_record_pda
            .to_account_info(),
        &ctx.accounts.edition_account.to_account_info(),
    )?;

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

fn validate_collection(
    collection_metadata: &Account<TokenMetadata>,
    collection_authority: &AccountInfo,
    collection_mint: &AccountInfo,
    collection_authority_record_pda: &AccountInfo,
    edition_account: &AccountInfo,
) -> Result<()> {
    let collection_authority_record = if collection_authority_record_pda.key() == crate::id() {
        None
    } else {
        Some(collection_authority_record_pda)
    };

    // Verify correct account ownerships.
    require!(
        *collection_metadata.to_account_info().owner == mpl_token_metadata::ID,
        BubblegumError::IncorrectOwner
    );
    require!(
        *collection_mint.owner == spl_token::id(),
        BubblegumError::IncorrectOwner
    );

    assert_has_collection_authority(
        collection_metadata,
        collection_mint.key,
        collection_authority.key,
        collection_authority_record,
    )?;

    let (expected, _) = mpl_token_metadata::accounts::MasterEdition::find_pda(collection_mint.key);

    if edition_account.key != &expected {
        return Err(BubblegumError::CollectionMasterEditionAccountInvalid.into());
    }

    let edition = mpl_token_metadata::accounts::MasterEdition::try_from(edition_account)
        .map_err(|_err| BubblegumError::CollectionMustBeAUniqueMasterEdition)?;

    match collection_metadata.token_standard {
        Some(TokenStandard::NonFungible) | Some(TokenStandard::ProgrammableNonFungible) => (),
        _ => return Err(BubblegumError::CollectionMustBeAUniqueMasterEdition.into()),
    }

    if edition.max_supply != Some(0) {
        return Err(BubblegumError::CollectionMustBeAUniqueMasterEdition.into());
    }

    Ok(())
}
