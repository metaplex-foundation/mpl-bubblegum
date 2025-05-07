export enum LeafSchemaV2Flags {
  None = 0,
  FrozenByOwner = 1 << 0,
  FrozenByPermDelegate = 1 << 1,
  NonTransferable = 1 << 2,
}

// Checks whether a number is a valid LeafSchemaV2Flags bitmask.
export function isValidLeafSchemaV2Flags(n: unknown): n is LeafSchemaV2Flags {
  return (
    typeof n === 'number' &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 0xff && // fits in u8
    (n & ~0b111) === 0 // only known bits (bits 0–2)
  );
}
