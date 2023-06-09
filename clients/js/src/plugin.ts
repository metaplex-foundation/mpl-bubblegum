import { UmiPlugin } from '@metaplex-foundation/umi';
import { createMplProjectNameProgram } from './generated';

export const mplProjectName = (): UmiPlugin => ({
  install(umi) {
    umi.programs.add(createMplProjectNameProgram(), false);
  },
});
