import { RpcProvider } from "starknet";
const p = new RpcProvider({ nodeUrl: "https://rpc.starknet.lava.build" });
const POOL = "0x2eef0c13b10b487ea5916b54c0a7f98ec43fb3048f60fdeedaf5b08f6f88aaf";
const USDC = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";

const cls = await p.getClassAt(POOL);
const abi = typeof cls.abi === "string" ? JSON.parse(cls.abi) : cls.abi;
const structs = [];
const walk = (x) => { if (Array.isArray(x)) return x.forEach(walk);
  if (x && x.type === "struct") structs.push(x);
  if (x && x.items) walk(x.items); };
walk(abi);
const cfg = structs.find(s => s.name.endsWith("AssetConfig"));
console.log("AssetConfig fields:");
cfg?.members?.forEach((m, i) => console.log(`  ${i}. ${m.name}: ${m.type}`));

const res = await p.callContract({ contractAddress: POOL, entrypoint: "asset_config", calldata: [USDC] });
console.log("\nall", res.length, "felts:");
res.forEach((v, i) => console.log(`  [${i}] ${v}`));
