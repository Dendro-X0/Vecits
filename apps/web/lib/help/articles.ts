export type HelpSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type HelpArticleCategory = "getting-started" | "marketplace" | "founding";

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpArticleCategory;
  sections: HelpSection[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "deal-flow",
    title: "How a deal works",
    category: "marketplace",
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
    category: "marketplace",
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
    category: "getting-started",
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
    category: "getting-started",
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
      },
      {
        heading: "LAN market / local operator node",
        body: "At a meetup or market, the operator may share a Join this node QR with a LAN address (for example 192.168.x.x). Import or Settings asks you to confirm the hostname before pinning. While pinned only to that node, the client labels it as a local operator node — not yet reconciled with upstream. Events accepted there are accepted by the local node, not globally settled until peer pull catch-up.",
        bullets: [
          "Confirm hostname/IP before pin — open Wi-Fi can host fake nodes.",
          "HTTP on LAN is for demo/maintainer halos; prefer HTTPS when you can.",
          "Operator reconcile uses existing pull sync (see halo operator runbook)."
        ]
      },
      {
        heading: "NFC transport (Android)",
        body: "On the Android Vectis app, Dashboard → Import → Scan NFC reads the same Tier 1 transport JSON carried by QR/paste. Share panels (vouch request, identity intro, and other bundles) can Write to NFC tag using MIME application/vnd.vectis.transport.v1+json. Tapping or writing does not publish offers or move credits. If write fails, use the QR on the same panel.",
        bullets: [
          "iOS: prefer QR or paste. NFC write is not required; read is best-effort when the OS allows it.",
          "Expired tags show the same expired message as QR links.",
          "Operator steps: docs/runbooks/r9-nfc-operator-runbook.md"
        ]
      }
    ]
  },
  {
    slug: "trust-bootstrap",
    title: "Trust bootstrap and founding network",
    category: "founding",
    summary:
      "How sponsor vouches unlock provider admission during the founding phase — and how that differs from milestone settlement.",
    sections: [
      {
        heading: "Founding network phase",
        body: "Early deployments label honestly as a founding network. Admission is invite-style: sponsors vouch for new identities before they can publish offers. This is not a permanent gate — operators tighten policy as the network matures.",
        bullets: [
          "Dashboard and marketplace show a Founding network label with this guide linked.",
          "Vouch weight comes from replay-visible Vouch events on your node.",
          "Credits are coordination fuel — not fiat money and not withdrawable."
        ]
      },
      {
        heading: "Admission vs settlement",
        body: "Sponsor vouches answer whether a provider may publish offers (admission). They do not replace milestone rules. Escrow funding, delivery evidence, and buyer accept still settle each order on locked terms.",
        bullets: [
          "Admission — provider_eligibility_threshold from active policy.",
          "Settlement — SpendCredits, ServiceDelivery, ServiceAccept per order.",
          "Disputes — deterministic protocol outcomes only; no human override in the client."
        ]
      },
      {
        heading: "Getting sponsor vouches",
        body: "Open Dashboard → Overview while signed in. The trust bootstrap panel shows your vouch weight vs threshold, lets you track requested sponsors, and copy a vouch request message for sponsors to sign.",
        bullets: [
          "Create your identity on-node first (Settings → Advanced operator tools if needed).",
          "Add sponsor public keys and copy the request draft.",
          "Sponsors submit signed Vouch events referencing your identity."
        ]
      }
    ]
  },
  {
    slug: "credits-path",
    title: "Earning credits as a buyer",
    category: "founding",
    summary:
      "The contribution path for first credits during founding: claim → attest → mint → fund escrow.",
    sections: [
      {
        heading: "Why buyers need credits",
        body: "Marketplace escrow spends in-protocol credits. During founding there is no fiat checkout. Buyers typically earn first credits by documenting contribution work, collecting attestations, and minting under policy rules.",
        bullets: [
          "Credits expire and are not transferable wealth.",
          "Mint reason contribution is the primary net-new issuance path before marketplace closes.",
          "Never treat credits as money or an investment."
        ]
      },
      {
        heading: "Step 1 — File a contribution claim",
        body: "Describe verifiable work: maintenance, documentation, ops support, or other network contribution. The claim references an artifact hash and requested credit amount within policy caps.",
        bullets: [
          "Use operator contribution tools in Settings → Advanced for signed events during drills.",
          "Claims need a unique claimId and beneficiary public key (usually yours)."
        ]
      },
      {
        heading: "Step 2 — Collect attestations",
        body: "Independent attestors approve or reject the claim. Policy sets claim_approval_threshold — typically two distinct sponsors during genesis.",
        bullets: [
          "Attest events reference the claim event.",
          "Rejections do not mint credits."
        ]
      },
      {
        heading: "Step 3 — Mint credits",
        body: "After enough approvals, mint credits with mintReason contribution. Minted lots carry expiry — spend them before they lapse.",
        bullets: [
          "Mint references the approved claim.",
          "Check balance in Overview trust bootstrap or the balance explorer."
        ]
      },
      {
        heading: "Step 4 — Fund escrow",
        body: "With spendable balance, place an order and fund the milestone from Publish & transact → Fund escrow. That locks credits for provider work under locked terms.",
        bullets: [
          "Dashboard → Publish & transact → Fund escrow.",
          "Order pages also link to the matching builder step."
        ]
      }
    ]
  }
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}
