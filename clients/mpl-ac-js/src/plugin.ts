import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  createMplAccountCompressionProgram,
  createMplNoopProgram,
} from './generated';

export const mplAccountCompression = (): UmiPlugin => ({
  install(umi) {
    umi.programs.add(createMplAccountCompressionProgram(), false);
    umi.programs.add(createMplNoopProgram(), false);
  },
});
