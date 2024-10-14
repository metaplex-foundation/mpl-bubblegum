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

/** AssetOwnerMismatch: Asset Owner Does not match */
export class AssetOwnerMismatchError extends ProgramError {
  readonly name: string = 'AssetOwnerMismatch';

  readonly code: number = 0x1770; // 6000

  constructor(program: Program, cause?: Error) {
    super('Asset Owner Does not match', program, cause);
  }
}
codeToErrorMap.set(0x1770, AssetOwnerMismatchError);
nameToErrorMap.set('AssetOwnerMismatch', AssetOwnerMismatchError);

/** PublicKeyMismatch: PublicKeyMismatch */
export class PublicKeyMismatchError extends ProgramError {
  readonly name: string = 'PublicKeyMismatch';

  readonly code: number = 0x1771; // 6001

  constructor(program: Program, cause?: Error) {
    super('PublicKeyMismatch', program, cause);
  }
}
codeToErrorMap.set(0x1771, PublicKeyMismatchError);
nameToErrorMap.set('PublicKeyMismatch', PublicKeyMismatchError);

/** HashingMismatch: Hashing Mismatch Within Leaf Schema */
export class HashingMismatchError extends ProgramError {
  readonly name: string = 'HashingMismatch';

  readonly code: number = 0x1772; // 6002

  constructor(program: Program, cause?: Error) {
    super('Hashing Mismatch Within Leaf Schema', program, cause);
  }
}
codeToErrorMap.set(0x1772, HashingMismatchError);
nameToErrorMap.set('HashingMismatch', HashingMismatchError);

/** UnsupportedSchemaVersion: Unsupported Schema Version */
export class UnsupportedSchemaVersionError extends ProgramError {
  readonly name: string = 'UnsupportedSchemaVersion';

  readonly code: number = 0x1773; // 6003

  constructor(program: Program, cause?: Error) {
    super('Unsupported Schema Version', program, cause);
  }
}
codeToErrorMap.set(0x1773, UnsupportedSchemaVersionError);
nameToErrorMap.set('UnsupportedSchemaVersion', UnsupportedSchemaVersionError);

/** CreatorShareTotalMustBe100: Creator shares must sum to 100 */
export class CreatorShareTotalMustBe100Error extends ProgramError {
  readonly name: string = 'CreatorShareTotalMustBe100';

  readonly code: number = 0x1774; // 6004

  constructor(program: Program, cause?: Error) {
    super('Creator shares must sum to 100', program, cause);
  }
}
codeToErrorMap.set(0x1774, CreatorShareTotalMustBe100Error);
nameToErrorMap.set(
  'CreatorShareTotalMustBe100',
  CreatorShareTotalMustBe100Error
);

/** DuplicateCreatorAddress: No duplicate creator addresses in metadata */
export class DuplicateCreatorAddressError extends ProgramError {
  readonly name: string = 'DuplicateCreatorAddress';

  readonly code: number = 0x1775; // 6005

  constructor(program: Program, cause?: Error) {
    super('No duplicate creator addresses in metadata', program, cause);
  }
}
codeToErrorMap.set(0x1775, DuplicateCreatorAddressError);
nameToErrorMap.set('DuplicateCreatorAddress', DuplicateCreatorAddressError);

/** CreatorDidNotVerify: Creator did not verify the metadata */
export class CreatorDidNotVerifyError extends ProgramError {
  readonly name: string = 'CreatorDidNotVerify';

  readonly code: number = 0x1776; // 6006

  constructor(program: Program, cause?: Error) {
    super('Creator did not verify the metadata', program, cause);
  }
}
codeToErrorMap.set(0x1776, CreatorDidNotVerifyError);
nameToErrorMap.set('CreatorDidNotVerify', CreatorDidNotVerifyError);

/** CreatorNotFound: Creator not found in creator Vec */
export class CreatorNotFoundError extends ProgramError {
  readonly name: string = 'CreatorNotFound';

