"use client";

import Link from "next/link";
import { useState } from "react";

type ShellKind = "powershell" | "bash";

type CommandItem = {
  label: string;
  description: string;
  command: Record<ShellKind, string>;
};

type WorkflowBundle = {
  label: string;
  description: string;
  commands: Record<ShellKind, string[]>;
  launchHref: string;
  launchLabel: string;
  resultLinks: Array<{
    label: string;
    href: string;
  }>;
};

type LaneInspectionPreset = {
  label: string;
  description: string;
  links: Array<{
    label: string;
    href: string;
  }>;
};

type LaneFixtureDefinition = {
  lane: string;
  label: string;
  acceptDescription: string;
  disputeDescription: string;
};

const LOCAL_NODE_DATA_DIR = ".local-node";
const DEFAULT_PROVIDER_ID =
  "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";

const NON_SOFTWARE_LANE_FIXTURES: LaneFixtureDefinition[] = [
  {
    lane: "feature-work",
    label: "Feature Work",
    acceptDescription:
      "Start a local node, ingest the checked-in feature-work accept fixture, and jump straight into the bounded lane starter.",
    disputeDescription:
      "Start a local node, ingest the checked-in feature-work dispute fixture, and rehearse the timeout path from the dispute starter."
  },
  {
    lane: "documentation",
    label: "Documentation",
    acceptDescription:
      "Start a local node, ingest the checked-in documentation accept fixture, and jump directly into the documentation lane starter.",
    disputeDescription:
      "Start a local node, ingest the checked-in documentation dispute fixture, and inspect the deterministic dispute/timeout path."
  },
  {
    lane: "translation",
    label: "Translation",
    acceptDescription:
      "Start a local node, ingest the checked-in translation accept fixture, and open the translation starter with matching explorer links.",
    disputeDescription:
      "Start a local node, ingest the checked-in translation dispute fixture, and inspect the dispute/timeout outcome for that lane."
  },
  {
    lane: "testing",
    label: "Testing",
    acceptDescription:
      "Start a local node, ingest the checked-in testing accept fixture, and launch the testing lane workflow with direct state links.",
    disputeDescription:
      "Start a local node, ingest the checked-in testing dispute fixture, and verify the deterministic timeout outcome from the dispute starter."
  },
  {
    lane: "research",
    label: "Research",
    acceptDescription:
      "Start a local node, ingest the checked-in research accept fixture, and jump into the research lane workflow with direct result inspection.",
    disputeDescription:
      "Start a local node, ingest the checked-in research dispute fixture, and inspect the deterministic dispute/timeout path."
  },
  {
    lane: "project-maintenance",
    label: "Project Maintenance",
    acceptDescription:
      "Start a local node, ingest the checked-in project-maintenance accept fixture, and open the stalled-project support lane with direct result links.",
    disputeDescription:
      "Start a local node, ingest the checked-in project-maintenance dispute fixture, and rehearse the stalled-project timeout path from a reproducible log."
  },
  {
    lane: "compute-job",
    label: "Compute Job",
    acceptDescription:
      "Phase 2 kickoff: start a local node, ingest the checked-in compute-job accept fixture, and inspect the experimental compute receipt lane from a reproducible deterministic bundle.",
    disputeDescription:
      "Phase 2 kickoff: start a local node, ingest the checked-in compute-job dispute fixture, and rehearse the experimental compute receipt timeout path from a reproducible log."
  }
];

function startNodeCommand(shell: ShellKind): string {
  return shell === "powershell"
    ? `cargo run --bin cli -- node serve --data-dir .\\${LOCAL_NODE_DATA_DIR} --bind 127.0.0.1:7878`
    : `cargo run --bin cli -- node serve --data-dir ./${LOCAL_NODE_DATA_DIR} --bind 127.0.0.1:7878`;
}

function ingestFixtureCommand(shell: ShellKind, fixtureName: string): string {
  return shell === "powershell"
    ? `cargo run --bin cli -- node ingest --data-dir .\\${LOCAL_NODE_DATA_DIR} --in fixtures\\valid\\${fixtureName}`
    : `cargo run --bin cli -- node ingest --data-dir ./${LOCAL_NODE_DATA_DIR} --in fixtures/valid/${fixtureName}`;
}

