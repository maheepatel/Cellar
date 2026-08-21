// SPDX-License-Identifier: Apache-2.0
//
// The helper is only ever called by the STRK20 pool, so every test stands in
// for the pool: it funds the helper the way the pool's step-1 transfer does,
// then calls `privacy_invoke` as the pool would, then asserts the two things
// the pool actually relies on — the returned OpenNoteDeposit, and the approval
// that lets the pool pull the output.
//
// Run with:  scarb cairo-test

use starknet::syscalls::deploy_syscall;
use starknet::testing::set_contract_address;
use starknet::{ClassHash, ContractAddress, SyscallResultTrait};

use crate::mocks::{
    IMockERC20Dispatcher, IMockERC20DispatcherTrait, IMockVaultDispatcher,
    IMockVaultDispatcherTrait, MockERC20, MockVault,
};
use crate::yield_helper::{
    IYieldHelperDispatcher, IYieldHelperDispatcherTrait, LendingOperation, YieldHelper,
};

const ONE_TOKEN: u256 = 1_000_000_000_000_000_000;
const NOTE_ID: felt252 = 0x1234;

/// Stands in for the STRK20 privacy pool — the helper's only real caller.
fn pool() -> ContractAddress {
    0xF00.try_into().unwrap()
}

fn deploy(class_hash: ClassHash, calldata: Array<felt252>) -> ContractAddress {
    let (addr, _) = deploy_syscall(class_hash, 0, calldata.span(), false).unwrap_syscall();
    addr
}

/// Underlying ERC-20, an ERC-4626 vault over it, and the helper with that
/// vault — and only that vault — allowlisted.
fn setup() -> (IMockERC20Dispatcher, IMockVaultDispatcher, IYieldHelperDispatcher) {
    let asset = deploy(MockERC20::TEST_CLASS_HASH, array![]);
    let vault = deploy(MockVault::TEST_CLASS_HASH, array![asset.into()]);
    // Span<ContractAddress> serialises length-first.
    let helper = deploy(YieldHelper::TEST_CLASS_HASH, array![1, vault.into()]);

    (
        IMockERC20Dispatcher { contract_address: asset },
        IMockVaultDispatcher { contract_address: vault },
        IYieldHelperDispatcher { contract_address: helper },
    )
}

/// Imitates the pool's step 1: the input tokens arrive in the helper.
fn fund(asset: IMockERC20Dispatcher, who: ContractAddress, amount: u256) {
    asset.mint(who, amount);
}

/// Makes the next dispatcher call arrive with `pool()` as its caller.
fn act_as_pool() {
    set_contract_address(pool());
}

#[test]
fn deposit_credits_a_note_for_the_shares_received() {
    let (asset, vault, helper) = setup();
    fund(asset, helper.contract_address, ONE_TOKEN);

    act_as_pool();
    let deposits = helper
        .privacy_invoke(
            LendingOperation::Deposit,
            asset.contract_address,
            vault.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );

    assert(deposits.len() == 1, 'want exactly one deposit');
    let d = *deposits.at(0);
    assert(d.note_id == NOTE_ID, 'note_id echoed unchanged');
    assert(d.token == vault.contract_address, 'credit the share token');
    let expected: u128 = ONE_TOKEN.try_into().unwrap();
    assert(d.amount == expected, 'amount == shares minted');
}

#[test]
fn deposit_approves_the_pool_rather_than_transferring() {
    let (asset, vault, helper) = setup();
    fund(asset, helper.contract_address, ONE_TOKEN);

    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit,
            asset.contract_address,
            vault.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );

    // The pool pulls; the helper must never push.
    assert(vault.allowance(helper.contract_address, pool()) == ONE_TOKEN, 'pool approved in full');
    assert(vault.balance_of(helper.contract_address) == ONE_TOKEN, 'shares await the pull');
}

#[test]
fn withdraw_returns_the_underlying() {
    let (asset, vault, helper) = setup();
    fund(asset, helper.contract_address, ONE_TOKEN);

    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit,
            asset.contract_address,
            vault.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );

    act_as_pool();
    let deposits = helper
        .privacy_invoke(
            LendingOperation::Withdraw,
            vault.contract_address,
            asset.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );

    let d = *deposits.at(0);
    assert(d.token == asset.contract_address, 'credit the underlying');
    let expected: u128 = ONE_TOKEN.try_into().unwrap();
    assert(d.amount == expected, 'underlying matches request');
}

#[test]
fn accrued_yield_leaves_shares_over_after_a_round_trip() {
    let (asset, vault, helper) = setup();
    fund(asset, helper.contract_address, ONE_TOKEN);

    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit,
            asset.contract_address,
            vault.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );

    // 10% interest accrues, so each share is now worth more underlying and
    // withdrawing the original principal burns fewer shares than were minted.
    vault.simulate_yield_bps(1000);

    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Withdraw,
            vault.contract_address,
            asset.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );

    // Leftover shares are the yield — the whole point of the product.
    assert(vault.balance_of(helper.contract_address) > 0, 'yield remains as shares');
}

#[test]
#[should_panic(expected: ('SB: vault not allowed', 'ENTRYPOINT_FAILED'))]
fn rejects_a_vault_outside_the_allowlist() {
    let (asset, _vault, helper) = setup();
    fund(asset, helper.contract_address, ONE_TOKEN);
    let rogue: ContractAddress = 0xBAD.try_into().unwrap();

    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit, asset.contract_address, rogue, ONE_TOKEN, NOTE_ID,
        );
}

#[test]
#[should_panic(expected: ('SB: assets is zero', 'ENTRYPOINT_FAILED'))]
fn rejects_zero_assets() {
    let (asset, vault, helper) = setup();
    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit, asset.contract_address, vault.contract_address, 0, NOTE_ID,
        );
}

#[test]
#[should_panic(expected: ('SB: in_token == out_token', 'ENTRYPOINT_FAILED'))]
fn rejects_identical_tokens() {
    let (asset, _vault, helper) = setup();
    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit,
            asset.contract_address,
            asset.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );
}

#[test]
#[should_panic(expected: ('SB: helper underfunded', 'ENTRYPOINT_FAILED'))]
fn rejects_when_the_pool_did_not_send_the_inputs() {
    let (asset, vault, helper) = setup();
    // deliberately unfunded
    act_as_pool();
    helper
        .privacy_invoke(
            LendingOperation::Deposit,
            asset.contract_address,
            vault.contract_address,
            ONE_TOKEN,
            NOTE_ID,
        );
}

#[test]
fn allowlist_is_publicly_verifiable() {
    let (_asset, vault, helper) = setup();
    assert(helper.allowed_vault_count() == 1, 'one vault pinned');
    assert(helper.allowed_vault_at(0) == vault.contract_address, 'pinned vault readable');
    assert(helper.is_allowed_vault(vault.contract_address), 'pinned vault allowed');
    let rogue: ContractAddress = 0xBAD.try_into().unwrap();
    assert(!helper.is_allowed_vault(rogue), 'unknown vault rejected');
}