  readonly code: number = 0x1777; // 6007

  constructor(program: Program, cause?: Error) {
    super('Creator not found in creator Vec', program, cause);
  }
}
codeToErrorMap.set(0x1777, CreatorNotFoundError);
nameToErrorMap.set('CreatorNotFound', CreatorNotFoundError);

/** NoCreatorsPresent: No creators in creator Vec */
export class NoCreatorsPresentError extends ProgramError {
  readonly name: string = 'NoCreatorsPresent';

  readonly code: number = 0x1778; // 6008

  constructor(program: Program, cause?: Error) {
    super('No creators in creator Vec', program, cause);
  }
}
codeToErrorMap.set(0x1778, NoCreatorsPresentError);
nameToErrorMap.set('NoCreatorsPresent', NoCreatorsPresentError);

/** CreatorHashMismatch: User-provided creator Vec must result in same user-provided creator hash */
export class CreatorHashMismatchError extends ProgramError {
  readonly name: string = 'CreatorHashMismatch';

  readonly code: number = 0x1779; // 6009

  constructor(program: Program, cause?: Error) {
    super(
      'User-provided creator Vec must result in same user-provided creator hash',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1779, CreatorHashMismatchError);
nameToErrorMap.set('CreatorHashMismatch', CreatorHashMismatchError);

/** DataHashMismatch: User-provided metadata must result in same user-provided data hash */
export class DataHashMismatchError extends ProgramError {
  readonly name: string = 'DataHashMismatch';

  readonly code: number = 0x177a; // 6010

  constructor(program: Program, cause?: Error) {
    super(
      'User-provided metadata must result in same user-provided data hash',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x177a, DataHashMismatchError);
nameToErrorMap.set('DataHashMismatch', DataHashMismatchError);

/** CreatorsTooLong: Creators list too long */
export class CreatorsTooLongError extends ProgramError {
  readonly name: string = 'CreatorsTooLong';

  readonly code: number = 0x177b; // 6011

  constructor(program: Program, cause?: Error) {
    super('Creators list too long', program, cause);
  }
}
codeToErrorMap.set(0x177b, CreatorsTooLongError);
nameToErrorMap.set('CreatorsTooLong', CreatorsTooLongError);

/** MetadataNameTooLong: Name in metadata is too long */
export class MetadataNameTooLongError extends ProgramError {
  readonly name: string = 'MetadataNameTooLong';

  readonly code: number = 0x177c; // 6012

  constructor(program: Program, cause?: Error) {
    super('Name in metadata is too long', program, cause);
  }
}
codeToErrorMap.set(0x177c, MetadataNameTooLongError);
nameToErrorMap.set('MetadataNameTooLong', MetadataNameTooLongError);

/** MetadataSymbolTooLong: Symbol in metadata is too long */
export class MetadataSymbolTooLongError extends ProgramError {
  readonly name: string = 'MetadataSymbolTooLong';

  readonly code: number = 0x177d; // 6013

  constructor(program: Program, cause?: Error) {
    super('Symbol in metadata is too long', program, cause);
  }
}
codeToErrorMap.set(0x177d, MetadataSymbolTooLongError);
nameToErrorMap.set('MetadataSymbolTooLong', MetadataSymbolTooLongError);

/** MetadataUriTooLong: Uri in metadata is too long */
export class MetadataUriTooLongError extends ProgramError {
  readonly name: string = 'MetadataUriTooLong';

  readonly code: number = 0x177e; // 6014

  constructor(program: Program, cause?: Error) {
    super('Uri in metadata is too long', program, cause);
  }
}
codeToErrorMap.set(0x177e, MetadataUriTooLongError);
nameToErrorMap.set('MetadataUriTooLong', MetadataUriTooLongError);

/** MetadataBasisPointsTooHigh: Basis points in metadata cannot exceed 10000 */
export class MetadataBasisPointsTooHighError extends ProgramError {
  readonly name: string = 'MetadataBasisPointsTooHigh';

  readonly code: number = 0x177f; // 6015

  constructor(program: Program, cause?: Error) {
    super('Basis points in metadata cannot exceed 10000', program, cause);
  }
}
codeToErrorMap.set(0x177f, MetadataBasisPointsTooHighError);
nameToErrorMap.set(
  'MetadataBasisPointsTooHigh',
  MetadataBasisPointsTooHighError
);

/** TreeAuthorityIncorrect: Tree creator or tree delegate must sign. */
export class TreeAuthorityIncorrectError extends ProgramError {
  readonly name: string = 'TreeAuthorityIncorrect';

  readonly code: number = 0x1780; // 6016

  constructor(program: Program, cause?: Error) {
    super('Tree creator or tree delegate must sign.', program, cause);
  }
}
codeToErrorMap.set(0x1780, TreeAuthorityIncorrectError);
nameToErrorMap.set('TreeAuthorityIncorrect', TreeAuthorityIncorrectError);

/** InsufficientMintCapacity: Not enough unapproved mints left */
export class InsufficientMintCapacityError extends ProgramError {
  readonly name: string = 'InsufficientMintCapacity';

  readonly code: number = 0x1781; // 6017

  constructor(program: Program, cause?: Error) {
    super('Not enough unapproved mints left', program, cause);
  }
}
codeToErrorMap.set(0x1781, InsufficientMintCapacityError);
nameToErrorMap.set('InsufficientMintCapacity', InsufficientMintCapacityError);

/** NumericalOverflowError: NumericalOverflowError */
export class NumericalOverflowErrorError extends ProgramError {
  readonly name: string = 'NumericalOverflowError';

  readonly code: number = 0x1782; // 6018

  constructor(program: Program, cause?: Error) {
    super('NumericalOverflowError', program, cause);
  }
}
codeToErrorMap.set(0x1782, NumericalOverflowErrorError);
nameToErrorMap.set('NumericalOverflowError', NumericalOverflowErrorError);

/** IncorrectOwner: Incorrect account owner */
export class IncorrectOwnerError extends ProgramError {
  readonly name: string = 'IncorrectOwner';

  readonly code: number = 0x1783; // 6019

  constructor(program: Program, cause?: Error) {
    super('Incorrect account owner', program, cause);
  }
}
codeToErrorMap.set(0x1783, IncorrectOwnerError);
nameToErrorMap.set('IncorrectOwner', IncorrectOwnerError);

/** CollectionCannotBeVerifiedInThisInstruction: Cannot Verify Collection in this Instruction */
export class CollectionCannotBeVerifiedInThisInstructionError extends ProgramError {
  readonly name: string = 'CollectionCannotBeVerifiedInThisInstruction';

  readonly code: number = 0x1784; // 6020

  constructor(program: Program, cause?: Error) {
    super('Cannot Verify Collection in this Instruction', program, cause);
  }
}
codeToErrorMap.set(0x1784, CollectionCannotBeVerifiedInThisInstructionError);
nameToErrorMap.set(
  'CollectionCannotBeVerifiedInThisInstruction',
  CollectionCannotBeVerifiedInThisInstructionError
);

/** CollectionNotFound: Collection Not Found on Metadata */
export class CollectionNotFoundError extends ProgramError {
  readonly name: string = 'CollectionNotFound';

  readonly code: number = 0x1785; // 6021

  constructor(program: Program, cause?: Error) {
    super('Collection Not Found on Metadata', program, cause);
  }
}
codeToErrorMap.set(0x1785, CollectionNotFoundError);
nameToErrorMap.set('CollectionNotFound', CollectionNotFoundError);

/** AlreadyVerified: Collection item is already verified. */
export class AlreadyVerifiedError extends ProgramError {
  readonly name: string = 'AlreadyVerified';

  readonly code: number = 0x1786; // 6022

  constructor(program: Program, cause?: Error) {
    super('Collection item is already verified.', program, cause);
  }
}
codeToErrorMap.set(0x1786, AlreadyVerifiedError);
nameToErrorMap.set('AlreadyVerified', AlreadyVerifiedError);

/** AlreadyUnverified: Collection item is already unverified. */
export class AlreadyUnverifiedError extends ProgramError {
  readonly name: string = 'AlreadyUnverified';

  readonly code: number = 0x1787; // 6023

  constructor(program: Program, cause?: Error) {
    super('Collection item is already unverified.', program, cause);
  }
}
codeToErrorMap.set(0x1787, AlreadyUnverifiedError);
nameToErrorMap.set('AlreadyUnverified', AlreadyUnverifiedError);

/** UpdateAuthorityIncorrect: Incorrect leaf metadata update authority. */
export class UpdateAuthorityIncorrectError extends ProgramError {
  readonly name: string = 'UpdateAuthorityIncorrect';

  readonly code: number = 0x1788; // 6024

  constructor(program: Program, cause?: Error) {
    super('Incorrect leaf metadata update authority.', program, cause);
  }
}
codeToErrorMap.set(0x1788, UpdateAuthorityIncorrectError);
nameToErrorMap.set('UpdateAuthorityIncorrect', UpdateAuthorityIncorrectError);

/** LeafAuthorityMustSign: This transaction must be signed by either the leaf owner or leaf delegate */
export class LeafAuthorityMustSignError extends ProgramError {
  readonly name: string = 'LeafAuthorityMustSign';

  readonly code: number = 0x1789; // 6025

  constructor(program: Program, cause?: Error) {
    super(
      'This transaction must be signed by either the leaf owner or leaf delegate',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1789, LeafAuthorityMustSignError);
nameToErrorMap.set('LeafAuthorityMustSign', LeafAuthorityMustSignError);

/** CollectionMustBeSized: Collection Not Compatable with Compression, Must be Sized */
export class CollectionMustBeSizedError extends ProgramError {
  readonly name: string = 'CollectionMustBeSized';

  readonly code: number = 0x178a; // 6026

  constructor(program: Program, cause?: Error) {
    super(
      'Collection Not Compatable with Compression, Must be Sized',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x178a, CollectionMustBeSizedError);
nameToErrorMap.set('CollectionMustBeSized', CollectionMustBeSizedError);

/** MetadataMintMismatch: Metadata mint does not match collection mint */
export class MetadataMintMismatchError extends ProgramError {
  readonly name: string = 'MetadataMintMismatch';

  readonly code: number = 0x178b; // 6027

  constructor(program: Program, cause?: Error) {
    super('Metadata mint does not match collection mint', program, cause);
  }
}
codeToErrorMap.set(0x178b, MetadataMintMismatchError);
nameToErrorMap.set('MetadataMintMismatch', MetadataMintMismatchError);

/** InvalidCollectionAuthority: Invalid collection authority */
export class InvalidCollectionAuthorityError extends ProgramError {
  readonly name: string = 'InvalidCollectionAuthority';

  readonly code: number = 0x178c; // 6028

  constructor(program: Program, cause?: Error) {
    super('Invalid collection authority', program, cause);
  }
}
codeToErrorMap.set(0x178c, InvalidCollectionAuthorityError);
nameToErrorMap.set(
  'InvalidCollectionAuthority',
  InvalidCollectionAuthorityError
);

/** InvalidDelegateRecord: Invalid delegate record pda derivation */
export class InvalidDelegateRecordError extends ProgramError {
  readonly name: string = 'InvalidDelegateRecord';

  readonly code: number = 0x178d; // 6029

  constructor(program: Program, cause?: Error) {
    super('Invalid delegate record pda derivation', program, cause);
  }
}
codeToErrorMap.set(0x178d, InvalidDelegateRecordError);
nameToErrorMap.set('InvalidDelegateRecord', InvalidDelegateRecordError);

/** CollectionMasterEditionAccountInvalid: Edition account doesnt match collection */
export class CollectionMasterEditionAccountInvalidError extends ProgramError {
  readonly name: string = 'CollectionMasterEditionAccountInvalid';

  readonly code: number = 0x178e; // 6030

  constructor(program: Program, cause?: Error) {
    super('Edition account doesnt match collection', program, cause);
  }
}
codeToErrorMap.set(0x178e, CollectionMasterEditionAccountInvalidError);
nameToErrorMap.set(
  'CollectionMasterEditionAccountInvalid',
  CollectionMasterEditionAccountInvalidError
);

/** CollectionMustBeAUniqueMasterEdition: Collection Must Be a Unique Master Edition v2 */
export class CollectionMustBeAUniqueMasterEditionError extends ProgramError {
  readonly name: string = 'CollectionMustBeAUniqueMasterEdition';

  readonly code: number = 0x178f; // 6031

  constructor(program: Program, cause?: Error) {
    super('Collection Must Be a Unique Master Edition v2', program, cause);
  }
}
codeToErrorMap.set(0x178f, CollectionMustBeAUniqueMasterEditionError);
nameToErrorMap.set(
  'CollectionMustBeAUniqueMasterEdition',
  CollectionMustBeAUniqueMasterEditionError
);

/** UnknownExternalError: Could not convert external error to BubblegumError */
export class UnknownExternalErrorError extends ProgramError {
  readonly name: string = 'UnknownExternalError';

  readonly code: number = 0x1790; // 6032

  constructor(program: Program, cause?: Error) {
    super('Could not convert external error to BubblegumError', program, cause);
  }
}
codeToErrorMap.set(0x1790, UnknownExternalErrorError);
nameToErrorMap.set('UnknownExternalError', UnknownExternalErrorError);

/** DecompressionDisabled: Decompression is disabled for this tree. */
export class DecompressionDisabledError extends ProgramError {
  readonly name: string = 'DecompressionDisabled';

  readonly code: number = 0x1791; // 6033

  constructor(program: Program, cause?: Error) {
    super('Decompression is disabled for this tree.', program, cause);
  }
}
codeToErrorMap.set(0x1791, DecompressionDisabledError);
nameToErrorMap.set('DecompressionDisabled', DecompressionDisabledError);

/** MissingCollectionMintAccount: Missing collection mint account */
export class MissingCollectionMintAccountError extends ProgramError {
  readonly name: string = 'MissingCollectionMintAccount';

  readonly code: number = 0x1792; // 6034

  constructor(program: Program, cause?: Error) {
    super('Missing collection mint account', program, cause);
  }
}
codeToErrorMap.set(0x1792, MissingCollectionMintAccountError);
nameToErrorMap.set(
  'MissingCollectionMintAccount',
  MissingCollectionMintAccountError
);

/** MissingCollectionMetadataAccount: Missing collection metadata account */
export class MissingCollectionMetadataAccountError extends ProgramError {
  readonly name: string = 'MissingCollectionMetadataAccount';

  readonly code: number = 0x1793; // 6035

  constructor(program: Program, cause?: Error) {
    super('Missing collection metadata account', program, cause);
  }
}
codeToErrorMap.set(0x1793, MissingCollectionMetadataAccountError);
nameToErrorMap.set(
  'MissingCollectionMetadataAccount',
  MissingCollectionMetadataAccountError
);

/** CollectionMismatch: Collection mismatch */
export class CollectionMismatchError extends ProgramError {
  readonly name: string = 'CollectionMismatch';

  readonly code: number = 0x1794; // 6036

  constructor(program: Program, cause?: Error) {
    super('Collection mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1794, CollectionMismatchError);
nameToErrorMap.set('CollectionMismatch', CollectionMismatchError);

/** MetadataImmutable: Metadata not mutable */
export class MetadataImmutableError extends ProgramError {
  readonly name: string = 'MetadataImmutable';

  readonly code: number = 0x1795; // 6037

  constructor(program: Program, cause?: Error) {
    super('Metadata not mutable', program, cause);
  }
}
codeToErrorMap.set(0x1795, MetadataImmutableError);
nameToErrorMap.set('MetadataImmutable', MetadataImmutableError);

/** PrimarySaleCanOnlyBeFlippedToTrue: Can only update primary sale to true */
export class PrimarySaleCanOnlyBeFlippedToTrueError extends ProgramError {
  readonly name: string = 'PrimarySaleCanOnlyBeFlippedToTrue';

  readonly code: number = 0x1796; // 6038

  constructor(program: Program, cause?: Error) {
    super('Can only update primary sale to true', program, cause);
  }
}
codeToErrorMap.set(0x1796, PrimarySaleCanOnlyBeFlippedToTrueError);
nameToErrorMap.set(
  'PrimarySaleCanOnlyBeFlippedToTrue',
  PrimarySaleCanOnlyBeFlippedToTrueError
);

/** CreatorDidNotUnverify: Creator did not unverify the metadata */
export class CreatorDidNotUnverifyError extends ProgramError {
  readonly name: string = 'CreatorDidNotUnverify';

  readonly code: number = 0x1797; // 6039

  constructor(program: Program, cause?: Error) {
    super('Creator did not unverify the metadata', program, cause);
  }
}
codeToErrorMap.set(0x1797, CreatorDidNotUnverifyError);
nameToErrorMap.set('CreatorDidNotUnverify', CreatorDidNotUnverifyError);

/** InvalidTokenStandard: Only NonFungible standard is supported */
export class InvalidTokenStandardError extends ProgramError {
  readonly name: string = 'InvalidTokenStandard';

  readonly code: number = 0x1798; // 6040

  constructor(program: Program, cause?: Error) {
    super('Only NonFungible standard is supported', program, cause);
  }
}
codeToErrorMap.set(0x1798, InvalidTokenStandardError);
nameToErrorMap.set('InvalidTokenStandard', InvalidTokenStandardError);

/** InvalidCanopySize: Canopy size should be set bigger for this tree */
export class InvalidCanopySizeError extends ProgramError {
  readonly name: string = 'InvalidCanopySize';

  readonly code: number = 0x1799; // 6041

  constructor(program: Program, cause?: Error) {
    super('Canopy size should be set bigger for this tree', program, cause);
  }
}
codeToErrorMap.set(0x1799, InvalidCanopySizeError);
nameToErrorMap.set('InvalidCanopySize', InvalidCanopySizeError);

/** InvalidLogWrapper: Invalid log wrapper program */
export class InvalidLogWrapperError extends ProgramError {
  readonly name: string = 'InvalidLogWrapper';

  readonly code: number = 0x179a; // 6042

  constructor(program: Program, cause?: Error) {
    super('Invalid log wrapper program', program, cause);
  }
}
codeToErrorMap.set(0x179a, InvalidLogWrapperError);
nameToErrorMap.set('InvalidLogWrapper', InvalidLogWrapperError);

/** InvalidCompressionProgram: Invalid compression program */
export class InvalidCompressionProgramError extends ProgramError {
  readonly name: string = 'InvalidCompressionProgram';

  readonly code: number = 0x179b; // 6043

  constructor(program: Program, cause?: Error) {
    super('Invalid compression program', program, cause);
  }
}
codeToErrorMap.set(0x179b, InvalidCompressionProgramError);
nameToErrorMap.set('InvalidCompressionProgram', InvalidCompressionProgramError);

/**
 * Attempts to resolve a custom program error from the provided error code.
 * @category Errors
 */
export function getMplBubblegumErrorFromCode(
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
export function getMplBubblegumErrorFromName(
  name: string,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = nameToErrorMap.get(name);
  return constructor ? new constructor(program, cause) : null;
}
