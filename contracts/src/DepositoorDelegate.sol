// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC7821} from "solady/accounts/ERC7821.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

interface IWETH {
    function deposit() external payable;
}

contract DepositoorDelegate is ERC7821 {
    /// @notice The wrapped-native token for this chain (WETH on most, WPOL on Polygon, etc).
    /// Named `weth` for backward-compatibility with the deploy script; semantically wrapped-native.
    address public immutable weth;
    address public immutable keeper;

    constructor(address _weth, address _keeper) {
        weth = _weth;
        keeper = _keeper;
    }

    /// @notice Sweep the entire balance of a token to a recipient.
    /// @dev Uses SafeTransferLib so non-conforming tokens (e.g. USDT, which
    ///      does not return a bool from `transfer`) work correctly.
    function sweep(address token, address to) external {
        require(msg.sender == keeper || msg.sender == address(this), "unauthorized");
        uint256 bal = SafeTransferLib.balanceOf(token, address(this));
        if (bal > 0) {
            SafeTransferLib.safeTransfer(token, to, bal);
        }
    }

    function _execute(
        bytes32,
        bytes calldata,
        Call[] calldata calls,
        bytes calldata opData
    ) internal virtual override {
        if (opData.length == 0) {
            require(msg.sender == keeper || msg.sender == address(this), "unauthorized");
            _execute(calls, bytes32(0));
            return;
        }
        revert("opData not supported");
    }

    /// @notice Auto-wrap incoming native gas into the canonical wrapped-native token.
    /// @dev Calls IWETH.deposit() explicitly. Some non-OP-Stack wrapped-native
    ///      contracts do not have a payable fallback, so the explicit call is
    ///      required for portability.
    receive() external payable override {
        if (msg.value > 0) {
            IWETH(weth).deposit{value: msg.value}();
        }
    }
}
