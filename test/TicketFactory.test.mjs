import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

// Helper for zero address
const ZERO_ADDRESS =
  ethers.ZeroAddress || "0x0000000000000000000000000000000000000000";

let ticketNFTImplementation;
let ticketFactory;

// Get signers from Hardhat network
const [wallet, walletTo, thirdWallet] = await ethers.getSigners();

describe("TicketFactory", () => {
  beforeEach(async () => {
    // Deploy TicketNFT as the base implementation
    ticketNFTImplementation = await ethers.deployContract("TicketNFT");

    // Deploy TicketFactory with the implementation
    ticketFactory = await ethers.deployContract("TicketFactory", [
      await ticketNFTImplementation.getAddress(),
    ]);

    // Get current block timestamp (stored for potential future use)
    // const block = await ethers.provider.getBlock("latest");
    // currentTimestamp = block.timestamp;
  });

  describe("Deployment", () => {
    it("Should set the correct implementation address", async () => {
      expect(await ticketFactory.implementation()).to.equal(
        await ticketNFTImplementation.getAddress()
      );
    });

    it("Should set the deployer as owner", async () => {
      expect(await ticketFactory.owner()).to.equal(await wallet.getAddress());
    });

    it("Should emit ImplementationUpdated event on deployment", async () => {
      const Factory = await ethers.getContractFactory("TicketFactory");
      const implAddress = await ticketNFTImplementation.getAddress();

      const factory = await Factory.deploy(implAddress);
      const deploymentTx = factory.deploymentTransaction();

      await expect(deploymentTx)
        .to.emit(factory, "ImplementationUpdated")
        .withArgs(implAddress);
    });

    it("Should revert if implementation address is zero", async () => {
      const Factory = await ethers.getContractFactory("TicketFactory");
      await expect(Factory.deploy(ZERO_ADDRESS)).to.be.revertedWithCustomError(
        Factory,
        "InvalidImplementation"
      );
    });
  });

  describe("setImplementation", () => {
    it("Should allow owner to update implementation", async () => {
      const newImplementation = await ethers.deployContract("TicketNFT");

      await expect(
        ticketFactory.setImplementation(await newImplementation.getAddress())
      )
        .to.emit(ticketFactory, "ImplementationUpdated")
        .withArgs(await newImplementation.getAddress());

      expect(await ticketFactory.implementation()).to.equal(
        await newImplementation.getAddress()
      );
    });

    it("Should revert if called by non-owner", async () => {
      const newImplementation = await ethers.deployContract("TicketNFT");

      await expect(
        ticketFactory
          .connect(walletTo)
          .setImplementation(await newImplementation.getAddress())
      ).to.be.revertedWithCustomError(
        ticketFactory,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert if new implementation is zero address", async () => {
      await expect(
        ticketFactory.setImplementation(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(ticketFactory, "InvalidImplementation");
    });
  });

  describe("predictEventAddress", () => {
    it("Should predict the correct deterministic address for an eventId", async () => {
      const eventId = 1;
      const predictedAddress = await ticketFactory.predictEventAddress(eventId);

      // The address should be deterministic
      expect(predictedAddress).to.not.equal(ZERO_ADDRESS);

      // Predicting again should return the same address
      const predictedAddress2 = await ticketFactory.predictEventAddress(
        eventId
      );
      expect(predictedAddress).to.equal(predictedAddress2);

      // Different eventId should return different address
      const predictedAddress3 = await ticketFactory.predictEventAddress(2);
      expect(predictedAddress).to.not.equal(predictedAddress3);
    });
  });

  describe("createEvent", () => {
    const eventId = 1;
    const name = "Test Event";
    const symbol = "TEST";
    const ticketTypeNames = ["General", "VIP"];
    const baseURI = "https://example.com/api/token/";
    const contractURI = "https://example.com/api/contract/";

    it("Should create a new event and emit EventCreated", async () => {
      const predictedAddress = await ticketFactory.predictEventAddress(eventId);

      await expect(
        ticketFactory.createEvent(
          eventId,
          name,
          symbol,
          ticketTypeNames,
          baseURI,
          contractURI,
          await walletTo.getAddress()
        )
      )
        .to.emit(ticketFactory, "EventCreated")
        .withArgs(eventId, predictedAddress, name, symbol);

      // Verify the event was stored
      const eventContract = await ticketFactory.eventContractOf(eventId);
      expect(eventContract).to.equal(predictedAddress);
      expect(eventContract).to.not.equal(ZERO_ADDRESS);
    });

    it("Should initialize the cloned TicketNFT correctly", async () => {
      await ticketFactory.createEvent(
        eventId,
        name,
        symbol,
        ticketTypeNames,
        baseURI,
        contractURI,
        walletTo.address
      );

      const eventContractAddress = await ticketFactory.eventContractOf(eventId);
      const ticketNFT = await ethers.getContractAt(
        "TicketNFT",
        eventContractAddress
      );

      // Verify initialization
      expect(await ticketNFT.eventId()).to.equal(eventId);
      expect(await ticketNFT.name()).to.equal(name);
      expect(await ticketNFT.symbol()).to.equal(symbol);
      expect(await ticketNFT.contractURI()).to.equal(contractURI);
      expect(await ticketNFT.owner()).to.equal(await walletTo.getAddress());

      // Verify ticket types
      const types = await ticketNFT.getTicketTypes();
      expect(types).to.have.lengthOf(2);
      expect(types[0]).to.equal("General");
      expect(types[1]).to.equal("VIP");
    });

    it("Should add event to allEvents array", async () => {
      await ticketFactory.createEvent(
        eventId,
        name,
        symbol,
        ticketTypeNames,
        baseURI,
        contractURI,
        walletTo.address
      );

      expect(await ticketFactory.getEventsCount()).to.equal(1);

      const eventAddress = await ticketFactory.getEventAt(0);
      const storedEventAddress = await ticketFactory.eventContractOf(eventId);
      expect(eventAddress).to.equal(storedEventAddress);
    });

    it("Should revert if eventId already exists", async () => {
      await ticketFactory.createEvent(
        eventId,
        name,
        symbol,
        ticketTypeNames,
        baseURI,
        contractURI,
        walletTo.address
      );

      await expect(
        ticketFactory.createEvent(
          eventId,
          "Another Event",
          "ANOTHER",
          ticketTypeNames,
          baseURI,
          contractURI,
          await walletTo.getAddress()
        )
      ).to.be.revertedWithCustomError(ticketFactory, "EventAlreadyExists");
    });

    it("Should revert if organizerOwner is zero address", async () => {
      await expect(
        ticketFactory.createEvent(
          eventId,
          name,
          symbol,
          ticketTypeNames,
          baseURI,
          contractURI,
          ZERO_ADDRESS
        )
      ).to.be.revertedWithCustomError(ticketFactory, "ZeroAddressOwner");
    });

    it("Should revert if called by non-owner", async () => {
      await expect(
        ticketFactory
          .connect(walletTo)
          .createEvent(
            eventId,
            name,
            symbol,
            ticketTypeNames,
            baseURI,
            contractURI,
            await walletTo.getAddress()
          )
      ).to.be.revertedWithCustomError(
        ticketFactory,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should create multiple events with different eventIds", async () => {
      await ticketFactory.createEvent(
        1,
        "Event 1",
        "EV1",
        ticketTypeNames,
        baseURI,
        contractURI,
        walletTo.address
      );

      await ticketFactory.createEvent(
        2,
        "Event 2",
        "EV2",
        ticketTypeNames,
        baseURI,
        contractURI,
        await thirdWallet.getAddress()
      );

      expect(await ticketFactory.getEventsCount()).to.equal(2);

      const event1Address = await ticketFactory.eventContractOf(1);
      const event2Address = await ticketFactory.eventContractOf(2);
      expect(event1Address).to.not.equal(event2Address);
    });
  });

  describe("Helper functions", () => {
    it("Should return correct events count", async () => {
      expect(await ticketFactory.getEventsCount()).to.equal(0);

      await ticketFactory.createEvent(
        1,
        "Event 1",
        "EV1",
        ["General"],
        "https://example.com/",
        "https://example.com/contract",
        walletTo.address
      );

      expect(await ticketFactory.getEventsCount()).to.equal(1);

      await ticketFactory.createEvent(
        2,
        "Event 2",
        "EV2",
        ["General"],
        "https://example.com/",
        "https://example.com/contract",
        walletTo.address
      );

      expect(await ticketFactory.getEventsCount()).to.equal(2);
    });

    it("Should return correct event address at index", async () => {
      await ticketFactory.createEvent(
        1,
        "Event 1",
        "EV1",
        ["General"],
        "https://example.com/",
        "https://example.com/contract",
        walletTo.address
      );

      const eventAddress1 = await ticketFactory.getEventAt(0);
      const storedAddress1 = await ticketFactory.eventContractOf(1);
      expect(eventAddress1).to.equal(storedAddress1);

      await ticketFactory.createEvent(
        2,
        "Event 2",
        "EV2",
        ["General"],
        "https://example.com/",
        "https://example.com/contract",
        walletTo.address
      );

      const eventAddress2 = await ticketFactory.getEventAt(1);
      const storedAddress2 = await ticketFactory.eventContractOf(2);
      expect(eventAddress2).to.equal(storedAddress2);
    });
  });
});
