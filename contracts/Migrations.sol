pragma solidity ^0.5.17;

contract Migrations {
    address public owner;

    // A function with the signature `last_completed_migration()`, returning a uint, is required.
    uint public last_completed_migration;
    mapping (uint256 => address) public stored_addresses;


    modifier restricted() {
        require(msg.sender == owner, 'sender must be owner');
        _;
    }


    constructor()
        public
    {
        owner = msg.sender;
    }


    function setAddress(uint256 key, address value)
        restricted
        public
    {
        require(stored_addresses[key] == address(0x0), 'key must not already have a value');
        stored_addresses[key] = value;
    }
    function getAddress(uint256 key)
        public
        view
        returns (address)
    {
        require(stored_addresses[key] != address(0x0), 'key must be associated with a value');
        return stored_addresses[key];
    }


    // A function with the signature `setCompleted(uint)` is required.
    function setCompleted(uint completed)
        restricted
        public
    {
        last_completed_migration = completed;
    }


    function upgrade(address new_address)
        restricted
        public
    {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}