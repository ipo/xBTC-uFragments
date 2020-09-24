pragma solidity 0.5.17;


interface IOracle {
    function getData() external returns (uint256, bool);
    function pushReport(uint256 payload) external;
}
