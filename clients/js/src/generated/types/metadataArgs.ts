/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Option, OptionOrNullable, none, some } from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  bool,
  mapSerializer,
  option,
  string,
  struct,
  u16,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  Collection,
  CollectionArgs,
  Creator,
  CreatorArgs,
  TokenProgramVersion,
  TokenProgramVersionArgs,
  TokenStandard,
  TokenStandardArgs,
  Uses,
  UsesArgs,
  getCollectionSerializer,
  getCreatorSerializer,
  getTokenProgramVersionSerializer,
  getTokenStandardSerializer,
  getUsesSerializer,
} from '.';

export type MetadataArgs = {
  /** The name of the asset */
  name: string;
  /** The symbol for the asset */
  symbol: string;
  /** URI pointing to JSON representing the asset */
  uri: string;
  /** Royalty basis points that goes to creators in secondary sales (0-10000) */
  sellerFeeBasisPoints: number;
  primarySaleHappened: boolean;
  isMutable: boolean;
  /** nonce for easy calculation of editions, if present */
  editionNonce: Option<number>;
  /** Since we cannot easily change Metadata, we add the new DataV2 fields here at the end. */
  tokenStandard: Option<TokenStandard>;
  /** Collection */
  collection: Option<Collection>;
  /** Uses */
  uses: Option<Uses>;
  tokenProgramVersion: TokenProgramVersion;
  creators: Array<Creator>;
};

export type MetadataArgsArgs = {
  /** The name of the asset */
  name: string;
  /** The symbol for the asset */
  symbol?: string;
  /** URI pointing to JSON representing the asset */
  uri: string;
  /** Royalty basis points that goes to creators in secondary sales (0-10000) */
  sellerFeeBasisPoints: number;
  primarySaleHappened?: boolean;
  isMutable?: boolean;
  /** nonce for easy calculation of editions, if present */
  editionNonce?: OptionOrNullable<number>;
  /** Since we cannot easily change Metadata, we add the new DataV2 fields here at the end. */
  tokenStandard?: OptionOrNullable<TokenStandardArgs>;
  /** Collection */
  collection: OptionOrNullable<CollectionArgs>;
  /** Uses */
  uses?: OptionOrNullable<UsesArgs>;
  tokenProgramVersion?: TokenProgramVersionArgs;
  creators: Array<CreatorArgs>;
};

export function getMetadataArgsSerializer(): Serializer<
  MetadataArgsArgs,
  MetadataArgs
> {
  return mapSerializer<MetadataArgsArgs, any, MetadataArgs>(
    struct<MetadataArgs>(
      [
        ['name', string()],
        ['symbol', string()],
        ['uri', string()],
        ['sellerFeeBasisPoints', u16()],
        ['primarySaleHappened', bool()],
        ['isMutable', bool()],
        ['editionNonce', option(u8())],
        ['tokenStandard', option(getTokenStandardSerializer())],
        ['collection', option(getCollectionSerializer())],
        ['uses', option(getUsesSerializer())],
        ['tokenProgramVersion', getTokenProgramVersionSerializer()],
        ['creators', array(getCreatorSerializer())],
      ],
      { description: 'MetadataArgs' }
    ),
    (value) => ({
      ...value,
      symbol: value.symbol ?? '',
      primarySaleHappened: value.primarySaleHappened ?? false,
      isMutable: value.isMutable ?? true,
      editionNonce: value.editionNonce ?? none(),
      tokenStandard: value.tokenStandard ?? some(TokenStandard.NonFungible),
      uses: value.uses ?? none(),
      tokenProgramVersion:
        value.tokenProgramVersion ?? TokenProgramVersion.Original,
    })
  ) as Serializer<MetadataArgsArgs, MetadataArgs>;
}