//! Create a single Squads v3 (squads-mpl) multisig transaction that bundles the
//! BPF program upgrade and the verified-build PDA write so the squads vault
//! executes both atomically in one proposal.
//!
//! The bot key can only *create and activate* the proposal; the multisig still
//! approves and executes. The guards below fail closed before anything is
//! written on-chain.

use std::fmt::Write as _;
use std::fs;

use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    bpf_loader_upgradeable::{self, UpgradeableLoaderState},
    commitment_config::CommitmentConfig,
    instruction::{AccountMeta, Instruction},
    message::legacy::Message as LegacyMessage,
    pubkey::Pubkey,
    signature::{read_keypair_file, Keypair, Signer},
    transaction::Transaction,
};
use std::str::FromStr;

const COMPUTE_BUDGET_PROGRAM_ID: &str = "ComputeBudget111111111111111111111111111111";
// otter-verify on-chain program that stores verified-build PDA records
// (https://github.com/otter-sec/otter-verify). The bundled verify instruction
// must target this program so a tampered PDA_TX_FILE cannot inject a different
// vault-signed instruction.
const OTTER_VERIFY_PROGRAM_ID: &str = "verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC";
// squads-mpl (Squads v3) program. The genesis multisig must be owned by it;
// pinning it prevents a bad SQUADS_MULTISIG from redirecting the submitter's
// signature to another program.
const SQUADS_MPL_PROGRAM_ID: &str = "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu";

// ProgramData layout: 4-byte enum tag, 8-byte slot, 1-byte COption tag, then
// the 32-byte upgrade authority.
const PROGRAM_DATA_AUTHORITY_OFFSET: usize = 13;
// Ms account layout: 8-byte Anchor discriminator, threshold (u16),
// authorityIndex (u16), then transactionIndex (u32) at offset 12.
const MS_TRANSACTION_INDEX_OFFSET: usize = 12;

type BoxError = Box<dyn std::error::Error>;

fn required_env(name: &str) -> Result<String, BoxError> {
    std::env::var(name).map_err(|_| format!("missing required environment variable: {name}").into())
}

fn anchor_discriminator(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("global:{name}").as_bytes());
    let digest = hasher.finalize();
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest.iter() {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

// Borsh wire format for the squads-mpl IncomingInstruction struct:
//   programId: 32 bytes
//   keys:      u32 little-endian count, then [pubkey(32) | is_signer(1) | is_writable(1)]
//   data:      u32 little-endian length, then raw bytes
fn encode_incoming_instruction(instruction: &Instruction) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(instruction.program_id.as_ref());
    buf.extend_from_slice(&(instruction.accounts.len() as u32).to_le_bytes());
    for meta in &instruction.accounts {
        buf.extend_from_slice(meta.pubkey.as_ref());
        buf.push(meta.is_signer as u8);
        buf.push(meta.is_writable as u8);
    }
    buf.extend_from_slice(&(instruction.data.len() as u32).to_le_bytes());
    buf.extend_from_slice(&instruction.data);
    buf
}

fn create_transaction_ix(
    program_id: &Pubkey,
    multisig: &Pubkey,
    transaction_pda: &Pubkey,
    creator: &Pubkey,
    authority_index: u32,
) -> Instruction {
    let mut data = anchor_discriminator("create_transaction").to_vec();
    data.extend_from_slice(&authority_index.to_le_bytes());
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new(*multisig, false),
            AccountMeta::new(*transaction_pda, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ],
        data,
    }
}

fn add_instruction_ix(
    program_id: &Pubkey,
    multisig: &Pubkey,
    transaction_pda: &Pubkey,
    instruction_pda: &Pubkey,
    creator: &Pubkey,
    incoming: &Instruction,
) -> Instruction {
    let mut data = anchor_discriminator("add_instruction").to_vec();
    data.extend_from_slice(&encode_incoming_instruction(incoming));
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(*transaction_pda, false),
            AccountMeta::new(*instruction_pda, false),
            AccountMeta::new(*creator, true),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ],
        data,
    }
}

