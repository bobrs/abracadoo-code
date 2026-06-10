import type { HumanKeyContact, HumanKeyCredential, HumanKeyLane } from "../../humankey/model/types";

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
};

export interface PolicyAdapter {
  canCreateCredential(contact: HumanKeyContact): Promise<PolicyDecision>;
  canVerifyCredential(contact: HumanKeyContact, credential: HumanKeyCredential): Promise<PolicyDecision>;
  canSendOnLane(contact: HumanKeyContact, lane: HumanKeyLane): Promise<PolicyDecision>;
  canPromoteToRelationship(contact: HumanKeyContact): Promise<PolicyDecision>;
}
