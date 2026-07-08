/**
 * Generate invalid marketplace fixtures for protocol-fixture-gap-audit GAP-01..07,
 * trust-bootstrap fixtures SCN-17, and GAP-08 physical-handoff happy path.
 *
 * Usage: node scripts/generate-protocol-gap-fixtures.mjs
 * Requires: pnpm --filter @new-start/sdk-ts build
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createUnsignedEnvelope, derivePublicKey, signUnsignedEnvelope } from "../packages/sdk-ts/dist/index.js";

const ALICE_SECRET = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET = "3333333333333333333333333333333333333333333333333333333333333333";

const BASE_DATE = "2026-03-07";
const OFFLINE_BASE_DATE = "2026-04-01";
const DELIVERY_AT = `${BASE_DATE}T00:00:13Z`;
/** Default policy acceptanceWindowSeconds = 7 days (`crates/policy/src/lib.rs`). */
const AFTER_WINDOW_AT = `${BASE_DATE.replace(/07$/, "15")}T00:00:00Z`;

async function main() {
	const funded = await buildSoftwareFixesExchange({ includeDelivery: true });
	const fundedPrefix = funded.events.slice(0, -1);
	const delivery = funded.delivery;

	const throughOrder = await buildSoftwareFixesExchange({ includeDelivery: false });
	const disputed = await buildSoftwareFixesExchange({
		includeDelivery: true,
		includeDispute: true,
	});
	const disputedPrefix = disputed.events.slice(0, -1);

	const outputs = [
		{
			file: "fixtures/invalid/marketplace-accept-after-window.jsonl",
			events: [
				...fundedPrefix,
				await signEvent(
					ALICE_SECRET,
					"ServiceAccept",
					AFTER_WINDOW_AT,
					{
						acceptedAt: AFTER_WINDOW_AT,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
					},
					{ delivery: delivery.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-dispute-after-window.jsonl",
			events: [
				...fundedPrefix,
				await signEvent(
					ALICE_SECRET,
					"ServiceDispute",
					AFTER_WINDOW_AT,
					{
						disputedAt: AFTER_WINDOW_AT,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
						reasonCode: "quality",
					},
					{ delivery: delivery.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-dispute-after-accept.jsonl",
			events: [
				...fundedPrefix,
				await signEvent(
					ALICE_SECRET,
					"ServiceAccept",
					`${BASE_DATE}T00:00:14Z`,
					{
						acceptedAt: `${BASE_DATE}T00:00:14Z`,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
					},
					{ delivery: delivery.eventId },
				),
				await signEvent(
					ALICE_SECRET,
					"ServiceDispute",
					`${BASE_DATE}T00:00:15Z`,
					{
						disputedAt: `${BASE_DATE}T00:00:15Z`,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
						reasonCode: "quality",
					},
					{ delivery: delivery.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-delivery-wrong-evidence-format.jsonl",
			events: [
				...fundedPrefix,
				await signEvent(
					BOB_SECRET,
					"ServiceDelivery",
					DELIVERY_AT,
					{
						artifactHashes: ["gap-wrong-format-hash"],
						deliveredAt: DELIVERY_AT,
						evidenceFormat: "job-receipt-v1",
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
						notesHash: "gap-wrong-format-notes",
					},
					{ order: funded.order.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-delivery-before-funded.jsonl",
			events: [
				...throughOrder.events,
				await signEvent(
					BOB_SECRET,
					"ServiceDelivery",
					ts(12),
					{
						artifactHashes: ["gap-early-delivery-hash"],
						deliveredAt: ts(12),
						evidenceFormat: "artifactHash",
						milestoneId: throughOrder.milestoneId,
						orderId: throughOrder.orderId,
					},
					{ order: throughOrder.order.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-duplicate-accept.jsonl",
			events: [
				...fundedPrefix,
				await signEvent(
					ALICE_SECRET,
					"ServiceAccept",
					`${BASE_DATE}T00:00:14Z`,
					{
						acceptedAt: `${BASE_DATE}T00:00:14Z`,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
					},
					{ delivery: delivery.eventId },
				),
				await signEvent(
					ALICE_SECRET,
					"ServiceAccept",
					`${BASE_DATE}T00:00:15Z`,
					{
						acceptedAt: `${BASE_DATE}T00:00:15Z`,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
					},
					{ delivery: delivery.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-settle-amounts-not-funded-total.jsonl",
			events: [
				...disputedPrefix,
				await signEvent(
					ALICE_SECRET,
					"ServiceSettle",
					`${BASE_DATE}T00:00:16Z`,
					{
						buyerRefundCredits: 40,
						providerRewardCredits: 50,
						milestoneId: disputed.milestoneId,
						orderId: disputed.orderId,
						outcome: "split",
						settledAt: `${BASE_DATE}T00:00:16Z`,
					},
					{ dispute: disputed.dispute.eventId },
				),
			],
		},
		{
			file: "fixtures/invalid/marketplace-settle-without-dispute.jsonl",
			events: [
				...fundedPrefix,
				await signEvent(
					ALICE_SECRET,
					"ServiceSettle",
					`${BASE_DATE}T00:00:14Z`,
					{
						buyerRefundCredits: 0,
						providerRewardCredits: 100,
						milestoneId: funded.milestoneId,
						orderId: funded.orderId,
						outcome: "split",
						settledAt: `${BASE_DATE}T00:00:14Z`,
					},
					{ dispute: delivery.eventId },
				),
			],
		},
	];

	for (const { file, events } of outputs) {
		const body = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
		await writeFile(path.resolve(file), body, "utf8");
		console.log(file);
	}

	const genesisEligible = await buildGenesisPrefix(2);
	await writeFixture(
		"fixtures/valid/bootstrap-provider-vouch-eligibility.jsonl",
		[
			...genesisEligible.events,
			await signEvent(BOB_SECRET, "ServiceOffer", ts(10), {
				offerId: "bootstrap-software-fixes-offer",
				serviceType: "software-fixes",
				unitDefinition: "fix per issue",
				pricePerUnitCredits: 100,
				deliveryMode: "artifact",
				offerExpiresAt: "2026-12-01T00:00:00Z",
				allowedEvidenceFormats: ["artifactHash"],
			}),
		],
	);

	const genesisUnderVouched = await buildGenesisPrefix(1);
	await writeFixture("fixtures/invalid/marketplace-offer-below-trust-threshold.jsonl", [
		...genesisUnderVouched.events,
		await signEvent(BOB_SECRET, "ServiceOffer", ts(10), {
			offerId: "bootstrap-under-vouched-offer",
			serviceType: "software-fixes",
			unitDefinition: "fix per issue",
			pricePerUnitCredits: 100,
			deliveryMode: "artifact",
			offerExpiresAt: "2026-12-01T00:00:00Z",
			allowedEvidenceFormats: ["artifactHash"],
		}),
	]);

	const handoff = await buildPhysicalHandoffAcceptExchange();
	await writeFixture("fixtures/valid/marketplace-physical-handoff-accept.jsonl", handoff.events);
}

async function writeFixture(file, events) {
	const body = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
	await writeFile(path.resolve(file), body, "utf8");
	console.log(file);
}

async function buildGenesisPrefix(providerVouchCount) {
	const alicePk = await derivePublicKey(ALICE_SECRET);
	const bobPk = await derivePublicKey(BOB_SECRET);
	const carolPk = await derivePublicKey(CAROL_SECRET);
	const events = [
		await signEvent(ALICE_SECRET, "IdentityCreate", ts(0), {
			identityPubKey: alicePk,
			metadata: { displayName: "alice" },
		}),
		await signEvent(BOB_SECRET, "IdentityCreate", ts(1), {
			identityPubKey: bobPk,
			metadata: { displayName: "bob" },
		}),
		await signEvent(CAROL_SECRET, "IdentityCreate", ts(2), {
			identityPubKey: carolPk,
			metadata: { displayName: "carol" },
		}),
	];
	if (providerVouchCount >= 1) {
		events.push(
			await signEvent(ALICE_SECRET, "Vouch", ts(3), {
				subjectPubKey: bobPk,
			}),
		);
	}
	if (providerVouchCount >= 2) {
		events.push(
			await signEvent(CAROL_SECRET, "Vouch", ts(4), {
				subjectPubKey: bobPk,
			}),
		);
	}
	return { events, bobPk };
}

async function buildSoftwareFixesExchange({ includeDelivery, includeDispute = false }) {
	const alicePk = await derivePublicKey(ALICE_SECRET);
	const bobPk = await derivePublicKey(BOB_SECRET);
	const carolPk = await derivePublicKey(CAROL_SECRET);
	const offerId = "gap-software-fixes-offer";
	const orderId = "gap-software-fixes-order";
	const claimId = "gap-software-fixes-claim";
	const milestoneId = "m1";
	const events = [];

	events.push(
		await signEvent(ALICE_SECRET, "IdentityCreate", ts(0), {
			identityPubKey: alicePk,
			metadata: { displayName: "alice" },
		}),
		await signEvent(BOB_SECRET, "IdentityCreate", ts(1), {
			identityPubKey: bobPk,
			metadata: { displayName: "bob" },
		}),
		await signEvent(CAROL_SECRET, "IdentityCreate", ts(2), {
			identityPubKey: carolPk,
			metadata: { displayName: "carol" },
		}),
	);

	events.push(
		await signEvent(ALICE_SECRET, "Vouch", ts(3), { subjectPubKey: bobPk }),
		await signEvent(CAROL_SECRET, "Vouch", ts(4), { subjectPubKey: bobPk }),
		await signEvent(ALICE_SECRET, "Vouch", ts(5), { subjectPubKey: carolPk }),
	);

	const claim = await signEvent(ALICE_SECRET, "ContributionClaim", ts(6), {
		claimId,
		claimType: "maintenance",
		artifactHash: "gap-claim-artifact",
		summary: "gap fixture buyer credit prep",
		requestedCredits: 500,
	});
	events.push(claim);
	events.push(
		await signEvent(
			BOB_SECRET,
			"ContributionAttest",
			ts(7),
			{ claimId, decision: "approve" },
			{ claim: claim.eventId },
		),
		await signEvent(
			CAROL_SECRET,
			"ContributionAttest",
			ts(8),
			{ claimId, decision: "approve" },
			{ claim: claim.eventId },
		),
		await signEvent(
			ALICE_SECRET,
			"MintCredits",
			ts(9),
			{
				beneficiaryPubKey: alicePk,
				amount: 500,
				expiresAt: "2026-12-01T00:00:00Z",
				mintReason: "contribution",
				sourceClaimId: claimId,
			},
			{ claim: claim.eventId },
		),
	);

	const offer = await signEvent(BOB_SECRET, "ServiceOffer", ts(10), {
		offerId,
		serviceType: "software-fixes",
		unitDefinition: "fix per issue",
		pricePerUnitCredits: 100,
		deliveryMode: "artifact",
		offerExpiresAt: "2026-12-01T00:00:00Z",
		allowedEvidenceFormats: ["artifactHash"],
	});
	events.push(offer);

	const order = await signEvent(
		ALICE_SECRET,
		"ServiceOrder",
		ts(11),
		{
			buyerPubKey: alicePk,
			providerPubKey: bobPk,
			orderId,
			offerId,
			orderExpiresAt: "2026-12-15T00:00:00Z",
			milestones: [
				{
					milestoneId,
					amountCredits: 100,
					evidenceFormat: "artifactHash",
				},
			],
		},
		{ offer: offer.eventId },
	);
	events.push(order);

	events.push(
		await signEvent(
			ALICE_SECRET,
			"SpendCredits",
			ts(12),
			{
				amount: 100,
				milestoneId,
				orderId,
				sinkKind: "ServiceEscrowSink",
				spenderPubKey: alicePk,
			},
			undefined,
			"gap-escrow-1",
		),
	);

	let delivery = null;
	if (includeDelivery) {
		delivery = await signEvent(
			BOB_SECRET,
			"ServiceDelivery",
			DELIVERY_AT,
			{
				artifactHashes: ["gap-delivery-hash"],
				deliveredAt: DELIVERY_AT,
				evidenceFormat: "artifactHash",
				milestoneId,
				orderId,
			},
			{ order: order.eventId },
		);
		events.push(delivery);
	}

	let dispute = null;
	if (includeDispute && delivery) {
		dispute = await signEvent(
			ALICE_SECRET,
			"ServiceDispute",
			`${BASE_DATE}T00:00:15Z`,
			{
				disputedAt: `${BASE_DATE}T00:00:15Z`,
				milestoneId,
				orderId,
				reasonCode: "quality",
			},
			{ delivery: delivery.eventId },
		);
		events.push(dispute);
	}

	return { events, delivery, dispute, order, orderId, milestoneId };
}

async function buildPhysicalHandoffAcceptExchange() {
	const alicePk = await derivePublicKey(ALICE_SECRET);
	const bobPk = await derivePublicKey(BOB_SECRET);
	const carolPk = await derivePublicKey(CAROL_SECRET);
	const offerId = "gap-physical-handoff-offer";
	const orderId = "gap-physical-handoff-order";
	const claimId = "gap-physical-handoff-claim";
	const milestoneId = "m1";
	const deliveryAt = offlineTs(13);
	const acceptedAt = offlineTs(14);
	const events = [];

	events.push(
		await signEvent(ALICE_SECRET, "IdentityCreate", offlineTs(0), {
			identityPubKey: alicePk,
			metadata: { displayName: "alice" },
		}),
		await signEvent(BOB_SECRET, "IdentityCreate", offlineTs(1), {
			identityPubKey: bobPk,
			metadata: { displayName: "bob" },
		}),
		await signEvent(CAROL_SECRET, "IdentityCreate", offlineTs(2), {
			identityPubKey: carolPk,
			metadata: { displayName: "carol" },
		}),
		await signEvent(ALICE_SECRET, "Vouch", offlineTs(3), { subjectPubKey: bobPk }),
		await signEvent(CAROL_SECRET, "Vouch", offlineTs(4), { subjectPubKey: bobPk }),
		await signEvent(ALICE_SECRET, "Vouch", offlineTs(5), { subjectPubKey: carolPk }),
	);

	const claim = await signEvent(ALICE_SECRET, "ContributionClaim", offlineTs(6), {
		claimId,
		claimType: "maintenance",
		artifactHash: "gap-handoff-claim-artifact",
		summary: "gap-08 physical-handoff buyer credit prep",
		requestedCredits: 200,
	});
	events.push(claim);
	events.push(
		await signEvent(
			BOB_SECRET,
			"ContributionAttest",
			offlineTs(7),
			{ claimId, decision: "approve" },
			{ claim: claim.eventId },
		),
		await signEvent(
			CAROL_SECRET,
			"ContributionAttest",
			offlineTs(8),
			{ claimId, decision: "approve" },
			{ claim: claim.eventId },
		),
		await signEvent(
			ALICE_SECRET,
			"MintCredits",
			offlineTs(9),
			{
				beneficiaryPubKey: alicePk,
				amount: 200,
				expiresAt: "2026-12-31T00:00:00Z",
				mintReason: "contribution",
				sourceClaimId: claimId,
			},
			{ claim: claim.eventId },
		),
	);

	const offer = await signEvent(BOB_SECRET, "ServiceOffer", offlineTs(10), {
		offerId,
		serviceType: "physical-handoff",
		unitDefinition: "in-person handoff",
		pricePerUnitCredits: 100,
		deliveryMode: "in-person",
		offerExpiresAt: "2026-12-31T00:00:00Z",
		allowedEvidenceFormats: ["physical-handoff-ack-dual-v1"],
	});
	events.push(offer);

	const order = await signEvent(
		ALICE_SECRET,
		"ServiceOrder",
		offlineTs(11),
		{
			buyerPubKey: alicePk,
			providerPubKey: bobPk,
			orderId,
			offerId,
			orderExpiresAt: "2026-12-31T00:00:00Z",
			milestones: [
				{
					milestoneId,
					amountCredits: 100,
					evidenceFormat: "physical-handoff-ack-dual-v1",
				},
			],
		},
		{ offer: offer.eventId },
	);
	events.push(order);

	events.push(
		await signEvent(
			ALICE_SECRET,
			"SpendCredits",
			offlineTs(12),
			{
				amount: 100,
				milestoneId,
				orderId,
				sinkKind: "ServiceEscrowSink",
				spenderPubKey: alicePk,
			},
			undefined,
			"gap-handoff-escrow-1",
		),
	);

	const delivery = await signEvent(
		BOB_SECRET,
		"ServiceDelivery",
		deliveryAt,
		{
			artifactHashes: ["provider-handoff-ack", "buyer-handoff-ack"],
			deliveredAt: deliveryAt,
			evidenceFormat: "physical-handoff-ack-dual-v1",
			milestoneId,
			notesHash: "gap-handoff-notes",
			orderId,
		},
		{ order: order.eventId },
	);
	events.push(delivery);

	events.push(
		await signEvent(
			ALICE_SECRET,
			"ServiceAccept",
			acceptedAt,
			{
				acceptedAt,
				milestoneId,
				orderId,
			},
			{ delivery: delivery.eventId },
		),
	);

	return { events, orderId, milestoneId, deliveryAt, acceptedAt };
}

async function signEvent(secretKey, kind, createdAt, payload, references, nonce) {
	const authorPubKey = await derivePublicKey(secretKey);
	const unsigned = createUnsignedEnvelope({
		authorPubKey,
		kind,
		createdAt,
		payload,
		references,
		nonce,
		policyVersion: "v0-default",
	});
	return signUnsignedEnvelope(unsigned, secretKey);
}

function ts(second) {
	return `${BASE_DATE}T00:00:${String(second).padStart(2, "0")}Z`;
}

function offlineTs(second) {
	return `${OFFLINE_BASE_DATE}T00:00:${String(second).padStart(2, "0")}Z`;
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