fn activate_transaction_ix(
    program_id: &Pubkey,
    multisig: &Pubkey,
    transaction_pda: &Pubkey,
    creator: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: *program_id,
        accounts: vec![
            AccountMeta::new_readonly(*multisig, false),
            AccountMeta::new(*transaction_pda, false),
            AccountMeta::new(*creator, true),
        ],
        data: anchor_discriminator("activate_transaction").to_vec(),
    }
}

fn transaction_pda(program_id: &Pubkey, multisig: &Pubkey, transaction_index: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            b"squad",
            multisig.as_ref(),
            &transaction_index.to_le_bytes(),
            b"transaction",
        ],
        program_id,
    )
    .0
}

fn instruction_pda(program_id: &Pubkey, transaction_pda: &Pubkey, instruction_index: u8) -> Pubkey {
    Pubkey::find_program_address(
        &[
            b"squad",
            transaction_pda.as_ref(),
            &[instruction_index],
            b"instruction",
        ],
        program_id,
    )
    .0
}

fn authority_pda(program_id: &Pubkey, multisig: &Pubkey, authority_index: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            b"squad",
            multisig.as_ref(),
            &authority_index.to_le_bytes(),
            b"authority",
        ],
        program_id,
    )
    .0
}

// Reconstruct (is_signer, is_writable) per account index from the legacy
// message header, so the verified-build instruction lifted out of the exported
// transaction keeps the exact account metadata it was built with. Validate the
// header counts first so a malformed transaction fails closed instead of
// producing bogus signer/writable flags that weaken the later signer check.
fn account_flags(message: &LegacyMessage) -> Result<Vec<(bool, bool)>, BoxError> {
    let total = message.account_keys.len();
    let signers = message.header.num_required_signatures as usize;
    let readonly_signed = message.header.num_readonly_signed_accounts as usize;
    let readonly_unsigned = message.header.num_readonly_unsigned_accounts as usize;

    if signers > total {
        return Err("legacy message header has more signers than account keys".into());
    }
    if readonly_signed > signers {
        return Err("legacy message header has too many readonly signed accounts".into());
    }
    let unsigned = total - signers;
    if readonly_unsigned > unsigned {
        return Err("legacy message header has too many readonly unsigned accounts".into());
    }

    let writable_signers = signers - readonly_signed;
    let writable_unsigned = unsigned - readonly_unsigned;

    Ok((0..total)
        .map(|index| {
            let is_signer = index < signers;
            let is_writable = if is_signer {
                index < writable_signers
            } else {
                (index - signers) < writable_unsigned
            };
            (is_signer, is_writable)
        })
        .collect())
}

// Fail closed on a malformed exported transaction instead of panicking on an
// out-of-range account index. The file is produced by the export step earlier
// in the job, but it is still parsed input feeding a mainnet proposal.
fn decompile_instructions(message: &LegacyMessage) -> Result<Vec<Instruction>, BoxError> {
    let flags = account_flags(message)?;
    let key_count = message.account_keys.len();
    let mut decompiled = Vec::with_capacity(message.instructions.len());
    for compiled in &message.instructions {
        let program_index = compiled.program_id_index as usize;
        if program_index >= key_count {
            return Err("exported transaction references an out-of-range program index".into());
        }
        let mut accounts = Vec::with_capacity(compiled.accounts.len());
        for &account_index in &compiled.accounts {
            let index = account_index as usize;
            if index >= key_count {
                return Err("exported transaction references an out-of-range account index".into());
            }
            let (is_signer, is_writable) = flags[index];
            accounts.push(AccountMeta {
                pubkey: message.account_keys[index],
                is_signer,
                is_writable,
            });
        }
        decompiled.push(Instruction {
            program_id: message.account_keys[program_index],
            accounts,
            data: compiled.data.clone(),
        });
    }
    Ok(decompiled)
}

