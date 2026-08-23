// SPDX-License-Identifier: Apache-2.0
//
// Cellar — STRK20 anonymizer contract for private yield.
//
// The STRK20 privacy pool calls `privacy_invoke` on this contract during an
// InvokeExternal action. The full cycle, all inside ONE atomic transaction:
//
//   1. The pool transfers the input tokens to this contract (a plain, public
//      ERC-20 transfer — observers see "the pool paid the helper", never who
//      initiated it).
//   2. The pool calls `privacy_invoke` via the protocol's INVOKE_SELECTOR.
//   3. This contract deposits into (or withdraws from) an ERC-4626 vault.
//   4. This contract APPROVES the pool to pull the output. It must not
//      transfer — the pool executes the pull itself when applying deposits.
//   5. This contract returns `Span<OpenNoteDeposit>` telling the pool which
//      open note to credit, with which token and amount.
//
// Design rules enforced here, per the STRK20 anonymizer anatomy:
//   * Return EXACTLY a Span<OpenNoteDeposit> — trailing data makes the pool
//     reject the call.
//   * Approve, never transfer.
//   * Measure output by BALANCE DELTA, never by the external call's return
//     value. ERC-4626 `deposit` returns a shares figure; we discard it.
//   * One invoke per pool transaction (enforced by the protocol, not here).
//   * u256 vault maths must narrow to a u128 note amount or we revert.
//
// Deliberately absent: events. This contract emits nothing. An event here
// would publish a correlatable trace of an otherwise private action.
//
// Deliberately absent: an owner. The vault allowlist is written once in the
// constructor and has no setter, so a deployed Cellar helper is a fixed,
// auditable route. Nobody — including us — can redirect user funds later.

use starknet::ContractAddress;

/// Instruction returned to the pool: credit `amount` of `token` to `note_id`.
///
/// NOTE: this mirrors `privacy::objects::OpenNoteDeposit` from the
/// starknet-privacy monorepo. Cairo serialisation is structural, so an
/// identical field layout produces identical returndata. Declared locally to
/// keep this crate dependency-free. Verify the layout against the monorepo
/// before mainnet deploy.
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub enum LendingOperation {
    Deposit,
    Withdraw,
}

/// Minimal ERC-20 surface. Only the two functions this helper needs.
#[starknet::interface]
pub trait IERC20<T> {
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
}

/// Minimal ERC-4626 surface (Vesu vTokens, SNIP-22 vaults).
#[starknet::interface]
pub trait IVault<T> {
    fn deposit(ref self: T, assets: u256, receiver: ContractAddress) -> u256;
    fn withdraw(
        ref self: T, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
}

#[starknet::interface]
pub trait IYieldHelper<T> {
    /// The single entrypoint the STRK20 pool calls.
    fn privacy_invoke(
        ref self: T,
        operation: LendingOperation,
        in_token: ContractAddress,
        out_token: ContractAddress,
        assets: u256,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;

    /// Anyone can verify which vaults this helper is permitted to route into.
    fn is_allowed_vault(self: @T, vault: ContractAddress) -> bool;
    fn allowed_vault_count(self: @T) -> u32;
    fn allowed_vault_at(self: @T, index: u32) -> ContractAddress;
}

pub mod errors {
    pub const ZERO_IN_TOKEN: felt252 = 'CLR: in_token is zero';
    pub const ZERO_OUT_TOKEN: felt252 = 'CLR: out_token is zero';
    pub const ZERO_ASSETS: felt252 = 'CLR: assets is zero';
    pub const TOKENS_EQUAL: felt252 = 'CLR: in_token == out_token';
    pub const VAULT_NOT_ALLOWED: felt252 = 'CLR: vault not allowed';
    pub const INSUFFICIENT_BALANCE: felt252 = 'CLR: helper underfunded';
    pub const ZERO_OUT_AMOUNT: felt252 = 'CLR: zero output';
    pub const AMOUNT_OVERFLOW: felt252 = 'CLR: output exceeds u128';
    pub const NO_VAULTS: felt252 = 'CLR: no vaults given';
    pub const ZERO_VAULT: felt252 = 'CLR: vault is zero';
    pub const INDEX_OUT_OF_RANGE: felt252 = 'CLR: index out of range';
}

#[starknet::contract]
pub mod YieldHelper {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{
        IERC20Dispatcher, IERC20DispatcherTrait, IVaultDispatcher, IVaultDispatcherTrait,
        IYieldHelper, LendingOperation, OpenNoteDeposit, errors,
    };

