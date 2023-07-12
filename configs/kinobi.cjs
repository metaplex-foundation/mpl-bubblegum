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
    treeConfig: {
      seeds: [k.publicKeySeed("merkleTree")],
      size: 96,
    },
  })
);

// Update types.
kinobi.update(
  new k.UpdateDefinedTypesVisitor({
    // Remove unnecessary spl_account_compression type.
    ApplicationDataEventV1: { delete: true },
    ChangeLogEventV1: { delete: true },
    PathNode: { delete: true },
    ApplicationDataEvent: { delete: true },
    ChangeLogEvent: { delete: true },
    AccountCompressionEvent: { delete: true },
  })
);

// Custom tree updates.
kinobi.update(
  new k.TransformNodesVisitor([
    {
      // Rename `treeAuthority` instruction account to `treeConfig`.
      selector: { kind: "instructionAccountNode", name: "treeAuthority" },
      transformer: (node) => {
        k.assertInstructionAccountNode(node);
        return k.instructionAccountNode({ ...node, name: "treeConfig" });
      },
    },
  ])
);

// Set default account values accross multiple instructions.
kinobi.update(
  new k.SetInstructionAccountDefaultValuesVisitor([
    {
      account: "logWrapper",
      ignoreIfOptional: true,
      ...k.programDefault(
        "splNoop",
        "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
      ),
    },
    {
      account: "compressionProgram",
      ignoreIfOptional: true,
      ...k.programDefault(
        "splAccountCompression",
        "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
      ),
    },
    {
      account: "treeCreator",
      ignoreIfOptional: true,
      ...k.identityDefault(),
    },
    {
      account: "treeConfig",
      ignoreIfOptional: true,
      ...k.pdaDefault("treeConfig"),
    },
    {
      account: "bubblegumSigner",
      ignoreIfOptional: true,
      ...k.publicKeyDefault("4ewWZC5gT6TGpm5LZNDs9wVonfUT2q5PP5sc9kVbwMAK"),
    },
  ])
);

// Update instructions.
kinobi.update(
  new k.UpdateInstructionsVisitor({
    createTree: {
      name: "createTreeConfig",
      bytesCreatedOnChain: k.bytesFromAccount("treeConfig"),
    },
    mintV1: {
      accounts: {
        leafDelegate: { defaultsTo: k.accountDefault("leafOwner") },
        treeDelegate: {
          name: "treeCreatorOrDelegate",
          defaultsTo: k.identityDefault(),
        },
      },
    },
    transfer: {
      accounts: {
        leafOwner: { isSigner: "either" },
        leafDelegate: {
          isSigner: "either",
          defaultsTo: k.accountDefault("leafOwner"),
        },
      },
    },
    decompressV1: {
      args: {
        metadata: { name: "message" },
      },
    },
    // Remove unnecessary spl_account_compression instructions.
    append: { delete: true },
    closeEmptyTree: { delete: true },
    compress: { delete: true },
    initEmptyMerkleTree: { delete: true },
    insertOrAppend: { delete: true },
    noopInstruction: { delete: true },
    replaceLeaf: { delete: true },
    transferAuthority: { delete: true },
  })
);

// Set default values for structs.
kinobi.update(
  new k.SetStructDefaultValuesVisitor({
    createTreeConfigInstructionData: {
      public: k.vNone(),
    },
    metadataArgs: {
      symbol: k.vScalar(""),
      primarySaleHappened: k.vScalar(false),
      isMutable: k.vScalar(true),
      editionNonce: k.vNone(),
      tokenStandard: k.vSome(k.vEnum("TokenStandard", "NonFungible")),
      uses: k.vNone(),
      tokenProgramVersion: k.vEnum("TokenProgramVersion", "Original"),
    },
  })
);

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
  ])
);

// Transform tuple enum variants to structs.
kinobi.update(
  new k.UnwrapTupleEnumWithSingleStructVisitor([
    "ConcurrentMerkleTreeHeaderData",
  ])
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(new k.RenderJavaScriptVisitor(jsDir, { prettier }));
