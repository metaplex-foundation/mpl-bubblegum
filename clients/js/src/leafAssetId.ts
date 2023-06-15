import { Context, Pda, PublicKey } from '@metaplex-foundation/umi';
import { MPL_BUBBLEGUM_PROGRAM_ID } from './generated';

export function findLeafAssetIdPda(
  context: Pick<Context, 'serializer' | 'programs' | 'eddsa'>,
  seeds: {
    tree: PublicKey;
    leafIndex: number | bigint;
  }
): Pda {
  const programId = context.programs.getPublicKey(
    'mplBubblegum',
    MPL_BUBBLEGUM_PROGRAM_ID
  );
  const s = context.serializer;
  return context.eddsa.findPda(programId, [
    s.string({ size: 'variable' }).serialize('asset'),
    s.publicKey().serialize(seeds.tree),
    s.u64().serialize(seeds.leafIndex),
  ]);
}
