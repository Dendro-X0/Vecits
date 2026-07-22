# Architecture

System design, protocol shape, lane contracts, and evolution strategy.

The **protocol kernel** (signed events, deterministic replay) is separate from the **application** (replaceable UX/platform). See [v0-architecture.md § Protocol vs application](v0-architecture.md#protocol-vs-application).

| Document | Purpose |
| --- | --- |
| [v0-architecture.md](v0-architecture.md) | Component boundaries |
| [v0-foundation.md](v0-foundation.md) | v0 scope and success criteria |
| [v0-spec-outline.md](v0-spec-outline.md) | Protocol outline |
| [event-versioning-strategy.md](event-versioning-strategy.md) | Event/policy evolution |
| [software-fixes-lane.md](software-fixes-lane.md) | **Reference v1 lane** — bounded bugfix / CI repair |
| [aperio-engine-integration.md](aperio-engine-integration.md) | **Aperio Rust engine → Vectis** (operational bridge) |
| [discovery-engine-bridge.md](discovery-engine-bridge.md) | Exploratory predecessor (see aperio-engine-integration) |
| [stalled-project-support-flow.md](stalled-project-support-flow.md) | Project-maintenance lane |
| [phase2-compute-job-lane.md](phase2-compute-job-lane.md) | Compute job lane |

← [Docs index](../index.md)
