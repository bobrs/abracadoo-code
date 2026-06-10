import type { HumanKeyContact, HumanKeyCredential, HumanKeyLane } from "../../humankey/model/types";
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

  async canSendOnLane(contact: HumanKeyContact, lane: HumanKeyLane): Promise<PolicyDecision> {
    if (contact.state === "revoked" || contact.state === "archived") {
      return { allowed: false, reason: `Cannot send on lane for ${contact.state} contact.` };
    }
    if (lane.lifecycle.revokedAt) {
      return { allowed: false, reason: "Lane is revoked." };
    }
    return allowed;
  }

  async canPromoteToRelationship(contact: HumanKeyContact): Promise<PolicyDecision> {
    if (contact.state === "loop_witnessed") return allowed;
    return { allowed: false, reason: "Relationship requires a completed reciprocal app-native loop." };
  }
}
