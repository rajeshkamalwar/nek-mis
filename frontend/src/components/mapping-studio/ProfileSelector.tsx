import { useMemo, useState } from "react";
import type { ProfileDTO } from "../../api/client";
import { api, deleteProfile, updateProfile } from "../../api/client";

function normSource(sk: string) {
  return sk.toLowerCase().replace(/-/g, "_");
}

export function ProfileSelector({
  profiles,
  selectedId,
  onSelect,
  sourceKey,
  onCreated,
}: {
  profiles: ProfileDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sourceKey: string;
  onCreated?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const list = useMemo(() => profiles.filter((p) => p.source_key === sourceKey), [profiles, sourceKey]);
  const selectedProfile = useMemo(() => list.find((p) => p.id === selectedId) ?? null, [list, selectedId]);

  async function seedDefault() {
    setCreating(true);
    setMsg("");
    try {
      if (normSource(sourceKey) === "walmart") {
        await api.post("/admin/seed-walmart-profile");
        setMsg("Default Walmart profile created.");
      } else {
        const { data } = await api.post<ProfileDTO>("/mapping-profiles", {
          source_key: sourceKey,
          profile_name: `${sourceKey} default`,
          description: "Auto-created",
          is_default: true,
        });
        setMsg(`Profile "${data.profile_name || sourceKey}" created.`);
      }
      onCreated?.();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRename() {
    if (!selectedId || !editName.trim()) return;
    setEditBusy(true);
    try {
      await updateProfile(selectedId, { profile_name: editName.trim() });
      setEditing(false);
      onCreated?.();
      setMsg("Renamed.");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function handleSetDefault() {
    if (!selectedId) return;
    setEditBusy(true);
    try {
      await updateProfile(selectedId, { is_default: true });
      onCreated?.();
      setMsg("Set as default.");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedId || !selectedProfile) return;
    if (!window.confirm(`Delete profile "${selectedProfile.profile_name}"? All its rules will be deleted.`)) return;
    setEditBusy(true);
    try {
      await deleteProfile(selectedId);
      onCreated?.();
      setMsg("Deleted.");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(String(e));
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
      <span className="text-xs font-semibold uppercase text-slate-500">Profile</span>

      {list.length > 0 ? (
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="">— select —</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.profile_name}
              {p.is_default ? " (default)" : ""}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-slate-500">No profiles for {sourceKey}.</span>
      )}

      <button
        type="button"
        disabled={creating}
        onClick={seedDefault}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        {creating ? "Creating…" : list.length === 0 ? "+ Create default profile" : "+ Seed default"}
      </button>

      {selectedProfile && !editing && (
        <>
          <button
            type="button"
            disabled={editBusy}
            onClick={() => { setEditName(selectedProfile.profile_name); setEditing(true); }}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Rename
          </button>
          {!selectedProfile.is_default && (
            <button
              type="button"
              disabled={editBusy}
              onClick={handleSetDefault}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Set default
            </button>
          )}
          <button
            type="button"
            disabled={editBusy}
            onClick={handleDelete}
            className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </>
      )}

      {editing && (
        <div className="flex items-center gap-1">
          <input
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
          <button
            type="button"
            disabled={editBusy || !editName.trim()}
            onClick={handleRename}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            {editBusy ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
          >
            Cancel
          </button>
        </div>
      )}

      {msg ? <span className="text-xs text-slate-600">{msg}</span> : null}
    </div>
  );
}
