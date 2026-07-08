/**
 * Generate P2H / issuance-control policy fixtures (SCN-19).
 *
 * Usage: node scripts/generate-p2h-policy-fixtures.mjs
 * Requires: pnpm --filter @new-start/sdk-ts build
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createUnsignedEnvelope, derivePublicKey, signUnsignedEnvelope } from "../packages/sdk-ts/dist/index.js";

const ALICE_SECRET = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET = "3333333333333333333333333333333333333333333333333333333333333333";

const BASE_DATE = "2026-02-01";

async function signEvent(secretKey, kind, createdAt, payload, references, nonce, policyVersion = "v0-default") {
	const authorPubKey = await derivePublicKey(secretKey);
	const unsigned = createUnsignedEnvelope({
		authorPubKey,
		kind,
		createdAt,
		payload,
		references,
		nonce,
		policyVersion,
	});
	return signUnsignedEnvelope(unsigned, secretKey);
}

function ts(dayOffset, second) {
	const day = 1 + dayOffset;
	return `2026-02-${String(day).padStart(2, "0")}T00:00:${String(second).padStart(2, "0")}Z`;
}

function policyPayload(authorityPubKey, version, controls) {
	return {
		version,
		clockSkewSeconds: 300,
		creditDefaultExpiryDays: 180,
		providerRewardExpiryDays: 90,
		demurrageRateWeeklyBps: 100,
		claimApprovalThreshold: 2,
		maxContributionClaimCredits: 1000,
		allowedServiceTypes: [
			"software-fixes",
			"documentation",
			"project-maintenance",
			"local-resource-exchange",
			"physical-handoff",
		],
		maxMilestonesPerOrder: 16,
		maxMilestoneCredits: 5000,
		acceptanceWindowSeconds: 604800,
		disputeTimeoutSeconds: 1209600,
		providerEligibilityThreshold: 2,
		attestorEligibilityThreshold: 1,
		allowedSinkKinds: ["ServiceEscrowSink", "ComputeSink", "AISink", "StorageSink", "BountySink"],
		policyAuthorityPubKey: authorityPubKey,
		issuanceWindowSeconds: controls.issuanceWindowSeconds,
		maxIssuanceEventsPerIdentityWindow: controls.maxIssuanceEventsPerIdentityWindow,
		maxIssuanceEventsPerLaneWindow: controls.maxIssuanceEventsPerLaneWindow,
		minIssuanceCounterpartyDiversity: controls.minIssuanceCounterpartyDiversity,
		...(controls.maxP2hRiskBand ? { maxP2hRiskBand: controls.maxP2hRiskBand } : {}),
	};
}

async function buildBootstrap() {
	const alicePk = await derivePublicKey(ALICE_SECRET);
	const bobPk = await derivePublicKey(BOB_SECRET);
	const carolPk = await derivePublicKey(CAROL_SECRET);
	return {
		events: [
			await signEvent(ALICE_SECRET, "IdentityCreate", ts(0, 0), {
				identityPubKey: alicePk,
				metadata: { displayName: "alice" },
			}),
			await signEvent(BOB_SECRET, "IdentityCreate", ts(0, 1), {
				identityPubKey: bobPk,
				metadata: { displayName: "bob" },
			}),
			await signEvent(CAROL_SECRET, "IdentityCreate", ts(0, 2), {
				identityPubKey: carolPk,
				metadata: { displayName: "carol" },
			}),
			await signEvent(ALICE_SECRET, "Vouch", ts(0, 3), { subjectPubKey: bobPk, weight: 1 }),
			await signEvent(ALICE_SECRET, "Vouch", ts(0, 4), { subjectPubKey: carolPk, weight: 1 }),
			await signEvent(BOB_SECRET, "Vouch", ts(0, 5), { subjectPubKey: alicePk, weight: 1 }),
			await signEvent(CAROL_SECRET, "Vouch", ts(0, 6), { subjectPubKey: alicePk, weight: 1 }),
		],
		alicePk,
	};
}

async function buildMintCycle({ claimId, dayOffset, policyVersion, alicePk }) {
	const claim = await signEvent(
		ALICE_SECRET,
		"ContributionClaim",
		ts(dayOffset, 10),
		{
			claimId,
			claimType: "maintenance",
			artifactHash: `artifact-${claimId}`,
			summary: `p2h fixture claim ${claimId}`,
			requestedCredits: 10,
		},
		undefined,
		undefined,
		policyVersion,
	);
	const attestBob = await signEvent(
		BOB_SECRET,
		"ContributionAttest",
		ts(dayOffset, 11),
		{ claimId, decision: "approve" },
		{ claim: claim.eventId },
		undefined,
		policyVersion,
	);
	const attestCarol = await signEvent(
		CAROL_SECRET,
		"ContributionAttest",
		ts(dayOffset, 12),
		{ claimId, decision: "approve" },
		{ claim: claim.eventId },
		undefined,
		policyVersion,
	);
	const mint = await signEvent(
		ALICE_SECRET,
		"MintCredits",
		ts(dayOffset, 13),
		{
			beneficiaryPubKey: alicePk,
			amount: 10,
			expiresAt: "2026-12-31T00:00:00Z",
			mintReason: "contribution",
			sourceClaimId: claimId,
		},
		{ claim: claim.eventId },
		undefined,
		policyVersion,
	);
	return [claim, attestBob, attestCarol, mint];
}

async function writeFixture(file, events) {
	const body = `${events.map(event => JSON.stringify(event)).join("\n")}\n`;
	await writeFile(path.resolve(file), body, "utf8");
	console.log(file);
}

async function main() {
	const { events: prefix, alicePk } = await buildBootstrap();

	const policyVersion = "v0-policy-p2h";
	const activationPolicy = await signEvent(
		ALICE_SECRET,
		"PolicyUpdate",
		ts(1, 0),
		{
			nextPolicyVersion: policyVersion,
			effectiveAt: ts(2, 0),
			policy: policyPayload(alicePk, policyVersion, {
				issuanceWindowSeconds: 86400,
				maxIssuanceEventsPerIdentityWindow: 1,
				maxIssuanceEventsPerLaneWindow: 0,
				minIssuanceCounterpartyDiversity: 2,
				maxP2hRiskBand: "medium",
			}),
		},
	);

	const activationMintOne = await buildMintCycle({
		claimId: "p2h-activation-claim-1",
		dayOffset: 3,
		policyVersion,
		alicePk,
	});
	const activationMintTwo = await buildMintCycle({
		claimId: "p2h-activation-claim-2",
		dayOffset: 5,
		policyVersion,
		alicePk,
	});

	await writeFixture("fixtures/valid/policy-update-p2h-activation.jsonl", [
		...prefix,
		activationPolicy,
		...activationMintOne,
		...activationMintTwo,
	]);

	const ratePolicy = await signEvent(
		ALICE_SECRET,
		"PolicyUpdate",
		ts(1, 0),
		{
			nextPolicyVersion: "v0-policy-rate",
			effectiveAt: ts(2, 0),
			policy: policyPayload(alicePk, "v0-policy-rate", {
				issuanceWindowSeconds: 604800,
				maxIssuanceEventsPerIdentityWindow: 1,
				maxIssuanceEventsPerLaneWindow: 0,
				minIssuanceCounterpartyDiversity: 2,
			}),
		},
	);
	const rateMintOne = await buildMintCycle({
		claimId: "p2h-rate-claim-1",
		dayOffset: 3,
		policyVersion: "v0-policy-rate",
		alicePk,
	});
	const rateMintTwo = await buildMintCycle({
		claimId: "p2h-rate-claim-2",
		dayOffset: 4,
		policyVersion: "v0-policy-rate",
		alicePk,
	});

	await writeFixture("fixtures/invalid/mint-issuance-rate-exceeded.jsonl", [
		...prefix,
		ratePolicy,
		...rateMintOne,
		...rateMintTwo,
	]);

	const p2hBandPolicy = await signEvent(
		ALICE_SECRET,
		"PolicyUpdate",
		ts(10, 0),
		{
			nextPolicyVersion: "v0-policy-p2h-band",
			effectiveAt: ts(11, 0),
			policy: policyPayload(alicePk, "v0-policy-p2h-band", {
				issuanceWindowSeconds: 0,
				maxIssuanceEventsPerIdentityWindow: 0,
				maxIssuanceEventsPerLaneWindow: 0,
				minIssuanceCounterpartyDiversity: 0,
				maxP2hRiskBand: "low",
			}),
		},
	);

	const historyMints = [];
	for (let index = 0; index < 4; index += 1) {
		historyMints.push(
			...(await buildMintCycle({
				claimId: `p2h-band-history-${index + 1}`,
				dayOffset: index,
				policyVersion: "v0-default",
				alicePk,
			})),
		);
	}
	const blockedMint = await buildMintCycle({
		claimId: "p2h-band-blocked",
		dayOffset: 12,
		policyVersion: "v0-policy-p2h-band",
		alicePk,
	});

	await writeFixture("fixtures/invalid/mint-p2h-risk-band-exceeded.jsonl", [
		...prefix,
		...historyMints,
		p2hBandPolicy,
		...blockedMint,
	]);
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
