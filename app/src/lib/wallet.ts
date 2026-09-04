// SPDX-License-Identifier: Apache-2.0
//
// Wallet discovery and connection.
//
// We deliberately do NOT use get-starknet-core. It pins @starknet-io/types-js
// 0.7.x while starknet.js 10.7's Wallet Standard adapter pins 0.10.x, and the
// two StarknetWindowObject types are then nominally incompatible even though
// they describe the same object. Since all get-starknet-core contributed here
// was scanning `window` for `starknet_*` keys, we do that ourselves and skip
// the dependency conflict entirely.
//
// Privacy is mainnet-only and only some wallets implement the STRK20 Wallet
// API. MAINNET-DAY-0.md names Ready and Braavos; other STRK20 pages name Ready
// and Xverse. Ready is on both lists, so it is the primary target — but rather
// than trusting either list we probe the connected account for the STRK20
// methods and report what is actually there.

import { WalletAccountV6 } from "starknet";
import { NETWORKS, rpc, setNetwork, type Network } from "./strk20";

/** The minimum surface we need from an injected wallet to discover + connect. */
type InjectedWallet = {
  id: string;
  name?: string;
  icon?: string | { light: string; dark: string };
  version?: string;
  request: (call: { type: string; params?: unknown }) => Promise<unknown>;
};

declare global {
  interface Window {
    [key: `starknet_${string}`]: InjectedWallet | undefined;
  }
}

export type DiscoveredWallet = {
  id: string;
  name: string;
  icon?: string;
  obj: InjectedWallet;
};

/** Wallets injected into this browser, whether or not they support STRK20. */
export function discover(): DiscoveredWallet[] {
  if (typeof window === "undefined") return [];

  const seen = new Set<string>();
  const out: DiscoveredWallet[] = [];

  for (const key of Object.keys(window)) {
    if (!key.startsWith("starknet_")) continue;
    const w = window[key as `starknet_${string}`];
    if (!w || typeof w.request !== "function") continue;
    const id = w.id ?? key.slice("starknet_".length);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: w.name ?? id,
      icon: typeof w.icon === "string" ? w.icon : w.icon?.light,
      obj: w,
    });
  }
  return out;
}

/**
 * Does this wallet actually implement the STRK20 Wallet API? Probed at
 * runtime rather than assumed, because the official sources disagree about
 * which wallets qualify.
 */
export function supportsStrk20(account: WalletAccountV6): boolean {
  return (
    typeof (account as unknown as Record<string, unknown>).strk20InvokeTransaction ===
    "function"
  );
}

export type Connection = {
  account: WalletAccountV6;
  address: string;
  chainId: string;
  network: Network;
  strk20: boolean;
};

export async function connect(wallet: DiscoveredWallet): Promise<Connection> {
  const w = wallet.obj;

  await w.request({ type: "wallet_requestAccounts" });
  const chainId = (await w.request({ type: "wallet_requestChainId" })) as string;

  // Follow the wallet rather than forcing a chain. Everything downstream — the
  // pool address, token list, RPC and explorer — comes from this one lookup, so
  // the app can never show one chain's addresses while signing on another.
  const net = setNetwork(chainId);
  if (!net) {
    const supported = Object.values(NETWORKS)
      .map((n) => n.name)
      .join(" or ");
    throw new Error(
      `${wallet.name} is on an unsupported chain (${chainId}). Switch it to ${supported}.`,
    );
  }

  // starknet.js speaks Wallet Standard; browsers inject the legacy object.
  // StarknetInjectedWallet is the official adapter between the two. The cast
  // is the one place the two types-js copies meet — the runtime object is the
  // same, only the nominal type differs.
  const { StarknetInjectedWallet } = await import(
    "@starknet-io/get-starknet-wallet-standard-v6"
  );
  const standard = new StarknetInjectedWallet(w as never);
  const account = await WalletAccountV6.connect(rpc(net), standard);

  return {
    account,
    address: account.address,
    chainId,
    network: net,
    strk20: supportsStrk20(account),
  };
}

export function short(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}
