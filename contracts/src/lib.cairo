// SPDX-License-Identifier: Apache-2.0
//
// Cellar — a private yield account built on the STRK20 privacy pool.
//
//   yield_helper — the anonymizer contract the pool calls. This is the
//                  contract that goes to mainnet.
//   mocks        — ERC-20 and ERC-4626 test doubles, so the full round trip
//                  can be exercised on Sepolia without a live Vesu market.

pub mod yield_helper;

// Test doubles. Always compiled so `TEST_CLASS_HASH` is available to the test
// module, but never deployed to mainnet — only YieldHelper is.
pub mod mocks;

#[cfg(test)]
mod tests;
