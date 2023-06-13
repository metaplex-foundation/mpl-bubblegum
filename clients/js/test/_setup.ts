/* eslint-disable import/no-extraneous-dependencies */
import { Context, PublicKey, generateSigner } from '@metaplex-foundation/umi';
import { createUmi as baseCreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import { createTree as baseCreateTree, mplBubblegum } from '../src';

export const createUmi = async () =>
  (await baseCreateUmi()).use(mplBubblegum());

export const createTree = async (
  context: Context,
  input: Partial<Parameters<typeof baseCreateTree>[1]> = {}
): Promise<PublicKey> => {
  const merkleTree = generateSigner(context);
  const builder = await baseCreateTree(context, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    ...input,
  });
  await builder.sendAndConfirm(context);
  return merkleTree.publicKey;
};
