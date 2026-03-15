// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GameTreasuryVault
/// @notice 金库仅支持充值（deposit），合约内代币不可被提取，资金永久锁定在合约中。
interface IGameTreasuryToken {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IRecoverableToken {
    function transfer(address to, uint256 value) external returns (bool);
}

contract GameTreasuryVault {
    address public owner;
    IGameTreasuryToken public immutable token;
    bool public paused;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    mapping(address => bool) public operators;
    mapping(address => bool) public pausers;
    mapping(bytes32 => bool) public usedDepositIds;
    mapping(bytes32 => bool) public usedWithdrawalIds;
    mapping(address => uint256) public depositedByAccount;
    mapping(address => uint256) public withdrawnByAccount;

    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed account, bool allowed);
    event PauserUpdated(address indexed account, bool allowed);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event Deposited(address indexed depositor, uint256 amount, bytes32 indexed depositId, uint256 vaultBalanceAfter);
    event Withdrawn(address indexed recipient, uint256 amount, bytes32 indexed withdrawalId, uint256 vaultBalanceAfter);
    event EmergencyTokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event EmergencyNativeWithdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == owner || operators[msg.sender], "ONLY_OPERATOR");
        _;
    }

    modifier onlyPauser() {
        require(msg.sender == owner || pausers[msg.sender], "ONLY_PAUSER");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VAULT_PAUSED");
        _;
    }

    modifier whenPaused() {
        require(paused, "VAULT_NOT_PAUSED");
        _;
    }

    constructor(address initialOwner, address tokenAddress) {
        require(initialOwner != address(0), "INVALID_OWNER");
        require(tokenAddress != address(0), "INVALID_TOKEN");

        owner = initialOwner;
        token = IGameTreasuryToken(tokenAddress);
        operators[initialOwner] = true;
        pausers[initialOwner] = true;

        emit OperatorUpdated(initialOwner, true);
        emit PauserUpdated(initialOwner, true);
    }

    receive() external payable {}

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    function setOperator(address account, bool allowed) external onlyOwner {
        operators[account] = allowed;
        emit OperatorUpdated(account, allowed);
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

    function deposit(uint256 amount, bytes32 depositId) external whenNotPaused {
        require(amount > 0, "INVALID_AMOUNT");
        require(depositId != bytes32(0), "INVALID_DEPOSIT_ID");
        require(!usedDepositIds[depositId], "DEPOSIT_ALREADY_USED");

        usedDepositIds[depositId] = true;
        bool success = token.transferFrom(msg.sender, address(this), amount);
        require(success, "TRANSFER_FROM_FAILED");

        totalDeposited += amount;
        depositedByAccount[msg.sender] += amount;

        emit Deposited(msg.sender, amount, depositId, token.balanceOf(address(this)));
    }

    /// @notice 已禁用：合约内代币不可提取。
    function withdraw(address, uint256, bytes32) external pure {
        revert("WITHDRAWAL_DISABLED");
    }

    function vaultBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice 已禁用：合约内主代币不可提取。
    function emergencyWithdrawPrincipalToken(address, uint256) external pure {
        revert("WITHDRAWAL_DISABLED");
    }

    function emergencyWithdrawUnexpectedToken(address tokenAddress, address recipient, uint256 amount)
        external
        onlyOwner
        whenPaused
    {
        require(tokenAddress != address(0), "INVALID_TOKEN");
        require(tokenAddress != address(token), "USE_PRINCIPAL_WITHDRAW");
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "INVALID_AMOUNT");

        bool success = IRecoverableToken(tokenAddress).transfer(recipient, amount);
        require(success, "TRANSFER_FAILED");

        emit EmergencyTokenWithdrawn(tokenAddress, recipient, amount);
    }

    function emergencyWithdrawNative(address payable recipient, uint256 amount) external onlyOwner whenPaused {
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "INVALID_AMOUNT");
        require(address(this).balance >= amount, "INSUFFICIENT_NATIVE_BALANCE");

        (bool success,) = recipient.call{value: amount}("");
        require(success, "NATIVE_TRANSFER_FAILED");

        emit EmergencyNativeWithdrawn(recipient, amount);
    }
}
