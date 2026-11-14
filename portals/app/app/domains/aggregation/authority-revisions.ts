export interface AuthorityRef { kind: "source_mapping" | "source_capability" | "station_service"; id: string }
export interface AuthorityRevision extends AuthorityRef { revision: string }

// Pure canonical evidence. Keep decimal revisions exact across JSON boundaries.
export function normalizeAuthorityRevisions(raw: readonly AuthorityRevision[]): AuthorityRevision[] {
  if (!Array.isArray(raw) || raw.length > 10010) throw Error("invalid_authority_revisions");
  const unique = new Map<string, AuthorityRevision>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Object.keys(row).some(k => !["kind", "id", "revision"].includes(k)) ||
        !["source_mapping", "source_capability", "station_service"].includes(row.kind) ||
        typeof row.id !== "string" || !row.id.trim() || row.id.trim() !== row.id || row.id === "*" || row.id.includes("\0") ||
        typeof row.revision !== "string" || !/^[1-9][0-9]{0,29}$/.test(row.revision)) throw Error("invalid_authority_revisions");
    const key = JSON.stringify([row.kind, row.id]), prior = unique.get(key);
    if (prior && prior.revision !== row.revision) throw Error("conflicting_authority_revisions");
    unique.set(key, { kind: row.kind, id: row.id, revision: row.revision });
  }
  return [...unique.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
