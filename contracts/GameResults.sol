// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GameResults {
    struct Stats {
        uint256 wins;
        uint256 losses;
        uint256 gamesPlayed;
    }

    mapping(address => Stats) public playerStats;

    event GameRecorded(
        address indexed player,
        bool won,
        uint256 heroHpLeft,
        uint256 bossHpLeft,
        uint256 timestamp
    );

    function recordGame(
        address player,
        bool won,
        uint256 heroHpLeft,
        uint256 bossHpLeft
    ) external {
        Stats storage s = playerStats[player];
        s.gamesPlayed++;
        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        emit GameRecorded(player, won, heroHpLeft, bossHpLeft, block.timestamp);
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
