import { expect } from "chai";
import { network } from "hardhat";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("NFTFactory", () => {
  let ethers;
  let baseNFTImpl;
  let nftFactory;
  let owner;
  let addr1;
  let addr2;
  let addr3;

  before(async () => {
    ({ ethers } = await network.connect());
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    addr1 = signers[1];
    addr2 = signers[2];
    addr3 = signers[3] || signers[2]; // Fallback to addr2 if not enough signers

    // deploy BaseNFT (implementation to be cloned)
    baseNFTImpl = await ethers.deployContract("BaseNFT");
    await baseNFTImpl.waitForDeployment();

    // deploy NFTFactory pointing to that implementation
    nftFactory = await ethers.deployContract("NFTFactory", [
      await baseNFTImpl.getAddress(),
    ]);
    await nftFactory.waitForDeployment();
  });

  describe("deployment", () => {
    it("sets the correct implementation", async () => {
      expect(await nftFactory.implementation()).to.equal(
        await baseNFTImpl.getAddress()
      );
    });

    it("sets deployer as owner", async () => {
      expect(await nftFactory.owner()).to.equal(await owner.getAddress());
    });

    it("emits ImplementationUpdated event on deployment", async () => {
      const Factory = await ethers.getContractFactory("NFTFactory");
      const newImpl = await ethers.deployContract("BaseNFT");
      await newImpl.waitForDeployment();

      const factory = await Factory.deploy(await newImpl.getAddress());
      const deploymentTx = factory.deploymentTransaction();

      await expect(deploymentTx)
        .to.emit(factory, "ImplementationUpdated")
        .withArgs(await newImpl.getAddress());
    });

    it("reverts if implementation is zero", async () => {
      const Factory = await ethers.getContractFactory("NFTFactory");
      await expect(Factory.deploy(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        Factory,
        "InvalidImplementation"
      );
    });
  });

  describe("setImplementation", () => {
    it("owner can update implementation", async () => {
      const newImpl = await ethers.deployContract("BaseNFT");
      await newImpl.waitForDeployment();

      await expect(nftFactory.setImplementation(await newImpl.getAddress()))
        .to.emit(nftFactory, "ImplementationUpdated")
        .withArgs(await newImpl.getAddress());

      expect(await nftFactory.implementation()).to.equal(
        await newImpl.getAddress()
      );
    });

    it("non owner cannot update", async () => {
      const newImpl = await ethers.deployContract("BaseNFT");
      await newImpl.waitForDeployment();

      await expect(
        nftFactory.connect(addr1).setImplementation(await newImpl.getAddress())
      ).to.be.revertedWithCustomError(nftFactory, "OwnableUnauthorizedAccount");
    });

    it("reverts on zero impl", async () => {
      await expect(
        nftFactory.setImplementation(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(nftFactory, "InvalidImplementation");
    });
  });

  describe("predictCollectionAddress", () => {
    it("returns deterministic address per collectionId", async () => {
      const id1 = 1;
      const id2 = 2;

      const predicted1 = await nftFactory.predictCollectionAddress(id1);
      const predicted1Again = await nftFactory.predictCollectionAddress(id1);
      const predicted2 = await nftFactory.predictCollectionAddress(id2);

      expect(predicted1).to.not.equal(ZERO_ADDRESS);
      expect(predicted1).to.equal(predicted1Again);
      expect(predicted1).to.not.equal(predicted2);
    });

    it("predicted address matches actual deployed clone address", async () => {
      const collectionId = 42;
      const predicted = await nftFactory.predictCollectionAddress(collectionId);

      await nftFactory.createCollection(
        collectionId,
        "Test",
        "TST",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const actual = await nftFactory.collectionContractOf(collectionId);
      expect(actual).to.equal(predicted);
    });

    it("works with collectionId = 0", async () => {
      const predicted = await nftFactory.predictCollectionAddress(0);
      expect(predicted).to.not.equal(ZERO_ADDRESS);

      await nftFactory.createCollection(
        0,
        "Zero Collection",
        "ZERO",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const actual = await nftFactory.collectionContractOf(0);
      expect(actual).to.equal(predicted);
    });
  });

  describe("createCollection", () => {
    const collectionId = 1;
    const name = "Test Collection";
    const symbol = "TEST";
    const baseURI = "https://example.com/api/token/";
    const contractURI = "https://example.com/api/contract/";

    it("creates a new collection and emits event", async () => {
      const predicted = await nftFactory.predictCollectionAddress(collectionId);

      await expect(
        nftFactory.createCollection(
          collectionId,
          name,
          symbol,
          baseURI,
          contractURI,
          await addr1.getAddress()
        )
      )
        .to.emit(nftFactory, "CollectionCreated")
        .withArgs(collectionId, predicted, name, symbol);

      const stored = await nftFactory.collectionContractOf(collectionId);
      expect(stored).to.equal(predicted);
    });

    it("initializes the cloned BaseNFT correctly", async () => {
      await nftFactory.createCollection(
        collectionId,
        name,
        symbol,
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      const cloneAddr = await nftFactory.collectionContractOf(collectionId);
      const clone = await ethers.getContractAt("BaseNFT", cloneAddr);

      expect(await clone.collectionId()).to.equal(collectionId);
      expect(await clone.name()).to.equal(name);
      expect(await clone.symbol()).to.equal(symbol);
      expect(await clone.contractURI()).to.equal(contractURI);
      expect(await clone.owner()).to.equal(await addr1.getAddress());
    });

    it("adds collection to allCollections array", async () => {
      await nftFactory.createCollection(
        collectionId,
        name,
        symbol,
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      expect(await nftFactory.getCollectionsCount()).to.equal(1);

      const storedAt0 = await nftFactory.getCollectionAt(0);
      const stored = await nftFactory.collectionContractOf(collectionId);

      expect(storedAt0).to.equal(stored);
    });

    it("reverts if collectionId already exists", async () => {
      await nftFactory.createCollection(
        collectionId,
        name,
        symbol,
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      await expect(
        nftFactory.createCollection(
          collectionId,
          "Another",
          "ANOTHER",
          baseURI,
          contractURI,
          await addr1.getAddress()
        )
      ).to.be.revertedWithCustomError(nftFactory, "CollectionAlreadyExists");
    });

    it("reverts if collectionOwner is zero", async () => {
      await expect(
        nftFactory.createCollection(
          collectionId,
          name,
          symbol,
          baseURI,
          contractURI,
          ZERO_ADDRESS
        )
      ).to.be.revertedWithCustomError(nftFactory, "ZeroAddressOwner");
    });

    it("reverts if called by non-owner", async () => {
      await expect(
        nftFactory
          .connect(addr1)
          .createCollection(
            collectionId,
            name,
            symbol,
            baseURI,
            contractURI,
            await addr1.getAddress()
          )
      ).to.be.revertedWithCustomError(nftFactory, "OwnableUnauthorizedAccount");
    });

    it("creates multiple collections with different ids", async () => {
      await nftFactory.createCollection(
        1,
        "Col 1",
        "C1",
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      await nftFactory.createCollection(
        2,
        "Col 2",
        "C2",
        baseURI,
        contractURI,
        await addr2.getAddress()
      );

      expect(await nftFactory.getCollectionsCount()).to.equal(2);

      const c1 = await nftFactory.collectionContractOf(1);
      const c2 = await nftFactory.collectionContractOf(2);
      expect(c1).to.not.equal(c2);
    });

    it("clone cannot be initialized twice", async () => {
      await nftFactory.createCollection(
        collectionId,
        name,
        symbol,
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      const cloneAddr = await nftFactory.collectionContractOf(collectionId);
      const clone = await ethers.getContractAt("BaseNFT", cloneAddr);

      await expect(
        clone.initialize(
          collectionId,
          name,
          symbol,
          baseURI,
          contractURI,
          await addr1.getAddress()
        )
      ).to.be.revertedWithCustomError(clone, "InvalidInitialization");
    });

    it("works with empty strings", async () => {
      await nftFactory.createCollection(
        999,
        "",
        "",
        "",
        "",
        await addr1.getAddress()
      );

      const cloneAddr = await nftFactory.collectionContractOf(999);
      const clone = await ethers.getContractAt("BaseNFT", cloneAddr);

      expect(await clone.name()).to.equal("");
      expect(await clone.symbol()).to.equal("");
      expect(await clone.contractURI()).to.equal("");
    });

    it("new clones use updated implementation after setImplementation", async () => {
      // Create collection with original implementation
      await nftFactory.createCollection(
        100,
        "Old",
        "OLD",
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      // Deploy new implementation
      const newImpl = await ethers.deployContract("BaseNFT");
      await newImpl.waitForDeployment();

      // Update implementation
      await nftFactory.setImplementation(await newImpl.getAddress());

      // Create new collection - should use new implementation
      await nftFactory.createCollection(
        101,
        "New",
        "NEW",
        baseURI,
        contractURI,
        await addr1.getAddress()
      );

      const oldClone = await nftFactory.collectionContractOf(100);
      const newClone = await nftFactory.collectionContractOf(101);

      // Both should work, but they're different clones
      expect(oldClone).to.not.equal(newClone);

      // Verify both are valid BaseNFT contracts
      const oldContract = await ethers.getContractAt("BaseNFT", oldClone);
      const newContract = await ethers.getContractAt("BaseNFT", newClone);

      expect(await oldContract.name()).to.equal("Old");
      expect(await newContract.name()).to.equal("New");
    });
  });

  describe("helper views", () => {
    it("returns correct collections count and addresses", async () => {
      expect(await nftFactory.getCollectionsCount()).to.equal(0);

      await nftFactory.createCollection(
        1,
        "Col 1",
        "C1",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      await nftFactory.createCollection(
        2,
        "Col 2",
        "C2",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      expect(await nftFactory.getCollectionsCount()).to.equal(2);

      const col0 = await nftFactory.getCollectionAt(0);
      const col1 = await nftFactory.getCollectionAt(1);

      const stored0 = await nftFactory.collectionContractOf(1);
      const stored1 = await nftFactory.collectionContractOf(2);

      expect(col0).to.equal(stored0);
      expect(col1).to.equal(stored1);
    });

    it("getCollectionAt reverts on out of bounds index", async () => {
      expect(await nftFactory.getCollectionsCount()).to.equal(0);

      // Should revert when accessing index 0 of empty array (Solidity 0.8.x panics on out of bounds)
      await expect(nftFactory.getCollectionAt(0)).to.be.revertedWithPanic(0x32);

      // After adding one collection, index 1 should revert
      await nftFactory.createCollection(
        1,
        "Col 1",
        "C1",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      // Index 0 should work, but index 1 should revert
      const valid = await nftFactory.getCollectionAt(0);
      expect(valid).to.not.equal(ZERO_ADDRESS);

      await expect(nftFactory.getCollectionAt(1)).to.be.revertedWithPanic(0x32);
    });
  });

  describe("BaseNFT clone functionality", () => {
    it("clone can mint tokens", async () => {
      await nftFactory.createCollection(
        200,
        "Mintable",
        "MINT",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const cloneAddr = await nftFactory.collectionContractOf(200);
      const clone = await ethers.getContractAt("BaseNFT", cloneAddr);

      // Owner can mint
      await expect(clone.connect(addr1).mint(await addr2.getAddress()))
        .to.emit(clone, "Transfer")
        .withArgs(ZERO_ADDRESS, await addr2.getAddress(), 0n);

      expect(await clone.ownerOf(0)).to.equal(await addr2.getAddress());
      expect(await clone.balanceOf(await addr2.getAddress())).to.equal(1n);

      // Non-owner cannot mint
      await expect(
        clone.connect(addr2).mint(await addr2.getAddress())
      ).to.be.revertedWithCustomError(clone, "OwnableUnauthorizedAccount");
    });

    it("clone returns correct tokenURI", async () => {
      const baseURI = "https://api.example.com/token/";
      await nftFactory.createCollection(
        201,
        "URI Test",
        "URI",
        baseURI,
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const cloneAddr = await nftFactory.collectionContractOf(201);
      const clone = await ethers.getContractAt("BaseNFT", cloneAddr);

      await clone.connect(addr1).mint(await addr2.getAddress());

      const tokenURI = await clone.tokenURI(0);
      expect(tokenURI).to.equal(`${baseURI}0`);
    });

    it("clone maintains independent state per collection", async () => {
      await nftFactory.createCollection(
        300,
        "Collection A",
        "COLA",
        "https://a.com/",
        "https://a.com/contract",
        await addr1.getAddress()
      );

      await nftFactory.createCollection(
        301,
        "Collection B",
        "COLB",
        "https://b.com/",
        "https://b.com/contract",
        await addr2.getAddress()
      );

      const cloneA = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(300)
      );
      const cloneB = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(301)
      );

      // Mint to same address in both collections
      await cloneA.connect(addr1).mint(await owner.getAddress());
      await cloneB.connect(addr2).mint(await owner.getAddress());

      // Both should have tokenId 0, but they're different NFTs
      expect(await cloneA.ownerOf(0)).to.equal(await owner.getAddress());
      expect(await cloneB.ownerOf(0)).to.equal(await owner.getAddress());
      expect(await cloneA.balanceOf(await owner.getAddress())).to.equal(1n);
      expect(await cloneB.balanceOf(await owner.getAddress())).to.equal(1n);

      // But they're different contracts
      expect(await cloneA.getAddress()).to.not.equal(await cloneB.getAddress());
    });

    it("clone mints sequential token IDs starting from 0", async () => {
      await nftFactory.createCollection(
        400,
        "Sequential",
        "SEQ",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(400)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      await clone.connect(addr1).mint(await addr3.getAddress());
      await clone.connect(addr1).mint(await owner.getAddress());

      expect(await clone.ownerOf(0)).to.equal(await addr2.getAddress());
      expect(await clone.ownerOf(1)).to.equal(await addr3.getAddress());
      expect(await clone.ownerOf(2)).to.equal(await owner.getAddress());
      expect(await clone.balanceOf(await addr2.getAddress())).to.equal(1n);
      expect(await clone.balanceOf(await addr3.getAddress())).to.equal(1n);
      expect(await clone.balanceOf(await owner.getAddress())).to.equal(1n);
    });

    it("clone cannot mint to zero address", async () => {
      await nftFactory.createCollection(
        401,
        "Zero Test",
        "ZERO",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(401)
      );

      await expect(
        clone.connect(addr1).mint(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(clone, "ERC721InvalidReceiver");
    });

    it("clone supports ERC721 interfaces", async () => {
      await nftFactory.createCollection(
        402,
        "Interface Test",
        "IFACE",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(402)
      );

      // ERC721 interface ID
      const ERC721_INTERFACE_ID = "0x80ac58cd";
      expect(await clone.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;

      // ERC721Metadata interface ID
      const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";
      expect(await clone.supportsInterface(ERC721_METADATA_INTERFACE_ID)).to.be
        .true;
    });

    it("clone allows token transfers", async () => {
      await nftFactory.createCollection(
        403,
        "Transfer Test",
        "TRANS",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(403)
      );

      // Mint tokens
      await clone.connect(addr1).mint(await addr2.getAddress());
      await clone.connect(addr1).mint(await addr2.getAddress());

      const tokenId = 0n;
      await expect(
        clone
          .connect(addr2)
          .transferFrom(
            await addr2.getAddress(),
            await addr3.getAddress(),
            tokenId
          )
      )
        .to.emit(clone, "Transfer")
        .withArgs(await addr2.getAddress(), await addr3.getAddress(), tokenId);

      expect(await clone.ownerOf(tokenId)).to.equal(await addr3.getAddress());
      expect(await clone.balanceOf(await addr2.getAddress())).to.equal(1n);
      expect(await clone.balanceOf(await addr3.getAddress())).to.equal(1n);
    });

    it("clone allows approved transfers", async () => {
      await nftFactory.createCollection(
        404,
        "Approve Test",
        "APPR",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(404)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      const tokenId = 0n;

      await clone.connect(addr2).approve(await owner.getAddress(), tokenId);
      expect(await clone.getApproved(tokenId)).to.equal(
        await owner.getAddress()
      );

      await expect(
        clone
          .connect(owner)
          .transferFrom(
            await addr2.getAddress(),
            await addr3.getAddress(),
            tokenId
          )
      )
        .to.emit(clone, "Transfer")
        .withArgs(await addr2.getAddress(), await addr3.getAddress(), tokenId);
    });

    it("clone allows operator approvals", async () => {
      await nftFactory.createCollection(
        405,
        "Operator Test",
        "OP",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(405)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      await clone.connect(addr1).mint(await addr2.getAddress());

      await clone
        .connect(addr2)
        .setApprovalForAll(await owner.getAddress(), true);
      expect(
        await clone.isApprovedForAll(
          await addr2.getAddress(),
          await owner.getAddress()
        )
      ).to.be.true;

      const tokenId = 0n;
      await expect(
        clone
          .connect(owner)
          .transferFrom(
            await addr2.getAddress(),
            await addr3.getAddress(),
            tokenId
          )
      )
        .to.emit(clone, "Transfer")
        .withArgs(await addr2.getAddress(), await addr3.getAddress(), tokenId);
    });

    it("clone can mint many tokens", async () => {
      await nftFactory.createCollection(
        406,
        "Many Tokens",
        "MANY",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(406)
      );

      // Mint 10 tokens
      for (let i = 0; i < 10; i++) {
        await clone.connect(addr1).mint(await addr2.getAddress());
      }

      expect(await clone.balanceOf(await addr2.getAddress())).to.equal(10n);
      expect(await clone.ownerOf(9)).to.equal(await addr2.getAddress());
      // Verify we can query all tokens
      for (let i = 0; i < 10; i++) {
        expect(await clone.ownerOf(i)).to.equal(await addr2.getAddress());
      }
    });

    it("clone tokenURI works with empty baseURI", async () => {
      await nftFactory.createCollection(
        407,
        "Empty URI",
        "EURI",
        "",
        "",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(407)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      // With empty baseURI, OpenZeppelin returns empty string for tokenURI
      // This is expected behavior - the baseURI is empty so tokenURI is just the tokenId as string
      const tokenURI = await clone.tokenURI(0);
      // OpenZeppelin ERC721 returns empty string when baseURI is empty
      expect(tokenURI).to.equal("");
    });

    it("clone supports safeTransferFrom", async () => {
      await nftFactory.createCollection(
        408,
        "Safe Transfer",
        "SAFE",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(408)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      const tokenId = 0n;

      await expect(
        clone
          .connect(addr2)
          .safeTransferFrom(
            await addr2.getAddress(),
            await addr3.getAddress(),
            tokenId
          )
      )
        .to.emit(clone, "Transfer")
        .withArgs(await addr2.getAddress(), await addr3.getAddress(), tokenId);

      expect(await clone.ownerOf(tokenId)).to.equal(await addr3.getAddress());
    });

    it("clone supports safeTransferFrom with data", async () => {
      await nftFactory.createCollection(
        409,
        "Safe Transfer Data",
        "SAFED",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(409)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      const tokenId = 0n;
      const data = ethers.toUtf8Bytes("test data");

      // Use the 4-parameter version explicitly
      await expect(
        clone
          .connect(addr2)
          ["safeTransferFrom(address,address,uint256,bytes)"](
            await addr2.getAddress(),
            await addr3.getAddress(),
            tokenId,
            data
          )
      )
        .to.emit(clone, "Transfer")
        .withArgs(await addr2.getAddress(), await addr3.getAddress(), tokenId);

      expect(await clone.ownerOf(tokenId)).to.equal(await addr3.getAddress());
    });

    it("clone safeTransferFrom reverts when transferring to non-ERC721Receiver contract", async () => {
      await nftFactory.createCollection(
        410,
        "Non Receiver",
        "NONREC",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(410)
      );

      await clone.connect(addr1).mint(await addr2.getAddress());
      const tokenId = 0n;

      // Deploy a simple contract that doesn't implement onERC721Received
      const NonReceiver = await ethers.getContractFactory("NFTFactory");
      const nonReceiver = await NonReceiver.deploy(
        await baseNFTImpl.getAddress()
      );
      await nonReceiver.waitForDeployment();

      await expect(
        clone
          .connect(addr2)
          .safeTransferFrom(
            await addr2.getAddress(),
            await nonReceiver.getAddress(),
            tokenId
          )
      ).to.be.revertedWithCustomError(clone, "ERC721InvalidReceiver");
    });

    it("predictCollectionAddress works correctly after implementation update", async () => {
      const collectionId = 500;

      // Predict with original implementation
      const predictedBefore = await nftFactory.predictCollectionAddress(
        collectionId
      );

      // Update implementation
      const newImpl = await ethers.deployContract("BaseNFT");
      await newImpl.waitForDeployment();
      await nftFactory.setImplementation(await newImpl.getAddress());

      // Predict with new implementation - should be different
      const predictedAfter = await nftFactory.predictCollectionAddress(
        collectionId
      );

      // They should be different because implementation changed
      expect(predictedBefore).to.not.equal(predictedAfter);

      // Create collection with new implementation
      await nftFactory.createCollection(
        collectionId,
        "New Impl",
        "NEW",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      // Actual address should match prediction after update
      const actual = await nftFactory.collectionContractOf(collectionId);
      expect(actual).to.equal(predictedAfter);
    });

    it("works with maximum collectionId (uint256 max)", async () => {
      const maxId = 2n ** 256n - 1n;
      const predicted = await nftFactory.predictCollectionAddress(maxId);
      expect(predicted).to.not.equal(ZERO_ADDRESS);

      await nftFactory.createCollection(
        maxId,
        "Max ID",
        "MAX",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const actual = await nftFactory.collectionContractOf(maxId);
      expect(actual).to.equal(predicted);
    });

    it("factory owner can renounce ownership", async () => {
      // Verify owner exists
      expect(await nftFactory.owner()).to.equal(await owner.getAddress());

      // Renounce ownership
      await nftFactory.renounceOwnership();

      // Owner should be zero address
      expect(await nftFactory.owner()).to.equal(ZERO_ADDRESS);

      // Owner functions should revert
      const newImpl = await ethers.deployContract("BaseNFT");
      await newImpl.waitForDeployment();

      await expect(
        nftFactory.setImplementation(await newImpl.getAddress())
      ).to.be.revertedWithCustomError(nftFactory, "OwnableUnauthorizedAccount");
    });

    it("clone owner can renounce ownership", async () => {
      await nftFactory.createCollection(
        411,
        "Renounce Test",
        "REN",
        "https://example.com/",
        "https://example.com/contract",
        await addr1.getAddress()
      );

      const clone = await ethers.getContractAt(
        "BaseNFT",
        await nftFactory.collectionContractOf(411)
      );

      expect(await clone.owner()).to.equal(await addr1.getAddress());

      await clone.connect(addr1).renounceOwnership();

      expect(await clone.owner()).to.equal(ZERO_ADDRESS);

      // Owner functions should revert
      await expect(
        clone.connect(addr1).mint(await addr2.getAddress())
      ).to.be.revertedWithCustomError(clone, "OwnableUnauthorizedAccount");
    });
  });
});
