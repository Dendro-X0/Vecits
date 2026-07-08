import { createUnsignedEnvelope, derivePublicKey, signUnsignedEnvelope } from "../../packages/sdk-ts/dist/index.js";

export const POLICY_PACK_SCHEMA = "policy-pack-v1";
export const DEFAULT_POLICY_AUTHORITY_SECRET =
	"1111111111111111111111111111111111111111111111111111111111111111";

const REQUIRED_POLICY_FIELDS = [
	"version",
	"clockSkewSeconds",
	"creditDefaultExpiryDays",
	"providerRewardExpiryDays",
	"demurrageRateWeeklyBps",
	"claimApprovalThreshold",
	"maxContributionClaimCredits",
	"allowedServiceTypes",
	"maxMilestonesPerOrder",
	"maxMilestoneCredits",
	"acceptanceWindowSeconds",
	"disputeTimeoutSeconds",
	"providerEligibilityThreshold",
	"attestorEligibilityThreshold",
	"allowedSinkKinds",
	"policyAuthorityPubKey",
];

export function validatePolicyPack(pack) {
	if (!pack || typeof pack !== "object") {
		throw new Error("policy pack must be an object");
	}
	if (pack.schemaVersion !== POLICY_PACK_SCHEMA) {
		throw new Error(`schemaVersion must be ${POLICY_PACK_SCHEMA}`);
	}
	for (const field of ["packId", "description", "nextPolicyVersion", "policy"]) {
		if (!pack[field]) {
			throw new Error(`policy pack missing required field: ${field}`);
		}
	}
	if (pack.nextPolicyVersion !== pack.policy.version) {
		throw new Error("nextPolicyVersion must match policy.version");
	}
	for (const field of REQUIRED_POLICY_FIELDS) {
		if (pack.policy[field] === undefined || pack.policy[field] === null) {
			throw new Error(`policy missing required field: ${field}`);
		}
	}
	if (pack.policy.policyAuthorityPubKey.length !== 64) {
		throw new Error("policy.policyAuthorityPubKey must be 64 hex characters");
	}
	if (!Array.isArray(pack.policy.allowedServiceTypes) || pack.policy.allowedServiceTypes.length === 0) {
		throw new Error("policy.allowedServiceTypes must be non-empty");
	}
	if (!Array.isArray(pack.policy.allowedSinkKinds) || pack.policy.allowedSinkKinds.length === 0) {
		throw new Error("policy.allowedSinkKinds must be non-empty");
	}
	return pack;
}

export function policyUpdatePayloadFromPack(pack, effectiveAt) {
	const validated = validatePolicyPack(pack);
	return {
		nextPolicyVersion: validated.nextPolicyVersion,
		effectiveAt,
		policy: validated.policy,
	};
}

export async function signPolicyUpdateFromPack(
	pack,
	{
		secretKey = DEFAULT_POLICY_AUTHORITY_SECRET,
		createdAt,
		effectiveAt,
		currentPolicyVersion = "v0-default",
	} = {},
) {
	const authorPubKey = await derivePublicKey(secretKey);
	if (authorPubKey !== pack.policy.policyAuthorityPubKey) {
		throw new Error("secret key does not match policy.policyAuthorityPubKey");
	}
	const unsigned = createUnsignedEnvelope({
		authorPubKey,
		kind: "PolicyUpdate",
		createdAt,
		policyVersion: currentPolicyVersion,
		payload: policyUpdatePayloadFromPack(pack, effectiveAt),
	});
	return signUnsignedEnvelope(unsigned, secretKey);
}

export function packFromPolicyUpdateEvent(event, { packId, description }) {
	if (event.kind !== "PolicyUpdate") {
		throw new Error("event kind must be PolicyUpdate");
	}
	const payload = event.payload ?? {};
	if (!payload.policy || !payload.nextPolicyVersion) {
		throw new Error("PolicyUpdate event missing policy payload");
	}
	return validatePolicyPack({
		schemaVersion: POLICY_PACK_SCHEMA,
		packId: packId ?? `imported-${payload.nextPolicyVersion}`,
		description: description ?? `Imported from PolicyUpdate (${payload.nextPolicyVersion})`,
		nextPolicyVersion: payload.nextPolicyVersion,
		policy: payload.policy,
	});
}

export function packFromNodePolicyView(view, { packId, description, nextPolicyVersion }) {
	const policy = view?.data?.policy ?? view?.policy;
	if (!policy) {
		throw new Error("node policy view missing policy object");
	}
	const version = nextPolicyVersion ?? policy.version;
	return validatePolicyPack({
		schemaVersion: POLICY_PACK_SCHEMA,
		packId: packId ?? `exported-${version}`,
		description: description ?? `Exported from node policy state (${version})`,
		nextPolicyVersion: version,
		policy: {
			...policy,
			version,
		},
	});
}
