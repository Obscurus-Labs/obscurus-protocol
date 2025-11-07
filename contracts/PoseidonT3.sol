// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "poseidon-solidity/PoseidonT3.sol";

/// @title PoseidonT3Wrapper
/// @notice Wrapper contract to deploy PoseidonT3 library
/// @dev This is needed because Hardhat cannot deploy libraries directly
contract PoseidonT3Wrapper {
    using PoseidonT3 for uint256[2];

    /// @dev This function exists only to force the library to be included in bytecode
    /// In practice, the library will be linked to contracts that use it
    function dummy() external pure returns (uint256) {
        return 0;
    }
}

