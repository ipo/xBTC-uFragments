pragma solidity 0.5.17;

import "./MedianOracle.sol";


interface ITellor {
    /**
    * @dev Gets the a value for the latest timestamp available
    * @return value for timestamp of last proof of work submited
    * @return true if the is a timestamp for the lastNewValue
    */
    function getLastNewValueById(uint256 id) external view returns(uint, bool);
}


contract TellorToMedianOracle is OpenZeppelinUpgradesOwnable, Initializable {
    using SafeMath for uint256;

    ITellor public tellor;
    MedianOracle public medianOracle;
    
    uint256 public tellorDecimals;
    uint256 public tellorId;

    event ProviderAdded(address provider);
    event ProviderRemoved(address provider);

    // Addresses of providers authorized to push reports.
    mapping(address => bool) public providers;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyProviders() {
        require(providers[msg.sender]);
        _;
    }

    /**
    * @notice Fetches value from Tellor, translates it and updates the MedianOracle.
    */
    function update()
        external
        onlyProviders
    {
        // get the value
        uint value;
        bool isValid;
        (value, isValid) = tellor.getLastNewValueById(tellorId);
        require(isValid);

        // translate the value to 18 decimals
        uint256 result = uint256(value).mul(10**(18 - tellorDecimals));

        // submit the value to the oracle
        medianOracle.pushReport(result);
    }

    /**
     * @notice Authorizes a provider.
     * @param provider Address of the provider.
     */
    function addProvider(address provider)
        external
        onlyOwner
    {
        if (!providers[provider]) {
            providers[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    /**
     * @notice Revokes provider authorization.
     * @param provider Address of the provider.
     */
    function removeProvider(address provider)
        external
        onlyOwner
    {
        if (providers[provider]) {
            providers[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function initialize(
            address owner_,
            ITellor tellor_,
            MedianOracle medianOracle_,
            uint256 tellorDecimals_,
            uint256 tellorId_
        )
        public
        initializer
    {
        OpenZeppelinUpgradesOwnable._transferOwnership(owner_);

        require(tellorDecimals_ <= 18);
        tellor = tellor_;
        medianOracle = medianOracle_;
        tellorDecimals = tellorDecimals_;
        tellorId = tellorId_;
    }
}