function buildLaneResultLinks(
  lane: string,
  flow: "accept" | "dispute"
): WorkflowBundle["resultLinks"] {
  return [
    { label: "Offer view", href: `/explorer/offers?id=${lane}-${flow}-offer` },
    { label: "Order view", href: `/explorer/orders?id=${lane}-${flow}-order` },
    {
      label: "Milestone view",
      href: `/explorer/milestones?order_id=${lane}-${flow}-order&milestone_id=m1`
    },
    {
      label: "Discovery view",
      href: `/explorer/discovery?service_type=${lane}&alpha_defaults=0`
    },
    {
      label: "Reputation explorer",
      href: `/explorer/reputation?id=${DEFAULT_PROVIDER_ID}&lane=${lane}&limit=20`
    }
  ];
}

const COMMANDS: CommandItem[] = [
  {
    label: "Start Local Node",
    description: "Starts a loopback local node runtime for web + explorer queries.",
    command: {
      powershell: startNodeCommand("powershell"),
      bash: startNodeCommand("bash")
    }
  },
  {
    label: "Ingest Accept Fixture",
    description: "Loads the happy-path marketplace fixture for offer/order/funding/accept.",
    command: {
      powershell: ingestFixtureCommand("powershell", "marketplace-accept.jsonl"),
      bash: ingestFixtureCommand("bash", "marketplace-accept.jsonl")
    }
  },
  {
    label: "Ingest Timeout Fixture",
    description: "Loads dispute-timeout fixture for deterministic auto-refund behavior.",
    command: {
      powershell: ingestFixtureCommand("powershell", "marketplace-timeout-autorefund.jsonl"),
      bash: ingestFixtureCommand("bash", "marketplace-timeout-autorefund.jsonl")
    }
  }
];

const QUICK_LINKS = [
  {
    label: "Offer: mk-accept-offer",
    href: "/explorer/offers?id=mk-accept-offer"
  },
  {
    label: "Order: mk-accept-order",
    href: "/explorer/orders?id=mk-accept-order"
  },
  {
    label: "Milestone: mk-accept-order/m1",
    href: "/explorer/milestones?order_id=mk-accept-order&milestone_id=m1"
  },
  {
    label: "Reputation: Alice lane",
    href: "/explorer/reputation?id=d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737&lane=software-fixes&limit=20"
  }
];

const WORKFLOW_BUNDLES: WorkflowBundle[] = [
  {
    label: "Accepted Exchange Bundle",
    description: "Start a local node, ingest the accepted-path fixture, then jump into the matching builder starter.",
    commands: {
      powershell: [startNodeCommand("powershell"), ingestFixtureCommand("powershell", "marketplace-accept.jsonl")],
      bash: [startNodeCommand("bash"), ingestFixtureCommand("bash", "marketplace-accept.jsonl")]
    },
    launchHref: "/?builder_starter=alpha-accept#marketplace-event-builder",
    launchLabel: "Launch accept-flow starter",
    resultLinks: [
      { label: "Offer view", href: "/explorer/offers?id=mk-accept-offer" },
      { label: "Order view", href: "/explorer/orders?id=mk-accept-order" },
      {
        label: "Milestone view",
        href: "/explorer/milestones?order_id=mk-accept-order&milestone_id=m1"
      },
      {
        label: "Discovery view",
        href: "/explorer/discovery?service_type=software-fixes&alpha_defaults=1"
      },
      {
        label: "Provider reputation",
        href: "/explorer/reputation?id=a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0&lane=software-fixes&limit=20"
      }
    ]
  },
  {
    label: "Timeout/Auto-Refund Bundle",
    description: "Start a local node, ingest the timeout fixture, then jump directly into the dispute-path starter.",
    commands: {
      powershell: [
        startNodeCommand("powershell"),
        ingestFixtureCommand("powershell", "marketplace-timeout-autorefund.jsonl")
      ],
      bash: [startNodeCommand("bash"), ingestFixtureCommand("bash", "marketplace-timeout-autorefund.jsonl")]
    },
    launchHref: "/?builder_starter=alpha-timeout#marketplace-event-builder",
    launchLabel: "Launch timeout/dispute starter",
    resultLinks: [
      { label: "Offer view", href: "/explorer/offers?id=mk-timeout-offer" },
      { label: "Order view", href: "/explorer/orders?id=mk-timeout-order" },
      {
        label: "Milestone view",
        href: "/explorer/milestones?order_id=mk-timeout-order&milestone_id=m1"
      },
      {
        label: "Discovery view",
        href: "/explorer/discovery?service_type=software-fixes&alpha_defaults=1"
      },
      {
        label: "Provider reputation",
        href: "/explorer/reputation?id=a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0&lane=software-fixes&limit=20"
      }
    ]
  },
  {
    label: "Dispute Settlement Bundle",
    description: "Start a local node, ingest the dispute-settle fixture, then open the software-fixes dispute starter for settlement-edge validation.",
    commands: {
      powershell: [
        startNodeCommand("powershell"),
        ingestFixtureCommand("powershell", "marketplace-dispute-settle.jsonl")
      ],
      bash: [startNodeCommand("bash"), ingestFixtureCommand("bash", "marketplace-dispute-settle.jsonl")]
    },
    launchHref: "/?builder_lane=software-fixes&builder_flow=dispute#marketplace-event-builder",
    launchLabel: "Launch software-fixes dispute starter",
    resultLinks: [
      { label: "Offer view", href: "/explorer/offers?id=mk-settle-offer" },
      { label: "Order view", href: "/explorer/orders?id=mk-settle-order" },
      {
        label: "Milestone view",
        href: "/explorer/milestones?order_id=mk-settle-order&milestone_id=m1"
      },
      {
        label: "Discovery view",
        href: "/explorer/discovery?service_type=software-fixes&alpha_defaults=1"
      },
      {
        label: "Provider reputation",
        href: "/explorer/reputation?id=a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0&lane=software-fixes&limit=20"
      }
    ]
  }
] as const;

