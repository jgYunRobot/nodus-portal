export function createRandomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const random_bytes = crypto.getRandomValues(new Uint8Array(16));
  random_bytes[6] = (random_bytes[6] & 0x0f) | 0x40;
  random_bytes[8] = (random_bytes[8] & 0x3f) | 0x80;
  const hexadecimal = Array.from(random_bytes, (value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20)
  ].join("-");
}
