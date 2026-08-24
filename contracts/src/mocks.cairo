// SPDX-License-Identifier: Apache-2.0
//
// Test doubles. NOT for mainnet.
//
// Why these exist: Vesu may not be deployed on Starknet Sepolia, which would
// leave us unable to exercise the full pool -> helper -> vault -> note cycle
// before touching mainnet. The helper only ever calls `deposit`, `withdraw`,
// `balance_of` and `approve`, so a minimal ERC-4626 stand-in is
// indistinguishable from the real thing as far as our contract is concerned.
// Test against MockVault on Sepolia, then pass the real Vesu vToken address to
// the constructor on mainnet.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockERC20<T> {
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn allowance(self: @T, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn mint(ref self: T, to: ContractAddress, amount: u256);
    fn total_supply(self: @T) -> u256;
}

#[starknet::interface]
pub trait IMockVault<T> {
    // ERC-4626 surface the helper uses.
    fn deposit(ref self: T, assets: u256, receiver: ContractAddress) -> u256;
    fn withdraw(
        ref self: T, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    fn preview_deposit(self: @T, assets: u256) -> u256;
    fn preview_withdraw(self: @T, assets: u256) -> u256;
    // The vault is itself the share token.
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn allowance(self: @T, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn asset(self: @T) -> ContractAddress;
    /// Test-only: inflate share value so a round trip returns more than it put
    /// in, the way real accrued interest would.
    fn simulate_yield_bps(ref self: T, bps: u256);
}

/// Bare-bones ERC-20 used as the underlying asset in tests.
#[starknet::contract]
pub mod MockERC20 {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use super::IMockERC20;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
    }

    #[abi(embed_v0)]
    impl MockERC20Impl of IMockERC20<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            self.allowances.write((get_caller_address(), spender), amount);
            true
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let from = get_caller_address();
            let bal = self.balances.read(from);
            assert(bal >= amount, 'MockERC20: insufficient');
            self.balances.write(from, bal - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let spender = get_caller_address();
            let allowed = self.allowances.read((sender, spender));
            assert(allowed >= amount, 'MockERC20: not allowed');
            let bal = self.balances.read(sender);
            assert(bal >= amount, 'MockERC20: insufficient');
            self.allowances.write((sender, spender), allowed - amount);
            self.balances.write(sender, bal - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            true
        }

        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.balances.write(to, self.balances.read(to) + amount);
            self.total_supply.write(self.total_supply.read() + amount);
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }
    }
}

/// Minimal ERC-4626-shaped vault. Shares are priced off a rate that starts at
/// 1:1 and can be inflated to imitate accrued yield.
#[starknet::contract]
pub mod MockVault {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{IMockERC20Dispatcher, IMockERC20DispatcherTrait, IMockVault};

    const ONE: u256 = 1_000_000_000_000_000_000; // 1e18

    #[storage]
    struct Storage {
        asset: ContractAddress,
        shares: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        /// assets-per-share, scaled by 1e18. Rises as "yield" accrues.
        rate: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, asset: ContractAddress) {
        self.asset.write(asset);
        self.rate.write(ONE);
    }

    #[abi(embed_v0)]
    impl MockVaultImpl of IMockVault<ContractState> {
        fn deposit(ref self: ContractState, assets: u256, receiver: ContractAddress) -> u256 {
            let caller = get_caller_address();
            // Pull the underlying, exactly as a real ERC-4626 vault does.
            IMockERC20Dispatcher { contract_address: self.asset.read() }
                .transfer_from(caller, get_contract_address(), assets);

            let minted = assets * ONE / self.rate.read();
            self.shares.write(receiver, self.shares.read(receiver) + minted);
            minted
        }

        fn withdraw(
            ref self: ContractState,
            assets: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            let burned = assets * ONE / self.rate.read();
            let held = self.shares.read(owner);
            assert(held >= burned, 'MockVault: insufficient shares');
            self.shares.write(owner, held - burned);

            IMockERC20Dispatcher { contract_address: self.asset.read() }
                .transfer(receiver, assets);
            burned
        }

        /// Both directions convert at the same rate, so the quote is exact for
        /// the mock. A real vault may round against you.
        fn preview_deposit(self: @ContractState, assets: u256) -> u256 {
            assets * ONE / self.rate.read()
        }

        fn preview_withdraw(self: @ContractState, assets: u256) -> u256 {
            assets * ONE / self.rate.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.shares.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            self.allowances.write((get_caller_address(), spender), amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let spender = get_caller_address();
            let allowed = self.allowances.read((sender, spender));
            assert(allowed >= amount, 'MockVault: not allowed');
            let held = self.shares.read(sender);
            assert(held >= amount, 'MockVault: insufficient');
            self.allowances.write((sender, spender), allowed - amount);
            self.shares.write(sender, held - amount);
            self.shares.write(recipient, self.shares.read(recipient) + amount);
            true
        }

        fn asset(self: @ContractState) -> ContractAddress {
            self.asset.read()
        }

        fn simulate_yield_bps(ref self: ContractState, bps: u256) {
            let r = self.rate.read();
            self.rate.write(r + (r * bps / 10_000));
        }
    }
}
