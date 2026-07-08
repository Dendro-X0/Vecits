export type OverviewKpi = {
  label: string;
  value: string;
  delta: string;
  hint: string;
};

export type LaneBar = {
  lane: string;
  count: number;
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  when: string;
};

export const SHOWCASE_KPIS: OverviewKpi[] = [
  {
    label: "Completed projects",
    value: "7",
    delta: "+2 this month",
    hint: "Settled exchanges on-protocol"
  },
  {
    label: "Active exchanges",
    value: "2",
    delta: "1 awaiting delivery",
    hint: "Orders in progress"
  },
  {
    label: "Open offers",
    value: "3",
    delta: "Across 2 lanes",
    hint: "Live marketplace listings"
  },
  {
    label: "Lead interactions",
    value: "12",
    delta: "+3 this week",
    hint: "Inbound orders on your offers"
  }
];

export const SHOWCASE_LANE_BARS: LaneBar[] = [
  { lane: "Software fixes", count: 4 },
  { lane: "Feature work", count: 3 },
  { lane: "Mutual aid", count: 2 },
  { lane: "Documentation", count: 1 }
];

export const SHOWCASE_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    title: "Delivery submitted",
    detail: "Project maintenance — milestone 2",
    when: "2h ago"
  },
  {
    id: "2",
    title: "Inbound order",
    detail: "New lead on Feature work offer",
    when: "Yesterday"
  },
  {
    id: "3",
    title: "Exchange settled",
    detail: "Mutual aid documentation pass",
    when: "3 days ago"
  },
  {
    id: "4",
    title: "Reputation updated",
    detail: "Lane score refresh from kernel replay",
    when: "Last week"
  }
];
