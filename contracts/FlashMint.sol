// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {ERC20} from "./ERC20.sol";
import {ERC20FlashMint} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20FlashMint.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MyFlashMinter is ERC20FlashMint, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public fee;

    constructor(
        string memory name,
        string memory symbol,
        uint256 fee_
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        fee = fee_;
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function flashFee(address token, uint256 amount)
        public
        view
        override
        returns (uint256)
    {
        require(token == address(this), "FlashMinter: Unsupported currency");
        return _flashFee(token, amount);
    }

    function _flashFee(address token, uint256 amount)
        internal
        view
        returns (uint256)
    {
        return (amount * fee) / 10000;
    }
}
