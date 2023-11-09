import { UmiPlugin } from '@metaplex-foundation/umi';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import {
  createMplBubblegumProgram,
  createSplAccountCompressionProgram,
  createSplNoopProgram,
} from './generated';

export const mplBubblegum = (): UmiPlugin => ({
  install(umi) {
    umi.use(dasApi());
    umi.programs.add(createMplBubblegumProgram(), false);
    umi.programs.add(createSplAccountCompressionProgram(), false);
    umi.programs.add(createSplNoopProgram(), false);
  },
});
