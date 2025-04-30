import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  createSplAccountCompressionProgram,
  createSplNoopProgram,
} from './generated';

export const splAccountCompression = (): UmiPlugin => ({
  install(umi) {
    umi.programs.add(createSplAccountCompressionProgram(), false);
    umi.programs.add(createSplNoopProgram(), false);
  },
});
