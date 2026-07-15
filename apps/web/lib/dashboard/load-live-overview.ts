import { NodeClient } from "@new-start/sdk-ts";

import type { OverviewKpi, ActivityItem, LaneBar } from "@/lib/dashboard/showcase-stats";
import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";

export type LiveOverviewStats = {
  kpis: OverviewKpi[];
  laneBars: LaneBar[];
  activity: ActivityItem[];
  asOf?: string;
  nodeLabel: string;
};

export type LiveOverviewState =
  | { kind: "live"; stats: LiveOverviewStats }
  | { kind: "empty"; nodeLabel: string; asOf?: string }
  | { kind: "error"; nodeLabel: string; message: string };

function readPubkeyField(payload: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export async function loadLiveOverviewStats(publicKeyHex: string): Promise<LiveOverviewState> {
  const nodeLabel = resolveNodeClientBaseUrl();
  try {
    const client = new NodeClient({ baseUrl: nodeLabel });

    const [discoveryView, reputationView, authoredEvents, providerOrdersView] = await Promise.all([
      client.getDiscovery({ limit: 100, alpha_defaults: true }),
      client.getReputation(publicKeyHex),
      client.listEvents({ author_pub_key: publicKeyHex, limit: 100 }),
      client.getParticipantOrders({ participant: publicKeyHex, role: "provider", limit: 100 })
    ]);

    const offers = discoveryView.data.offers;
    const myOffers = offers.filter((offer) => offer.provider_pub_key === publicKeyHex);
    const inboundOrders = providerOrdersView.data.orders.filter(
      (order) => order.buyer_pub_key !== publicKeyHex
    );

    const authored = authoredEvents.events;
    const ordersPlaced = authored.filter((event) => event.kind === "ServiceOrder").length;
    const accepts = authored.filter((event) => event.kind === "ServiceAccept").length;

    const globalScore = Number(
      reputationView.data?.global_score ?? reputationView.data?.globalScore ?? 0
    );

    const laneCounts = new Map<string, number>();
    for (const offer of myOffers) {
      laneCounts.set(offer.service_type, (laneCounts.get(offer.service_type) ?? 0) + 1);
    }

    const totalActiveOffers = myOffers.filter((offer) => offer.status === "active").length;
    const totalActivity = authored.length + inboundOrders.length;

    if (totalActivity === 0 && totalActiveOffers === 0) {
      return {
        kind: "empty",
        nodeLabel,
        asOf: discoveryView.as_of
      };
    }

    const kpis: OverviewKpi[] = [
      {
        label: "Completed projects",
        value: String(accepts),
        delta: "ServiceAccept events you authored",
        hint: "Kernel-settled milestone acceptances"
      },
      {
        label: "Orders placed",
        value: String(ordersPlaced),
        delta: `${inboundOrders.length} inbound on your offers`,
        hint: "Buying and selling activity"
      },
      {
        label: "Open offers",
        value: String(totalActiveOffers),
        delta: `${myOffers.length} total listings`,
        hint: "Live discovery rows for your identity"
      },
      {
        label: "Lead interactions",
        value: String(inboundOrders.length),
        delta: "Inbound orders on your offers",
        hint: "Orders placed against your offers"
      }
    ];

    if (globalScore > 0) {
      kpis[0] = {
        ...kpis[0],
        delta: `Global reputation ${globalScore}`
      };
    }

    const laneBars: LaneBar[] =
      laneCounts.size > 0
        ? [...laneCounts.entries()].map(([lane, count]) => ({
            lane: lane.replace(/-/g, " "),
            count
          }))
        : [{ lane: "No offer lanes yet", count: 0 }];

    const activity: ActivityItem[] = authored
      .sort((left, right) => {
        const leftTime = String(left.createdAt ?? left.created_at ?? "");
        const rightTime = String(right.createdAt ?? right.created_at ?? "");
        return rightTime.localeCompare(leftTime);
      })
      .slice(0, 5)
      .map((event, index) => {
        const kind = String(event.kind ?? "Event");
        const payload = (event.payload as Record<string, unknown> | undefined) ?? {};
        const orderId = readPubkeyField(payload, "orderId", "order_id") ?? "—";
        return {
          id: String(event.eventId ?? event.event_id ?? index),
          title: kind,
          detail: `Order ${orderId}`,
          when: String(event.createdAt ?? event.created_at ?? "recent")
        };
      });

    return {
      kind: "live",
      stats: {
        kpis,
        laneBars,
        activity,
        asOf: discoveryView.as_of,
        nodeLabel
      }
    };
  } catch (error) {
    return {
      kind: "error",
      nodeLabel,
      message: error instanceof Error ? error.message : "Unable to load dashboard activity."
    };
  }
}
