#!/usr/bin/env node
/**
 * SX guidance unit — Profile A/B lane hints (staged-exchange-practice-design).
 */

import assert from "node:assert/strict";
import {
  exchangeProfileForLane,
  milestoneScheduleHint,
  OFFLINE_ONESHOT_MILESTONE_HINT,
  STAGED_DIGITAL_MILESTONE_HINT
} from "../apps/web/lib/marketplace/staged-exchange-guidance.ts";

assert.equal(exchangeProfileForLane("compute-job"), "staged-digital");
assert.equal(exchangeProfileForLane("software-fixes"), "staged-digital");
assert.equal(exchangeProfileForLane("physical-handoff"), "offline-oneshot");
assert.equal(exchangeProfileForLane("local-resource-exchange"), "offline-oneshot");
assert.equal(exchangeProfileForLane("unknown-lane"), "general");

assert.equal(milestoneScheduleHint("compute-job"), STAGED_DIGITAL_MILESTONE_HINT);
assert.equal(milestoneScheduleHint("physical-handoff"), OFFLINE_ONESHOT_MILESTONE_HINT);
assert.ok(milestoneScheduleHint().includes("phase"));

console.log("SX staged-exchange guidance unit passed.");
