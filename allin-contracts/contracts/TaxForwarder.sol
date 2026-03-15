// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IForwarderRecoverableToken {
    function transfer(address to, uint256 value) external returns (bool);
}

contract TaxForwarder {
    uint256 public constant PRIZE_POOL_SHARE_NUMERATOR = 5;
    uint256 public constant PRIZE_POOL_SHARE_DENOMINATOR = 6;

    address public owner;
    address public marketingWallet;
    address public prizePool;
    bool public paused;
    uint256 private _reentrancyLock;

    mapping(address => bool) public pausers;

    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);
    event MarketingWalletUpdated(address indexed previousWallet, address indexed newWallet);
    event PrizePoolUpdated(address indexed previousPrizePool, address indexed newPrizePool);
    event PauserUpdated(address indexed account, bool allowed);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event TaxReceived(address indexed sender, uint256 amount, uint256 balanceAfter);
    event TaxForwarded(
        address indexed triggeredBy,
        uint256 totalAmount,
        uint256 prizePoolAmount,
        uint256 marketingAmount
    );
    event EmergencyNativeWithdrawn(address indexed recipient, uint256 amount);
    event EmergencyTokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyPauser() {
        require(msg.sender == owner || pausers[msg.sender], "ONLY_PAUSER");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "FORWARDER_PAUSED");
        _;
    }

    modifier whenPaused() {
        require(paused, "FORWARDER_NOT_PAUSED");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyLock == 0, "REENTRANCY");
        _reentrancyLock = 1;
        _;
        _reentrancyLock = 0;
    }

    constructor(address initialOwner, address initialMarketingWallet) {
        require(initialOwner != address(0), "INVALID_OWNER");
        require(initialMarketingWallet != address(0), "INVALID_MARKETING_WALLET");

        owner = initialOwner;
        marketingWallet = initialMarketingWallet;
        pausers[initialOwner] = true;

        emit PauserUpdated(initialOwner, true);
    }

    /// @dev 收到税后自动转出，无需再手动调用 forward()
    receive() external payable whenNotPaused nonReentrant {
        emit TaxReceived(msg.sender, msg.value, address(this).balance);
        _forwardAvailableBalance();
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "INVALID_OWNER");
        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    function setMarketingWallet(address newMarketingWallet) external onlyOwner {
        require(newMarketingWallet != address(0), "INVALID_MARKETING_WALLET");
        emit MarketingWalletUpdated(marketingWallet, newMarketingWallet);
        marketingWallet = newMarketingWallet;
    }

    function setPrizePool(address newPrizePool) external onlyOwner {
        require(newPrizePool != address(0), "INVALID_PRIZE_POOL");
        emit PrizePoolUpdated(prizePool, newPrizePool);
        prizePool = newPrizePool;
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

    /// @dev 也可手动调用，用于转发此前因暂停等原因滞留在合约的 BNB
    function forward() external whenNotPaused nonReentrant {
        _forwardAvailableBalance();
    }

    function forwardableBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @dev 未设置奖池时：全部归营销；设置奖池后：5/6 奖池、1/6 营销
    function previewForwardAmounts() external view returns (uint256 prizePoolAmount, uint256 marketingAmount) {
        uint256 balance = address(this).balance;
        if (prizePool == address(0)) {
            return (0, balance);
        }
        return _splitBalance(balance);
    }

    function emergencyWithdrawNative(address payable recipient, uint256 amount) external onlyOwner whenPaused {
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "INVALID_AMOUNT");
        require(address(this).balance >= amount, "INSUFFICIENT_NATIVE_BALANCE");

        (bool success,) = recipient.call{value: amount}("");
        require(success, "TRANSFER_FAILED");

        emit EmergencyNativeWithdrawn(recipient, amount);
    }

    function emergencyWithdrawUnexpectedToken(address token, address recipient, uint256 amount)
        external
        onlyOwner
        whenPaused
    {
        require(token != address(0), "INVALID_TOKEN");
        require(recipient != address(0), "INVALID_RECIPIENT");
        require(amount > 0, "INVALID_AMOUNT");

        bool success = IForwarderRecoverableToken(token).transfer(recipient, amount);
        require(success, "TRANSFER_FAILED");

        emit EmergencyTokenWithdrawn(token, recipient, amount);
    }

    /// @dev 前期奖池未设置：100% 转营销钱包；部署资金池并 setPrizePool 后：5/6 转奖池、1/6 转营销
    function _forwardAvailableBalance() internal {
        uint256 totalAmount = address(this).balance;
        require(totalAmount > 0, "NO_FUNDS_TO_FORWARD");

        uint256 prizePoolAmount;
        uint256 marketingAmount;

        if (prizePool == address(0)) {
            prizePoolAmount = 0;
            marketingAmount = totalAmount;
            (bool success,) = payable(marketingWallet).call{value: marketingAmount}("");
            require(success, "MARKETING_TRANSFER_FAILED");
        } else {
            (prizePoolAmount, marketingAmount) = _splitBalance(totalAmount);
            (bool prizePoolSuccess,) = payable(prizePool).call{value: prizePoolAmount}("");
            require(prizePoolSuccess, "PRIZE_POOL_TRANSFER_FAILED");
            (bool marketingSuccess,) = payable(marketingWallet).call{value: marketingAmount}("");
            require(marketingSuccess, "MARKETING_TRANSFER_FAILED");
        }

        emit TaxForwarded(msg.sender, totalAmount, prizePoolAmount, marketingAmount);
    }

    function _splitBalance(uint256 amount) internal pure returns (uint256 prizePoolAmount, uint256 marketingAmount) {
        prizePoolAmount = (amount * PRIZE_POOL_SHARE_NUMERATOR) / PRIZE_POOL_SHARE_DENOMINATOR;
        marketingAmount = amount - prizePoolAmount;
    }
}
