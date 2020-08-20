pragma solidity 0.5.17;

import "./Mock.sol";


contract MockUFragmentsPolicy is Mock {
    
    function rebase() external {
        emit FunctionCalled("UFragmentsPolicy", "rebase", msg.sender);
    }
}
