use anchor_lang::{prelude::*, system_program::System};
use bytemuck::cast_slice;
use spl_concurrent_merkle_tree::node::Node;

use crate::{
    error::BubblegumError,
    state::{DecompressibleState, TreeConfig, TREE_AUTHORITY_SIZE},
    utils::validate_ownership_and_programs,
};

pub const MAX_ACC_PROOFS_SIZE: u32 = 17;

#[derive(Accounts)]
pub struct CreateTree<'info> {
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
    pub tree_creator: Signer<'info>,
    /// CHECK: Program is verified in the instruction
    pub log_wrapper: UncheckedAccount<'info>,
    /// CHECK: Program is verified in the instruction
    pub compression_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn create_tree(
    ctx: Context<CreateTree>,
    max_depth: u32,
    max_buffer_size: u32,
    public: Option<bool>,
) -> Result<()> {
    validate_ownership_and_programs(
        &ctx.accounts.merkle_tree,
        &ctx.accounts.log_wrapper,
        &ctx.accounts.compression_program,
    )?;

    // Note this uses spl-account-compression to check the canopy size, and is assumed
    // to be a valid check for mpl-account-compression.
    check_canopy_size(&ctx, max_depth, max_buffer_size)?;

    let seed = ctx.accounts.merkle_tree.key();
    let seeds = &[seed.as_ref(), &[ctx.bumps.tree_authority]];
    let authority = &mut ctx.accounts.tree_authority;
    authority.set_inner(TreeConfig {
        tree_creator: ctx.accounts.tree_creator.key(),
        tree_delegate: ctx.accounts.tree_creator.key(),
        total_mint_capacity: 1 << max_depth,
        num_minted: 0,
        is_public: public.unwrap_or(false),
        is_decompressible: DecompressibleState::Disabled,
    });
    let authority_pda_signer = &[&seeds[..]];

    if ctx.accounts.compression_program.key == &spl_account_compression::id() {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(),
            spl_account_compression::cpi::accounts::Initialize {
                authority: ctx.accounts.tree_authority.to_account_info(),
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
                noop: ctx.accounts.log_wrapper.to_account_info(),
            },
            authority_pda_signer,
        );
        spl_account_compression::cpi::init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)
    } else {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(),
            mpl_account_compression::cpi::accounts::Initialize {
                authority: ctx.accounts.tree_authority.to_account_info(),
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
                noop: ctx.accounts.log_wrapper.to_account_info(),
            },
            authority_pda_signer,
        );
        mpl_account_compression::cpi::init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)
    }
}

fn check_canopy_size(
    ctx: &Context<CreateTree>,
    max_depth: u32,
    max_buffer_size: u32,
) -> Result<()> {
    use spl_account_compression::state::{
        merkle_tree_get_size, ConcurrentMerkleTreeHeader, CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1,
    };

    let merkle_tree_bytes = ctx.accounts.merkle_tree.data.borrow();

    let (header_bytes, rest) = merkle_tree_bytes.split_at(CONCURRENT_MERKLE_TREE_HEADER_SIZE_V1);

    let mut header = ConcurrentMerkleTreeHeader::try_from_slice(header_bytes)?;
    header.initialize(
        max_depth,
        max_buffer_size,
        &ctx.accounts.tree_authority.key(),
        Clock::get()?.slot,
    );

    let merkle_tree_size = merkle_tree_get_size(&header)?;

    let (_tree_bytes, canopy_bytes) = rest.split_at(merkle_tree_size);

    let canopy = cast_slice::<u8, Node>(canopy_bytes);

    let cached_path_len = get_cached_path_length(canopy, max_depth)?;

    let required_canopy = max_depth.saturating_sub(MAX_ACC_PROOFS_SIZE);

    require!(
        (cached_path_len as u32) >= required_canopy,
        BubblegumError::InvalidCanopySize
    );

    Ok(())
}

// Method is taken from account-compression Solana program
#[inline(always)]
fn get_cached_path_length(canopy: &[Node], max_depth: u32) -> Result<u32> {
    // The offset of 2 is applied because the canopy is a full binary tree without the root node
    // Size: (2^n - 2) -> Size + 2 must be a power of 2
    let closest_power_of_2 = (canopy.len() + 2) as u32;
    // This expression will return true if `closest_power_of_2` is actually a power of 2
    if closest_power_of_2 & (closest_power_of_2 - 1) == 0 {
        // (1 << max_depth) returns the number of leaves in the full merkle tree
        // (1 << (max_depth + 1)) - 1 returns the number of nodes in the full tree
        // The canopy size cannot exceed the size of the tree
        if closest_power_of_2 > (1 << (max_depth + 1)) {
            msg!(
                "Canopy size is too large. Size: {}. Max size: {}",
                closest_power_of_2 - 2,
                (1 << (max_depth + 1)) - 2
            );
            return err!(BubblegumError::InvalidCanopySize);
        }
    } else {
        msg!(
            "Canopy length {} is not 2 less than a power of 2",
            canopy.len()
        );
        return err!(BubblegumError::InvalidCanopySize);
    }
    // 1 is subtracted from the trailing zeros because the root is not stored in the canopy
    Ok(closest_power_of_2.trailing_zeros() - 1)
}
