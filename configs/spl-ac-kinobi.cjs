const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instantiate Kinobi without DefaultVisitor.
const kinobi = k.createFromIdls(
  [
    path.join(idlDir, "spl_account_compression.json"),
    path.join(idlDir, "spl_noop.json"),
  ],
  false
);

// Update programs.
kinobi.update(
  new k.UpdateProgramsVisitor({
    splAccountCompression: { name: "splAccountCompression" },
  })
);

// Apply the DefaultVisitor.
kinobi.update(new k.DefaultVisitor());

// Custom tree updates.
kinobi.update(
  new k.TransformNodesVisitor([
    {
      // Add nodes to the splAccountCompression program.
      selector: { kind: "programNode", name: "splAccountCompression" },
      transformer: (node) => {
        k.assertProgramNode(node);
        return k.programNode({
          ...node,
          accounts: [
            ...node.accounts,
            k.accountNode({
              name: "merkleTree",
              data: k.accountDataNode({
                name: "merkleTreeAccountData",
                link: k.linkTypeNode("merkleTreeAccountData", {
                  importFrom: "hooked",
                }),
                struct: k.structTypeNode([
                  k.structFieldTypeNode({
                    name: "discriminator",
                    child: k.linkTypeNode("compressionAccountType"),
                  }),
                  k.structFieldTypeNode({
                    name: "treeHeader",
                    child: k.linkTypeNode("concurrentMerkleTreeHeaderData"),
                  }),
                  k.structFieldTypeNode({
                    name: "serializedTree",
                    child: k.bytesTypeNode(k.remainderSize()),
                  }),
                ]),
              }),
            }),
          ],
        });
      },
    },
    {
      // Use extra "proof" arg as remaining accounts.
      selector: (node) =>
        k.isInstructionNode(node) &&
        [
          "verifyLeaf",
        ].includes(node.name),
      transformer: (node) => {
        k.assertInstructionNode(node);
        return k.instructionNode({
          ...node,
          remainingAccounts: k.remainingAccountsFromArg("proof"),
          argDefaults: {
            ...node.argDefaults,
            proof: k.valueDefault(k.vList([])),
          },
          extraArgs: k.instructionExtraArgsNode({
            ...node.extraArgs,
            struct: k.structTypeNode([
              ...node.extraArgs.struct.fields,
              k.structFieldTypeNode({
                name: "proof",
                child: k.arrayTypeNode(k.publicKeyTypeNode()),
              }),
            ]),
          }),
        });
      },
    },
  ])
);

// Transform tuple enum variants to structs.
kinobi.update(
  new k.UnwrapTupleEnumWithSingleStructVisitor([
    "ConcurrentMerkleTreeHeaderData",
  ])
);

// Render JavaScript.
const jsDir = path.join(clientDir, "spl-ac-js", "src", "generated");
const prettier = require(path.join(clientDir, "spl-ac-js", ".prettierrc.json"));
kinobi.accept(
  new k.RenderJavaScriptVisitor(jsDir, {
    prettier,
  })
);
