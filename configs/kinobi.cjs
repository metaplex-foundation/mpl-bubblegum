const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instantiate Kinobi without DefaultVisitor.
const kinobi = k.createFromIdls(
  [
    path.join(idlDir, "bubblegum.json"),
  ],
  false
);

// Update programs.
kinobi.update(
  new k.UpdateProgramsVisitor({
    bubblegum: { name: "mplBubblegum" },
  })
);

// Add wrapper defined type with a link to UpdateArgs. This is to avoid the
// type being inlined in the instruction.
kinobi.update(
  new k.TransformNodesVisitor([
    {
      selector: { kind: "programNode", name: "mplBubblegum" },
      transformer: (node) => {
        k.assertProgramNode(node);
        return k.programNode({
          ...node,
          definedTypes: [
            ...node.definedTypes,
            // wrapper type
            k.definedTypeNode({
              name: "UpdateArgsWrapper",
              data: k.structTypeNode([
                k.structFieldTypeNode({
                  name: "wrapped",
                  child: k.linkTypeNode("UpdateArgs"),
                }),
              ]),
            }),
          ],
        });
      },
    },
  ])
);

// Apply the DefaultVisitor.
kinobi.update(new k.DefaultVisitor());

// Delete the unnecessary UpdateArgsWrapper type.
kinobi.update(
  new k.UpdateDefinedTypesVisitor({
    UpdateArgsWrapper: { delete: true },
  })
);

// Update accounts.
kinobi.update(
  new k.UpdateAccountsVisitor({
    treeConfig: {
      seeds: [k.publicKeySeed("merkleTree")],
      size: 96,
    },
    voucher: {
      seeds: [
        k.stringConstantSeed("voucher"),
        k.publicKeySeed("merkleTree"),
        k.variableSeed("nonce", k.numberTypeNode("u64")),
      ],
    },
  })
);

// Update types.
kinobi.update(
  new k.UpdateDefinedTypesVisitor({
    // Remove unnecessary types.
    InstructionName: { delete: true },
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
    {
      // Rename `treeDelegate` instruction account to `treeCreatorOrDelegate`.
      selector: { kind: "instructionAccountNode", name: "treeDelegate" },
      transformer: (node) => {
        k.assertInstructionAccountNode(node);
        return k.instructionAccountNode({
          ...node,
          name: "treeCreatorOrDelegate",
        });
      },
    },
    {
      // Rename `editionAccount` instruction account to `collectionEdition`.
      selector: { kind: "instructionAccountNode", name: "editionAccount" },
      transformer: (node) => {
        k.assertInstructionAccountNode(node);
        return k.instructionAccountNode({ ...node, name: "collectionEdition" });
      },
    },
    {
      // Rename `message` arg to `metadata`.
      selector: { kind: "structFieldTypeNode", name: "message" },
      transformer: (node) => {
        k.assertStructFieldTypeNode(node);
        return k.structFieldTypeNode({ ...node, name: "metadata" });
      },
    },
    {
      // Update `collectionAuthorityRecordPda` account as `optional`.
      selector: {
        kind: "instructionAccountNode",
        name: "collectionAuthorityRecordPda",
      },
      transformer: (node) => {
        k.assertInstructionAccountNode(node);
        return k.instructionAccountNode({
          ...node,
          isOptional: true,
        });
      },
    },
  ])
);

const deprecatedTmIxes = [
  "mintToCollectionV1",
  "setAndVerifyCollection",
  "unverifyCollection",
  "updateMetadata",
  "verifyCollection",
];
let deprecatedIxUpdaters = [];
for (let ix of deprecatedTmIxes) {
  deprecatedIxUpdaters.push(
    {
      account: "tokenMetadataProgram",
      instruction: ix,
      ...k.publicKeyDefault("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"),
    })
}

const v1Ixs = [
  "burn",
  "cancel_redeem",
  "compress",
  "create_tree",
  "decompressV1",
  "delegate",
  "mintToCollectionV1",
  "mintV1",
  "redeem",
  "setAndVerifyCollection",
  "transfer",
  "unverifyCollection",
  "unverifyCreator",
  "updateMetadata",
  "verifyCollection",
  "verifyCreator",
];
let v1IxUpdaters = [];
for (let ix of v1Ixs) {
  v1IxUpdaters.push(
    {
      account: "logWrapper",
      ignoreIfOptional: true,
      instruction: ix,
      ...k.programDefault(
        "splNoop",
        "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
      ),
    })
  v1IxUpdaters.push(
    {
      account: "compressionProgram",
      ignoreIfOptional: true,
      instruction: ix,
      ...k.programDefault(
        "splAccountCompression",
        "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
      ),
    })
}

