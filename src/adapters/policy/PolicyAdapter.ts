import type { HumanKeyContact, HumanKeyCredential, HumanKeyPath } from "../../humankey/model/types";

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
};

export interface PolicyAdapter {
  canCreateCredential(contact: HumanKeyContact): Promise<PolicyDecision>;
  canVerifyCredential(contact: HumanKeyContact, credential: HumanKeyCredential): Promise<PolicyDecision>;
  canSendOnPath(contact: HumanKeyContact, path: HumanKeyPath): Promise<PolicyDecision>;
  canPromoteToRelationship(contact: HumanKeyContact): Promise<PolicyDecision>;
}