fn extract_verified_build_instruction(
    path: &str,
    expected_uploader: &Pubkey,
    expected_program: &Pubkey,
) -> Result<Instruction, BoxError> {
    let encoded = fs::read_to_string(path)?;
    let bytes = bs58::decode(encoded.trim()).into_vec()?;
    let transaction: Transaction = bincode::deserialize(&bytes)
        .map_err(|err| format!("could not decode exported transaction as legacy: {err}"))?;

    let compute_budget = Pubkey::from_str(COMPUTE_BUDGET_PROGRAM_ID)?;
    let mut instructions: Vec<Instruction> = decompile_instructions(&transaction.message)?
        .into_iter()
        .filter(|instruction| instruction.program_id != compute_budget)
        .collect();

    if instructions.len() != 1 {
        return Err(format!(
            "expected exactly one non-compute verified-build instruction, found {}",
            instructions.len()
        )
        .into());
    }

    let instruction = instructions.remove(0);

    // Identity check: the instruction must target the otter-verify program, so a
    // tampered file cannot swap in some other vault-signed instruction.
    let otter_verify = Pubkey::from_str(OTTER_VERIFY_PROGRAM_ID)?;
    if instruction.program_id != otter_verify {
        return Err(format!(
            "verified-build instruction targets {} not the otter-verify program {otter_verify}",
            instruction.program_id
        )
        .into());
    }

    // Variant check: otter-verify exposes initialize/update/close, and
    // `solana-verify export-pda-tx` only ever emits initialize (first upload) or
    // update (re-upload) to write the build record. Pin the 8-byte Anchor
    // discriminator to those two so a tampered file cannot swap in `close` (or
    // any other vault-signed otter-verify instruction) and still satisfy the
    // broad program/account/signer checks below.
    let discriminator: [u8; 8] = instruction
        .data
        .get(..8)
        .and_then(|prefix| prefix.try_into().ok())
        .ok_or_else(|| {
            format!(
                "verified-build instruction data is {} bytes, too short for an 8-byte discriminator",
                instruction.data.len()
            )
        })?;
    let initialize = anchor_discriminator("initialize");
    let update = anchor_discriminator("update");
    if discriminator != initialize && discriminator != update {
        return Err(format!(
            "verified-build instruction is not an otter-verify initialize/update write (discriminator {discriminator:?})"
        )
        .into());
    }

    // The otter-verify build record is per-program (its PDA is derived from the
    // program address), so the program being upgraded must appear in the
    // instruction's accounts. This rejects a record exported for a different
    // program.
    let references_program = instruction
        .accounts
        .iter()
        .any(|meta| &meta.pubkey == expected_program);
    if !references_program {
        return Err(format!(
            "verified-build instruction does not reference the upgraded program {expected_program}"
        )
        .into());
    }

    let signs = instruction
        .accounts
        .iter()
        .any(|meta| &meta.pubkey == expected_uploader && meta.is_signer);
    if !signs {
        return Err(format!(
            "verified-build instruction does not require uploader {expected_uploader} as a signer"
        )
        .into());
    }

    Ok(instruction)
}

fn program_data_authority(client: &RpcClient, program_id: &Pubkey) -> Result<Pubkey, BoxError> {
    let (program_data, _) =
        Pubkey::find_program_address(&[program_id.as_ref()], &bpf_loader_upgradeable::id());
    let account = client.get_account(&program_data)?;
    if account.data.len() < PROGRAM_DATA_AUTHORITY_OFFSET + 32 {
        return Err(format!("program data account {program_data} is too small").into());
    }
    // 4-byte tag (3 == ProgramData), 8-byte slot, 1-byte has-authority option.
    let tag = u32::from_le_bytes(account.data[0..4].try_into()?);
    if tag != 3 {
        return Err(format!("unexpected program data state tag {tag} at {program_data}").into());
    }
    if account.data[12] != 1 {
        return Err(format!("program {program_id} has no upgrade authority").into());
    }
    let authority = Pubkey::try_from(
        &account.data[PROGRAM_DATA_AUTHORITY_OFFSET..PROGRAM_DATA_AUTHORITY_OFFSET + 32],
    )?;
    Ok(authority)
}

