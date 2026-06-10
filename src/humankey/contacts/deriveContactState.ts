import type { HumanKeyContact, HumanKeyContactState, HumanKeyEvent } from "../model/types";

function hasEvent(events: HumanKeyEvent[], type: HumanKeyEvent["type"]): boolean {
  return events.some((event) => event.type === type);
}

export function deriveContactState(contact: HumanKeyContact, events: HumanKeyEvent[]): HumanKeyContactState {
  if (hasEvent(events, "contact.revoked")) return "revoked";
  if (hasEvent(events, "contact.archived")) return "archived";
  if (hasEvent(events, "relationship.established")) return "relationship";
  if (hasEvent(events, "loop.completed")) return "loop_witnessed";
  if (hasEvent(events, "lane.shared") || hasEvent(events, "lane.imported")) return "loop_offered";
  if (contact.credentialIds.length > 0 || contact.laneIds.length > 0) return "acquaintance";
  return "draft";
}
