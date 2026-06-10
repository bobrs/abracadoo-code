export interface CryptoAdapter {
  randomId(): string;
  randomBytes(length: number): Uint8Array;
}
