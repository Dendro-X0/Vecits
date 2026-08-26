import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bug,
  Cpu,
  FlaskConical,
  HeartHandshake,
  Languages,
  Search,
  Sparkles
} from "lucide-react";

const LANE_ICONS: Record<string, LucideIcon> = {
  "software-fixes": Bug,
  "feature-work": Sparkles,
  documentation: BookOpen,
  translation: Languages,
  testing: FlaskConical,
  research: Search,
  "project-maintenance": HeartHandshake,
  "compute-job": Cpu
};

export function getLaneIcon(serviceType: string): LucideIcon {
  return LANE_ICONS[serviceType] ?? Sparkles;
}
