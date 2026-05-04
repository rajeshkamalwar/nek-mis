import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchCanonicalKeys, fetchCoa, fetchProfiles } from "../api/client";
import type { MappingRuleDTO } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useT } from "../i18n/LangContext";
import { MappingCanvas } from "../components/mapping-studio/MappingCanvas";
import { ProfileSelector } from "../components/mapping-studio/ProfileSelector";
import { RuleEditPanel } from "../components/mapping-studio/RuleEditPanel";

export function MappingStudioPage() {
  const t = useT();
  const { source_key = "walmart" } = useParams<{ source_key: string }>();
  try { localStorage.setItem("last_source_key", source_key); } catch {}
  const qc = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<MappingRuleDTO | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["mappingProfiles", source_key],
    queryFn: () => fetchProfiles(source_key),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa"],
    queryFn: fetchCoa,
  });

  const { data: keys = [] } = useQuery({
    queryKey: ["canonicalKeys", source_key],
    queryFn: () => fetchCanonicalKeys(source_key),
  });

  const profile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? profiles.find((p) => p.is_default) ?? profiles[0] ?? null,
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    if (!selectedProfileId && profile) {
      setSelectedProfileId(profile.id);
    }
  }, [selectedProfileId, profile]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["mappingProfiles", source_key] });
  };

  return (
    <AppShell
      title={t("page.studio.title")}
      subtitle={`${t("page.studio.subtitle.prefix")} ${source_key}`}
      fullHeight
    >
      <div className="flex flex-col h-full">
      <ProfileSelector
        profiles={profiles}
        selectedId={selectedProfileId}
        onSelect={(id) => {
          setSelectedProfileId(id);
          setSelectedRule(null);
        }}
        sourceKey={source_key}
        onCreated={refresh}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0">
          <MappingCanvas
            sourceKey={source_key}
            profile={profile}
            keys={keys}
            accounts={accounts}
            onRuleSelect={setSelectedRule}
            onGraphRefresh={refresh}
          />
        </div>

        <RuleEditPanel
          profileId={profile?.id ?? null}
          rule={selectedRule}
          accounts={accounts}
          canonicalKeys={keys}
          onSaved={refresh}
        />
      </div>
      </div>
    </AppShell>
  );
}
