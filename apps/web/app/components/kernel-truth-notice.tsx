type KernelTruthNoticeProps = {
  variant?: "banner" | "session" | "discovery" | "offProtocol";
};

const COPY = {
  banner:
    "Authoritative protocol state comes from the Rust kernel API only. This web shell signs events and displays kernel responses — it does not settle balances or apply policy locally.",
  session:
    "Session checklist tracks events accepted by the kernel in this browser tab only. Refresh explorer views or replay for authoritative order/milestone status.",
  discovery:
    "Discovery rankings are informational scores from kernel replay at as_of. They are not payment guarantees or off-platform trust endorsements.",
  offProtocol:
    "Vectis credits are non-transferable protocol units, not fiat money. Off-platform payment (PayPal, crypto, bank transfer) is outside kernel enforcement — escrow and acceptance must stay in the event log.",
};

export function KernelTruthNotice({ variant = "banner" }: KernelTruthNoticeProps) {
  const text = COPY[variant];
  const border =
    variant === "offProtocol" ? "1px solid #6b4a2a" : "1px solid #2a3458";
  const background =
    variant === "offProtocol" ? "#2a1f14" : variant === "session" ? "#141c38" : "#111936";

  return (
    <p
      style={{
        marginTop: variant === "banner" ? 0 : "0.65rem",
        marginBottom: "0.85rem",
        padding: "0.65rem 0.75rem",
        border,
        borderRadius: 8,
        background,
        opacity: 0.92,
        fontSize: "0.92rem",
        lineHeight: 1.45,
      }}
    >
      <strong>Kernel truth:</strong> {text}
    </p>
  );
}

export function OffProtocolPaymentWarning() {
  return <KernelTruthNotice variant="offProtocol" />;
}
