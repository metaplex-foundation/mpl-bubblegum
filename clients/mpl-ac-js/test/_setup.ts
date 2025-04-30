/* eslint-disable import/no-extraneous-dependencies */
import { SolAmount, TransactionWithMeta } from '@metaplex-foundation/umi';
import { createUmi as baseCreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import { mplAccountCompression } from '../src';

export const createUmi = async (endpoint?: string, airdropAmount?: SolAmount) =>
  (await baseCreateUmi(endpoint, undefined, airdropAmount)).use(
    mplAccountCompression()
  );

// TransactionWithMeta doesn't have ReturnData field that is discribed in
// https://solana.com/docs/rpc/http/gettransaction#result
// so ugly log parsing is provided
export function getReturnLog(
  transaction: TransactionWithMeta | null
): null | [string, string, Buffer] {
  if (transaction === null) {
    return null;
  }
  const prefix = 'Program return: ';
  let log = transaction.meta.logs.find((logs) => logs.startsWith(prefix));
  if (log === undefined) {
    return null;
  }
  log = log.slice(prefix.length);
  const [key, data] = log.split(' ', 2);
  const buffer = Buffer.from(data, 'base64');
  return [key, data, buffer];
}
