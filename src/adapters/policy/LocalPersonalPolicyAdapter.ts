import type { HumanKeyContact, HumanKeyCredential, HumanKeyPath } from "../../humankey/model/types";
import type { PolicyAdapter, PolicyDecision } from "./PolicyAdapter";

const allowed: PolicyDecision = { allowed: true };

export class LocalPersonalPolicyAdapter implements PolicyAdapter {
  async canCreateCredential(contact: HumanKeyContact): Promise<PolicyDecision> {
    if (contact.state === "revoked" || contact.state === "archived") {
      return { allowed: false, reason: `Cannot create credentials for ${contact.state} contact.` };
    }
    return allowed;
  }

  async canVerifyCredential(contact: HumanKeyContact, credential: HumanKeyCredential): Promise<PolicyDecision> {
    if (contact.state === "revoked" || contact.state === "archived") {
      return { allowed: false, reason: `Cannot verify ${contact.state} contact.` };
    }
    if (credential.lifecycle.revokedAt) {
      return { allowed: false, reason: "Credential is revoked." };
    }
    return allowed;
  }

  async canSendOnPath(contact: HumanKeyContact, path: HumanKeyPath): Promise<PolicyDecision> {
    if (contact.state === "revoked" || contact.state === "archived") {
      return { allowed: false, reason: `Cannot send on path for ${contact.state} contact.` };
    }
    if (path.lifecycle.revokedAt) {
      return { allowed: false, reason: "Path is revoked." };
    }
    return allowed;
  }

  async canPromoteToRelationship(contact: HumanKeyContact): Promise<PolicyDecision> {
    if (contact.state === "loop_witnessed") return allowed;
    return { allowed: false, reason: "Relationship requires a completed reciprocal app-native loop." };
  }
}
