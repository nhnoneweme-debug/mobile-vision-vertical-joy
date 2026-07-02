import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Activity, Upload, Watch, RefreshCw, Info } from "lucide-react";
import {
  importWearableSamples,
  listConnections,
  listRecentSamples,
  parseWearableFile,
  type WearableConnection,
  type WearableSource,
} from "@/lib/wearables";

export const Route = createFileRoute("/_authenticated/wearables")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Wearables · Saga" },
      { name: "description", content: "Importe sono, passos e frequência cardíaca do Apple Health, Google Fit ou Samsung Health." },
    ],
  }),
  component: WearablesPage,
});

const SOURCES: { id: WearableSource; label: string; hint: string }[] = [
  { id: "apple_health", label: "Apple Health", hint: "Exporte via app Saúde → seu perfil → Exportar Dados" },
  { id: "google_fit", label: "Google Fit", hint: "Google Takeout → Google Fit → JSON" },
  { id: "samsung_health", label: "Samsung Health", hint: "Ajustes → Baixar dados pessoais → CSV" },
  { id: "fitbit", label: "Fitbit", hint: "fitbit.com/settings/data/export" },
  { id: "other", label: "Outro / Manual", hint: "CSV com colunas: date,metric,value" },
];

function WearablesPage() {
  const [source, setSource] = useState<WearableSource>("apple_health");
  const [connections, setConnections] = useState<WearableConnection[]>([]);
  const [samples, setSamples] = useState<Awaited<ReturnType<typeof listRecentSamples>>>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([listConnections(), listRecentSamples(30)]);
      setConnections(c);
      setSamples(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = parseWearableFile(text);
      if (parsed.length === 0) {
        toast.error("Nenhuma amostra reconhecida. Verifique o formato.");
        return;
      }
      const res = await importWearableSamples(source, parsed);
      toast.success(`Importadas ${res.imported} amostras · ${res.sleep_synced} noites sincronizadas`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const selected = SOURCES.find((s) => s.id === source)!;

  return (
    <div className="min-h-screen space-y-4 p-4 pb-24">
      <header>
        <div className="flex items-center gap-2">
          <Watch className="h-5 w-5 text-ember" />
          <h1 className="font-display text-2xl tracking-wide text-foreground">WEARABLES</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sono, passos e frequência cardíaca alimentam automaticamente seus rituais e o Personal IA Score.
        </p>
      </header>

      {/* Fonte + import */}
      <section className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">FONTE</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
              className={`rounded-lg border px-3 py-2 text-left text-xs ${
                source === s.id
                  ? "border-ember bg-ember/20 text-foreground"
                  : "border-border bg-background/40 text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {selected.hint}
        </p>

        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-ember px-3 py-2.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900">
          <Upload className="h-4 w-4" />
          {uploading ? "IMPORTANDO…" : "IMPORTAR ARQUIVO (CSV/JSON)"}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt,application/json,text/csv"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>

        <details className="mt-3">
          <summary className="cursor-pointer font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            FORMATO SUPORTADO
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-md bg-background/80 p-2 text-[10px] leading-relaxed text-muted-foreground">
{`# CSV
date,metric,value
2025-11-01,sleep_hours,7.5
2025-11-01,steps,9820
2025-11-01,resting_hr,58

# JSON
[
  { "date": "2025-11-01", "metric": "sleep_hours", "value": 7.5 },
  { "date": "2025-11-01", "metric": "steps", "value": 9820 }
]

Métricas: sleep_hours, sleep_quality (1-5),
steps, resting_hr, hr_avg, active_kcal`}
          </pre>
        </details>
      </section>

      {/* Conexões */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-[10px] tracking-[0.35em] text-muted-foreground">CONEXÕES</h2>
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <RefreshCw className="h-3 w-3" /> atualizar
          </button>
        </div>
        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-background/40" />
        ) : connections.length === 0 ? (
          <p className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            Nenhuma fonte conectada. Importe um arquivo acima.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {connections.map((c) => (
              <li
                key={c.source}
                className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-foreground">{c.source}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "—"}
                  </p>
                </div>
                <span className="rounded-md bg-ember/20 px-2 py-0.5 font-display text-[9px] tracking-[0.2em] text-ember">
                  {c.status.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Amostras recentes */}
      <section>
        <h2 className="mb-2 font-display text-[10px] tracking-[0.35em] text-muted-foreground">
          ÚLTIMAS AMOSTRAS
        </h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-background/40" />
        ) : samples.length === 0 ? (
          <p className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            Sem amostras nos últimos 30 dias.
          </p>
        ) : (
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto rounded-lg border border-border bg-background/40 p-2 text-xs">
            {samples.slice(0, 100).map((s, i) => (
              <li key={i} className="flex items-center justify-between px-1 py-1">
                <span className="text-muted-foreground">
                  {s.sample_date} · {s.metric}
                </span>
                <span className="flex items-center gap-1 text-foreground">
                  <Activity className="h-3 w-3 text-ember" />
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pt-2 text-center text-[10px] leading-relaxed text-muted-foreground">
        Integração nativa com Apple Health e Health Connect requer app nativo — chegará quando publicarmos o pacote na App Store / Play Store. Até lá, os exports oficiais funcionam.
      </p>
    </div>
  );
}