const LANE_FIXTURE_BUNDLES: WorkflowBundle[] = NON_SOFTWARE_LANE_FIXTURES.map(definition => ({
  label: `${definition.label} Fixture Bundle`,
  description: definition.acceptDescription,
  commands: {
    powershell: [
      startNodeCommand("powershell"),
      ingestFixtureCommand("powershell", `marketplace-${definition.lane}-accept.jsonl`)
    ],
    bash: [startNodeCommand("bash"), ingestFixtureCommand("bash", `marketplace-${definition.lane}-accept.jsonl`)]
  },
  launchHref: `/?builder_lane=${definition.lane}&builder_flow=accept#marketplace-event-builder`,
  launchLabel: `Launch ${definition.lane} starter`,
  resultLinks: buildLaneResultLinks(definition.lane, "accept")
}));

const LANE_DISPUTE_FIXTURE_BUNDLES: WorkflowBundle[] = NON_SOFTWARE_LANE_FIXTURES.map(
  definition => ({
    label: `${definition.label} Dispute Fixture Bundle`,
    description: definition.disputeDescription,
    commands: {
      powershell: [
        startNodeCommand("powershell"),
        ingestFixtureCommand("powershell", `marketplace-${definition.lane}-dispute.jsonl`)
      ],
      bash: [
        startNodeCommand("bash"),
        ingestFixtureCommand("bash", `marketplace-${definition.lane}-dispute.jsonl`)
      ]
    },
    launchHref: `/?builder_lane=${definition.lane}&builder_flow=dispute#marketplace-event-builder`,
    launchLabel: `Launch ${definition.lane} dispute starter`,
    resultLinks: buildLaneResultLinks(definition.lane, "dispute")
  })
);

const LANE_INSPECTION_PRESETS: LaneInspectionPreset[] = [
  {
    label: "Feature Work Inspection",
    description: "Review discovery, reputation, and both builder paths for the feature-work lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=feature-work&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=feature-work&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=feature-work&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=feature-work&builder_flow=dispute#marketplace-event-builder" }
    ]
  },
  {
    label: "Documentation Inspection",
    description: "Review discovery, reputation, and both builder paths for the documentation lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=documentation&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=documentation&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=documentation&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=documentation&builder_flow=dispute#marketplace-event-builder" }
    ]
  },
  {
    label: "Translation Inspection",
    description: "Review discovery, reputation, and both builder paths for the translation lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=translation&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=translation&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=translation&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=translation&builder_flow=dispute#marketplace-event-builder" }
    ]
  },
  {
    label: "Testing Inspection",
    description: "Review discovery, reputation, and both builder paths for the testing lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=testing&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=testing&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=testing&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=testing&builder_flow=dispute#marketplace-event-builder" }
    ]
  },
  {
    label: "Research Inspection",
    description: "Review discovery, reputation, and both builder paths for the research lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=research&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=research&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=research&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=research&builder_flow=dispute#marketplace-event-builder" }
    ]
  },
  {
    label: "Project Maintenance Inspection",
    description: "Review discovery, reputation, and both builder paths for the project-maintenance lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=project-maintenance&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=project-maintenance&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=project-maintenance&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=project-maintenance&builder_flow=dispute#marketplace-event-builder" }
    ]
  },
  {
    label: "Compute Job Inspection",
    description: "Phase 2 / experimental: review discovery, reputation, and both builder paths for the compute-job lane.",
    links: [
      { label: "Discovery", href: "/explorer/discovery?service_type=compute-job&alpha_defaults=0" },
      { label: "Reputation", href: "/explorer/reputation?lane=compute-job&limit=20" },
      { label: "Accept starter", href: "/?builder_lane=compute-job&builder_flow=accept#marketplace-event-builder" },
      { label: "Dispute starter", href: "/?builder_lane=compute-job&builder_flow=dispute#marketplace-event-builder" }
    ]
  }
] as const;