// `bpf_loader_upgradeable::upgrade` also requires the buffer to be a loader-owned
// Buffer whose stored authority matches the program's upgrade authority. Check
// it here so a misconfigured buffer fails before we activate a proposal that
// could never execute.
fn check_buffer_authority(
    client: &RpcClient,
    buffer: &Pubkey,
    expected_authority: &Pubkey,
) -> Result<(), BoxError> {
    let account = client.get_account(buffer)?;
    if account.owner != bpf_loader_upgradeable::id() {
        return Err(format!(
            "buffer {buffer} is owned by {} not the upgradeable loader",
            account.owner
        )
        .into());
    }

    let metadata_size = UpgradeableLoaderState::size_of_buffer_metadata();
    if account.data.len() < metadata_size {
        return Err(format!("buffer {buffer} is too small to be a Buffer account").into());
    }

    let state: UpgradeableLoaderState = bincode::deserialize(&account.data[..metadata_size])
        .map_err(|err| format!("could not decode buffer state for {buffer}: {err}"))?;
    match state {
        UpgradeableLoaderState::Buffer { authority_address } => match authority_address {
            Some(addr) if &addr == expected_authority => Ok(()),
            Some(addr) => Err(format!(
                "buffer {buffer} authority {addr} does not match expected {expected_authority}"
            )
            .into()),
            None => Err(format!("buffer {buffer} is immutable (no authority)").into()),
        },
        _ => Err(format!("account {buffer} is not an upgradeable Buffer").into()),
    }
}

fn multisig_transaction_index(client: &RpcClient, multisig: &Pubkey) -> Result<u32, BoxError> {
    let account = client.get_account(multisig)?;
    if account.data.len() < MS_TRANSACTION_INDEX_OFFSET + 4 {
        return Err(format!("multisig account {multisig} is too small").into());
    }
    let index = u32::from_le_bytes(
        account.data[MS_TRANSACTION_INDEX_OFFSET..MS_TRANSACTION_INDEX_OFFSET + 4].try_into()?,
    );
    Ok(index)
}

fn log_instruction(label: &str, instruction: &Instruction) {
    println!("{label}");
    println!("  program: {}", instruction.program_id);
    println!("  data_len: {}", instruction.data.len());
    println!("  data_sha256: {}", sha256_hex(&instruction.data));
    for (index, meta) in instruction.accounts.iter().enumerate() {
        println!(
            "  [{index}] {} signer={} writable={}",
            meta.pubkey, meta.is_signer, meta.is_writable
        );
    }
}

fn send(
    client: &RpcClient,
    payer: &Keypair,
    instruction: Instruction,
    label: &str,
) -> Result<(), BoxError> {
    let blockhash = client.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[instruction],
        Some(&payer.pubkey()),
        &[payer],
        blockhash,
    );
    let signature = client.send_and_confirm_transaction(&transaction)?;
    println!("{label}: {signature}");
    Ok(())
}

