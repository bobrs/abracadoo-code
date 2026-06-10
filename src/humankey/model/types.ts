export type IsoTimestamp = string;
export type ContactId = string;
export type CredentialId = string;
export type LaneId = string;
export type EventId = string;
export type SecretRef = string;

export type HumanKeyContactState =
  | "draft"
  | "acquaintance"
  | "loop_offered"
  | "loop_witnessed"
  | "relationship"
  | "paused"
  | "revoked"
  | "archived";

export type CredentialDirection = "i_verify_them" | "they_verify_me";
export type LaneDirection = "inbound" | "outbound";

export type HumanKeyContact = {
  id: ContactId;
  displayName: string;
  state: HumanKeyContactState;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  establishedRelationshipAt?: IsoTimestamp;
  credentialIds: CredentialId[];
  laneIds: LaneId[];
  eventIds: EventId[];
  metadata: {
    notes?: string;
    tags?: string[];
  };
};

export type HumanKeyCredential = HumanKeyTotpCredential;

export type HumanKeyTotpCredential = {
  id: CredentialId;
  contactId: ContactId;
  profile: "HK_TOTP_1";
  direction: CredentialDirection;
  label: string;
  secretRef: SecretRef;
  publicMaterial?: {
    otpauthUri?: string;
    qrLabel?: string;
  };
  parameters: {
    issuer: "Abracadoo";
    algorithm: "SHA1";
    digits: 6;
    period: 30;
    encoding: "base32";
  };
  lifecycle: {
    createdAt: IsoTimestamp;
    lastVerifiedAt?: IsoTimestamp;
    revokedAt?: IsoTimestamp;
  };
};

export type HumanKeyLane = {
  id: LaneId;
  contactId: ContactId;
  profile: "HK_LANE_1";
  direction: LaneDirection;
  transport:
    | { kind: "none" }
    | { kind: "nostr"; relays: string[]; publicKey: string }
    | { kind: "webpush"; endpoint: string }
    | { kind: "local"; descriptor: string };
  policy: {
    requiresCredentialIds: CredentialId[];
    requiresHumanKeyEvent?: boolean;
  };
  lifecycle: {
    createdAt: IsoTimestamp;
    revokedAt?: IsoTimestamp;
  };
};

export type HumanKeyEventType =
  | "contact.created"
  | "contact.state_changed"
  | "credential.created"
  | "credential.shared"
  | "credential.verified"
  | "credential.failed_verification"
  | "credential.revoked"
  | "lane.created"
  | "lane.shared"
  | "message.sent"
  | "message.received"
  | "loop.completed"
  | "relationship.established"
  | "contact.revoked"
  | "contact.archived";

export type HumanKeyEvent = {
  id: EventId;
  contactId: ContactId;
  credentialId?: CredentialId;
  laneId?: LaneId;
  type: HumanKeyEventType;
  createdAt: IsoTimestamp;
  data?: Record<string, unknown>;
};
