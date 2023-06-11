import { UmiPlugin } from '@metaplex-foundation/umi';
import { createMplBubblegumProgram } from './generated';

export const mplBubblegum = (): UmiPlugin => ({
  install(umi) {
    umi.programs.add(createMplBubblegumProgram(), false);
  },
});
