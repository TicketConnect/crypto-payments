#!/usr/bin/env node
// Mines a CREATE3 vanity salt using proper Keccak-256.
//
// Usage: node script/mine.mjs [prefix]

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { keccak_256 } = require("@noble/hashes/sha3.js");

const FACTORY = "0xDc83FD2a9567c8B2e7Efd2328580c824ad0ab62D";
const DEPLOYER = "0x7664Cb8305a9c62F93E4886F53027f4debeE6EbB";
const PREFIX = (process.argv[2] || "33333").toLowerCase();

const PROXY_INITCODE_HASH = Buffer.from(
  "21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f", "hex"
);

function keccak256(data) {
  return Buffer.from(keccak_256(data));
}

function predictCreate3(guardedSalt) {
  // CREATE2 proxy address
  const create2Input = Buffer.concat([
    Buffer.from([0xff]),
    Buffer.from(FACTORY.slice(2), "hex"),
    guardedSalt,
    PROXY_INITCODE_HASH,
  ]);
  const proxy = keccak256(create2Input).subarray(12);

  // CREATE address from proxy with nonce=1: RLP = d6 94 <proxy> 01
  const rlp = Buffer.concat([
    Buffer.from([0xd6, 0x94]),
    proxy,
    Buffer.from([0x01]),
  ]);
  return keccak256(rlp).subarray(12);
}

// Verify against known deployment first
const verifySalt = Buffer.alloc(32);
verifySalt.writeUInt32BE(0x04a3daa9, 28); // old salt that produced 0x888BD0...
const deployerBuf = Buffer.from(DEPLOYER.slice(2), "hex");
const verifyGuarded = keccak256(Buffer.concat([deployerBuf, verifySalt]));
const verifyAddr = predictCreate3(verifyGuarded);
console.log(`Sanity check (old salt): 0x${verifyAddr.toString("hex")}`);

console.log(`Mining for prefix 0x${PREFIX}...`);
console.log(`Factory: ${FACTORY}`);
console.log(`Deployer: ${DEPLOYER}`);
console.log("");

const prefixBuf = Buffer.from(PREFIX, "hex");
const prefixLen = prefixBuf.length;
const oddPrefix = PREFIX.length % 2 !== 0;
const lastNibble = oddPrefix ? parseInt(PREFIX[PREFIX.length - 1], 16) : 0;

const start = Date.now();
let found = 0;

for (let i = 0; i < 100_000_000; i++) {
  const saltBuf = Buffer.alloc(32);
  saltBuf.writeUInt32BE(i >>> 0, 28);
  if (i > 0xFFFFFFFF) saltBuf.writeUInt32BE((i / 0x100000000) >>> 0, 24);

  const guardedSalt = keccak256(Buffer.concat([deployerBuf, saltBuf]));
  const addr = predictCreate3(guardedSalt);

  let match = true;
  for (let j = 0; j < prefixLen; j++) {
    if (addr[j] !== prefixBuf[j]) { match = false; break; }
  }
  if (match && oddPrefix) {
    if ((addr[prefixLen] >> 4) !== lastNibble) match = false;
  }

  if (match) {
    found++;
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`Found #${found} in ${elapsed}s (attempt ${i.toLocaleString()}):`);
    console.log(`  salt:    0x${saltBuf.toString("hex")}`);
    console.log(`  address: 0x${addr.toString("hex")}`);
    console.log("");
    if (found >= 3) process.exit(0);
  }

  if (i > 0 && i % 1_000_000 === 0) {
    const rate = (i / ((Date.now() - start) / 1000)).toFixed(0);
    process.stdout.write(`  ... ${(i / 1e6).toFixed(0)}M checked (${rate}/s)\r`);
  }
}

if (!found) console.log("No matches found.");
