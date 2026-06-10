function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);

  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }

  return bytes;
}

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index];
  if (value === undefined) {
    throw new Error(`Missing byte at index ${index}`);
  }
  return value;
}

function truncate(hmac: Uint8Array): number {
  const offset = byteAt(hmac, hmac.length - 1) & 0x0f;
  return (
    ((byteAt(hmac, offset) & 0x7f) << 24) |
    ((byteAt(hmac, offset + 1) & 0xff) << 16) |
    ((byteAt(hmac, offset + 2) & 0xff) << 8) |
    (byteAt(hmac, offset + 3) & 0xff)
  );
}

export type GenerateTotpInput = {
  secret: Uint8Array;
  timestampMs?: number;
  period?: 30;
  digits?: 6;
};

export async function generateTotp(input: GenerateTotpInput): Promise<string> {
  const timestampMs = input.timestampMs ?? Date.now();
  const period = input.period ?? 30;
  const digits = input.digits ?? 6;
  const counter = Math.floor(timestampMs / 1000 / period);

  const key = await crypto.subtle.importKey(
    "raw",
    input.secret,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, counterToBytes(counter));
  const codeInt = truncate(new Uint8Array(signature));
  const modulus = 10 ** digits;

  return String(codeInt % modulus).padStart(digits, "0");
}

export type VerifyTotpInput = GenerateTotpInput & {
  code: string;
  window?: number;
};

export async function verifyTotp(input: VerifyTotpInput): Promise<boolean> {
  const timestampMs = input.timestampMs ?? Date.now();
  const period = input.period ?? 30;
  const window = input.window ?? 1;

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = await generateTotp({
      secret: input.secret,
      timestampMs: timestampMs + offset * period * 1000,
      period,
      digits: input.digits ?? 6,
    });

    if (candidate === input.code) {
      return true;
    }
  }

  return false;
}
