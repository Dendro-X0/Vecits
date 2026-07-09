import type { TransactionOrderSummary } from "@/lib/dashboard/load-transactions";

export type ExchangeRole = "buyer" | "provider";

export type PrimaryWorkspaceRole = ExchangeRole | "balanced";

export type RoleQueueSummary = {
  role: ExchangeRole;
  total: number;
  needsAction: number;
  inProgress: number;
  complete: number;
};

export type WorkspaceRoleSummary = {
  primaryRole: PrimaryWorkspaceRole;
  primaryLabel: string;
  hint: string;
  buyer: RoleQueueSummary;
  provider: RoleQueueSummary;
};

export type RoleFilter = "all" | ExchangeRole;

function queueSummary(role: ExchangeRole, orders: TransactionOrderSummary[]): RoleQueueSummary {
  const needsAction = orders.filter((order) => order.progress.needsViewerAction).length;
  const complete = orders.filter((order) => order.progress.isComplete).length;

  return {
    role,
    total: orders.length,
    needsAction,
    inProgress: orders.length - needsAction - complete,
    complete
  };
}

export function summarizeWorkspaceRoles(orders: TransactionOrderSummary[]): WorkspaceRoleSummary {
  const buyerOrders = orders.filter((order) => order.role === "buyer");
  const providerOrders = orders.filter((order) => order.role === "provider");
  const buyer = queueSummary("buyer", buyerOrders);
  const provider = queueSummary("provider", providerOrders);

  let primaryRole: PrimaryWorkspaceRole = "balanced";
  if (buyer.total > provider.total) {
    primaryRole = "buyer";
  } else if (provider.total > buyer.total) {
    primaryRole = "provider";
  }

  const primaryLabel =
    primaryRole === "buyer"
      ? "Buyer-focused workspace"
      : primaryRole === "provider"
        ? "Provider-focused workspace"
        : "Balanced workspace";

  const hint =
    primaryRole === "buyer"
      ? `Most active orders are purchases (${buyer.total} buying vs ${provider.total} selling).`
      : primaryRole === "provider"
        ? `Most active orders are sales (${provider.total} selling vs ${buyer.total} buying).`
        : `You have ${buyer.total} buying and ${provider.total} selling orders on this node.`;

  return {
    primaryRole,
    primaryLabel,
    hint,
    buyer,
    provider
  };
}

export function filterOrdersByRole(
  orders: TransactionOrderSummary[],
  filter: RoleFilter
): TransactionOrderSummary[] {
  if (filter === "all") {
    return orders;
  }
  return orders.filter((order) => order.role === filter);
}

export function parseRoleFilter(value: string | null): RoleFilter {
  if (value === "buyer" || value === "provider") {
    return value;
  }
  return "all";
}

export function roleFilterLabel(filter: RoleFilter): string {
  if (filter === "buyer") {
    return "Buying";
  }
  if (filter === "provider") {
    return "Selling";
  }
  return "All orders";
}