    #[storage]
    struct Storage {
        /// Immutable after construction. No setter exists.
        allowed: Map<ContractAddress, bool>,
        vault_at: Map<u32, ContractAddress>,
        vault_count: u32,
    }

    /// `vaults` pins every ERC-4626 vault this helper may ever route into.
    /// There is no way to add or remove one after deployment.
    #[constructor]
    fn constructor(ref self: ContractState, vaults: Span<ContractAddress>) {
        let len = vaults.len();
        assert(len > 0, errors::NO_VAULTS);

        let mut i: u32 = 0;
        while i < len {
            let vault = *vaults.at(i);
            assert(vault.is_non_zero(), errors::ZERO_VAULT);
            self.allowed.write(vault, true);
            self.vault_at.write(i, vault);
            i += 1;
        }
        self.vault_count.write(len);
    }

    #[abi(embed_v0)]
    pub impl YieldHelperImpl of IYieldHelper<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            operation: LendingOperation,
            in_token: ContractAddress,
            out_token: ContractAddress,
            assets: u256,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            assert(in_token.is_non_zero(), errors::ZERO_IN_TOKEN);
            assert(out_token.is_non_zero(), errors::ZERO_OUT_TOKEN);
            assert(assets.is_non_zero(), errors::ZERO_ASSETS);
            assert(in_token != out_token, errors::TOKENS_EQUAL);

            // In an ERC-4626 round trip the vault IS the share token, so the
            // vault sits on whichever side holds shares:
            //   Deposit  — underlying in,  shares out  => vault is out_token
            //   Withdraw — shares in,      underlying out => vault is in_token
            let vault_address = match operation {
                LendingOperation::Deposit => out_token,
                LendingOperation::Withdraw => in_token,
            };
            assert(self.allowed.read(vault_address), errors::VAULT_NOT_ALLOWED);

            let self_addr = get_contract_address();
            // The pool is our caller. It is the only party we approve.
            let pool_addr = get_caller_address();

            let in_erc20 = IERC20Dispatcher { contract_address: in_token };
            let out_erc20 = IERC20Dispatcher { contract_address: out_token };

            // The pool transferred the inputs to us in step 1. Confirm they
            // arrived before touching an external protocol.
            assert(in_erc20.balance_of(self_addr) >= assets, errors::INSUFFICIENT_BALANCE);

            let balance_before = out_erc20.balance_of(self_addr);

            match operation {
                LendingOperation::Deposit => {
                    // Approve the vault to pull the underlying, then deposit.
                    in_erc20.approve(vault_address, assets);
                    IVaultDispatcher { contract_address: vault_address }
                        .deposit(assets, self_addr);
                },
                LendingOperation::Withdraw => {
                    // We are both receiver and owner of the shares.
                    IVaultDispatcher { contract_address: vault_address }
                        .withdraw(assets, self_addr, self_addr);
                },
            }

            let balance_after = out_erc20.balance_of(self_addr);

            // Trust the delta, never the vault's reported return value.
            let delta: u256 = balance_after - balance_before;
            let out_amount: u128 = delta.try_into().expect(errors::AMOUNT_OVERFLOW);
            assert(out_amount.is_non_zero(), errors::ZERO_OUT_AMOUNT);

            // Approve — do NOT transfer. The pool pulls when it applies deposits.
            out_erc20.approve(pool_addr, delta);

            [OpenNoteDeposit { note_id, token: out_token, amount: out_amount }].span()
        }

        fn is_allowed_vault(self: @ContractState, vault: ContractAddress) -> bool {
            self.allowed.read(vault)
        }

        fn allowed_vault_count(self: @ContractState) -> u32 {
            self.vault_count.read()
        }

        fn allowed_vault_at(self: @ContractState, index: u32) -> ContractAddress {
            assert(index < self.vault_count.read(), errors::INDEX_OUT_OF_RANGE);
            self.vault_at.read(index)
        }
    }
}
