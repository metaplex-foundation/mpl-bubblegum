use anchor_lang::prelude::*;
use solana_program::keccak;
use spl_account_compression::{program::SplAccountCompression, wrap_application_data_v1, Noop};
use std::collections::HashSet;

use crate::{
    asserts::assert_edge_is_node_compatible,
    error::PrimitivesError,
    state::{leaf_schema::LeafSchema, metaplex_adapter::EdgeArgs, TreeConfig},
    utils::{append_leaf, get_asset_id},
};

#[derive(Accounts)]
pub struct MintEdgeV1<'info> {
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: Account<'info, TreeConfig>,
    /// CHECK: This account is neither written to nor read from.
    pub leaf_owner: AccountInfo<'info>,
    /// CHECK: This account is neither written to nor read from.
    pub leaf_delegate: AccountInfo<'info>,
    #[account(mut)]
    /// CHECK: unsafe
    pub merkle_tree: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    pub tree_delegate: Signer<'info>,
    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn mint_edge_v1(ctx: Context<MintEdgeV1>, message: EdgeArgs) -> Result<()> {
    // TODO -> Separate V1 / V1 into seperate instructions
    let payer = ctx.accounts.payer.key();
    let incoming_tree_delegate = ctx.accounts.tree_delegate.key();
    let owner = ctx.accounts.leaf_owner.key();
    let delegate = ctx.accounts.leaf_delegate.key();
    let authority = &mut ctx.accounts.tree_authority;
    let merkle_tree = &ctx.accounts.merkle_tree;

    if !authority.is_public {
        require!(
            incoming_tree_delegate == authority.tree_creator
                || incoming_tree_delegate == authority.tree_delegate,
            PrimitivesError::TreeAuthorityIncorrect,
        );
    }

    if !authority.contains_mint_capacity(1) {
        return Err(PrimitivesError::InsufficientMintCapacity.into());
    }

    // Create a HashSet to store signers to use with creator validation.  Any signer can be
    // counted as a validated creator.
    let mut metadata_auth = HashSet::<Pubkey>::new();
    metadata_auth.insert(payer);
    metadata_auth.insert(incoming_tree_delegate);

    // If there are any remaining accounts that are also signers, they can also be used for
    // creator validation.
    metadata_auth.extend(
        ctx.remaining_accounts
            .iter()
            .filter(|a| a.is_signer)
            .map(|a| a.key()),
    );

    process_edge_mint_v1(
        message,
        owner,
        delegate,
        metadata_auth,
        *ctx.bumps.get("tree_authority").unwrap(),
        authority,
        merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    authority.increment_mint_count();

    Ok(())
}

pub(crate) fn process_edge_mint_v1<'info>(
    message: EdgeArgs,
    owner: Pubkey,
    delegate: Pubkey,
    metadata_auth: HashSet<Pubkey>,
    authority_bump: u8,
    authority: &mut Account<'info, TreeConfig>,
    merkle_tree: &AccountInfo<'info>,
    wrapper: &Program<'info, Noop>,
    compression_program: &AccountInfo<'info>,
) -> Result<()> {
    assert_edge_is_node_compatible(&message)?;

    // @dev: seller_fee_basis points is encoded twice so that it can be passed to marketplace
    // instructions, without passing the entire, un-hashed MetadataArgs struct
    let metadata_args_hash = keccak::hashv(&[message.try_to_vec()?.as_slice()]);
    let data_hash = keccak::hashv(&[&metadata_args_hash.to_bytes()]);

    // Use the metadata auth to check whether we can allow `verified` to be set to true in the
    // creator Vec.
    let creator_data = message
        .creators
        .iter()
        .map(|c| {
            if c.verified && !metadata_auth.contains(&c.address) {
                Err(PrimitivesError::CreatorDidNotVerify.into())
            } else {
                Ok([c.address.as_ref(), &[c.verified as u8], &[c.share]].concat())
            }
        })
        .collect::<Result<Vec<_>>>()?;

    // Calculate creator hash.
    let creator_hash = keccak::hashv(
        creator_data
            .iter()
            .map(|c| c.as_slice())
            .collect::<Vec<&[u8]>>()
            .as_ref(),
    );

    let asset_id = get_asset_id(&merkle_tree.key(), authority.num_minted);
    let leaf = LeafSchema::new_v0(
        asset_id,
        owner,
        delegate,
        authority.num_minted,
        data_hash.to_bytes(),
        creator_hash.to_bytes(),
    );

    wrap_application_data_v1(leaf.to_event().try_to_vec()?, wrapper)?;

    append_leaf(
        &merkle_tree.key(),
        authority_bump,
        &compression_program.to_account_info(),
        &authority.to_account_info(),
        &merkle_tree.to_account_info(),
        &wrapper.to_account_info(),
        leaf.to_node(),
    )
}
