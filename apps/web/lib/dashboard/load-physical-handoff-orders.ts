import { NodeClient, type ParticipantOrderRow } from "@new-start/sdk-ts";

import { humanizeMarketplaceError } from "@/lib/marketplace/status-message";
import { normalizeOrderExchange, type NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";
import { milestoneReadyForDelivery } from "@/lib/marketplace/service-delivery";
import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";

const DEFAULT_NODE =
  process.env.NEXT_PUBLIC_NODE_API_BASE_URL ?? "http://127.0.0.1:7878";

export type PhysicalHandoffOrderCandidate = {
  orderId: string;
  serviceType: string;
  role: "buyer" | "provider";
  orderStatus: string;
  exchange: NormalizedOrderExchange;
  activeMilestoneId: string | null;
  canDeliver: boolean;
  canAccept: boolean;
};

export type PhysicalHandoffOrdersState =
  | { kind: "live"; orders: PhysicalHandoffOrderCandidate[]; nodeLabel: string }
  | { kind: "empty"; nodeLabel: string }
  | { kind: "error"; nodeLabel: string; message: string }
  | { kind: "signed-out"; nodeLabel: string };

function viewerRole(order: ParticipantOrderRow, publicKeyHex: string): "buyer" | "provider" | null {
  if (order.buyer_pub_key === publicKeyHex) {
    return "buyer";
  }
  if (order.provider_pub_key === publicKeyHex) {
    return "provider";
  }
  return null;
}

async function loadExchange(client: NodeClient, order: ParticipantOrderRow) {
  const view = await client.getOrder(order.order_id);
  const orderData = (view.data as Record<string, unknown> | null) ?? null;
  if (!orderData) {
    return null;
  }

  const milestoneIds = order.milestone_ids.length
    ? order.milestone_ids
    : Array.isArray(orderData.milestone_ids)
      ? (orderData.milestone_ids as string[])
      : [];

  const milestones = await Promise.all(
    milestoneIds.map(async (milestoneId) => {
      try {
        const milestoneView = await client.getMilestone(order.order_id, milestoneId);
        return {
          id: milestoneId,
          data: (milestoneView.data as Record<string, unknown> | null) ?? null
        };
      } catch {
        return { id: milestoneId, data: null };
      }
    })
  );

  return normalizeOrderExchange(order.order_id, orderData, milestones);
}

function pickActiveMilestone(exchange: NormalizedOrderExchange) {
  for (const milestone of exchange.milestones) {
    if (milestone.status !== "Accepted" && milestone.status !== "Disputed") {
      return milestone;
    }
  }
  return exchange.milestones[0] ?? null;
}

export async function loadPhysicalHandoffOrders(
  publicKeyHex: string
): Promise<PhysicalHandoffOrdersState> {
  if (!publicKeyHex.trim()) {
    return { kind: "signed-out", nodeLabel: DEFAULT_NODE };
  }

  try {
    const client = new NodeClient({ baseUrl: resolveNodeClientBaseUrl(DEFAULT_NODE) });
    const ordersView = await client.getParticipantOrders({
      participant: publicKeyHex,
      role: "any",
      limit: 40
    });

    const candidates: PhysicalHandoffOrderCandidate[] = [];

    for (const order of ordersView.data.orders) {
      if (order.service_type !== "physical-handoff") {
        continue;
      }
      const role = viewerRole(order, publicKeyHex);
      if (!role) {
        continue;
      }

      const exchange = await loadExchange(client, order);
      if (!exchange) {
        continue;
      }

      const milestone = pickActiveMilestone(exchange);
      const canDeliver =
        role === "provider" &&
        Boolean(milestone && milestoneReadyForDelivery(milestone.status));
      const canAccept =
        role === "buyer" &&
        Boolean(milestone && milestone.status === "Delivered" && milestone.deliveryEventId);

      candidates.push({
        orderId: exchange.orderId,
        serviceType: order.service_type,
        role,
        orderStatus: exchange.status,
        exchange,
        activeMilestoneId: milestone?.id ?? null,
        canDeliver,
        canAccept
      });
    }

    candidates.sort((left, right) => left.orderId.localeCompare(right.orderId));

    if (candidates.length === 0) {
      return { kind: "empty", nodeLabel: DEFAULT_NODE };
    }

    return { kind: "live", orders: candidates, nodeLabel: DEFAULT_NODE };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    return {
      kind: "error",
      nodeLabel: DEFAULT_NODE,
      message: humanizeMarketplaceError(message)
    };
  }
}
