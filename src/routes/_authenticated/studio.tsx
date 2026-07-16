import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldOff, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  attachReward,
  checkStudioAdmin,
  createChallenge,
  createReward,
  listChallengesStudio,
  listRewards,
  METRIC_LABELS,
  publishChallenge,
  type ChallengePerspective,
  type StudioChallenge,
  type StudioReward,
} from "@/lib/studio";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Weme" },
      { name: "description", content: "Criação de desafios e prêmios dinâmicos." },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"challenges" | "rewards">("challenges");
  const [rewards, setRewards] = useState<StudioReward[]>([]);
  const [challenges, setChallenges] = useState<StudioChallenge[]>([]);

  const refresh = async () => {
    const [r, c] = await Promise.all([listRewards(), listChallengesStudio(true)]);
    setRewards(r);
    setChallenges(c);
  };

  useEffect(() => {
    (async () => {
      const admin = await checkStudioAdmin();
      setIsAdmin(admin);
      if (admin) await refresh();
    })();
  }, []);

  if (isAdmin === null) {
    return (
      <MobileShell>
        <div className="flex h-[80vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell>
        <div className="flex h-[80vh] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
          <ShieldOff className="h-8 w-8" />
          <h2 className="font-display text-2xl text-foreground">Acesso restrito</h2>
          <p className="text-sm">
            Esta área é exclusiva da equipe de design (papel <code>studio_admin</code>).
          </p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <section className="border-b border-border px-4 pb-4 pt-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">CONTA</p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-foreground">Studio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie prêmios e desafios dinâmicos com múltiplas perspectivas.
        </p>
        <div className="mt-4 flex gap-2">
          {(["challenges", "rewards"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-full border px-4 py-1.5 font-display text-[11px] tracking-[0.18em] " +
                (tab === t ? "border-ember bg-ember/10 text-ember" : "border-border text-muted-foreground")
              }
            >
              {t === "challenges" ? "DESAFIOS" : "PRÊMIOS"}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-6 px-4 py-5 pb-32">
        {tab === "rewards" ? (
          <RewardsBuilder rewards={rewards} onChange={refresh} />
        ) : (
          <ChallengeBuilder rewards={rewards} challenges={challenges} onChange={refresh} />
        )}
      </div>

    </MobileShell>
  );
}

function RewardsBuilder({ rewards, onChange }: { rewards: StudioReward[]; onChange: () => void }) {
  const [kind, setKind] = useState<StudioReward["kind"]>("crystal");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [crystalCode, setCrystalCode] = useState("oracle_eye");
  const [mode, setMode] = useState<"temporal" | "conditional" | "permanent">("temporal");
  const [hours, setHours] = useState(24);
  const [amount, setAmount] = useState(50);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Dê um nome.");
      return;
    }
    let payload: Record<string, unknown> = {};
    if (kind === "crystal") {
      payload = { crystal_code: crystalCode, mode, expires_in_hours: hours };
    } else if (kind === "brasas" || kind === "xp") {
      payload = { amount };
    }
    try {
      await createReward({ kind, name, description: desc || null, payload });
      toast.success("Prêmio criado.");
      setName("");
      setDesc("");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-charcoal-900/30 p-4">
        <h2 className="font-display text-lg tracking-wide text-foreground">Novo prêmio</h2>
        <div className="mt-3 space-y-3 text-sm">
          <Field label="Tipo">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as StudioReward["kind"])}
              className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-foreground"
            >
              <option value="crystal">Cristal do Poder</option>
              <option value="brasas">Brasas</option>
              <option value="xp">XP</option>
              <option value="badge">Selo / Badge</option>
              <option value="inventory_item">Item da Forja</option>
            </select>
          </Field>
          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
            />
          </Field>

          {kind === "crystal" ? (
            <>
              <Field label="Cristal">
                <select
                  value={crystalCode}
                  onChange={(e) => setCrystalCode(e.target.value)}
                  className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-foreground"
                >
                  <option value="oracle_eye">Olho do Oráculo</option>
                  <option value="echo_mentor">Eco do Mentor</option>
                </select>
              </Field>
              <Field label="Modo">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-foreground"
                >
                  <option value="temporal">Temporal (com prazo)</option>
                  <option value="conditional">Condicional (streak mínimo)</option>
                  <option value="permanent">Permanente irrestrito</option>
                </select>
              </Field>
              {mode === "temporal" ? (
                <Field label="Horas de duração">
                  <input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value || "0"))}
                    className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          {kind === "brasas" || kind === "xp" ? (
            <Field label="Quantidade">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value || "0"))}
                className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
              />
            </Field>
          ) : null}

          <button
            type="button"
            onClick={submit}
            className="w-full rounded-full bg-ember py-2 font-display text-[11px] tracking-[0.18em] text-charcoal-900"
          >
            CRIAR PRÊMIO
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">PRÊMIOS CRIADOS</p>
        <ul className="space-y-2">
          {rewards.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-charcoal-900/30 p-3">
              <p className="font-display text-sm text-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.kind} · {r.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChallengeBuilder({
  rewards,
  challenges,
  onChange,
}: {
  rewards: StudioReward[];
  challenges: StudioChallenge[];
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [perspectives, setPerspectives] = useState<ChallengePerspective[]>([
    { name: "Execução", metric: "habit_completion", target: 20 },
  ]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Dê um título.");
      return;
    }
    try {
      const id = await createChallenge({
        title,
        description: desc || null,
        cover_url: null,
        start_at: null,
        end_at: null,
        rules: { perspectives },
      });
      toast.success("Desafio criado (rascunho).");
      setTitle("");
      setDesc("");
      onChange();
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-charcoal-900/30 p-4">
        <h2 className="font-display text-lg tracking-wide text-foreground">Novo desafio</h2>
        <div className="mt-3 space-y-3 text-sm">
          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
            />
          </Field>
          <Field label="Descrição">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-foreground"
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-display text-[11px] tracking-[0.18em] text-muted-foreground">PERSPECTIVAS</p>
              <button
                type="button"
                onClick={() =>
                  setPerspectives((p) => [...p, { name: "", metric: "xp_total", target: 100 }])
                }
                className="rounded-full border border-border p-1 text-muted-foreground"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {perspectives.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  value={p.name}
                  onChange={(e) =>
                    setPerspectives((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder="Nome"
                  className="col-span-4 rounded-lg border border-border bg-transparent px-2 py-1 text-xs text-foreground"
                />
                <select
                  value={p.metric}
                  onChange={(e) =>
                    setPerspectives((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, metric: e.target.value as ChallengePerspective["metric"] } : x)),
                    )
                  }
                  className="col-span-5 rounded-lg border border-border bg-charcoal-900/60 px-2 py-1 text-xs text-foreground"
                >
                  {Object.entries(METRIC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={p.target}
                  onChange={(e) =>
                    setPerspectives((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, target: parseInt(e.target.value || "0") } : x)),
                    )
                  }
                  className="col-span-2 rounded-lg border border-border bg-transparent px-2 py-1 text-xs text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setPerspectives((arr) => arr.filter((_, j) => j !== i))}
                  className="col-span-1 rounded-lg text-muted-foreground"
                  aria-label="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={submit}
            className="w-full rounded-full bg-ember py-2 font-display text-[11px] tracking-[0.18em] text-charcoal-900"
          >
            CRIAR RASCUNHO
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">DESAFIOS</p>
        <ul className="space-y-2">
          {challenges.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-charcoal-900/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-sm text-foreground">{c.title}</p>
                  <p className="text-[11px] text-muted-foreground">{c.status}</p>
                </div>
                {c.status === "draft" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await publishChallenge(c.id);
                      toast.success("Publicado.");
                      onChange();
                    }}
                    className="flex items-center gap-1 rounded-full border border-ember/60 px-3 py-1 text-[10px] font-display tracking-[0.18em] text-ember"
                  >
                    <Upload className="h-3 w-3" /> PUBLICAR
                  </button>
                ) : null}
              </div>
              {rewards.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rewards.slice(0, 4).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={async () => {
                        await attachReward(c.id, r.id, 1);
                        toast.success("Prêmio anexado.");
                      }}
                      className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      + {r.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-display tracking-[0.18em] text-muted-foreground">
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}
