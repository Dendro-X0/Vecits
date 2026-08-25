/**
 * Generate P4 mutual-cancel fixtures (ServiceCancel handshake).
 *
 * Usage: node scripts/generate-mutual-cancel-fixtures.mjs
 * Requires: pnpm --filter @new-start/sdk-ts build
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createUnsignedEnvelope, derivePublicKey, signUnsignedEnvelope } from "../packages/sdk-ts/dist/index.js";

const ALICE_SECRET = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET = "3333333333333333333333333333333333333333333333333333333333333333";

const BASE_DATE = "2026-05-01";

async function main() {
	const funded = await buildFundedExchange({ includeDelivery: false });
	const delivered = await buildFundedExchange({ includeDelivery: true });
	const accepted = await buildFundedExchange({ includeDelivery: true, includeAccept: true });

	const firstCancel = await signEvent(
		ALICE_SECRET,
		"ServiceCancel",
		ts(14),
		{
			cancelledAt: ts(14),
			milestoneId: funded.milestoneId,
			orderId: funded.orderId,
			reasonHash: "mutual-cancel-reason",
		},
		{ order: funded.order.eventId },
	);

	const matchCancel = await signEvent(
		BOB_SECRET,
		"ServiceCancel",
		ts(15),
		{
			cancelledAt: ts(15),
			milestoneId: funded.milestoneId,
			orderId: funded.orderId,
		},
		{ order: funded.order.eventId, cancel: firstCancel.eventId },
	);

	await writeFixture("fixtures/valid/marketplace-mutual-cancel.jsonl", [
		...funded.events,
		firstCancel,
		matchCancel,
	]);

	await writeFixture("fixtures/invalid/marketplace-cancel-after-delivery.jsonl", [
		...delivered.events,
		await signEvent(
			ALICE_SECRET,
			"ServiceCancel",
			ts(14),
			{
				cancelledAt: ts(14),
				milestoneId: delivered.milestoneId,
				orderId: delivered.orderId,
			},
			{ order: delivered.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-cancel-after-accept.jsonl", [
		...accepted.events,
		await signEvent(
			ALICE_SECRET,
			"ServiceCancel",
			ts(15),
			{
				cancelledAt: ts(15),
				milestoneId: accepted.milestoneId,
				orderId: accepted.orderId,
			},
			{ order: accepted.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-cancel-same-actor.jsonl", [
		...funded.events,
		firstCancel,
		await signEvent(
			ALICE_SECRET,
			"ServiceCancel",
			ts(15),
			{
				cancelledAt: ts(15),
				milestoneId: funded.milestoneId,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId, cancel: firstCancel.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-cancel-unauthorized.jsonl", [
		...funded.events,
		await signEvent(
			CAROL_SECRET,
			"ServiceCancel",
			ts(14),
			{
				cancelledAt: ts(14),
				milestoneId: funded.milestoneId,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-cancel-missing-order-ref.jsonl", [
		...funded.events,
		await signEvent(
			ALICE_SECRET,
			"ServiceCancel",
			ts(14),
			{
				cancelledAt: ts(14),
				milestoneId: funded.milestoneId,
				orderId: funded.orderId,
			},
			undefined,
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-cancel-mismatch-ref.jsonl", [
		...funded.events,
		firstCancel,
		await signEvent(
			BOB_SECRET,
			"ServiceCancel",
			ts(15),
			{
				cancelledAt: ts(15),
				milestoneId: funded.milestoneId,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId, cancel: funded.order.eventId },
		),
	]);
}

async function buildFundedExchange({ includeDelivery = false, includeAccept = false } = {}) {
	const alicePk = await derivePublicKey(ALICE_SECRET);
	const bobPk = await derivePublicKey(BOB_SECRET);
	const carolPk = await derivePublicKey(CAROL_SECRET);
	const offerId = "mk-cancel-offer";
	const orderId = "mk-cancel-order";
	const claimId = "mk-cancel-claim";
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
		await signEvent(ALICE_SECRET, "Vouch", ts(3), { subjectPubKey: bobPk }),
		await signEvent(CAROL_SECRET, "Vouch", ts(4), { subjectPubKey: bobPk }),
		await signEvent(ALICE_SECRET, "Vouch", ts(5), { subjectPubKey: carolPk }),
	);

	const claim = await signEvent(ALICE_SECRET, "ContributionClaim", ts(6), {
		claimId,
		claimType: "maintenance",
		artifactHash: "mk-cancel-claim-artifact",
		summary: "mutual cancel buyer credit prep",
		requestedCredits: 200,
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
				amount: 200,
				expiresAt: "2026-12-31T00:00:00Z",
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
		offerExpiresAt: "2026-12-31T00:00:00Z",
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
			orderExpiresAt: "2026-12-31T00:00:00Z",
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
			"mk-cancel-escrow-1",
		),
	);

	let delivery = null;
	if (includeDelivery) {
		delivery = await signEvent(
			BOB_SECRET,
			"ServiceDelivery",
			ts(13),
			{
				artifactHashes: ["mk-cancel-delivery-hash"],
				deliveredAt: ts(13),
				evidenceFormat: "artifactHash",
				milestoneId,
				orderId,
			},
			{ order: order.eventId },
		);
		events.push(delivery);
	}

	if (includeAccept && delivery) {
		events.push(
			await signEvent(
				ALICE_SECRET,
				"ServiceAccept",
				ts(14),
				{
					acceptedAt: ts(14),
					milestoneId,
					orderId,
				},
				{ delivery: delivery.eventId },
			),
		);
	}

	return { events, order, orderId, milestoneId, delivery };
}

async function writeFixture(file, events) {
	const body = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
	await writeFile(path.resolve(file), body, "utf8");
	console.log(file);
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

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
