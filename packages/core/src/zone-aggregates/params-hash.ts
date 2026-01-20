function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, val]) => [key, canonicalize(val)] as const);

    return Object.fromEntries(entries);
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function hashAggregateParams(value: unknown): Promise<string> {
  const input = canonicalJson(value);
  const bytes = new TextEncoder().encode(input);
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required for aggregate hashing.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return bufferToHex(digest);
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
