pragma solidity ^0.5.0;

interface IOracle {
    function getData() external returns (uint256, bool);
}
