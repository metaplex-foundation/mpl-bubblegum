const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instantiate Kinobi without DefaultVisitor.
const kinobi = k.createFromIdls(
  [
    path.join(idlDir, "mpl_account_compression.json"),
    path.join(idlDir, "mpl_noop.json"),
  ],
  false
);

// Update programs.
kinobi.update(
  k.updateProgramsVisitor({
    mplAccountCompression: { name: "mplAccountCompression" },
  })
);

// Apply the DefaultVisitor.
kinobi.update(k.defaultVisitor());

// Custom tree updates.
kinobi.update(
  k.bottomUpTransformerVisitor([
    {
      // Add nodes to the mplAccountCompression program.
      select: "[programNode]mplAccountCompression",
      transform: (node) => {
        k.assertIsNode(node, "programNode");
        return k.programNode({
          ...node,
          accounts: [
            ...node.accounts,
            k.accountNode({
              name: "merkleTree",
              size: null,
              data: k.structTypeNode([
                k.structFieldTypeNode({
                  name: "discriminator",
                  type: k.definedTypeLinkNode("compressionAccountType"),
                }),
                k.structFieldTypeNode({
                  name: "treeHeader",
                  type: k.definedTypeLinkNode("concurrentMerkleTreeHeaderData"),
                }),
                k.structFieldTypeNode({
                  name: "serializedTree",
                  type: k.bytesTypeNode(k.remainderSizeNode()),
                }),
              ]),
            }),
          ],
        });
      },
    },
    {
      // Use extra "proof" arg as remaining accounts.
      select: (node) =>
        k.isNode(node, "instructionNode") &&
        [
          "verifyLeaf",
        ].includes(node.name),
      transform: (node) => {
        k.assertIsNode(node, "instructionNode");
        return k.instructionNode({
          ...node,
          remainingAccounts: [
            k.instructionRemainingAccountsNode(
              k.argumentValueNode("proof")
            ),
          ],
          extraArguments: [
            ...(node.extraArguments ?? []),
            k.instructionArgumentNode({
              name: "proof",
              type: k.arrayTypeNode(k.publicKeyTypeNode()),
              defaultValue: k.arrayValueNode([]),
            }),
          ],
        });
      },
    },
  ])
);

// Extract ConcurrentMerkleTreeHeaderDataV1 to a separate type.
// Note: This creates a tuple wrapper, but the hooked code provides custom types.
kinobi.update(
  k.unwrapTupleEnumWithSingleStructVisitor([
    "ConcurrentMerkleTreeHeaderData",
  ])
);

// Render JavaScript.
const jsDir = path.join(clientDir, "mpl-ac-js", "src", "generated");
const prettier = require(path.join(clientDir, "mpl-ac-js", ".prettierrc.json"));
kinobi.accept(
  k.renderJavaScriptVisitor(jsDir, {
    prettier,
    customAccountData: [
      {
        name: "merkleTree",
        extract: false,
      },
    ],
  })
);
