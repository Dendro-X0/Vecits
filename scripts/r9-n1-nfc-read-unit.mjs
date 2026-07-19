#!/usr/bin/env node
/**
 * R9-N1 — unit checks for NDEF → transport text decode (R9-G1 helper).
 */

import assert from "node:assert/strict";
import {
  decodeNdefTextPayload,
  decodeNdefUriPayload,
  extractTransportTextFromNdefRecords,
  NFC_TNF,
  VECTIS_TRANSPORT_MIME
} from "../apps/web/lib/transport/nfc-payload.ts";

function encodeTextRecord(text, language = "en") {
  const langBytes = Array.from(Buffer.from(language, "utf8"));
  const textBytes = Array.from(Buffer.from(text, "utf8"));
  return [langBytes.length, ...langBytes, ...textBytes];
}

const sampleBundle =
  '{"v":1,"kind":"vectis.transport.v1","type":"vouch.request","createdAt":"2026-07-18T00:00:00.000Z","expiresAt":"2026-07-19T00:00:00.000Z","nodeUrl":"http://192.168.1.10:7878","payload":{"subjectPubKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}';

const textPayload = encodeTextRecord(sampleBundle);
assert.equal(decodeNdefTextPayload(textPayload), sampleBundle);

assert.equal(decodeNdefUriPayload([0x04, ...Buffer.from("example.com/join")]), "https://example.com/join");

const fromText = extractTransportTextFromNdefRecords([
  {
    tnf: NFC_TNF.NfcWellKnown,
    kind: [0x54],
    payload: textPayload
  }
]);
assert.equal(fromText, sampleBundle);

const mimeKind = Array.from(Buffer.from(VECTIS_TRANSPORT_MIME, "utf8"));
const fromMime = extractTransportTextFromNdefRecords([
  {
    tnf: NFC_TNF.Media,
    kind: mimeKind,
    payload: Array.from(Buffer.from(sampleBundle, "utf8"))
  }
]);
assert.equal(fromMime, sampleBundle);

const fromJoinUrl = extractTransportTextFromNdefRecords([
  {
    tnf: NFC_TNF.NfcWellKnown,
    kind: [0x55],
    payload: [0x03, ...Buffer.from("192.168.1.5:7878")]
  }
]);
assert.equal(fromJoinUrl, "http://192.168.1.5:7878");

assert.throws(() => extractTransportTextFromNdefRecords([]));

console.log("R9-N1 NFC read unit checks passed (R9-G1 helper).");
