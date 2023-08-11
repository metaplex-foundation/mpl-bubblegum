const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "bubblegum",
  programId: "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "bubblegum", "program"),
  rustbin: {
    locked: true,
    versionRangeFallback: "0.27.0",
  },
});

console.log("===================");
console.log("Trying some regexes");
console.log("===================");

const msg =
  "error: could not find `anchor-cli` in registry `crates-io` with version `=0.28.0`";
const regex1 = /error: could not find.+in registry/;
const regex2 = /error\: could not find.+in registry/;
const regex3 = new RegExp("error: could not find.+in registry");
const regex4 = new RegExp("error\\: could not find.+in registry");

console.log({
  regex1: regex1.test(msg),
  regex2: regex2.test(msg),
  regex3: regex3.test(msg),
  regex4: regex4.test(msg),
});
