import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncatePubkey(pubkey: string, head = 6, tail = 4): string {
  if (pubkey.length <= head + tail + 1) {
    return pubkey;
  }
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`;
}

export function formatServiceType(serviceType: string): string {
  return serviceType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} credits`;
}
