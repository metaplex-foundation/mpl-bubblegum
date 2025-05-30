/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Program, ProgramError } from '@metaplex-foundation/umi';

type ProgramErrorConstructor = new (
  program: Program,
  cause?: Error
) => ProgramError;
const codeToErrorMap: Map<number, ProgramErrorConstructor> = new Map();
const nameToErrorMap: Map<string, ProgramErrorConstructor> = new Map();

/** IncorrectLeafLength: Incorrect leaf length. Expected vec of 32 bytes */
export class IncorrectLeafLengthError extends ProgramError {
  readonly name: string = 'IncorrectLeafLength';

  readonly code: number = 0x1770; // 6000

  constructor(program: Program, cause?: Error) {
    super('Incorrect leaf length. Expected vec of 32 bytes', program, cause);
  }
}
codeToErrorMap.set(0x1770, IncorrectLeafLengthError);
nameToErrorMap.set('IncorrectLeafLength', IncorrectLeafLengthError);

/** ConcurrentMerkleTreeError: Concurrent merkle tree error */
export class ConcurrentMerkleTreeErrorError extends ProgramError {
  readonly name: string = 'ConcurrentMerkleTreeError';

  readonly code: number = 0x1771; // 6001

  constructor(program: Program, cause?: Error) {
    super('Concurrent merkle tree error', program, cause);
  }
}
codeToErrorMap.set(0x1771, ConcurrentMerkleTreeErrorError);
nameToErrorMap.set('ConcurrentMerkleTreeError', ConcurrentMerkleTreeErrorError);

/** ZeroCopyError: Issue zero copying concurrent merkle tree data */
export class ZeroCopyErrorError extends ProgramError {
  readonly name: string = 'ZeroCopyError';

  readonly code: number = 0x1772; // 6002

  constructor(program: Program, cause?: Error) {
    super('Issue zero copying concurrent merkle tree data', program, cause);
  }
}
codeToErrorMap.set(0x1772, ZeroCopyErrorError);
nameToErrorMap.set('ZeroCopyError', ZeroCopyErrorError);

/** ConcurrentMerkleTreeConstantsError: An unsupported max depth or max buffer size constant was provided */
export class ConcurrentMerkleTreeConstantsErrorError extends ProgramError {
  readonly name: string = 'ConcurrentMerkleTreeConstantsError';

  readonly code: number = 0x1773; // 6003

