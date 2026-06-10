import type { AbracadooRuntime } from "../../runtime/AbracadooRuntime";
import { deriveContactState } from "../contacts/deriveContactState";
import { createHumanKeyEvent } from "../events/createEvent";
import type { HumanKeyContact, HumanKeyLane, LaneId } from "../model/types";

export type HumanKeyLaneInvite = {
  schema: "ABRACADOO_HUMANKEY_LANE_INVITE";
  schemaVersion: 1;
  exportedAt: string;
  note: "PUBLIC_LANE_INVITE_CONTAINS_NO_TOTP_SECRET_MATERIAL";
  lane: {
    inviteId: string;
    profile: "HK_LANE_1";
    transport: HumanKeyLane["transport"];
    policy: HumanKeyLane["policy"];
    createdAt: string;
  };
};

export type CreateInboundLaneInput = {
  contactId: string;
  descriptor?: string;
  requiresCredentialIds?: string[];
};

export type CreateInboundLaneResult = {
  contact: HumanKeyContact;
  lane: HumanKeyLane;
  invite: HumanKeyLaneInvite;
};

export type ImportLaneInviteInput = {
  contactId: string;
  invite: unknown;
};

export type ImportLaneInviteResult = {
  contact: HumanKeyContact;
  lane: HumanKeyLane;
};

function assertLaneInvite(value: unknown): asserts value is HumanKeyLaneInvite {
  if (!value || typeof value !== "object") {
    throw new Error("Lane invite is not an object.");
  }
  const candidate = value as Partial<HumanKeyLaneInvite>;
  if (candidate.schema !== "ABRACADOO_HUMANKEY_LANE_INVITE" || candidate.schemaVersion !== 1) {
    throw new Error("Unsupported Abracadoo HumanKey lane invite schema.");
  }
  if (!candidate.lane || candidate.lane.profile !== "HK_LANE_1") {
    throw new Error("Lane invite is missing its HK_LANE_1 payload.");
  }
}

function makeLaneInvite(runtime: AbracadooRuntime, lane: HumanKeyLane): HumanKeyLaneInvite {
  return {
    schema: "ABRACADOO_HUMANKEY_LANE_INVITE",
    schemaVersion: 1,
    exportedAt: runtime.clock.nowIso(),
    note: "PUBLIC_LANE_INVITE_CONTAINS_NO_TOTP_SECRET_MATERIAL",
    lane: {
      inviteId: lane.id,
      profile: "HK_LANE_1",
      transport: lane.transport,
      policy: lane.policy,
      createdAt: lane.lifecycle.createdAt,
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

export async function createInboundLane(
  runtime: AbracadooRuntime,
  input: CreateInboundLaneInput
): Promise<CreateInboundLaneResult> {
  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error("Contact not found.");

  const createdAt = runtime.clock.nowIso();
  const lane: HumanKeyLane = {
    id: crypto.randomUUID(),
    contactId: contact.id,
    profile: "HK_LANE_1",
    direction: "inbound",
    transport: {
      kind: "local",
      descriptor: input.descriptor?.trim() || `manual-lane:${crypto.randomUUID()}`,
    },
    policy: {
      requiresCredentialIds: input.requiresCredentialIds ?? contact.credentialIds,
      requiresHumanKeyEvent: false,
    },
    lifecycle: { createdAt },
  };

  const event = createHumanKeyEvent({
    contactId: contact.id,
    laneId: lane.id,
    type: "lane.created",
    nowIso: createdAt,
    data: { direction: lane.direction, transport: lane.transport.kind },
  });

  await runtime.storage.saveLane(lane);
  await runtime.storage.appendEvent(event);

  const contactWithLane = {
    ...contact,
    laneIds: [...new Set([...contact.laneIds, lane.id])],
    eventIds: [...contact.eventIds, event.id],
    updatedAt: createdAt,
  };
  await runtime.storage.saveContact(contactWithLane);

  return {
    contact: await saveContactWithDerivedState(runtime, contactWithLane),
    lane,
    invite: makeLaneInvite(runtime, lane),
  };
}

export async function recordLaneShared(runtime: AbracadooRuntime, laneId: LaneId): Promise<HumanKeyLaneInvite> {
  const lane = await runtime.storage.getLane(laneId);
  if (!lane) throw new Error("Lane not found.");
  const contact = await runtime.storage.getContact(lane.contactId);
  if (!contact) throw new Error("Contact not found.");

  const createdAt = runtime.clock.nowIso();
  const event = createHumanKeyEvent({
    contactId: contact.id,
    laneId: lane.id,
    type: "lane.shared",
    nowIso: createdAt,
    data: { direction: lane.direction, transport: lane.transport.kind },
  });

  await runtime.storage.appendEvent(event);
  const updated = {
    ...contact,
    eventIds: [...contact.eventIds, event.id],
    updatedAt: createdAt,
  };
  await runtime.storage.saveContact(updated);
  await saveContactWithDerivedState(runtime, updated);
  return makeLaneInvite(runtime, lane);
}

export async function importLaneInvite(
  runtime: AbracadooRuntime,
  input: ImportLaneInviteInput
): Promise<ImportLaneInviteResult> {
  assertLaneInvite(input.invite);

  const contact = await runtime.storage.getContact(input.contactId);
  if (!contact) throw new Error("Contact not found.");

  const createdAt = runtime.clock.nowIso();
  const lane: HumanKeyLane = {
    id: crypto.randomUUID(),
    contactId: contact.id,
    profile: "HK_LANE_1",
    direction: "outbound",
    transport: input.invite.lane.transport,
    policy: input.invite.lane.policy,
    lifecycle: { createdAt },
  };

  const event = createHumanKeyEvent({
    contactId: contact.id,
    laneId: lane.id,
    type: "lane.imported",
    nowIso: createdAt,
    data: { sourceInviteId: input.invite.lane.inviteId, transport: lane.transport.kind },
  });

  await runtime.storage.saveLane(lane);
  await runtime.storage.appendEvent(event);

  const updated = {
    ...contact,
    laneIds: [...new Set([...contact.laneIds, lane.id])],
    eventIds: [...contact.eventIds, event.id],
    updatedAt: createdAt,
  };
  await runtime.storage.saveContact(updated);

  return {
    contact: await saveContactWithDerivedState(runtime, updated),
    lane,
  };
}

export function isHumanKeyLaneInvite(value: unknown): value is HumanKeyLaneInvite {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Partial<HumanKeyLaneInvite>).schema === "ABRACADOO_HUMANKEY_LANE_INVITE"
  );
}
