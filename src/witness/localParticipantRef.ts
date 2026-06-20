const LOCAL_PARTICIPANT_REF_KEY = "abracadoo.acceptWitness.participantRef.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createParticipantRef(randomId: string): string {
  return `abracadoo.local.participant/${randomId}`;
}

export function getOrCreateStableParticipantRef(
  storage: StorageLike = window.localStorage,
  randomId: () => string = () => crypto.randomUUID()
): string {
  const existing = storage.getItem(LOCAL_PARTICIPANT_REF_KEY);
  if (existing && existing.trim().length > 0) return existing;

  const created = createParticipantRef(randomId());
  storage.setItem(LOCAL_PARTICIPANT_REF_KEY, created);
  return created;
}
