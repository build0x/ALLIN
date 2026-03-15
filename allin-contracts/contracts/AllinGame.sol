// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract AllinGame {
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    IERC20 public immutable token;
    address public owner;

    uint256 public tournamentFee = 100000 * 1e18;
    uint256 public roomCreationFee = 10000 * 1e18;

    event TournamentRegistered(address indexed user, uint256 fee);
    event RoomCreated(address indexed user, uint256 fee);

    constructor(address tokenAddress) {
        token = IERC20(tokenAddress);
        owner = msg.sender;
    }

    function registerTournament() external {
        require(token.transferFrom(msg.sender, DEAD, tournamentFee), "TRANSFER_FAILED");
        emit TournamentRegistered(msg.sender, tournamentFee);
    }

    function createRoom() external {
        require(token.transferFrom(msg.sender, DEAD, roomCreationFee), "TRANSFER_FAILED");
        emit RoomCreated(msg.sender, roomCreationFee);
    }

    function setFees(uint256 _tournamentFee, uint256 _roomFee) external {
        require(msg.sender == owner, "ONLY_OWNER");
        tournamentFee = _tournamentFee;
        roomCreationFee = _roomFee;
    }
}
