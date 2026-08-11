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
  k.updateProgramsVisitor({
    bubblegum: { name: "mplBubblegum" },
  })
);

// Add wrapper defined type with a link to UpdateArgs. This is to avoid the
// type being inlined in the instruction.
kinobi.update(
  k.bottomUpTransformerVisitor([
    {
      select: "[programNode]mplBubblegum",
      transform: (node) => {
        k.assertIsNode(node, "programNode");
        return k.programNode({
          ...node,
          definedTypes: [
            ...node.definedTypes,
            // wrapper type
            k.definedTypeNode({
              name: "UpdateArgsWrapper",
              type: k.structTypeNode([
                k.structFieldTypeNode({
                  name: "wrapped",
                  type: k.definedTypeLinkNode("UpdateArgs"),
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
kinobi.update(k.defaultVisitor());

// Delete the unnecessary UpdateArgsWrapper type.
kinobi.update(
  k.updateDefinedTypesVisitor({
    UpdateArgsWrapper: { delete: true },
  })
);

// Update accounts.
kinobi.update(
  k.updateAccountsVisitor({
    treeConfig: {
      seeds: [
        k.variablePdaSeedNode("merkleTree", k.publicKeyTypeNode(), "The merkle tree account"),
      ],
      size: 96,
    },
    voucher: {
      seeds: [
        k.constantPdaSeedNodeFromString("voucher"),
        k.variablePdaSeedNode("merkleTree", k.publicKeyTypeNode()),
        k.variablePdaSeedNode("nonce", k.numberTypeNode("u64")),
      ],
    },
  })
);

// Update types.
kinobi.update(
  k.updateDefinedTypesVisitor({
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
  k.bottomUpTransformerVisitor([
    {
      // Rename `treeAuthority` instruction account to `treeConfig`.
      select: "[instructionAccountNode]treeAuthority",
      transform: (node) => {
        k.assertIsNode(node, "instructionAccountNode");
        return k.instructionAccountNode({ ...node, name: "treeConfig" });
      },
    },
    {
      // Rename `treeDelegate` instruction account to `treeCreatorOrDelegate`.
      select: "[instructionAccountNode]treeDelegate",
      transform: (node) => {
        k.assertIsNode(node, "instructionAccountNode");
        return k.instructionAccountNode({
          ...node,
          name: "treeCreatorOrDelegate",
        });
      },
    },
    {
      // Rename `editionAccount` instruction account to `collectionEdition`.
      select: "[instructionAccountNode]editionAccount",
      transform: (node) => {
        k.assertIsNode(node, "instructionAccountNode");
        return k.instructionAccountNode({ ...node, name: "collectionEdition" });
      },
    },
    {
      // Rename `message` arg to `metadata`.
      select: (node) =>
        (k.isNode(node, "structFieldTypeNode") || k.isNode(node, "instructionArgumentNode")) &&
        node.name === "message",
      transform: (node) => {
        if (k.isNode(node, "structFieldTypeNode")) {
          return k.structFieldTypeNode({ ...node, name: "metadata" });
        }
        if (k.isNode(node, "instructionArgumentNode")) {
          return k.instructionArgumentNode({ ...node, name: "metadata" });
        }
        return node;
      },
    },
    {
      // Update `collectionAuthorityRecordPda` account as `optional`.
      select: "[instructionAccountNode]collectionAuthorityRecordPda",
      transform: (node) => {
        k.assertIsNode(node, "instructionAccountNode");
        return k.instructionAccountNode({
          ...node,
          isOptional: true,
        });
      },
    },
  ])
);

// The CPI call to Token Metadata has been deprecated in these
// V1 insructions.
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
      defaultValue: k.publicKeyValueNode("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"),
    })
}

// Use spl-noop and spl-account-compression as defaults for all
// V2 instructions.
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
      defaultValue: k.publicKeyValueNode(
        "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
        "splNoop"
      ),
    })
  v1IxUpdaters.push(
    {
      account: "compressionProgram",
      ignoreIfOptional: true,
      instruction: ix,
      defaultValue: k.publicKeyValueNode(
        "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK",
        "splAccountCompression"
      ),
    })
}

// Use mpl-noop and mpl-account-compression as defaults for all
// V2 instructions.
const v2Ixs = [
  "burnV2",
  "closeTreeV2",
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
      defaultValue: k.publicKeyValueNode(
        "mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3",
        "mplNoop"
      ),
    })
  v2IxUpdaters.push(
    {
      account: "compressionProgram",
      ignoreIfOptional: true,
      instruction: ix,
      defaultValue: k.publicKeyValueNode(
        "mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW",
        "mplAccountCompression"
      ),
    })
}

// We skip defaulting leaf delegate only for `freezeV2` and `thawV2` where
// we want the delegate to be made explicit by the caller.
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
    defaultValue: k.accountValueNode("leafOwner"),
  }));

// Set default account values across multiple instructions.
kinobi.update(
  k.setInstructionAccountDefaultValuesVisitor([
    {
      account: "associatedTokenProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        "splAssociatedToken"
      ),
    },
    {
      account: "mplCoreProgram",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode(
        "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
        "mplCore"
      ),
    },
    {
      account: "treeCreator",
      ignoreIfOptional: true,
      defaultValue: k.identityValueNode(),
    },
    {
      account: "treeCreatorOrDelegate",
      ignoreIfOptional: true,
      defaultValue: k.identityValueNode(),
    },
    {
      account: "treeConfig",
      ignoreIfOptional: true,
      defaultValue: k.pdaValueNode("treeConfig"),
    },
    {
      account: "bubblegumSigner",
      ignoreIfOptional: true,
      defaultValue: k.publicKeyValueNode("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"),
    },
    {
      account: "collectionMetadata",
      ignoreIfOptional: true,
      defaultValue: k.pdaValueNode(
        k.pdaLinkNode("metadata", "mplTokenMetadata"),
        [
          k.pdaSeedValueNode("mint", k.accountValueNode("collectionMint")),
        ]
      ),
    },
    {
      account: "collectionEdition",
      ignoreIfOptional: true,
      defaultValue: k.pdaValueNode(
        k.pdaLinkNode("masterEdition", "mplTokenMetadata"),
        [
          k.pdaSeedValueNode("mint", k.accountValueNode("collectionMint")),
        ]
      ),
    },
    {
      account: "collectionAuthorityRecordPda",
      ignoreIfOptional: true,
      defaultValue: k.programIdValueNode(),
    },
    {
      account: "collectionAuthority",
      ignoreIfOptional: true,
      defaultValue: k.identityValueNode(),
    },
    {
      account: "mplCoreCpiSigner",
      defaultValue: k.conditionalValueNode({
        condition: k.accountValueNode("coreCollection"),
        ifTrue: k.publicKeyValueNode("CbNY3JiXdXNE9tPNEk1aRZVEkWdj2v7kfJLNQwZZgpXk"),
      }),
    },
    // `setCollectionV2` always requires the MPL Core signer so it's not a conditional
    // default based on `coreCollection`.
    {
      account: "mplCoreCpiSigner",
      instruction: "setCollectionV2",
      defaultValue: k.publicKeyValueNode("CbNY3JiXdXNE9tPNEk1aRZVEkWdj2v7kfJLNQwZZgpXk"),
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
    defaultValue: k.resolverValueNode("resolveDataHash", {
      dependsOn: [k.argumentValueNode("metadata")],
    }),
  },
  creatorHash: {
    defaultValue: k.resolverValueNode("resolveCreatorHash", {
      dependsOn: [k.argumentValueNode("metadata")],
    }),
  },
};

kinobi.update(
  k.updateInstructionsVisitor({
    createTree: {
      name: "createTreeConfig",
      byteDeltas: [
        k.instructionByteDeltaNode(
          k.numberValueNode(96) // TreeConfig account size
        ),
      ],
    },
    mintToCollectionV1: {
      arguments: {
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
          defaultValue: k.pdaValueNode("voucher", [
            k.pdaSeedValueNode("merkleTree", k.accountValueNode("merkleTree")),
            k.pdaSeedValueNode("nonce", k.argumentValueNode("nonce")),
          ]),
        },
      },
    },
    decompressV1: {
      accounts: {
        metadata: {
          name: "metadataAccount",
          defaultValue: k.pdaValueNode(
            k.pdaLinkNode("metadata", "mplTokenMetadata"),
            [
              k.pdaSeedValueNode("mint", k.accountValueNode("mint")),
            ]
          ),
        },
        masterEdition: {
          defaultValue: k.pdaValueNode(
            k.pdaLinkNode("masterEdition", "mplTokenMetadata"),
            [
              k.pdaSeedValueNode("mint", k.accountValueNode("mint")),
            ]
          ),
        },
        tokenAccount: {
          defaultValue: k.pdaValueNode(
            k.pdaLinkNode("associatedToken", "mplToolbox"),
            [
              k.pdaSeedValueNode("mint", k.accountValueNode("mint")),
              k.pdaSeedValueNode("owner", k.accountValueNode("leafOwner")),
            ]
          ),
        },
        mintAuthority: {
          defaultValue: k.pdaValueNode(
            k.pdaLinkNode("mintAuthority", "hooked"),
            [
              k.pdaSeedValueNode("mint", k.accountValueNode("mint")),
            ]
          ),
        },
      },
    },
    setAndVerifyCollection: {
      accounts: {
        treeCreatorOrDelegate: { isSigner: "either" },
      },
      arguments: {
        ...hashDefaults,
        collection: {
          defaultValue: k.accountValueNode("collectionMint"),
        },
      },
    },
    verifyCollection: { arguments: { ...hashDefaults } },
    unverifyCollection: { arguments: { ...hashDefaults } },
    verifyCreator: { arguments: { ...hashDefaults } },
    unverifyCreator: { arguments: { ...hashDefaults } },
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
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    },
    collectV2: {
      accounts: {
        destination: {
          defaultValue: k.publicKeyValueNode("2dgJVPC5fjLTBTmMvKDRig9JJUGK2Fgwr3EHShFxckhv")
        }
      }
    },
    createTreeV2: {
      name: "createTreeConfigV2",
      byteDeltas: [
        k.instructionByteDeltaNode(
          k.numberValueNode(96) // TreeConfig account size
        ),
      ],
    },
    delegateAndFreezeV2: {
      arguments: {
        collectionHash: { defaultValue: k.noneValueNode() },
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() }
      }
    },
    delegateV2: {
      arguments: {
        collectionHash: { defaultValue: k.noneValueNode() },
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() }
      }
    },
    freezeV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() }
      }
    },
    mintV2: {
      arguments: {
        metadataArgs: { name: "metadata" },
        assetData: { defaultValue: k.noneValueNode() },
        assetDataSchema: { defaultValue: k.noneValueNode() }
      },
    },
    setCollectionV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    },
    setNonTransferableV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    },
    thawAndRevokeV2: {
      arguments: {
        collectionHash: { defaultValue: k.noneValueNode() },
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() }
      }
    },
    thawV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() }
      }
    },
    transferV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    },
    unverifyCreatorV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    },
    updateAssetDataV2: {
      arguments: {
        previousAssetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
        newAssetData: { defaultValue: k.noneValueNode() },
        newAssetDataSchema: { defaultValue: k.noneValueNode() }
      }
    },
    updateMetadataV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    },
    verifyCreatorV2: {
      arguments: {
        assetDataHash: { defaultValue: k.noneValueNode() },
        flags: { defaultValue: k.noneValueNode() },
      }
    }
  })
);

