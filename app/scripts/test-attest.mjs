// Round-trip test for the attestation plumbing. No wallet needed.
import { typedData as td, ec } from "starknet";

const CHAIN_ID = "SN_MAIN";
const STATEMENT = "shielded balance >= threshold";

function buildTypedData(c) {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      Attestation: [
        { name: "statement", type: "shortstring" },
        { name: "token", type: "ContractAddress" },
        { name: "threshold", type: "u128" },
        { name: "block", type: "u128" },
        { name: "issuedAt", type: "u128" },
        { name: "expiresAt", type: "u128" },
        { name: "nonce", type: "felt" },
      ],
    },
    primaryType: "Attestation",
    domain: { name: "Cellar", version: "1", chainId: CHAIN_ID, revision: "1" },
    message: {
      statement: STATEMENT,
      token: c.token, threshold: c.threshold, block: c.block,
      issuedAt: c.issuedAt, expiresAt: c.expiresAt, nonce: c.nonce,
    },
  };
}

const claim = {
  account: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  token: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  threshold: "100000000", block: "1234567",
  issuedAt: "1756000000", expiresAt: "1756086400",
  nonce: "0xdeadbeef",
};

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { console.log("  PASS", name); pass++; } else { console.log("  FAIL", name); fail++; } };

console.log("SNIP-12 hashing");
const h1 = td.getMessageHash(buildTypedData(claim), claim.account);
const h2 = td.getMessageHash(buildTypedData(claim), claim.account);
ok("hash is deterministic", h1 === h2);
ok("hash is a felt", /^0x[0-9a-f]+$/i.test(h1));

const tampered = { ...claim, threshold: "100000001" };
ok("one-unit threshold change alters the hash",
   td.getMessageHash(buildTypedData(tampered), claim.account) !== h1);
ok("different account alters the hash",
   td.getMessageHash(buildTypedData(claim), "0x999") !== h1);

console.log("\nsignature verification (local keypair)");
const priv = "0x1234567890987654321";
const pub = ec.starkCurve.getPublicKey(priv); // full 65-byte key; getStarkKey is x-only and will not verify
const sig = ec.starkCurve.sign(h1, priv);
ok("valid signature verifies", ec.starkCurve.verify(sig, h1, pub));
ok("signature rejected against a tampered hash",
   !ec.starkCurve.verify(sig, td.getMessageHash(buildTypedData(tampered), claim.account), pub));

console.log("\nencoding");
const encode = (a) => {
  const bytes = new TextEncoder().encode(JSON.stringify(a));
  let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
  return Buffer.from(bin, "binary").toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const decode = (s) => {
  const b64 = s.replace(/-/g,"+").replace(/_/g,"/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
};
const att = { claim, signature: [sig.r.toString(), sig.s.toString()] };
const enc = encode(att);
ok("encoded is URL-safe", !/[+/=]/.test(enc));
const dec = decode(enc);
ok("round-trips exactly", JSON.stringify(dec) === JSON.stringify(att));
ok("decoded hash matches original", td.getMessageHash(buildTypedData(dec.claim), dec.claim.account) === h1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
