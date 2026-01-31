// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GameResults {
    struct Stats {
        uint256 wins;
        uint256 losses;
        uint256 gamesPlayed;
    }

    mapping(address => Stats) public playerStats;
    mapping(address => uint256) public balances;

    address public operator;
    uint256 public gameFee = 0.01 ether;

    event GameRecorded(
        address indexed player,
        bool won,
        uint256 heroHpLeft,
        uint256 bossHpLeft,
        uint256 timestamp
    );
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    constructor() {
        operator = msg.sender;
    }

    function deposit() external payable {
        require(msg.value > 0, "Must send value");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "No balance");
        balances[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, bal);
    }

    function recordGame(
        address player,
        bool won,
        uint256 heroHpLeft,
        uint256 bossHpLeft
    ) external onlyOperator {
        require(balances[player] >= gameFee, "Insufficient balance");
        balances[player] -= gameFee;

        Stats storage s = playerStats[player];
        s.gamesPlayed++;
        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        emit GameRecorded(player, won, heroHpLeft, bossHpLeft, block.timestamp);
    }

    function getBalance(address player) external view returns (uint256) {
        return balances[player];
    }

    function getPlayerStats(address player)
        external
        view
        returns (uint256 wins, uint256 losses, uint256 gamesPlayed)
    {
        Stats storage s = playerStats[player];
        return (s.wins, s.losses, s.gamesPlayed);
    }
}