// Set default values for structs.
kinobi.update(
  k.setStructDefaultValuesVisitor({
    metadataArgs: {
      symbol: k.stringValueNode(""),
      primarySaleHappened: k.booleanValueNode(false),
      isMutable: k.booleanValueNode(true),
      editionNonce: k.noneValueNode(),
      tokenStandard: k.someValueNode(k.enumValueNode("TokenStandard", "NonFungible")),
      uses: k.noneValueNode(),
      tokenProgramVersion: k.enumValueNode("TokenProgramVersion", "Original"),
    },
    metadataArgsV2: {
      symbol: k.stringValueNode(""),
      primarySaleHappened: k.booleanValueNode(false),
      isMutable: k.booleanValueNode(true),
      tokenStandard: k.someValueNode(k.enumValueNode("TokenStandard", "NonFungible")),
    },
    updateArgs: {
      name: k.noneValueNode(),
      symbol: k.noneValueNode(),
      uri: k.noneValueNode(),
      creators: k.noneValueNode(),
      sellerFeeBasisPoints: k.noneValueNode(),
      primarySaleHappened: k.noneValueNode(),
      isMutable: k.noneValueNode(),
    },
  })
);

// Set optional fields with defaults.
kinobi.update(
  k.bottomUpTransformerVisitor([
    {
      // Make 'public' field optional with none() default
      select: (node) => {
        return (
          k.isNode(node, ["structFieldTypeNode", "instructionArgumentNode"]) &&
          node.name === "public"
        );
      },
      transform: (node) => {
        k.assertIsNode(node, ["structFieldTypeNode", "instructionArgumentNode"]);
        return {
          ...node,
          defaultValueStrategy: "optional",
          defaultValue: k.noneValueNode(),
        };
      },
    },
  ])
);

// Custom tree updates.
kinobi.update(
  k.bottomUpTransformerVisitor([
    {
      // Add nodes to the splAccountCompression program.
      select: "[programNode]splAccountCompression",
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

// Transform tuple enum variants to structs.
kinobi.update(
  k.unwrapTupleEnumWithSingleStructVisitor([
    "ConcurrentMerkleTreeHeaderData",
  ])
);

kinobi.update(
  k.updateInstructionsVisitor({
    updateMetadata: {
      accounts: {
        collectionMetadata: {
          defaultValue: k.conditionalValueNode({
            condition: k.accountValueNode("collectionMint"),
            ifTrue: k.pdaValueNode(
              k.pdaLinkNode("metadata", "mplTokenMetadata"),
              [
                k.pdaSeedValueNode("mint", k.accountValueNode("collectionMint")),
              ]
            ),
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
  k.renderJavaScriptVisitor(jsDir, {
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
  k.renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  })
);