const v2Ixs = [
  "burnV2",
  "createTreeV2",
  "delegateAndFreezeV2",
  "delegateV2",
  "freezeV2",
  "mintV2",
  "setCollectionV2",
  "setNonTransferableV2",
  "thawAndRevokeV2",
  "thawV2",
  "transferV2",
  "unverifyCreatorV2",
  "updateAssetDataV2",
  "updateMetadataV2",
  "verifyCreatorV2",
];
let v2IxUpdaters = [];
for (let ix of v2Ixs) {
  v2IxUpdaters.push(
    {
      account: "logWrapper",
      ignoreIfOptional: true,
      instruction: ix,
      ...k.programDefault(
        "mplNoop",
        "mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3"
      ),
    })
  v2IxUpdaters.push(
    {
      account: "compressionProgram",
      ignoreIfOptional: true,
      instruction: ix,
      ...k.programDefault(
        "mplAccountCompression",
        "mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW"
      ),
    })
}

const allLeafDelegateIxs = [...v1Ixs, ...v2Ixs];
const skipLeafDelegateDefaultFor = new Set([
  "freezeV2",
  "thawV2",
]);

const leafDelegateUpdaters = allLeafDelegateIxs
  .filter((ix) => !skipLeafDelegateDefaultFor.has(ix))
  .map((ix) => ({
    instruction: ix,
    account: "leafDelegate",
    ignoreIfOptional: true,
    ...k.accountDefault("leafOwner"),
  }));

// Set default account values across multiple instructions.
kinobi.update(
  new k.SetInstructionAccountDefaultValuesVisitor([
    {
      account: "associatedTokenProgram",
      ignoreIfOptional: true,
      ...k.programDefault(
        "splAssociatedToken",
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
      ),
    },
    {
      account: "mplCoreProgram",
      ignoreIfOptional: true,
      ...k.programDefault(
        "mplCore",
        "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
      ),
    },
    {
      account: "treeCreator",
      ignoreIfOptional: true,
      ...k.identityDefault(),
    },
    {
      account: "treeCreatorOrDelegate",
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
      ...k.publicKeyDefault("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"),
    },
    {
      account: "collectionMetadata",
      ignoreIfOptional: true,
      ...k.pdaDefault("metadata", {
        importFrom: "mplTokenMetadata",
        seeds: { mint: k.accountDefault("collectionMint") },
      }),
    },
    {
      account: "collectionEdition",
      ignoreIfOptional: true,
      ...k.pdaDefault("masterEdition", {
        importFrom: "mplTokenMetadata",
        seeds: { mint: k.accountDefault("collectionMint") },
      }),
    },
    {
      account: "collectionAuthorityRecordPda",
      ignoreIfOptional: true,
      ...k.programIdDefault(),
    },
    {
      account: "collectionAuthority",
      ignoreIfOptional: true,
      ...k.identityDefault(),
    },
    {
      account: "mplCoreCpiSigner",
      // TODO would be great if I could add this if a collection is present but otherwise not.
      // ignoreIfOptional: true,
      ...k.publicKeyDefault("CbNY3JiXdXNE9tPNEk1aRZVEkWdj2v7kfJLNQwZZgpXk"),
    },
    ...deprecatedIxUpdaters,
    ...v1IxUpdaters,
    ...v2IxUpdaters,
    ...leafDelegateUpdaters,
  ])
);

// Update instructions.
const hashDefaults = {
  dataHash: {
    defaultsTo: k.resolverDefault("resolveDataHash", [
      k.dependsOnArg("metadata"),
    ]),
  },
  creatorHash: {
    defaultsTo: k.resolverDefault("resolveCreatorHash", [
      k.dependsOnArg("metadata"),
    ]),
  },
};

