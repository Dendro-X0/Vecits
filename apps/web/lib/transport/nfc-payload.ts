/**
 * Decode NDEF TagRecords into transport/join text for R9-N1.
 * Pure helpers — no Tauri imports (unit-testable on desktop CI).
 */

export const VECTIS_TRANSPORT_MIME = "application/vnd.vectis.transport.v1+json";

export type NdefTagRecordLike = {
  tnf: number;
  kind: number[];
  payload: number[];
};

/** NFC Forum TNF values (match @tauri-apps/plugin-nfc NFCTypeNameFormat). */
export const NFC_TNF = {
  Empty: 0,
  NfcWellKnown: 1,
  Media: 2,
  AbsoluteURI: 3,
  NfcExternal: 4,
  Unknown: 5,
  Unchanged: 6
} as const;

const RTD_TEXT = 0x54; // 'T'
const RTD_URI = 0x55; // 'U'

function bytesToUtf8(bytes: number[] | Uint8Array): string {
  return new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
}

function utf8ToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function kindAscii(kind: number[]): string {
  return bytesToUtf8(kind).toLowerCase();
}

/** Encode NFC Forum Text RTD payload (status + language + UTF-8 body). */
export function encodeNdefTextPayload(text: string, language = "en"): number[] {
  const langBytes = utf8ToBytes(language);
  if (langBytes.length > 0x3f) {
    throw new Error("NDEF text language code too long.");
  }
  return [langBytes.length, ...langBytes, ...utf8ToBytes(text)];
}

/** Encode MIME record kind + payload for Vectis transport JSON. */
export function encodeVectisTransportMimeRecord(json: string): {
  tnf: number;
  kind: number[];
  payload: number[];
} {
  return {
    tnf: NFC_TNF.Media,
    kind: utf8ToBytes(VECTIS_TRANSPORT_MIME),
    payload: utf8ToBytes(json.trim())
  };
}

/** Decode NFC Forum Text RTD payload (status + language + body). */
export function decodeNdefTextPayload(payload: number[]): string {
  if (payload.length < 1) {
    throw new Error("Empty NDEF text payload.");
  }
  const status = payload[0] ?? 0;
  const langLen = status & 0x3f;
  const utf16 = (status & 0x80) !== 0;
  if (1 + langLen > payload.length) {
    throw new Error("Invalid NDEF text language length.");
  }
  const body = payload.slice(1 + langLen);
  if (utf16) {
    const buf = Uint8Array.from(body);
    if (buf.byteLength % 2 !== 0) {
      throw new Error("Invalid UTF-16 NDEF text payload.");
    }
    return new TextDecoder("utf-16be").decode(buf);
  }
  return bytesToUtf8(body);
}

/** Decode NFC Forum URI RTD payload (prefix code + remainder). */
export function decodeNdefUriPayload(payload: number[]): string {
  if (payload.length < 1) {
    throw new Error("Empty NDEF URI payload.");
  }
  const prefixes = [
    "",
    "http://www.",
    "https://www.",
    "http://",
    "https://",
    "tel:",
    "mailto:",
    "ftp://anonymous:anonymous@",
    "ftp://ftp.",
    "ftps://",
    "sftp://",
    "smb://",
    "nfs://",
    "ftp://",
    "dav://",
    "news:",
    "telnet://",
    "imap:",
    "rtsp://",
    "urn:",
    "pop:",
    "sip:",
    "sips:",
    "tftp:",
    "btspp://",
    "btl2cap://",
    "btgoep://",
    "tcpobex://",
    "irdaobex://",
    "file://",
    "urn:epc:id:",
    "urn:epc:tag:",
    "urn:epc:pat:",
    "urn:epc:raw:",
    "urn:epc:",
    "urn:nfc:"
  ];
  const code = payload[0] ?? 0;
  const prefix = prefixes[code] ?? "";
  return `${prefix}${bytesToUtf8(payload.slice(1))}`;
}

export function decodeNdefRecordToText(record: NdefTagRecordLike): string | null {
  if (record.tnf === NFC_TNF.NfcWellKnown && record.kind[0] === RTD_TEXT) {
    return decodeNdefTextPayload(record.payload);
  }
  if (record.tnf === NFC_TNF.NfcWellKnown && record.kind[0] === RTD_URI) {
    return decodeNdefUriPayload(record.payload);
  }
  if (record.tnf === NFC_TNF.Media) {
    const mime = kindAscii(record.kind);
    if (mime === VECTIS_TRANSPORT_MIME || mime === "application/json" || mime === "text/plain") {
      return bytesToUtf8(record.payload);
    }
  }
  if (record.tnf === NFC_TNF.Unknown || record.tnf === NFC_TNF.AbsoluteURI) {
    const raw = bytesToUtf8(record.payload).trim();
    if (raw.startsWith("{") || /^https?:\/\//i.test(raw)) {
      return raw;
    }
  }
  return null;
}

/**
 * Extract the first usable Vectis transport/join payload from NDEF records.
 * Prefers MIME transport JSON, then text JSON, then absolute join URLs.
 */
export function extractTransportTextFromNdefRecords(records: NdefTagRecordLike[]): string {
  const candidates: string[] = [];
  for (const record of records) {
    const text = decodeNdefRecordToText(record);
    if (text?.trim()) {
      candidates.push(text.trim());
    }
  }
  if (candidates.length === 0) {
    throw new Error("NFC tag had no readable NDEF text or transport MIME payload.");
  }

  const mimeOrJson = candidates.find(
    (item) => item.startsWith("{") && item.includes("vectis.transport.v1")
  );
  if (mimeOrJson) {
    return mimeOrJson;
  }

  const anyJson = candidates.find((item) => item.startsWith("{"));
  if (anyJson) {
    return anyJson;
  }

  const absoluteUrl = candidates.find((item) => /^https?:\/\//i.test(item));
  if (absoluteUrl) {
    return absoluteUrl;
  }

  return candidates[0]!;
}
