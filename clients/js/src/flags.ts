export enum LeafSchemaV2Flags {
  None = 0,
  FrozenByOwner = 1 << 0,
  FrozenByPermDelegate = 1 << 1,
  NonTransferable = 1 << 2,
}
