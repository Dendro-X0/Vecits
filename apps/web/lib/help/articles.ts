export type HelpSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  sections: HelpSection[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "deal-flow",
    title: "How a deal works",
    summary:
      "Walk through publish → order → escrow → delivery → accept using the guided builder and order pages.",
    sections: [
      {
        heading: "The five happy-path steps",
        body: "Most exchanges follow the same sequence. Each step is a signed event your node replays into order state.",
        bullets: [
          "Publish offer — provider lists a service, price, and delivery terms.",
          "Place order — buyer commits to an offer and defines the first milestone.",
          "Fund escrow — buyer locks credits for that milestone.",
          "Deliver work — provider submits evidence (hashes, links, or notes).",
          "Accept completion — buyer accepts delivery and releases payout."
        ]
      },
      {
        heading: "Where to do each step",
        body: "Use Publish & transact in your dashboard for the guided flow. When an order already exists, open it from Transactions — the order page shows your next action and links to the matching builder step.",
        bullets: [
          "Dashboard → Publish & transact for new exchanges.",
          "Dashboard → Transactions for live orders that need you.",
          "Marketplace → order detail for inline fund / deliver / accept actions."
        ]
      },
      {
        heading: "Barter and mixed compensation",
        body: "Offers can use credits only, barter only, or a mix. Barter terms are part of the locked offer — review them on the order page before you fund or deliver."
      },
      {
        heading: "Credits are not money",
        body: "Credits are coordination fuel inside the protocol. They expire, they are not transferable wealth, and they do not replace fiat payment rails. Never move settlement off-platform unless you accept that risk."
      }
    ]
  },
  {
    slug: "disputes",
    title: "Disputes and settlement",
    summary:
      "When delivery does not meet locked terms, open a dispute and propose a deterministic settlement outcome.",
    sections: [
      {
        heading: "When to dispute",
        body: "Disputes are for protocol-recorded disagreement after delivery — not for subjective taste or off-platform promises. Use them when evidence or terms hash do not match what was agreed.",
        bullets: [
          "Delivery evidence does not match acceptance criteria.",
          "Scope or quality conflicts with the locked terms hash.",
          "Timeout windows expired without acceptable resolution."
        ]
      },
      {
        heading: "Guided dispute resolution",
        body: "From Publish & transact, open Resolve a problem to file a dispute and then propose settlement. You can also start from an order page or Transactions when a dispute is already open.",
        bullets: [
          "Open dispute — pick a reason (quality, scope, timeout) and reference the delivery event.",
          "Settle outcome — choose buyer wins or split and enter refund/reward credits.",
          "Both steps require signing — the node accepts or rejects based on protocol rules."
        ]
      },
      {
        heading: "What disputes are not",
        body: "Vectis does not provide human arbitration or legal judgment. Settlement proposals must fit deterministic protocol outcomes. Subjective satisfaction stays off-protocol."
      }
    ]
  },
  {
    slug: "identity",
    title: "Identity and backup",
    summary: "Protect your signing key, use passkeys where available, and export backups before switching devices.",
    sections: [
      {
        heading: "Your signing key is your identity",
        body: "The marketplace recognizes you by your public key. The secret key signs every offer, order, delivery, and dispute event. Anyone with your secret key can act as you on nodes that trust your signatures."
      },
      {
        heading: "Before you switch devices",
        body: "Go to Settings → Security. Export an encrypted key backup or configure a passkey vault while you still have access to this browser or desktop shell.",
        bullets: [
          "Encrypted key backup — password-protected file you can restore elsewhere.",
          "Passkey vault — unlock with device biometrics or PIN where supported.",
          "Sign out when finished on a shared machine."
        ]
      },
      {
        heading: "Recovery limits",
        body: "There is no central account recovery. If you lose both the secret key and backups, the protocol cannot restore your identity or credits."
      }
    ]
  },
  {
    slug: "node-connection",
    title: "Connecting to a node",
    summary: "The official client reads live marketplace state from a Vectis node — usually yours or one your community operates.",
    sections: [
      {
        heading: "Default connection",
        body: "The web client talks to the node URL configured for your build (often a local node during development). Desktop and mobile builds may pin a remote node instead."
      },
      {
        heading: "Connection errors",
        body: "If Overview or Transactions show a connection issue, open Settings and confirm the node is running and reachable. Advanced settings include operator tools and mobile node override for pinned hosts.",
        bullets: [
          "Local development: start the node, then refresh the dashboard.",
          "Production: use HTTPS and follow your operator runbook.",
          "Mobile: configure a pinned remote node when sidecar mode is not available."
        ]
      },
      {
        heading: "Kernel truth",
        body: "Only events accepted by the node appear as authoritative state. Client-side drafts, notes, or chat are not settlement unless they are signed and ingested."
      }
    ]
  }
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}
