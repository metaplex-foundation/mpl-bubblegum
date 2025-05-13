import { samePublicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import { SPL_ACCOUNT_COMPRESSION_PROGRAM_ID } from '../src';
import { createUmi } from './_setup';

test('it registers the program', async (t) => {
  // Given a Umi instance using the project's plugin.
  const umi = await createUmi();

  // When we fetch the registered program.
  const program = umi.programs.get('splAccountCompression');

  // Then we expect it to be the same as the program ID constant.
  t.true(samePublicKey(program.publicKey, SPL_ACCOUNT_COMPRESSION_PROGRAM_ID));
});
