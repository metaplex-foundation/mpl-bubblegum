const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([
  path.join(idlDir, "bubblegum.json"),
  path.join(idlDir, "spl_account_compression.json"),
  path.join(idlDir, "spl_noop.json"),
]);

// Update programs.
kinobi.update(
  new k.UpdateProgramsVisitor({
    bubblegum: { name: "mplBubblegum" },
  })
);

// Update accounts.
kinobi.update(
  new k.UpdateAccountsVisitor({
    // ...
  })
);

// Update instructions.
kinobi.update(
  new k.UpdateInstructionsVisitor({
    decompressV1: {
      args: {
        metadata: { name: "metadataArgs" },
      },
    },
    // ...
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(new k.RenderJavaScriptVisitor(jsDir, { prettier }));
