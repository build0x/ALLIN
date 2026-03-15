// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PrizePoolVault
/// @notice 奖池仅支持接收（receive），合约内资金不可被提取，不可发奖。
interface IPrizePoolRecoverableToken {
    function transfer(address to, uint256 value) external returns (bool);
}

contract PrizePoolVault {
    struct TournamentPayout {
        bytes32 payoutId;
        bytes32 tournamentId;
        address winner;
        uint256 amount;
        uint256 paidAt;
    }

    address public owner;
    bool public paused;
    uint256 public totalPaid;

    TournamentPayout[] public payouts;
    mapping(address => bool) public payoutOperators;
    mapping(address => bool) public pausers;
    mapping(bytes32 => bool) public usedPayoutIds;

    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
    event PayoutOperatorUpdated(address indexed account, bool allowed);
    event PauserUpdated(address indexed account, bool allowed);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event PrizeDeposited(address indexed sender, uint256 amount, uint256 balanceAfter);
    event PrizePaid(
        bytes32 indexed tournamentId,
        bytes32 indexed payoutId,
        address indexed winner,
        uint256 amount
    );
    event EmergencyNativeWithdrawn(address indexed recipient, uint256 amount);
    event EmergencyTokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyPayoutOperator() {
        require(msg.sender == owner || payoutOperators[msg.sender], "ONLY_PAYOUT_OPERATOR");
        _;
    }

    modifier onlyPauser() {
        require(msg.sender == owner || pausers[msg.sender], "ONLY_PAUSER");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "PRIZE_POOL_PAUSED");
        _;
    }

    modifier whenPaused() {
        require(paused, "PRIZE_POOL_NOT_PAUSED");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "INVALID_OWNER");
        owner = initialOwner;
        payoutOperators[initialOwner] = true;
        pausers[initialOwner] = true;
        emit PayoutOperatorUpdated(initialOwner, true);
        emit PauserUpdated(initialOwner, true);
    }

    receive() external payable {
        emit PrizeDeposited(msg.sender, msg.value, address(this).balance);
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    function setPayoutOperator(address account, bool allowed) external onlyOwner {
        payoutOperators[account] = allowed;
        emit PayoutOperatorUpdated(account, allowed);
    }

    function setPauser(address account, bool allowed) external onlyOwner {
        pausers[account] = allowed;
        emit PauserUpdated(account, allowed);
    }

    function pause() external onlyPauser {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyPauser {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice 已禁用：合约内资金不可提取/发奖。
    function payTournamentPrize(
        bytes32,
        bytes32,
        address payable,
        uint256
    ) external pure {
        revert("WITHDRAWAL_DISABLED");
    }

    /// @notice 已禁用：合约内资金不可提取/发奖。
    function payTournamentPrizes(
        bytes32,
        bytes32[] calldata,
        address payable[] calldata,
        uint256[] calldata
    ) external pure {
        revert("WITHDRAWAL_DISABLED");
    }

    function getPayoutCount() external view returns (uint256) {
        return payouts.length;
    }

    /// @notice 已禁用：合约内资金不可提取。
    function emergencyWithdrawNative(address payable, uint256) external pure {
        revert("WITHDRAWAL_DISABLED");
    }

    /// @notice 已禁用：合约内资金不可提取。
    function emergencyWithdrawUnexpectedToken(address, address, uint256) external pure {
        revert("WITHDRAWAL_DISABLED");
    }

    function _payTournamentPrize(
        bytes32 tournamentId,
        bytes32 payoutId,
        address payable winner,
        uint256 amount
    ) internal {
        require(tournamentId != bytes32(0), "INVALID_TOURNAMENT");
        require(payoutId != bytes32(0), "INVALID_PAYOUT_ID");
        require(!usedPayoutIds[payoutId], "PAYOUT_ALREADY_USED");
        require(winner != address(0), "INVALID_WINNER");
        require(amount > 0, "INVALID_AMOUNT");
        require(address(this).balance >= amount, "INSUFFICIENT_POOL_BALANCE");

        usedPayoutIds[payoutId] = true;
        totalPaid += amount;

        payouts.push(
            TournamentPayout({
                payoutId: payoutId,
                tournamentId: tournamentId,
                winner: winner,
                amount: amount,
                paidAt: block.timestamp
            })
        );

        (bool success,) = winner.call{value: amount}("");
        require(success, "TRANSFER_FAILED");

        emit PrizePaid(tournamentId, payoutId, winner, amount);
    }
}
