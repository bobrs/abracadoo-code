import type { CryptoAdapter } from "./CryptoAdapter";

export class WebCryptoAdapter implements CryptoAdapter {
  randomId(): string {
    return crypto.randomUUID();
  }

  randomBytes(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }
}
