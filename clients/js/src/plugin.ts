import { UmiPlugin } from '@metaplex-foundation/umi';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { splAccountCompression } from '@metaplex-foundation/spl-account-compression';
import { createMplBubblegumProgram } from './generated';

export const mplBubblegum = (): UmiPlugin => ({
  install(umi) {
    umi.use(dasApi()).use(splAccountCompression());
    umi.programs.add(createMplBubblegumProgram(), false);
  },
});
