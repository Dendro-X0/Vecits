/**
 * Generate OrderAmend v1 fixtures (amount + order expiry handshake).
 *
 * Usage: node scripts/generate-order-amend-fixtures.mjs
 * Requires: pnpm --filter @new-start/sdk-ts build
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createUnsignedEnvelope, derivePublicKey, signUnsignedEnvelope } from "../packages/sdk-ts/dist/index.js";

const ALICE_SECRET = "1111111111111111111111111111111111111111111111111111111111111111";
const BOB_SECRET = "2222222222222222222222222222222222222222222222222222222222222222";
const CAROL_SECRET = "3333333333333333333333333333333333333333333333333333333333333333";

const BASE_DATE = "2026-06-01";
const NEW_EXPIRY = "2026-12-31T00:00:00Z";
const OVER_CAP_AMOUNT = 5001;

async function main() {
	const funded = await buildFundedExchange({ amountCredits: 100, mintAmount: 300 });
	const delivered = await buildFundedExchange({
		amountCredits: 100,
		mintAmount: 200,
		includeDelivery: true,
		idSuffix: "del",
	});

	const firstDecrease = await signEvent(
		ALICE_SECRET,
		"OrderAmend",
		ts(14),
		{
			amendedAt: ts(14),
			amountCredits: 60,
			milestoneId: funded.milestoneId,
			orderExpiresAt: NEW_EXPIRY,
			orderId: funded.orderId,
			reasonHash: "amend-decrease-reason",
		},
		{ order: funded.order.eventId },
	);
	const matchDecrease = await signEvent(
		BOB_SECRET,
		"OrderAmend",
		ts(15),
		{
			amendedAt: ts(15),
			amountCredits: 60,
			milestoneId: funded.milestoneId,
			orderExpiresAt: NEW_EXPIRY,
			orderId: funded.orderId,
		},
		{ order: funded.order.eventId, amend: firstDecrease.eventId },
	);

	await writeFixture("fixtures/valid/marketplace-order-amend-decrease.jsonl", [
		...funded.events,
		firstDecrease,
		matchDecrease,
	]);

	const increaseBase = await buildFundedExchange({
		amountCredits: 100,
		mintAmount: 300,
		idSuffix: "inc",
	});
	const firstIncrease = await signEvent(
		ALICE_SECRET,
		"OrderAmend",
		ts(14),
		{
			amendedAt: ts(14),
			amountCredits: 150,
			milestoneId: increaseBase.milestoneId,
			orderExpiresAt: NEW_EXPIRY,
			orderId: increaseBase.orderId,
		},
		{ order: increaseBase.order.eventId },
	);
	const matchIncrease = await signEvent(
		BOB_SECRET,
		"OrderAmend",
		ts(15),
		{
			amendedAt: ts(15),
			amountCredits: 150,
			milestoneId: increaseBase.milestoneId,
			orderExpiresAt: NEW_EXPIRY,
			orderId: increaseBase.orderId,
		},
		{ order: increaseBase.order.eventId, amend: firstIncrease.eventId },
	);
	const topUp = await signEvent(
		ALICE_SECRET,
		"SpendCredits",
		ts(16),
		{
			amount: 50,
			milestoneId: increaseBase.milestoneId,
			orderId: increaseBase.orderId,
			sinkKind: "ServiceEscrowSink",
			spenderPubKey: await derivePublicKey(ALICE_SECRET),
		},
		undefined,
		"mk-amend-escrow-topup",
	);

	await writeFixture("fixtures/valid/marketplace-order-amend-increase.jsonl", [
		...increaseBase.events,
		firstIncrease,
		matchIncrease,
		topUp,
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-after-delivery.jsonl", [
		...delivered.events,
		await signEvent(
			ALICE_SECRET,
			"OrderAmend",
			ts(14),
			{
				amendedAt: ts(14),
				amountCredits: 60,
				milestoneId: delivered.milestoneId,
				orderExpiresAt: NEW_EXPIRY,
				orderId: delivered.orderId,
			},
			{ order: delivered.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-same-actor.jsonl", [
		...funded.events,
		firstDecrease,
		await signEvent(
			ALICE_SECRET,
			"OrderAmend",
			ts(15),
			{
				amendedAt: ts(15),
				amountCredits: 60,
				milestoneId: funded.milestoneId,
				orderExpiresAt: NEW_EXPIRY,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId, amend: firstDecrease.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-unauthorized.jsonl", [
		...funded.events,
		await signEvent(
			CAROL_SECRET,
			"OrderAmend",
			ts(14),
			{
				amendedAt: ts(14),
				amountCredits: 60,
				milestoneId: funded.milestoneId,
				orderExpiresAt: NEW_EXPIRY,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-missing-order-ref.jsonl", [
		...funded.events,
		await signEvent(
			ALICE_SECRET,
			"OrderAmend",
			ts(14),
			{
				amendedAt: ts(14),
				amountCredits: 60,
				milestoneId: funded.milestoneId,
				orderExpiresAt: NEW_EXPIRY,
				orderId: funded.orderId,
			},
			undefined,
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-mismatch-ref.jsonl", [
		...funded.events,
		firstDecrease,
		await signEvent(
			BOB_SECRET,
			"OrderAmend",
			ts(15),
			{
				amendedAt: ts(15),
				amountCredits: 60,
				milestoneId: funded.milestoneId,
				orderExpiresAt: NEW_EXPIRY,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId, amend: funded.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-over-cap.jsonl", [
		...funded.events,
		await signEvent(
			ALICE_SECRET,
			"OrderAmend",
			ts(14),
			{
				amendedAt: ts(14),
				amountCredits: OVER_CAP_AMOUNT,
				milestoneId: funded.milestoneId,
				orderExpiresAt: NEW_EXPIRY,
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId },
		),
	]);

	await writeFixture("fixtures/invalid/marketplace-amend-bad-expiry.jsonl", [
		...funded.events,
		await signEvent(
			ALICE_SECRET,
			"OrderAmend",
			ts(14),
			{
				amendedAt: ts(14),
				amountCredits: 60,
				milestoneId: funded.milestoneId,
				orderExpiresAt: "2026-05-01T00:00:00Z",
				orderId: funded.orderId,
			},
			{ order: funded.order.eventId },
		),
	]);
}

async function buildFundedExchange({
	amountCredits = 100,
	mintAmount = 200,
	includeDelivery = false,
	idSuffix = "",
} = {}) {
	const alicePk = await derivePublicKey(ALICE_SECRET);
	const bobPk = await derivePublicKey(BOB_SECRET);
	const carolPk = await derivePublicKey(CAROL_SECRET);
	const tag = idSuffix ? `-${idSuffix}` : "";
	const offerId = `mk-amend-offer${tag}`;
	const orderId = `mk-amend-order${tag}`;
	const claimId = `mk-amend-claim${tag}`;
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
		artifactHash: `mk-amend-claim-artifact${tag}`,
		summary: "order amend buyer credit prep",
		requestedCredits: mintAmount,
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
				amount: mintAmount,
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
		pricePerUnitCredits: amountCredits,
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
			orderExpiresAt: "2026-11-01T00:00:00Z",
			milestones: [
				{
					milestoneId,
					amountCredits,
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
				amount: amountCredits,
				milestoneId,
				orderId,
				sinkKind: "ServiceEscrowSink",
				spenderPubKey: alicePk,
			},
			undefined,
			`mk-amend-escrow${tag}-1`,
		),
	);

	if (includeDelivery) {
		events.push(
			await signEvent(
				BOB_SECRET,
				"ServiceDelivery",
				ts(13),
				{
					artifactHashes: [`mk-amend-delivery-hash${tag}`],
					deliveredAt: ts(13),
					evidenceFormat: "artifactHash",
					milestoneId,
					orderId,
				},
				{ order: order.eventId },
			),
		);
	}

	return { events, order, orderId, milestoneId };
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
