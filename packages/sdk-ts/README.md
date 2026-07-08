# `@new-start/sdk-ts`

Typed TypeScript client for the local Rust node HTTP API.

**Stability policy:** see [STABILITY.md](./STABILITY.md) (R4-C1 semver + stable surface).

## Example

```ts
import {
  buildIdentityCreateUnsigned,
  generateEd25519KeyPair,
  NodeClient,
  signUnsignedEnvelope,
  verifySignedEnvelope
} from "@new-start/sdk-ts";

const client = new NodeClient({ baseUrl: "http://127.0.0.1:7878" });
const keys = await generateEd25519KeyPair();
const draft = buildIdentityCreateUnsigned(keys.publicKeyHex, {
  metadata: { displayName: "Experimental Builder" }
});
const signed = await signUnsignedEnvelope(draft, keys.secretKeyHex);
const ok = await verifySignedEnvelope(signed);
if (!ok) throw new Error("signature verification failed");

const ingest = await client.submitSignedEnvelope(signed);
console.log(ingest.accepted, ingest.event_id);
```
