import { NodeClient, type ParticipantOrderRow } from "@new-start/sdk-ts";

import { humanizeMarketplaceError } from "@/lib/marketplace/status-message";
import { normalizeOrderExchange } from "@/lib/marketplace/order-normalize";
import {
  deriveTransactionProgress,
  type TransactionProgress
} from "@/lib/dashboard/transaction-progress";
import {
  summarizeWorkspaceRoles,
  type WorkspaceRoleSummary
} from "@/lib/dashboard/workspace-role";

const DEFAULT_NODE =
  process.env.NEXT_PUBLIC_NODE_API_BASE_URL ?? "http://127.0.0.1:7878";

const ORDER_LIMIT = 40;

export type TransactionOrderSummary = {
  orderId: string;
  offerId: string;
  serviceType: string;
  role: "buyer" | "provider";
  orderStatus: string;
  progress: TransactionProgress;
  orderHref: string;
};

export type TransactionsState =
  | {
      kind: "live";
      orders: TransactionOrderSummary[];
      roleSummary: WorkspaceRoleSummary;
      asOf?: string;
      nodeLabel: string;
    }
  | { kind: "empty"; nodeLabel: string; asOf?: string }
  | { kind: "error"; nodeLabel: string; message: string };

function viewerRoleForOrder(
  order: ParticipantOrderRow,
  publicKeyHex: string
): "buyer" | "provider" | null {
  if (order.buyer_pub_key === publicKeyHex) {
    return "buyer";
  }
  if (order.provider_pub_key === publicKeyHex) {
    return "provider";
  }
  return null;
}

function sortOrders(orders: TransactionOrderSummary[]): TransactionOrderSummary[] {
  return [...orders].sort((left, right) => {
    const leftPriority = left.progress.needsViewerAction
      ? 0
      : left.progress.isComplete
        ? 2
        : 1;
    const rightPriority = right.progress.needsViewerAction
      ? 0
      : right.progress.isComplete
        ? 2
        : 1;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.orderId.localeCompare(right.orderId);
  });
}

async function loadOrderExchange(
  client: NodeClient,
  order: ParticipantOrderRow
): Promise<ReturnType<typeof normalizeOrderExchange>> {
  const view = await client.getOrder(order.order_id);
  const orderData = (view.data as Record<string, unknown> | null) ?? null;
  if (!orderData) {
    return null;
  }

  const milestoneIds = order.milestone_ids.length
    ? order.milestone_ids
    : Array.isArray(orderData.milestone_ids)
      ? (orderData.milestone_ids as string[])
      : Array.isArray(orderData.milestoneIds)
        ? (orderData.milestoneIds as string[])
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

export async function loadTransactions(publicKeyHex: string): Promise<TransactionsState> {
  try {
    const client = new NodeClient({ baseUrl: DEFAULT_NODE });
    const ordersView = await client.getParticipantOrders({
      participant: publicKeyHex,
      role: "any",
      limit: ORDER_LIMIT
    });

    const summaries: TransactionOrderSummary[] = [];

    for (const order of ordersView.data.orders) {
      const role = viewerRoleForOrder(order, publicKeyHex);
      if (!role) {
        continue;
      }

      const exchange = await loadOrderExchange(client, order);
      if (!exchange) {
        continue;
      }

      summaries.push({
        orderId: order.order_id,
        offerId: order.offer_id,
        serviceType: order.service_type,
        role,
        orderStatus: order.status,
        progress: deriveTransactionProgress(exchange, role),
        orderHref: `/marketplace/orders/${encodeURIComponent(order.order_id)}`
      });
    }

    if (summaries.length === 0) {
      return {
        kind: "empty",
        nodeLabel: DEFAULT_NODE,
        asOf: ordersView.as_of
      };
    }

    const sorted = sortOrders(summaries);

    return {
      kind: "live",
      orders: sorted,
      roleSummary: summarizeWorkspaceRoles(sorted),
      asOf: ordersView.as_of,
      nodeLabel: DEFAULT_NODE
    };
  } catch (error) {
    return {
      kind: "error",
      nodeLabel: DEFAULT_NODE,
      message: humanizeMarketplaceError(
        error instanceof Error ? error.message : "Unable to load transactions."
      )
    };
  }
}
