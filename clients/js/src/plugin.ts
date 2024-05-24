import { RpcInterface, UmiPlugin } from '@metaplex-foundation/umi';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import {
  createPrimitivesProtractorProgram,
  createSplAccountCompressionProgram,
  createSplNoopProgram,
} from './generated';
import { GraphApiInterface } from './decorator';

export const primitivesProtractor = (): UmiPlugin => ({
  install(umi) {
    umi.use(dasApi());
    umi.programs.add(createPrimitivesProtractorProgram(), false);
    umi.programs.add(createSplAccountCompressionProgram(), false);
    umi.programs.add(createSplNoopProgram(), false);
  },
});

declare module '@metaplex-foundation/umi/dist/types/Umi' {
  interface Umi {
    rpc: RpcInterface & GraphApiInterface;
  }
}
