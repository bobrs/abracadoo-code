import { SystemClockAdapter } from "../adapters/clock/SystemClockAdapter";
import { WebCryptoAdapter } from "../adapters/crypto/WebCryptoAdapter";
import { LocalPersonalPolicyAdapter } from "../adapters/policy/LocalPersonalPolicyAdapter";
import { IndexedDbStorageAdapter } from "../adapters/storage/indexeddb/IndexedDbStorageAdapter";
import { ManualTransportAdapter } from "../adapters/transport/ManualTransportAdapter";
import { EncryptedIndexedDbSecretVault } from "../vault/indexeddb/EncryptedIndexedDbSecretVault";
import type { AbracadooRuntime } from "./AbracadooRuntime";

export function createBrowserRuntime(): AbracadooRuntime {
  const clock = new SystemClockAdapter();

  return {
    storage: new IndexedDbStorageAdapter(),
    vault: new EncryptedIndexedDbSecretVault(),
    transports: {
      manual: new ManualTransportAdapter(clock),
    },
    policy: new LocalPersonalPolicyAdapter(),
    clock,
    crypto: new WebCryptoAdapter(),
  };
}
