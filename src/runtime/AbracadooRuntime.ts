import type { ClockAdapter } from "../adapters/clock/ClockAdapter";
import type { CryptoAdapter } from "../adapters/crypto/CryptoAdapter";
import type { PolicyAdapter } from "../adapters/policy/PolicyAdapter";
import type { StorageAdapter } from "../adapters/storage/StorageAdapter";
import type { TransportAdapterRegistry } from "../adapters/transport/TransportAdapter";
import type { SecretVault } from "../vault/SecretVault";

export type AbracadooRuntime = {
  storage: StorageAdapter;
  vault: SecretVault;
  transports: TransportAdapterRegistry;
  policy: PolicyAdapter;
  clock: ClockAdapter;
  crypto: CryptoAdapter;
};
