const PROFILE_STORAGE_PREFIX = "vectis.profile.";

export type UserProfile = {
  displayName: string;
  bio: string;
  serviceCategories: string;
  links: string;
};

export const EMPTY_PROFILE: UserProfile = {
  displayName: "",
  bio: "",
  serviceCategories: "",
  links: ""
};

function storageKey(publicKeyHex: string): string {
  return `${PROFILE_STORAGE_PREFIX}${publicKeyHex}`;
}

export function loadProfile(publicKeyHex: string): UserProfile {
  if (typeof window === "undefined") {
    return EMPTY_PROFILE;
  }
  const raw = localStorage.getItem(storageKey(publicKeyHex));
  if (!raw) {
    return EMPTY_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      displayName: parsed.displayName ?? "",
      bio: parsed.bio ?? "",
      serviceCategories: parsed.serviceCategories ?? "",
      links: parsed.links ?? ""
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(publicKeyHex: string, profile: UserProfile): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageKey(publicKeyHex), JSON.stringify(profile));
}
