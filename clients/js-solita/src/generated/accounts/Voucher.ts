/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as web3 from '@solana/web3.js'
import * as beet from '@metaplex-foundation/beet'
import * as beetSolana from '@metaplex-foundation/beet-solana'
import { LeafSchema, leafSchemaBeet } from '../types/LeafSchema'

/**
 * Arguments used to create {@link Voucher}
 * @category Accounts
 * @category generated
 */
export type VoucherArgs = {
  leafSchema: LeafSchema
  index: number
  merkleTree: web3.PublicKey
}

export const voucherDiscriminator = [191, 204, 149, 234, 213, 165, 13, 65]
/**
 * Holds the data for the {@link Voucher} Account and provides de/serialization
 * functionality for that data
 *
 * @category Accounts
 * @category generated
 */
export class Voucher implements VoucherArgs {
  private constructor(
    readonly leafSchema: LeafSchema,
    readonly index: number,
    readonly merkleTree: web3.PublicKey
  ) {}

  /**
   * Creates a {@link Voucher} instance from the provided args.
   */
  static fromArgs(args: VoucherArgs) {
    return new Voucher(args.leafSchema, args.index, args.merkleTree)
  }

  /**
   * Deserializes the {@link Voucher} from the data of the provided {@link web3.AccountInfo}.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static fromAccountInfo(
    accountInfo: web3.AccountInfo<Buffer>,
    offset = 0
  ): [Voucher, number] {
    return Voucher.deserialize(accountInfo.data, offset)
  }

  /**
   * Retrieves the account info from the provided address and deserializes
   * the {@link Voucher} from its data.
   *
   * @throws Error if no account info is found at the address or if deserialization fails
   */
  static async fromAccountAddress(
    connection: web3.Connection,
    address: web3.PublicKey,
    commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
  ): Promise<Voucher> {
    const accountInfo = await connection.getAccountInfo(
      address,
      commitmentOrConfig
    )
    if (accountInfo == null) {
      throw new Error(`Unable to find Voucher account at ${address}`)
    }
    return Voucher.fromAccountInfo(accountInfo, 0)[0]
  }

  /**
   * Provides a {@link web3.Connection.getProgramAccounts} config builder,
   * to fetch accounts matching filters that can be specified via that builder.
   *
   * @param programId - the program that owns the accounts we are filtering
   */
  static gpaBuilder(
    programId: web3.PublicKey = new web3.PublicKey(
      'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY'
    )
  ) {
    return beetSolana.GpaBuilder.fromStruct(programId, voucherBeet)
  }

  /**
   * Deserializes the {@link Voucher} from the provided data Buffer.
   * @returns a tuple of the account data and the offset up to which the buffer was read to obtain it.
   */
  static deserialize(buf: Buffer, offset = 0): [Voucher, number] {
    return voucherBeet.deserialize(buf, offset)
  }

  /**
   * Serializes the {@link Voucher} into a Buffer.
   * @returns a tuple of the created Buffer and the offset up to which the buffer was written to store it.
   */
  serialize(): [Buffer, number] {
    return voucherBeet.serialize({
      accountDiscriminator: voucherDiscriminator,
      ...this,
    })
  }

  /**
   * Returns the byteSize of a {@link Buffer} holding the serialized data of
   * {@link Voucher} for the provided args.
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   */
  static byteSize(args: VoucherArgs) {
    const instance = Voucher.fromArgs(args)
    return voucherBeet.toFixedFromValue({
      accountDiscriminator: voucherDiscriminator,
      ...instance,
    }).byteSize
  }

  /**
   * Fetches the minimum balance needed to exempt an account holding
   * {@link Voucher} data from rent
   *
   * @param args need to be provided since the byte size for this account
   * depends on them
   * @param connection used to retrieve the rent exemption information
   */
  static async getMinimumBalanceForRentExemption(
    args: VoucherArgs,
    connection: web3.Connection,
    commitment?: web3.Commitment
  ): Promise<number> {
    return connection.getMinimumBalanceForRentExemption(
      Voucher.byteSize(args),
      commitment
    )
  }

  /**
   * Returns a readable version of {@link Voucher} properties
   * and can be used to convert to JSON and/or logging
   */
  pretty() {
    return {
      leafSchema: this.leafSchema.__kind,
      index: this.index,
      merkleTree: this.merkleTree.toBase58(),
    }
  }
}

/**
 * @category Accounts
 * @category generated
 */
export const voucherBeet = new beet.FixableBeetStruct<
  Voucher,
  VoucherArgs & {
    accountDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['accountDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['leafSchema', leafSchemaBeet],
    ['index', beet.u32],
    ['merkleTree', beetSolana.publicKey],
  ],
  Voucher.fromArgs,
  'Voucher'
)
