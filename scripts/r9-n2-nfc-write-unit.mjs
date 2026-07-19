#!/usr/bin/env node
/**
 * R9-N2 — unit checks for NFC write encoding (R9-G2 helper).
 */

import assert from "node:assert/strict";
import {
  decodeNdefTextPayload,
  encodeNdefTextPayload,
  encodeVectisTransportMimeRecord,
  extractTransportTextFromNdefRecords,
  VECTIS_TRANSPORT_MIME
} from "../apps/web/lib/transport/nfc-payload.ts";

const sample =
  '{"v":1,"kind":"vectis.transport.v1","type":"vouch.request","createdAt":"2026-07-18T00:00:00.000Z","expiresAt":"2026-07-19T00:00:00.000Z","nodeUrl":"http://192.168.1.10:7878","payload":{"subjectPubKey":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}';

const textPayload = encodeNdefTextPayload(sample);
assert.equal(decodeNdefTextPayload(textPayload), sample);

const mime = encodeVectisTransportMimeRecord(sample);
assert.equal(Buffer.from(mime.kind).toString("utf8"), VECTIS_TRANSPORT_MIME);
assert.equal(Buffer.from(mime.payload).toString("utf8"), sample);

const roundTrip = extractTransportTextFromNdefRecords([
  { tnf: mime.tnf, kind: mime.kind, payload: mime.payload }
]);
assert.equal(roundTrip, sample);

console.log("R9-N2 NFC write unit checks passed (R9-G2 helper).");