kinobi.update(
  new k.UpdateInstructionsVisitor({
    createTree: {
      name: "createTreeConfig",
      bytesCreatedOnChain: k.bytesFromAccount("treeConfig"),
    },
    mintToCollectionV1: {
      args: {
        metadataArgs: { name: "metadata" },
      },
    },
    transfer: {
      accounts: {
        leafOwner: { isSigner: "either" },
        leafDelegate: { isSigner: "either" },
      },
    },
    burn: {
      accounts: {
        leafOwner: { isSigner: "either" },
        leafDelegate: { isSigner: "either" },
      },
    },
    redeem: {
      accounts: {
        voucher: {
          defaultsTo: k.pdaDefault("voucher", {
            seeds: {
              merkleTree: k.accountDefault("merkleTree"),
              nonce: k.argDefault("nonce"),
            },
          }),
        },
      },
    },
    decompressV1: {
      accounts: {
        metadata: {
          name: "metadataAccount",
          defaultsTo: k.pdaDefault("metadata", {
            importFrom: "mplTokenMetadata",
            seeds: { mint: k.accountDefault("mint") },
          }),
        },
        masterEdition: {
          defaultsTo: k.pdaDefault("masterEdition", {
            importFrom: "mplTokenMetadata",
            seeds: { mint: k.accountDefault("mint") },
          }),
        },
        tokenAccount: {
          defaultsTo: k.pdaDefault("associatedToken", {
            importFrom: "mplToolbox",
            seeds: {
              mint: k.accountDefault("mint"),
              owner: k.accountDefault("leafOwner"),
            },
          }),
        },
        mintAuthority: {
          defaultsTo: k.pdaDefault("mintAuthority", {
            importFrom: "hooked",
            seeds: { mint: k.accountDefault("mint") },
          }),
        },
      },
    },
    setAndVerifyCollection: {
      accounts: {
        treeCreatorOrDelegate: { isSigner: "either" },
      },
      args: {
        ...hashDefaults,
        collection: {
          defaultsTo: k.accountDefault("collectionMint"),
        },
      },
    },
    verifyCollection: { args: { ...hashDefaults } },
    unverifyCollection: { args: { ...hashDefaults } },
    verifyCreator: { args: { ...hashDefaults } },
    unverifyCreator: { args: { ...hashDefaults } },
    // Remove deprecated instructions.
    setDecompressableState: { delete: true },
    // Remove unnecessary spl_account_compression instructions.
    append: { delete: true },
    closeEmptyTree: { delete: true },
    compress: { delete: true },
    initEmptyMerkleTree: { delete: true },
    insertOrAppend: { delete: true },
    noopInstruction: { delete: true },
    replaceLeaf: { delete: true },
    transferAuthority: { delete: true },
    burnV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    },
    collectV2: {
      accounts: {
        destination: {
          defaultsTo: k.publicKeyDefault("2dgJVPC5fjLTBTmMvKDRig9JJUGK2Fgwr3EHShFxckhv")
        }
      }
    },
    createTreeV2: {
      name: "createTreeConfigV2",
      bytesCreatedOnChain: k.bytesFromAccount("treeConfig"),
    },
    delegateAndFreezeV2: {
      args: {
        collectionHash: { defaultsTo: k.valueDefault(k.vNone()) },
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) }
      }
    },
    delegateV2: {
      args: {
        collectionHash: { defaultsTo: k.valueDefault(k.vNone()) },
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) }
      }
    },
    freezeV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) }
      }
    },
    mintV2: {
      args: {
        metadataArgs: { name: "metadata" },
        assetData: { defaultsTo: k.valueDefault(k.vNone()) },
        assetDataSchema: { defaultsTo: k.valueDefault(k.vNone()) }
      },
    },
    setCollectionV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    },
    setNonTransferableV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    },
    thawAndRevokeV2: {
      args: {
        collectionHash: { defaultsTo: k.valueDefault(k.vNone()) },
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) }
      }
    },
    thawV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) }
      }
    },
    transferV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    },
    unverifyCreatorV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    },
    updateAssetDataV2: {
      args: {
        previousAssetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
        newAssetData: { defaultsTo: k.valueDefault(k.vNone()) },
        newAssetDataSchema: { defaultsTo: k.valueDefault(k.vNone()) }
      }
    },
    updateMetadataV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    },
    verifyCreatorV2: {
      args: {
        assetDataHash: { defaultsTo: k.valueDefault(k.vNone()) },
        flags: { defaultsTo: k.valueDefault(k.vNone()) },
      }
    }
  })
);

// Set default values for structs.
kinobi.update(
  new k.SetStructDefaultValuesVisitor({
    createTreeConfigInstructionData: {
      public: k.vNone(),
    },
    createTreeConfigV2InstructionData: {
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
    metadataArgsV2: {
      symbol: k.vScalar(""),
      primarySaleHappened: k.vScalar(false),
      isMutable: k.vScalar(true),
      tokenStandard: k.vSome(k.vEnum("TokenStandard", "NonFungible")),
    },
    updateArgs: {
      name: k.vNone(),
      symbol: k.vNone(),
      uri: k.vNone(),
      creators: k.vNone(),
      sellerFeeBasisPoints: k.vNone(),
      primarySaleHappened: k.vNone(),
      isMutable: k.vNone(),
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
    {
      // Use extra "proof" arg as remaining accounts.
      selector: (node) =>
        k.isInstructionNode(node) &&
        [
          "burn",
          "transfer",
          "redeem",
          "delegate",
          "setAndVerifyCollection",
          "verifyCollection",
          "unverifyCollection",
          "verifyCreator",
          "unverifyCreator",
          "verifyLeaf",
          "updateMetadata",
          "burnV2",
          "delegateAndFreezeV2",
          "delegateV2",
          "freezeV2",
          "setCollectionV2",
          "setNonTransferableV2",
          "thawAndRevokeV2",
          "thawV2",
          "transferV2",
          "unverifyCreatorV2",
          "updateAssetDataV2",
          "updateMetadataV2",
          "verifyCreatorV2"
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

kinobi.update(
  new k.UpdateInstructionsVisitor({
    updateMetadata: {
      accounts: {
        collectionMetadata: {
          defaultsTo: k.conditionalDefault("account", "collectionMint", {
            ifTrue: k.pdaDefault("metadata", {
              importFrom: "mplTokenMetadata",
              seeds: { mint: k.accountDefault("collectionMint") },
            }),
          }),
        },
      },
    },
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(
  new k.RenderJavaScriptVisitor(jsDir, {
    prettier,
    dependencyMap: {
      mplTokenMetadata: "@metaplex-foundation/mpl-token-metadata",
    },
  })
);

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
kinobi.accept(
  new k.RenderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  })
);
