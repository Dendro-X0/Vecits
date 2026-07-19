#!/usr/bin/env node
/**
 * R9-H1 — unit checks for LAN / local-operator host classification (R9-G3 helper).
 */

import assert from "node:assert/strict";
import {
  isLocalOperatorNodeUrl,
  isPrivateOrLocalHostname,
  parseNodeHost,
  tryParseAbsoluteNodeJoinUrl
} from "../apps/web/lib/halo/local-operator-node.ts";

const localHosts = [
  "127.0.0.1",
  "localhost",
  "192.168.1.10",
  "10.0.0.5",
  "172.16.4.2",
  "market.local",
  "[::1]",
  "fd12::1"
];

for (const host of localHosts) {
  assert.equal(isPrivateOrLocalHostname(host.replace(/^\[|\]$/g, "")), true, host);
}

assert.equal(isPrivateOrLocalHostname("example.com"), false);
assert.equal(isPrivateOrLocalHostname("8.8.8.8"), false);
assert.equal(isPrivateOrLocalHostname("172.32.0.1"), false);

assert.equal(parseNodeHost("http://192.168.0.4:7878").class, "local-operator");
assert.equal(parseNodeHost("https://node.example.com").class, "public");
assert.equal(parseNodeHost("/api/node").class, "relative");
assert.equal(isLocalOperatorNodeUrl("http://10.0.0.2:7878/"), true);

assert.equal(tryParseAbsoluteNodeJoinUrl("http://192.168.1.5:7878"), "http://192.168.1.5:7878");
assert.equal(tryParseAbsoluteNodeJoinUrl('{"v":1}'), null);
assert.equal(tryParseAbsoluteNodeJoinUrl("not-a-url"), null);

console.log("R9-H1 halo join unit checks passed (R9-G3 helper).");