  constructor(program: Program, cause?: Error) {
    super(
      'An unsupported max depth or max buffer size constant was provided',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1773, ConcurrentMerkleTreeConstantsErrorError);
nameToErrorMap.set(
  'ConcurrentMerkleTreeConstantsError',
  ConcurrentMerkleTreeConstantsErrorError
);

/** CanopyLengthMismatch: Expected a different byte length for the merkle tree canopy */
export class CanopyLengthMismatchError extends ProgramError {
  readonly name: string = 'CanopyLengthMismatch';

  readonly code: number = 0x1774; // 6004

  constructor(program: Program, cause?: Error) {
    super(
      'Expected a different byte length for the merkle tree canopy',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1774, CanopyLengthMismatchError);
nameToErrorMap.set('CanopyLengthMismatch', CanopyLengthMismatchError);

/** IncorrectAuthority: Provided authority does not match expected tree authority */
export class IncorrectAuthorityError extends ProgramError {
  readonly name: string = 'IncorrectAuthority';

  readonly code: number = 0x1775; // 6005

  constructor(program: Program, cause?: Error) {
    super(
      'Provided authority does not match expected tree authority',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1775, IncorrectAuthorityError);
nameToErrorMap.set('IncorrectAuthority', IncorrectAuthorityError);

/** IncorrectAccountOwner: Account is owned by a different program, expected it to be owned by this program */
export class IncorrectAccountOwnerError extends ProgramError {
  readonly name: string = 'IncorrectAccountOwner';

  readonly code: number = 0x1776; // 6006

  constructor(program: Program, cause?: Error) {
    super(
      'Account is owned by a different program, expected it to be owned by this program',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1776, IncorrectAccountOwnerError);
nameToErrorMap.set('IncorrectAccountOwner', IncorrectAccountOwnerError);

/** IncorrectAccountType: Account provided has incorrect account type */
export class IncorrectAccountTypeError extends ProgramError {
  readonly name: string = 'IncorrectAccountType';

  readonly code: number = 0x1777; // 6007

  constructor(program: Program, cause?: Error) {
    super('Account provided has incorrect account type', program, cause);
  }
}
codeToErrorMap.set(0x1777, IncorrectAccountTypeError);
nameToErrorMap.set('IncorrectAccountType', IncorrectAccountTypeError);

/** LeafIndexOutOfBounds: Leaf index of concurrent merkle tree is out of bounds */
export class LeafIndexOutOfBoundsError extends ProgramError {
  readonly name: string = 'LeafIndexOutOfBounds';

  readonly code: number = 0x1778; // 6008

  constructor(program: Program, cause?: Error) {
    super(
      'Leaf index of concurrent merkle tree is out of bounds',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1778, LeafIndexOutOfBoundsError);
nameToErrorMap.set('LeafIndexOutOfBounds', LeafIndexOutOfBoundsError);

/** CanopyNotAllocated: Tree was initialized without allocating space for the canopy */
export class CanopyNotAllocatedError extends ProgramError {
  readonly name: string = 'CanopyNotAllocated';

  readonly code: number = 0x1779; // 6009

  constructor(program: Program, cause?: Error) {
    super(
      'Tree was initialized without allocating space for the canopy',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1779, CanopyNotAllocatedError);
nameToErrorMap.set('CanopyNotAllocated', CanopyNotAllocatedError);

/** TreeAlreadyInitialized: Tree was already initialized */
export class TreeAlreadyInitializedError extends ProgramError {
  readonly name: string = 'TreeAlreadyInitialized';

  readonly code: number = 0x177a; // 6010

  constructor(program: Program, cause?: Error) {
    super('Tree was already initialized', program, cause);
  }
}
codeToErrorMap.set(0x177a, TreeAlreadyInitializedError);
nameToErrorMap.set('TreeAlreadyInitialized', TreeAlreadyInitializedError);

/** BatchNotInitialized: Tree header was not initialized for batch processing */
export class BatchNotInitializedError extends ProgramError {
  readonly name: string = 'BatchNotInitialized';

  readonly code: number = 0x177b; // 6011

  constructor(program: Program, cause?: Error) {
    super(
      'Tree header was not initialized for batch processing',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x177b, BatchNotInitializedError);
nameToErrorMap.set('BatchNotInitialized', BatchNotInitializedError);

/** CanopyRootMismatch: Canopy root does not match the root of the tree */
export class CanopyRootMismatchError extends ProgramError {
  readonly name: string = 'CanopyRootMismatch';

  readonly code: number = 0x177c; // 6012

  constructor(program: Program, cause?: Error) {
    super('Canopy root does not match the root of the tree', program, cause);
  }
}
codeToErrorMap.set(0x177c, CanopyRootMismatchError);
nameToErrorMap.set('CanopyRootMismatch', CanopyRootMismatchError);

/** CanopyRightmostLeafMismatch: Canopy contains nodes to the right of the rightmost leaf of the tree */
export class CanopyRightmostLeafMismatchError extends ProgramError {
  readonly name: string = 'CanopyRightmostLeafMismatch';

  readonly code: number = 0x177d; // 6013

  constructor(program: Program, cause?: Error) {
    super(
      'Canopy contains nodes to the right of the rightmost leaf of the tree',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x177d, CanopyRightmostLeafMismatchError);
nameToErrorMap.set(
  'CanopyRightmostLeafMismatch',
  CanopyRightmostLeafMismatchError
);

/**
 * Attempts to resolve a custom program error from the provided error code.
 * @category Errors
 */
export function getMplAccountCompressionErrorFromCode(
  code: number,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = codeToErrorMap.get(code);
  return constructor ? new constructor(program, cause) : null;
}

/**
 * Attempts to resolve a custom program error from the provided error name, i.e. 'Unauthorized'.
 * @category Errors
 */
export function getMplAccountCompressionErrorFromName(
  name: string,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = nameToErrorMap.get(name);
  return constructor ? new constructor(program, cause) : null;
}
