import { Context, PublicKey } from '@metaplex-foundation/umi';
import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from './generated';

export const MPL_ACCOUNT_COMPRESSION_PROGRAM_ID =
  'mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW' as PublicKey<'mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW'>;

export const MPL_NOOP_PROGRAM_ID =
  'mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3' as PublicKey<'mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3'>;

// Constants for known genesis blockhashes on Solana.
const SOLANA_MAINNET_GENESIS_HASH =
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const SOLANA_DEVNET_GENESIS_HASH =
  'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const SOLANA_TESTNET_GENESIS_HASH =
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY';

export type CompressionPrograms = {
  logWrapper: PublicKey;
  compressionProgram: PublicKey;
};

export async function getCompressionPrograms(
  context: Pick<Context, 'programs' | 'eddsa' | 'rpc'>
): Promise<CompressionPrograms> {
  const genesisHash = await context.rpc.call<string>('getGenesisHash');

  // Determine if the genesis hash matches known clusters.
  const isSolanaCluster = [
    SOLANA_MAINNET_GENESIS_HASH,
    SOLANA_DEVNET_GENESIS_HASH,
    SOLANA_TESTNET_GENESIS_HASH,
  ].includes(genesisHash);

  // Return appropriate program IDs based on the cluster.
  if (isSolanaCluster) {
    return {
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    };
  }
  return {
    logWrapper: MPL_NOOP_PROGRAM_ID,
    compressionProgram: MPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  };
}
