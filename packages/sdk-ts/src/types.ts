export type ReplaySource = "genesis_replay" | "snapshot_plus_delta";
export type EventKind =
  | "IdentityCreate"
  | "IdentityUpdate"
  | "Vouch"
  | "VouchRevoke"
  | "ContributionClaim"
  | "ContributionAttest"
  | "MintCredits"
  | "SpendCredits"
  | "ServiceOffer"
  | "ServiceOrder"
  | "ServiceDelivery"
  | "ServiceAccept"
  | "ServiceDispute"
  | "ServiceSettle"
  | "PolicyUpdate";

export interface IdentityMetadata {
  displayName?: string;
  bio?: string;
  links?: string[];
  serviceCategories?: string[];
}

export interface IdentityCreatePayload {
  identityPubKey: string;
  metadata?: IdentityMetadata;
  recoveryPolicyHash?: string;
}

export interface UnsignedEnvelope {
  version: string;
  authorPubKey: string;
  createdAt: string;
  kind: EventKind;
  policyVersion: string;
  payload: Record<string, unknown>;
  references?: Record<string, string>;
  nonce?: string;
}

export interface SignedEnvelope extends UnsignedEnvelope {
  eventId: string;
  sig: string;
}

export interface CreateUnsignedEnvelopeInput {
  authorPubKey: string;
  kind: EventKind;
  payload: Record<string, unknown>;
  createdAt?: string;
  policyVersion?: string;
  references?: Record<string, string>;
  nonce?: string;
  version?: string;
}

export interface Ed25519KeyPair {
  publicKeyHex: string;
  secretKeyHex: string;
}

export interface IngestResult {
  accepted: boolean;
  already_present?: boolean;
  event_id: string | null;
  code: string | null;
  message: string | null;
}

export interface BatchIngestResult {
  accepted_count: number;
  rejected_count: number;
  results: IngestResult[];
}

export interface EventsPage {
  events: Array<Record<string, unknown>>;
  next_cursor: number | null;
}

export interface ReplayView {
  as_of: string;
  source: ReplaySource;
  snapshot_id?: string | null;
  data: Record<string, unknown>;
}

export interface StateView<TData> {
  as_of: string;
  source: ReplaySource;
  snapshot_id?: string | null;
  data: TData | null;
}

export interface DiscoveryOfferRow {
  offer_id: string;
  provider_pub_key: string;
  service_type: string;
  status: string;
  price_per_unit_credits: number;
  offer_expires_at: string;
  global_score: number;
  lane_score: number;
  discovery_score: number;
  created_event_id: string;
}

export interface DiscoveryPage {
  lane_filter?: string | null;
  effective_lane_filter: string[];
  min_score_filter?: number | null;
  alpha_defaults_enabled: boolean;
  alpha_initial_service_types: string[];
  policy_effective_version: string;
  policy_allowed_service_types: string[];
  ranking_formula: string;
  offers: DiscoveryOfferRow[];
  next_cursor: number | null;
  total: number;
}

export interface DiscoveryQuery {
  as_of?: string;
  service_type?: string;
  min_score?: number;
  cursor?: number;
  limit?: number;
  alpha_defaults?: boolean;
}

export interface DiscoveryView {
  as_of: string;
  source: ReplaySource;
  snapshot_id?: string | null;
  data: DiscoveryPage;
}

export type ParticipantOrderRole = "any" | "buyer" | "provider";

export interface ParticipantOrderRow {
  order_id: string;
  offer_id: string;
  provider_pub_key: string;
  buyer_pub_key: string;
  order_expires_at: string;
  milestone_ids: string[];
  status: string;
  created_event_id: string;
  service_type: string;
  participant_role: ParticipantOrderRole;
}

export interface ParticipantOrdersPage {
  participant_pub_key: string;
  role_filter: ParticipantOrderRole;
  status_filter?: string | null;
  orders: ParticipantOrderRow[];
  next_cursor: number | null;
  total: number;
}

export interface ParticipantOrdersQuery {
  participant: string;
  as_of?: string;
  role?: ParticipantOrderRole;
  status?: string;
  cursor?: number;
  limit?: number;
}

export interface ParticipantOrdersView {
  as_of: string;
  source: ReplaySource;
  snapshot_id?: string | null;
  data: ParticipantOrdersPage;
}

export interface PolicyTimelinePage {
  updates: Array<Record<string, unknown>>;
  next_cursor: number | null;
  total: number;
}

export interface PolicyTimelineView {
  as_of: string;
  source: ReplaySource;
  snapshot_id?: string | null;
  data: PolicyTimelinePage;
}

export interface ReputationHistoryPage {
  entries: Array<Record<string, unknown>>;
  next_cursor: number | null;
  total: number;
}

export interface ReputationHistoryView {
  as_of: string;
  source: ReplaySource;
  snapshot_id?: string | null;
  data: ReputationHistoryPage;
}

export interface SnapshotMeta {
  snapshot_id: string;
  as_of: string;
  event_seq: number;
  state_hash: string;
  created_at: string;
  format_version: number;
}

export interface SnapshotDocument {
  meta: SnapshotMeta;
  state: Record<string, unknown>;
  checkpoint?: Record<string, unknown> | null;
}

export interface ListEventsQuery {
  cursor?: number;
  limit?: number;
  kind?: string;
  author_pub_key?: string;
}

export interface TimelineQuery {
  as_of?: string;
  cursor?: number;
  limit?: number;
}

export interface ReputationHistoryQuery extends TimelineQuery {
  lane?: string;
}

export interface NodeClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
}
