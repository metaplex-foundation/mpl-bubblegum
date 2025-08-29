const path = require("path");

const programDir = path.join(__dirname, "..", "programs");

function getProgram(programName) {
  return path.join(programDir, ".bin", programName);
}

module.exports = {
  validator: {
    commitment: "processed",
    programs: [
      {
        label: "MPL Account Compression",
        programId: "mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW",
        deployPath: getProgram("mpl_account_compression.so"),
      },
      {
        label: "Mpl Bubblegum",
        programId: "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY",
        deployPath: getProgram("bubblegum.so"),
      },
      {
        label: "MPL Noop",
        programId: "mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3",
        deployPath: getProgram("mpl_noop.so"),
      },
      {
        label: "Token Metadata",
        programId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        deployPath: getProgram("mpl_token_metadata.so"),
      },
      {
        label: "SPL Account Compression",
        programId: "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK",
        deployPath: getProgram("spl_account_compression.so"),
      },
      {
        label: "SPL Noop",
        programId: "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
        deployPath: getProgram("spl_noop.so"),
      },
      {
        label: "MPL Core",
        programId: "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
        deployPath: getProgram("mpl_core_program.so"),
      },
    ],
  },
};
