const localnet = require("./validator.cjs");

module.exports = {
  ...localnet,
  validator: {
    ...localnet.validator,
    programs: [],
    accountsCluster: "https://api.mainnet-beta.solana.com/",
    accounts: (localnet.validator.programs ?? []).map((program) => ({
      ...program,
      accountId: program.programId,
      executable: true,
    })),
  },
};
