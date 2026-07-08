import OperatorConsolePage from "@/components/operator/operator-console-page";

export default async function OperatorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OperatorConsolePage searchParams={searchParams} />;
}
