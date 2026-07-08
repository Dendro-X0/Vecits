import type {
  BatchIngestResult,
  DiscoveryQuery,
  DiscoveryView,
  EventsPage,
  IngestResult,
  ListEventsQuery,
  NodeClientOptions,
  ParticipantOrdersQuery,
  ParticipantOrdersView,
  PolicyTimelineView,
  ReplayView,
  ReputationHistoryQuery,
  ReputationHistoryView,
  SnapshotDocument,
  SnapshotMeta,
  StateView,
  SignedEnvelope,
  TimelineQuery
} from "./types.js";

export class NodeApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "NodeApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class NodeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: NodeClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    // Bare `fetch` loses its `this` binding when called as a method reference.
    this.fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async ingestEvent(event: Record<string, unknown>): Promise<IngestResult> {
    return this.request<IngestResult>("/events", {
      method: "POST",
      body: JSON.stringify(event)
    });
  }

  async submitSignedEnvelope(event: SignedEnvelope): Promise<IngestResult> {
    return this.ingestEvent(event as unknown as Record<string, unknown>);
  }

  async ingestBatch(events: Array<Record<string, unknown>>): Promise<BatchIngestResult> {
    return this.request<BatchIngestResult>("/events/batch", {
      method: "POST",
      body: JSON.stringify({ events })
    });
  }

  async listEvents(query: ListEventsQuery = {}): Promise<EventsPage> {
    return this.request<EventsPage>(`/events${toQueryString(query)}`);
  }

  async replay(asOf?: string): Promise<ReplayView> {
    return this.request<ReplayView>(`/state/replay${toQueryString({ as_of: asOf })}`);
  }

  async getDiscovery(query: DiscoveryQuery = {}): Promise<DiscoveryView> {
    return this.request<DiscoveryView>(`/state/discovery${toQueryString(query)}`);
  }

  async getParticipantOrders(query: ParticipantOrdersQuery): Promise<ParticipantOrdersView> {
    return this.request<ParticipantOrdersView>(`/state/orders${toQueryString(query)}`);
  }

  async getIdentity(id: string, asOf?: string): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/identity/${encodeURIComponent(id)}${toQueryString({ as_of: asOf })}`
    );
  }

  async getBalance(id: string, asOf?: string): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/balance/${encodeURIComponent(id)}${toQueryString({ as_of: asOf })}`
    );
  }

  async getPolicy(asOf?: string): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/policy${toQueryString({ as_of: asOf })}`
    );
  }

  async getPolicyUpdates(query: TimelineQuery = {}): Promise<PolicyTimelineView> {
    return this.request<PolicyTimelineView>(`/state/policy/updates${toQueryString(query)}`);
  }

  async getOffer(id: string, asOf?: string): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/offer/${encodeURIComponent(id)}${toQueryString({ as_of: asOf })}`
    );
  }

  async getOrder(id: string, asOf?: string): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/order/${encodeURIComponent(id)}${toQueryString({ as_of: asOf })}`
    );
  }

  async getMilestone(
    orderId: string,
    milestoneId: string,
    asOf?: string
  ): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/milestone/${encodeURIComponent(orderId)}/${encodeURIComponent(milestoneId)}${toQueryString({
        as_of: asOf
      })}`
    );
  }

  async getReputation(id: string, asOf?: string): Promise<StateView<Record<string, unknown>>> {
    return this.request<StateView<Record<string, unknown>>>(
      `/state/reputation/${encodeURIComponent(id)}${toQueryString({ as_of: asOf })}`
    );
  }

  async getReputationHistory(
    id: string,
    query: ReputationHistoryQuery = {}
  ): Promise<ReputationHistoryView> {
    return this.request<ReputationHistoryView>(
      `/state/reputation/${encodeURIComponent(id)}/history${toQueryString(query)}`
    );
  }

  async createSnapshot(asOf?: string): Promise<SnapshotMeta> {
    return this.request<SnapshotMeta>("/snapshots", {
      method: "POST",
      body: JSON.stringify({ as_of: asOf })
    });
  }

  async getSnapshot(id: string): Promise<SnapshotDocument> {
    return this.request<SnapshotDocument>(`/snapshots/${encodeURIComponent(id)}`);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...this.defaultHeaders,
        ...(init.headers ?? {})
      }
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      const message =
        extractErrorMessage(payload) ??
        `Node API request failed: ${response.status} ${response.statusText}`;
      throw new NodeApiError(response.status, message, payload);
    }
    return payload as T;
  }
}

function toQueryString(query: object): string {
  const entries = Object.entries(query as Record<string, unknown>).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (entries.length === 0) {
    return "";
  }
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as Record<string, unknown>).error;
    if (typeof value === "string") {
      return value;
    }
  }
  return null;
}
