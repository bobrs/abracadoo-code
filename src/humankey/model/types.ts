export type IsoTimestamp = string;
export type ContactId = string;
export type CredentialId = string;
export type PathId = string;
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
export type PathDirection = "inbound" | "outbound";

export type HumanKeyContact = {
  id: ContactId;
  displayName: string;
  state: HumanKeyContactState;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  establishedRelationshipAt?: IsoTimestamp;
  credentialIds: CredentialId[];
  pathIds: PathId[];
  /** Legacy V0.6 field accepted from stored contacts/backups. */
  laneIds?: PathId[];
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

export type HumanKeyPath = {
  id: PathId;
  contactId: ContactId;
  profile: "HK_PATH_1";
  direction: PathDirection;
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
  | "path.created"
  | "path.shared"
  | "path.imported"
  // Legacy V0.6 event names accepted for import/state derivation.
  | "lane.created"
  | "lane.shared"
  | "lane.imported"
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
  pathId?: PathId;
  /** Legacy V0.6 field accepted for imported historical events. */
  laneId?: PathId;
  type: HumanKeyEventType;
  createdAt: IsoTimestamp;
  data?: Record<string, unknown>;
};
