import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import { MyAccount, create, fetchMyAccount } from '../src';
import { createUmi } from './_setup';

test('it can create new accounts', async (t) => {
  // Given a Umi instance and a new signer.
  const umi = await createUmi();
  const address = generateSigner(umi);

  // When we create a new account.
  await create(umi, { address, foo: 1, bar: 2 }).sendAndConfirm(umi);

  // Then an account was created with the correct data.
  t.like(await fetchMyAccount(umi, address.publicKey), <MyAccount>{
    publicKey: publicKey(address),
    authority: publicKey(umi.identity),
    data: { foo: 1, bar: 2 },
  });
});
