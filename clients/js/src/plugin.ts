import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  createMplBubblegumProgram,
  createSplAccountCompressionProgram,
  createSplNoopProgram,
} from './generated';

export const mplBubblegum = (): UmiPlugin => ({
  install(umi) {
    umi.programs.add(createMplBubblegumProgram(), false);
    umi.programs.add(createSplAccountCompressionProgram(), false);
    umi.programs.add(createSplNoopProgram(), false);
  },
});
