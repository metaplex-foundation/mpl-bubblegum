use crate::{
    processor::process_collection_verification_mpl_only,
    state::{metaplex_adapter::Collection, metaplex_anchor::TokenMetadata, TreeConfig},
    FinalizeTreeWithRoot, FinalizeTreeWithRootBumps,
};
use anchor_lang::{prelude::*, system_program::System};
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
    pub mining: UncheckedAccount<'info>,
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
    metadata_url: String,
    metadata_hash: String,
) -> Result<()> {
    let mut collection = Some(Collection {
        verified: false,
        key: ctx.accounts.collection_mint.key(),
    });
    process_collection_verification_mpl_only(
        &ctx.accounts.collection_metadata,
        &ctx.accounts.collection_mint.to_account_info(),
        &ctx.accounts.collection_authority.to_account_info(),
        &ctx.accounts
            .collection_authority_record_pda
            .to_account_info(),
        &ctx.accounts.edition_account.to_account_info(),
        &mut collection,
        true,
    )?;
    let mut accs: FinalizeTreeWithRoot<'info> = ctx.accounts.into();
    let bumps: FinalizeTreeWithRootBumps = ctx.bumps.into();
    let ctx = Context::<'_, '_, '_, 'info, FinalizeTreeWithRoot<'info>>::new(
        ctx.program_id,
        &mut accs,
        ctx.remaining_accounts,
        bumps,
    );
    crate::processor::finalize_tree_with_root(
        ctx,
        root,
        rightmost_leaf,
        rightmost_index,
        metadata_url,
        metadata_hash,
    )
}

impl<'info> From<&mut FinalizeTreeWithRootAndCollection<'info>> for FinalizeTreeWithRoot<'info> {
    fn from(value: &mut FinalizeTreeWithRootAndCollection<'info>) -> Self {
        Self {
            tree_authority: value.tree_authority.to_owned(),
            merkle_tree: value.merkle_tree.to_owned(),
            payer: value.payer.to_owned(),
            tree_delegate: value.tree_delegate.to_owned(),
            staker: value.staker.to_owned(),
            registrar: value.registrar.to_owned(),
            voter: value.voter.to_owned(),
            mining: value.mining.to_owned(),
            fee_receiver: value.fee_receiver.to_owned(),
            log_wrapper: value.log_wrapper.to_owned(),
            compression_program: value.compression_program.to_owned(),
            system_program: value.system_program.to_owned(),
        }
    }
}

impl From<FinalizeTreeWithRootAndCollectionBumps> for FinalizeTreeWithRootBumps {
    fn from(value: FinalizeTreeWithRootAndCollectionBumps) -> Self {
        Self {
            tree_authority: value.tree_authority,
        }
    }
}
