import { RpcInterface, UmiPlugin } from '@metaplex-foundation/umi';
import {
  createMplBubblegumProgram,
  createSplAccountCompressionProgram,
  createSplNoopProgram,
} from './generated';
import { ReadApiInterface, createReadApiDecorator } from './readApiDecorator';

export const mplBubblegum = (): UmiPlugin => ({
  install(umi) {
    umi.use(readApi());
    umi.programs.add(createMplBubblegumProgram(), false);
    umi.programs.add(createSplAccountCompressionProgram(), false);
    umi.programs.add(createSplNoopProgram(), false);
  },
});

export const readApi = (): UmiPlugin => ({
  install(umi) {
    umi.rpc = createReadApiDecorator(umi.rpc);
  },
});

declare module '@metaplex-foundation/umi' {
  interface Umi {
    rpc: RpcInterface & ReadApiInterface;
  }
}