fn run() -> Result<(), BoxError> {
    let rpc = required_env("RPC")?;
    let buffer = Pubkey::from_str(&required_env("BUFFER")?)?;
    let multisig = Pubkey::from_str(&required_env("SQUADS_MULTISIG")?)?;
    let vault = Pubkey::from_str(&required_env("SQUADS_VAULT")?)?;
    let spill = Pubkey::from_str(&required_env("SPILL_ADDRESS")?)?;
    let authority_index: u32 = std::env::var("SQUADS_AUTHORITY_INDEX")
        .unwrap_or_else(|_| "1".to_string())
        .parse()?;
    let pda_tx_file = required_env("PDA_TX_FILE")?;

    // The program id is public; read it as a pubkey rather than loading the
    // program-id keypair (which would put a private key in this process).
    let program_id = Pubkey::from_str(&required_env("PROGRAM_ID")?)?;
    let submitter = read_keypair_file(required_env("SUBMITTER_KEYPAIR")?)
        .map_err(|err| format!("could not read submitter keypair: {err}"))?;

    let client = RpcClient::new_with_commitment(rpc, CommitmentConfig::confirmed());
    let squads_program_id = client.get_account(&multisig)?.owner;
    let expected_squads_program_id = Pubkey::from_str(SQUADS_MPL_PROGRAM_ID)?;
    if squads_program_id != expected_squads_program_id {
        return Err(format!(
            "multisig {multisig} is owned by {squads_program_id}, expected Squads program {expected_squads_program_id}"
        )
        .into());
    }

    let derived_vault = authority_pda(&squads_program_id, &multisig, authority_index);
    if derived_vault != vault {
        return Err(format!(
            "squads authority mismatch for index {authority_index}: derived {derived_vault}, expected {vault}"
        )
        .into());
    }

    let on_chain_authority = program_data_authority(&client, &program_id)?;
    if on_chain_authority != vault {
        return Err(format!(
            "upgrade authority mismatch: on-chain {on_chain_authority}, expected squads vault {vault}"
        )
        .into());
    }

    check_buffer_authority(&client, &buffer, &vault)?;

    let upgrade_instruction = bpf_loader_upgradeable::upgrade(&program_id, &buffer, &vault, &spill);
    let verified_build_instruction =
        extract_verified_build_instruction(&pda_tx_file, &vault, &program_id)?;

    let transaction_index = multisig_transaction_index(&client, &multisig)?
        .checked_add(1)
        .ok_or("multisig transaction index overflow")?;
    let tx_pda = transaction_pda(&squads_program_id, &multisig, transaction_index);
    let first_ix_pda = instruction_pda(&squads_program_id, &tx_pda, 1);
    let second_ix_pda = instruction_pda(&squads_program_id, &tx_pda, 2);

    println!("Squads program: {squads_program_id}");
    println!("Multisig: {multisig}");
    println!("Vault authority: {vault}");
    println!("Program: {program_id}");
    println!("Buffer: {buffer}");
    println!("Transaction PDA: {tx_pda} (index {transaction_index})");
    log_instruction("Instruction 1: BPF program upgrade", &upgrade_instruction);
    log_instruction(
        "Instruction 2: verified-build PDA write",
        &verified_build_instruction,
    );

    send(
        &client,
        &submitter,
        create_transaction_ix(
            &squads_program_id,
            &multisig,
            &tx_pda,
            &submitter.pubkey(),
            authority_index,
        ),
        "Created squads transaction",
    )?;
    send(
        &client,
        &submitter,
        add_instruction_ix(
            &squads_program_id,
            &multisig,
            &tx_pda,
            &first_ix_pda,
            &submitter.pubkey(),
            &upgrade_instruction,
        ),
        "Added BPF program upgrade instruction",
    )?;
    send(
        &client,
        &submitter,
        add_instruction_ix(
            &squads_program_id,
            &multisig,
            &tx_pda,
            &second_ix_pda,
            &submitter.pubkey(),
            &verified_build_instruction,
        ),
        "Added verified-build PDA write instruction",
    )?;
    send(
        &client,
        &submitter,
        activate_transaction_ix(&squads_program_id, &multisig, &tx_pda, &submitter.pubkey()),
        "Activated bundled squads transaction",
    )?;

    println!("Activated squads transaction {tx_pda}");
    Ok(())
}

fn main() {
    if let Err(err) = run() {
        eprintln!("error: {err}");
        std::process::exit(1);
    }
}
