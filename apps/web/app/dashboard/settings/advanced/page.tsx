import { redirect } from "next/navigation";

export default function DashboardAdvancedPage() {
  redirect("/dashboard/settings?advanced=1");
}
