// @ts-check
const path = require('path');
const programDir = path.join(__dirname, '..', '..', 'programs', 'bubblegum', 'program');
const idlDir = path.join(__dirname, '..', '..', 'idls');
const sdkDir = path.join(__dirname, 'src', 'generated');
const binaryInstallDir = path.join(__dirname, '.crates');

module.exports = {
  idlGenerator: 'anchor',
  programName: 'bubblegum',
  programId: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY',
  idlDir,
  sdkDir,
  binaryInstallDir,
  programDir,
  rustbin: {
    locked: true,
    versionRangeFallback: '0.27.0',
  },
  idlHook: (idl) => {
    const instructions = idl.instructions.filter((ix) => {
      return ix.name !== 'setDecompressableState';
    });
    const types = idl.types.filter((ty) => {
      return ty.name !== 'InstructionName';
    });
    return { ...idl, instructions, types };
  },
};
