import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { deriveContactState } from "../contacts/deriveContactState";
import { createHumanKeyEvent } from "../events/createEvent";
import type { HumanKeyContact, HumanKeyPath, PathId } from "../model/types";
import { generateInboundPathReceiveKey } from "./manualMessages";

export type HumanKeyPathInvite = {
  schema: "ABRACADOO_HUMANKEY_PATH_INVITE";
  schemaVersion: 1;
  exportedAt: string;
  note: "PUBLIC_PATH_INVITE_CONTAINS_NO_TOTP_SECRET_MATERIAL";
  path: {
    inviteId: string;
    profile: "HK_PATH_1";
    transport: HumanKeyPath["transport"];
    policy: HumanKeyPath["policy"];
    createdAt: string;
  };
};

export type CreateInboundPathInput = {
  contactId: string;
  descriptor?: string;
  requiresCredentialIds?: string[];
};

export type CreateInboundPathResult = {
  contact: HumanKeyContact;
  path: HumanKeyPath;
  invite: HumanKeyPathInvite;
};

export type ImportPathInviteInput = {
  contactId: string;
  invite: unknown;
};

export type ImportPathInviteResult = {
  contact: HumanKeyContact;
  path: HumanKeyPath;
};

type LegacyHumanKeyLaneInvite = {
  schema: "ABRACADOO_HUMANKEY_LANE_INVITE";
  schemaVersion: 1;
  exportedAt: string;
  note?: string;
  lane: {
    inviteId: string;
    profile: "HK_LANE_1";
    transport: HumanKeyPath["transport"];
    policy: HumanKeyPath["policy"];
    createdAt: string;
  };
};

type SupportedPathInvite = HumanKeyPathInvite | LegacyHumanKeyLaneInvite;

function assertPathInvite(value: unknown): asserts value is SupportedPathInvite {
  if (!value || typeof value !== "object") {
    throw new Error("Path invite is not an object.");
  }
  const candidate = value as { schema?: string; schemaVersion?: number; path?: HumanKeyPathInvite["path"]; lane?: LegacyHumanKeyLaneInvite["lane"] };
  const isPathInvite = candidate.schema === "ABRACADOO_HUMANKEY_PATH_INVITE" && candidate.schemaVersion === 1;
  const isLegacyLaneInvite = candidate.schema === "ABRACADOO_HUMANKEY_LANE_INVITE" && candidate.schemaVersion === 1;
  if (!isPathInvite && !isLegacyLaneInvite) {
    throw new Error("Unsupported Abracadoo HumanKey path invite schema.");
  }
  if (isPathInvite && (!candidate.path || candidate.path.profile !== "HK_PATH_1")) {
    throw new Error("Path invite is missing its HK_PATH_1 payload.");
  }
  if (isLegacyLaneInvite && (!candidate.lane || candidate.lane.profile !== "HK_LANE_1")) {
    throw new Error("Legacy lane invite is missing its HK_LANE_1 payload.");
  }
}

function getInvitePathPayload(invite: SupportedPathInvite): HumanKeyPathInvite["path"] {
  if (invite.schema === "ABRACADOO_HUMANKEY_PATH_INVITE") return invite.path;
  return {
    inviteId: invite.lane.inviteId,
    profile: "HK_PATH_1",
    transport: invite.lane.transport,
    policy: invite.lane.policy,
    createdAt: invite.lane.createdAt,
  };
}

function makePathInvite(runtime: AbracadooRuntime, path: HumanKeyPath): HumanKeyPathInvite {
  return {
    schema: "ABRACADOO_HUMANKEY_PATH_INVITE",
    schemaVersion: 1,
    exportedAt: runtime.clock.nowIso(),
    note: "PUBLIC_PATH_INVITE_CONTAINS_NO_TOTP_SECRET_MATERIAL",
    path: {
      inviteId: path.id,
      profile: "HK_PATH_1",
      transport: path.transport,
      policy: path.policy,
      createdAt: path.lifecycle.createdAt,
    },
  };
}

async function saveContactWithDerivedState(runtime: AbracadooRuntime, contact: HumanKeyContact): Promise<HumanKeyContact> {
  const events = await runtime.storage.listEventsForContact(contact.id);
  const state = deriveContactState(contact, events);
  const updated = { ...contact, state, updatedAt: runtime.clock.nowIso() };
  await runtime.storage.saveContact(updated);
  return updated;
}

