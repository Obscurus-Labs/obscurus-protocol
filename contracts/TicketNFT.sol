// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract TicketNFT is Initializable, ERC721Upgradeable, OwnableUpgradeable {
    // ---- Minimal and clear state ----
    uint256 private _nextTokenId;
    uint256 public eventId;

    // On-chain names (UX) and type per token (logic/ZK)
    string[] public ticketTypeNames; // 0 -> "General", 1 -> "VIP", ...
    mapping(uint256 => uint8) public ticketTypeOf; // tokenId -> type

    // Collection metadata (optional) and baseURI per token
    string private _baseTokenURI;
    string public contractURI;

    // ---- Initializer for clones ----
    function initialize(
        uint256 eventId_,
        string calldata name_,
        string calldata symbol_,
        string[] calldata ticketTypeNames_,
        string calldata baseURI_,
        string calldata contractURI_,
        address owner_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init(owner_);

        eventId = eventId_;
        _baseTokenURI = baseURI_;
        contractURI = contractURI_;

        // copy type names
        for (uint256 i = 0; i < ticketTypeNames_.length; i++) {
            ticketTypeNames.push(ticketTypeNames_[i]);
        }
    }

    // ---- Mint controlled by the organizer (owner) ----
    function mint(
        address to,
        uint8 ticketType
    ) external onlyOwner returns (uint256 tokenId) {
        require(ticketType < ticketTypeNames.length, "invalid ticket type");
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        ticketTypeOf[tokenId] = ticketType;
    }

    // ---- Helper read functions ----
    function getTicketTypes() external view returns (string[] memory) {
        return ticketTypeNames;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