export function FixtureQuickstart() {
  const [shell, setShell] = useState<ShellKind>("powershell");
  const [status, setStatus] = useState<string>("");

  async function copyCommand(command: string, label: string) {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(command);
      setStatus(`Copied: ${label}`);
      setTimeout(() => setStatus(""), 1500);
    } catch {
      setStatus("Copy failed");
      setTimeout(() => setStatus(""), 1800);
    }
  }

  async function copyAllCommands() {
    const content = COMMANDS.map(item => `# ${item.label}\n${item.command[shell]}`).join("\n\n");
    await copyCommand(content, `All ${shell} commands`);
  }

  async function copyWorkflowBundle(bundle: WorkflowBundle) {
    const content = bundle.commands[shell].join("\n");
    await copyCommand(content, `${bundle.label} (${shell})`);
  }

  async function copyInspectionPreset(preset: LaneInspectionPreset) {
    const content = preset.links.map(link => `${link.label}: ${link.href}`).join("\n");
    await copyCommand(content, `${preset.label} links`);
  }

  async function copyBundleSet(bundles: readonly WorkflowBundle[], label: string) {
    const content = bundles
      .map(bundle => `# ${bundle.label}\n${bundle.commands[shell].join("\n")}`)
      .join("\n\n");
    await copyCommand(content, `${label} (${shell})`);
  }

  async function copyInspectionPresetSet() {
    const content = LANE_INSPECTION_PRESETS.map(
      preset =>
        `# ${preset.label}\n${preset.links.map(link => `${link.label}: ${link.href}`).join("\n")}`
    ).join("\n\n");
    await copyCommand(content, "All lane inspection presets");
  }

  return (
    <section id="fixture-quickstart" style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Fixture Quickstart</h2>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        One-click copy commands to spin up a local node and ingest reproducible fixture logs.
      </p>
      <p style={{ marginTop: 0, marginBottom: "0.75rem", opacity: 0.8 }}>
        Phase 1 closed-alpha fixture flows remain the default baseline here. The `compute-job`
        bundle is Phase 2 kickoff work and is intentionally kept separate from Phase 1 completion.
      </p>
      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <button
          type="button"
          style={shell === "powershell" ? selectedButtonStyle : buttonStyle}
          onClick={() => setShell("powershell")}
        >
          PowerShell
        </button>
        <button
          type="button"
          style={shell === "bash" ? selectedButtonStyle : buttonStyle}
          onClick={() => setShell("bash")}
        >
          Bash
        </button>
        <button type="button" style={buttonStyle} onClick={copyAllCommands}>
          Copy All Commands
        </button>
      </div>

      {COMMANDS.map(item => (
        <article key={item.label} style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{item.label}</h3>
          <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>{item.description}</p>
          <pre style={commandStyle}>{item.command[shell]}</pre>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => copyCommand(item.command[shell], `${item.label} (${shell})`)}
          >
            Copy Command
          </button>
        </article>
      ))}

      <article style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>Alpha Workflow Bundles</h3>
        <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
          Copy the exact local command bundle for a known workflow, then jump directly into the
          matching launcher path.
        </p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {WORKFLOW_BUNDLES.map(bundle => (
            <div key={bundle.label} style={nestedCardStyle}>
              <h4 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{bundle.label}</h4>
              <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
                {bundle.description}
              </p>
              <pre style={commandStyle}>{bundle.commands[shell].join("\n")}</pre>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle} onClick={() => copyWorkflowBundle(bundle)}>
                  Copy Bundle
                </button>
                <Link href={bundle.launchHref} style={linkButtonStyle}>
                  {bundle.launchLabel}
                </Link>
              </div>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                {bundle.resultLinks.map(link => (
                  <Link key={link.href} href={link.href} style={miniLinkStyle}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>Lane Fixture Bundles</h3>
        <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
          These checked-in non-software fixture bundles now provide reproducible lane-specific logs
          plus direct launcher and inspection links.
        </p>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => copyBundleSet(LANE_FIXTURE_BUNDLES, "All lane fixture bundles")}
          >
            Copy All Lane Fixture Bundles
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {LANE_FIXTURE_BUNDLES.map(bundle => (
            <div key={bundle.label} style={nestedCardStyle}>
              <h4 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{bundle.label}</h4>
              <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
                {bundle.description}
              </p>
              <pre style={commandStyle}>{bundle.commands[shell].join("\n")}</pre>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle} onClick={() => copyWorkflowBundle(bundle)}>
                  Copy Bundle
                </button>
                <Link href={bundle.launchHref} style={linkButtonStyle}>
                  {bundle.launchLabel}
                </Link>
              </div>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                {bundle.resultLinks.map(link => (
                  <Link key={link.href} href={link.href} style={miniLinkStyle}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>Lane Dispute Fixture Bundles</h3>
        <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
          These checked-in dispute fixtures let operators rehearse deterministic timeout outcomes
          for each non-software lane without generating ad hoc logs first.
        </p>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() =>
              copyBundleSet(LANE_DISPUTE_FIXTURE_BUNDLES, "All lane dispute fixture bundles")
            }
          >
            Copy All Dispute Fixture Bundles
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {LANE_DISPUTE_FIXTURE_BUNDLES.map(bundle => (
            <div key={bundle.label} style={nestedCardStyle}>
              <h4 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{bundle.label}</h4>
              <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
                {bundle.description}
              </p>
              <pre style={commandStyle}>{bundle.commands[shell].join("\n")}</pre>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle} onClick={() => copyWorkflowBundle(bundle)}>
                  Copy Bundle
                </button>
                <Link href={bundle.launchHref} style={linkButtonStyle}>
                  {bundle.launchLabel}
                </Link>
              </div>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                {bundle.resultLinks.map(link => (
                  <Link key={link.href} href={link.href} style={miniLinkStyle}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>Lane Inspection Presets</h3>
        <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
          Saved inspection sets for the manual lanes so post-launch review does not depend on
          rebuilding discovery, reputation, and builder-path links by hand.
        </p>
        <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" style={buttonStyle} onClick={copyInspectionPresetSet}>
            Copy All Inspection Presets
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {LANE_INSPECTION_PRESETS.map(preset => (
            <div key={preset.label} style={nestedCardStyle}>
              <h4 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{preset.label}</h4>
              <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
                {preset.description}
              </p>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                <button type="button" style={buttonStyle} onClick={() => copyInspectionPreset(preset)}>
                  Copy Preset Links
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
                {preset.links.map(link => (
                  <Link key={link.href} href={link.href} style={miniLinkStyle}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>Preset Explorer Links</h3>
        <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
          Open known fixture IDs directly in explorer pages after ingest.
        </p>
        <ul style={{ marginBottom: 0 }}>
          {QUICK_LINKS.map(link => (
            <li key={link.href}>
              <Link href={link.href} style={{ color: "#9fc2ff" }}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </article>

      {status ? <p style={{ marginBottom: 0, color: "#9fe0b1" }}>{status}</p> : null}
    </section>
  );
}

const sectionStyle = {
  marginTop: "1.5rem",
  border: "1px solid #2a3458",
  borderRadius: 12,
  padding: "1rem 1.25rem",
  background: "#111936"
} as const;

const cardStyle = {
  marginTop: "0.85rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.8rem",
  background: "#0d1633"
} as const;

const commandStyle = {
  marginTop: 0,
  marginBottom: "0.6rem",
  border: "1px solid #2a3458",
  borderRadius: 8,
  padding: "0.6rem 0.7rem",
  background: "#0b122b",
  whiteSpace: "pre-wrap"
} as const;

const nestedCardStyle = {
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.8rem",
  background: "#0b122b"
} as const;

const buttonStyle = {
  background: "#1a2f66",
  color: "#dbe7ff",
  border: "1px solid #3651a1",
  borderRadius: 8,
  padding: "0.45rem 0.72rem",
  cursor: "pointer"
} as const;

const selectedButtonStyle = {
  ...buttonStyle,
  border: "1px solid #6a86df",
  background: "#24408f"
} as const;

const linkButtonStyle = {
  ...buttonStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center"
} as const;

const miniLinkStyle = {
  color: "#9fc2ff",
  textDecoration: "none",
  border: "1px solid #2a3458",
  borderRadius: 8,
  padding: "0.35rem 0.55rem",
  background: "#111936"
} as const;

