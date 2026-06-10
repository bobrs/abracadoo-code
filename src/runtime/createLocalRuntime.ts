import { SystemClockAdapter } from "../adapters/clock/SystemClockAdapter";
import { WebCryptoAdapter } from "../adapters/crypto/WebCryptoAdapter";
import { LocalPersonalPolicyAdapter } from "../adapters/policy/LocalPersonalPolicyAdapter";
import { InMemoryStorageAdapter } from "../adapters/storage/InMemoryStorageAdapter";
import { ManualTransportAdapter } from "../adapters/transport/ManualTransportAdapter";
import { InMemorySecretVault } from "../vault/InMemorySecretVault";
import type { AbracadooRuntime } from "./AbracadooRuntime";

export function createLocalRuntime(): AbracadooRuntime {
  const clock = new SystemClockAdapter();

  return {
    storage: new InMemoryStorageAdapter(),
    vault: new InMemorySecretVault(),
    transports: {
      manual: new ManualTransportAdapter(clock),
    },
    policy: new LocalPersonalPolicyAdapter(),
    clock,
    crypto: new WebCryptoAdapter(),
  };
}
