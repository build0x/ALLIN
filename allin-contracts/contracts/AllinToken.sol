// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * 测试用 ALLIN 代币：ERC20 + 铸造 + 金库燃烧（仅 BurnRouter 可调）
 */
contract AllinToken {
    string public name = "ALLIN Test";
    string public symbol = "ALLIN";
    uint8 public decimals = 18;

    address public owner;
    address public burnRouter;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event BurnRouterUpdated(address indexed previousRouter, address indexed newRouter);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(uint256 initialSupply) {
        owner = msg.sender;
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address from, address spender) external view returns (uint256) {
        return _allowances[from][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ALLOWANCE_EXCEEDED");
            _allowances[from][msg.sender] = currentAllowance - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function setBurnRouter(address newBurnRouter) external onlyOwner {
        address previous = burnRouter;
        burnRouter = newBurnRouter;
        emit BurnRouterUpdated(previous, newBurnRouter);
    }

    /// @notice 仅 BurnRouter 可调：从指定账户（金库）销毁代币
    function burnFromVault(address vaultAccount, uint256 value) external {
        require(msg.sender == burnRouter, "ONLY_BURN_ROUTER");
        _burn(vaultAccount, value);
    }

    /// @notice 仅 BurnRouter 可调：从用户钱包扣款并销毁（实现真正的代币通缩）
    function burnFromUser(address user, uint256 value) external {
        require(msg.sender == burnRouter, "ONLY_BURN_ROUTER");
        require(user != address(0), "BURN_FROM_ZERO");
        _burn(user, value);
    }

    /// @notice 任意地址可燃烧自己的余额（供 AllinGame 等合约：先 transferFrom 到合约再 burn）
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /// @notice 测试用：仅 owner 可铸造
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "FROM_ZERO");
        require(to != address(0), "TO_ZERO");
        require(_balances[from] >= amount, "INSUFFICIENT_BALANCE");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "MINT_TO_ZERO");
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "BURN_FROM_ZERO");
        require(_balances[account] >= amount, "INSUFFICIENT_BALANCE");
        _balances[account] -= amount;
        _totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }
}
