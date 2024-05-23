import { UmiPlugin } from '@metaplex-foundation/umi';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import {
  createPrimitivesProtractorProgram,
  createSplAccountCompressionProgram,
  createSplNoopProgram,
} from './generated';

export const primitivesProtractor = (): UmiPlugin => ({
  install(umi) {
    umi.use(dasApi());
    umi.programs.add(createPrimitivesProtractorProgram(), false);
    umi.programs.add(createSplAccountCompressionProgram(), false);
    umi.programs.add(createSplNoopProgram(), false);
  },
});