export async function createInboundPath(
  runtime: AbracadooRuntime,
  input: CreateInboundPathInput
): Promise<CreateInboundPathResult> {
  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error("Contact not found.");

  const createdAt = runtime.clock.nowIso();
  const receiveKey = await generateInboundPathReceiveKey(runtime);
  const path: HumanKeyPath = {
    id: crypto.randomUUID(),
    contactId: contact.id,
    profile: "HK_PATH_1",
    direction: "inbound",
    secretRef: receiveKey.secretRef,
    transport: {
      kind: "local",
      descriptor: input.descriptor?.trim() || `manual-path:${crypto.randomUUID()}`,
      receivePublicKeyJwk: receiveKey.publicKeyJwk,
    },
    policy: {
      requiresCredentialIds: input.requiresCredentialIds ?? contact.credentialIds,
      requiresHumanKeyEvent: false,
    },
    lifecycle: { createdAt },
  };

  const event = createHumanKeyEvent({
    contactId: contact.id,
    pathId: path.id,
    type: "path.created",
    nowIso: createdAt,
    data: { direction: path.direction, transport: path.transport.kind },
  });

  await runtime.storage.savePath(path);
  await runtime.storage.appendEvent(event);

  const contactWithPath = {
    ...contact,
    pathIds: [...new Set([...(contact.pathIds ?? contact.laneIds ?? []), path.id])],
    eventIds: [...contact.eventIds, event.id],
    updatedAt: createdAt,
  };
  await runtime.storage.saveContact(contactWithPath);

  return {
    contact: await saveContactWithDerivedState(runtime, contactWithPath),
    path,
    invite: makePathInvite(runtime, path),
  };
}

export async function recordPathShared(runtime: AbracadooRuntime, pathId: PathId): Promise<HumanKeyPathInvite> {
  const path = await runtime.storage.getPath(pathId);
  if (!path) throw new Error("Path not found.");
  const contact = await runtime.storage.getContact(path.contactId);
  if (!contact) throw new Error("Contact not found.");

  const createdAt = runtime.clock.nowIso();
  const event = createHumanKeyEvent({
    contactId: contact.id,
    pathId: path.id,
    type: "path.shared",
    nowIso: createdAt,
    data: { direction: path.direction, transport: path.transport.kind },
  });

  await runtime.storage.appendEvent(event);
  const updated = {
    ...contact,
    eventIds: [...contact.eventIds, event.id],
    updatedAt: createdAt,
  };
  await runtime.storage.saveContact(updated);
  await saveContactWithDerivedState(runtime, updated);
  return makePathInvite(runtime, path);
}

export async function importPathInvite(
  runtime: AbracadooRuntime,
  input: ImportPathInviteInput
): Promise<ImportPathInviteResult> {
  assertPathInvite(input.invite);
  const invitePath = getInvitePathPayload(input.invite);

  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error("Contact not found.");

  const createdAt = runtime.clock.nowIso();
  const path: HumanKeyPath = {
    id: crypto.randomUUID(),
    contactId: contact.id,
    profile: "HK_PATH_1",
    direction: "outbound",
    remotePathId: invitePath.inviteId,
    transport: invitePath.transport,
    policy: invitePath.policy,
    lifecycle: { createdAt },
  };

  const event = createHumanKeyEvent({
    contactId: contact.id,
    pathId: path.id,
    type: "path.imported",
    nowIso: createdAt,
    data: { sourceInviteId: invitePath.inviteId, transport: path.transport.kind },
  });

  await runtime.storage.savePath(path);
  await runtime.storage.appendEvent(event);

  const updated = {
    ...contact,
    pathIds: [...new Set([...(contact.pathIds ?? contact.laneIds ?? []), path.id])],
    eventIds: [...contact.eventIds, event.id],
    updatedAt: createdAt,
  };
  await runtime.storage.saveContact(updated);

  return {
    contact: await saveContactWithDerivedState(runtime, updated),
    path,
  };
}

export function isHumanKeyPathInvite(value: unknown): value is HumanKeyPathInvite {
  return Boolean(
    value &&
      typeof value === "object" &&
      ((value as Partial<HumanKeyPathInvite>).schema === "ABRACADOO_HUMANKEY_PATH_INVITE" || (value as { schema?: string }).schema === "ABRACADOO_HUMANKEY_LANE_INVITE")
  );
}
