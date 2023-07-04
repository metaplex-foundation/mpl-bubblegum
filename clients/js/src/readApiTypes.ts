import { JsonMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { Nullable, PublicKey } from '@metaplex-foundation/umi';

export type ReadApiAssetInterface =
  | 'V1_NFT'
  | 'V1_PRINT'
  | 'LEGACY_NFT'
  | 'V2_NFT'
  | 'FungibleAsset'
  | 'Custom'
  | 'Identity'
  | 'Executable'
  | 'ProgrammableNFT';

export type ReadApiPropGroupKey = 'collection';

export type ReadApiPropSortBy = 'created' | 'updated' | 'recent_action';

export type ReadApiPropSortDirection = 'asc' | 'desc';

export type ReadApiParamAssetSortBy = {
  sortBy: ReadApiPropSortBy;
  sortDirection: ReadApiPropSortDirection;
};

export type ReadApiAssetContent = {
  json_uri: string;
  metadata: JsonMetadata;
};

export type ReadApiAssetCompression = {
  eligible: boolean;
  compressed: boolean;
  data_hash: PublicKey;
  creator_hash: PublicKey;
  asset_hash: PublicKey;
  tree: PublicKey;
  seq: number;
  leaf_id: number;
};

export type ReadApiAssetOwnership = {
  frozen: boolean;
  delegated: boolean;
  delegate: PublicKey | null;
  owner: PublicKey;
  ownership_model: 'single' | 'token';
};

export type ReadApiAssetSupply = {
  edition_nonce: number | null;
  print_current_supply: number;
  print_max_supply: number;
};

export type ReadApiAssetRoyalty = {
  royalty_model: 'creators';
  target: PublicKey | null;
  percent: number;
  primary_sale_happened: boolean;
  basis_points: number;
  locked: boolean;
};

export type ReadApiAssetCreator = {
  address: PublicKey;
  verified: boolean;
  share: number;
};

export type ReadApiAssetGrouping = {
  group_key: ReadApiPropGroupKey;
  group_value: string;
};

export type ReadApiAuthorityScope = 'full';

export type ReadApiAssetAuthority = {
  address: PublicKey;
  scopes: ReadApiAuthorityScope[];
};

export type GetAssetProofRpcResponse = {
  root: PublicKey;
  proof: PublicKey[];
  node_index: number;
  leaf: PublicKey;
  tree_id: PublicKey;
};

export type GetAssetsByGroupRpcInput = {
  groupKey: ReadApiPropGroupKey;
  groupValue: string;
  page?: Nullable<number>;
  limit?: Nullable<number>;
  /* assetId to search before */
  before?: Nullable<string>;
  /* assetId to search after */
  after?: Nullable<string>;
  sortBy?: Nullable<ReadApiParamAssetSortBy>;
};

export type GetAssetsByOwnerRpcInput = {
  /**
   * String of the owner's PublicKey address
   */
  owner: PublicKey;
  page?: Nullable<number>;
  limit?: Nullable<number>;
  before?: Nullable<string>;
  after?: Nullable<string>;
  sortBy?: Nullable<ReadApiParamAssetSortBy>;
};

export type ReadApiAsset = {
  /**
   * The asset Id
   */
  id: PublicKey;
  interface: ReadApiAssetInterface;
  ownership: ReadApiAssetOwnership;
  mutable: boolean;
  authorities: Array<ReadApiAssetAuthority>;
  content: ReadApiAssetContent;
  royalty: ReadApiAssetRoyalty;
  supply: ReadApiAssetSupply;
  creators: Array<ReadApiAssetCreator>;
  grouping: Array<ReadApiAssetGrouping>;
  compression: ReadApiAssetCompression;
};

export type ReadApiAssetList = {
  total: number;
  limit: number;

  /**
   * listing of individual assets, and their associated metadata
   */
  items: Array<ReadApiAsset>;

  /**
   * `page` is only provided when using page based pagination, as apposed
   * to asset id before/after based pagination
   */
  page: Nullable<number>;

  /**
   * asset Id searching before
   */
  before: Nullable<string>;

  /**
   * asset Id searching after
   */
  after: Nullable<string>;

  /**
   * listing of errors provided by the ReadApi RPC
   */
  errors: Nullable<ReadApiRpcResponseError[]>;
};

export type ReadApiRpcResponseError = {
  error: string;
  id: string;
};
