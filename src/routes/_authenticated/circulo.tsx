import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus, Copy, LogOut, Trophy, Dumbbell, Send, Target, Flame, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  listMyGroups, createGroup, joinByCode, leaveGroup, groupMemberCount,
  listGroupFeed, postToGroup, weeklyRanking,
  type Group, type GroupPost, type RankRow,
} from "@/lib/circles";
import {
  listMyChallenges, createChallenge, statusOf,
  type Challenge, type ChallengeMetric,
} from "@/lib/challenges";

export const Route = createFileRoute("/_authenticated/circulo")({
  head: () => ({ meta: [{ title: "Círculo — Personal IA" }] }),
  component: CirculoPage,
});

type Tab = "feed" | "desafios" | "ranking";

function CirculoPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("feed");

  const [feed, setFeed] = useState<GroupPost[] | null>(null);
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const [members, setMembers] = useState(0);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);

  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [postText, setPostText] = useState("");
  const [busy, setBusy] = useState(false);
  const [openCreateChallenge, setOpenCreateChallenge] = useState(false);

  const active = groups?.find((g) => g.id === activeId) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const gs = await listMyGroups();
        setGroups(gs);
        setActiveId((prev) => prev ?? gs[0]?.id ?? null);
      } catch {
        setGroups([]);
        toast.error("Não consegui carregar seus grupos.");
      }
    })();
  }, []);

  const loadGroup = useCallback(async () => {
    if (!activeId) return;
    try {
      const [f, r, c] = await Promise.all([
        listGroupFeed(activeId),
        weeklyRanking(activeId),
        groupMemberCount(activeId),
      ]);
      setFeed(f);
      setRanking(r);
      setMembers(c);
    } catch { /* noop */ }
  }, [activeId]);
  useEffect(() => { loadGroup(); }, [loadGroup]);

  const loadChallenges = useCallback(async () => {
    try {
      const cs = await listMyChallenges();
      setChallenges(cs);
    } catch {
      setChallenges([]);
    }
  }, []);
  useEffect(() => { loadChallenges(); }, [loadChallenges]);

  const groupChallenges = useMemo(
    () => (challenges ?? []).filter((c) => !activeId || c.group_id === activeId),
    [challenges, activeId],
  );
  const cActive = groupChallenges.filter((c) => statusOf(c) === "active");
  const cUpcoming = groupChallenges.filter((c) => statusOf(c) === "upcoming");
  const cEnded = groupChallenges.filter((c) => statusOf(c) === "ended");

  async function handleCreateGroup() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const g = await createGroup(name);
      setGroups((prev) => [...(prev ?? []), g]);
      setActiveId(g.id);
      setNewName("");
      toast.success("Grupo criado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar grupo.");
    } finally { setBusy(false); }
  }
  async function handleJoin() {
    const code = joinCode.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      const gid = await joinByCode(code);
      const gs = await listMyGroups();
      setGroups(gs);
      setActiveId(gid);
      setJoinCode("");
      toast.success("Você entrou no grupo!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido.");
    } finally { setBusy(false); }
  }
  async function handleLeave() {
    if (!active) return;
    if (!confirm(`Sair do grupo "${active.name}"?`)) return;
    try {
      await leaveGroup(active.id);
      const rest = (groups ?? []).filter((g) => g.id !== active.id);
      setGroups(rest);
      setActiveId(rest[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sair.");
    }
  }
  async function handlePost(kind: "post" | "treino", text?: string) {
    if (!active) return;
    const content = (text ?? postText).trim();
    if (!content) return;
    try {
      await postToGroup(active.id, content, kind);
      setPostText("");
      setFeed(await listGroupFeed(active.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar.");
    }
  }
  function copyCode() {
    if (!active) return;
    try { navigator.clipboard?.writeText(active.invite_code); toast("Código copiado."); } catch { /* noop */ }
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-14 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Users className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">CÍRCULO</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Grupos, desafios e ranking</p>
        </div>
      </header>

      {groups === null ? (
        <div className="space-y-2.5 px-4 pt-4">
          {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-charcoal-800" />)}
        </div>
      ) : (
        <>
          {groups.length > 0 && (
            <section className="px-4 pt-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {groups.map((g) => (
                  <button key={g.id} type="button" onClick={() => setActiveId(g.id)}
                    className={"shrink-0 rounded-xl border px-3 py-2 font-display text-[12px] tracking-wide " + (g.id === activeId ? "border-ember/60 bg-ember/10 text-ember" : "border-border text-muted-foreground")}>
                    {g.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2 px-4 pt-3">
            <div className="flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }} placeholder="Criar grupo…"
                className="flex-1 rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" />
              <button type="button" onClick={handleCreateGroup} disabled={!newName.trim() || busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-50 active:scale-95" aria-label="Criar grupo">
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
            <div className="flex gap-2">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }} placeholder="Entrar por código de convite"
                className="flex-1 rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm uppercase tracking-widest text-foreground placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" />
              <button type="button" onClick={handleJoin} disabled={!joinCode.trim() || busy} className="rounded-xl border border-ember/50 bg-charcoal-900 px-3 font-display text-[11px] tracking-[0.15em] text-ember disabled:opacity-50">
                ENTRAR
              </button>
            </div>
          </section>

          {!active ? (
            <section className="px-4 pt-8">
              <div className="forge-card rounded-2xl px-4 py-8 text-center text-muted-foreground">
                Crie um grupo ou entre por um código de convite.
              </div>
            </section>
          ) : (
            <>
              <section className="px-4 pt-4">
                <div className="forge-card rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-lg tracking-wide text-foreground">{active.name}</p>
                      <p className="text-[11px] text-muted-foreground">{members} {members === 1 ? "membro" : "membros"}</p>
                    </div>
                    <button type="button" onClick={handleLeave} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground active:scale-95" aria-label="Sair do grupo">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                  <button type="button" onClick={copyCode} className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-charcoal-900 px-3 py-2">
                    <span className="font-display text-[9px] tracking-[0.25em] text-muted-foreground">CONVITE</span>
                    <span className="font-display text-sm tracking-[0.3em] text-ember">{active.invite_code}</span>
                    <Copy className="ml-auto h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </section>

              <section className="px-4 pt-3">
                <div className="flex rounded-xl border border-border bg-charcoal-900 p-0.5">
                  {(["feed", "desafios", "ranking"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                      className={"flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-display text-[11px] tracking-[0.2em] " + (tab === t ? "bg-ember text-charcoal-900" : "text-muted-foreground")}>
                      {t === "feed" ? <Dumbbell className="h-3.5 w-3.5" /> : t === "desafios" ? <Target className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                      {t === "feed" ? "FEED" : t === "desafios" ? "DESAFIOS" : "RANKING"}
                    </button>
                  ))}
                </div>
              </section>

              {tab === "feed" && (
                <section className="space-y-2.5 px-4 pt-3">
                  <button type="button" onClick={() => handlePost("treino", "Bati mais um treino hoje! 💪")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2.5 font-display text-sm tracking-wide text-ember active:scale-[0.99]">
                    <Dumbbell className="h-4 w-4" /> Registrar treino no grupo
                  </button>
                  <div className="flex items-end gap-2">
                    <textarea value={postText} onChange={(e) => setPostText(e.target.value)} rows={1} placeholder="Escreva algo pro grupo…"
                      className="max-h-24 flex-1 resize-none rounded-xl border border-border bg-charcoal-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" />
                    <button type="button" onClick={() => handlePost("post")} disabled={!postText.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-40 active:scale-95" aria-label="Publicar">
                      <Send className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                  </div>
                  {feed === null ? (
                    <div className="h-24 animate-pulse rounded-2xl bg-charcoal-800" />
                  ) : feed.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      Ainda sem posts. Seja o primeiro a registrar um treino!
                    </p>
                  ) : (
                    feed.map((p) => (
                      <div key={p.id} className="forge-card rounded-2xl p-3.5">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-charcoal-900 font-display text-xs text-ember">
                            {p.author_name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="font-display text-sm tracking-wide text-foreground">{p.author_name}</span>
                          {p.kind === "treino" && (
                            <span className="ml-auto rounded-md border border-ember/30 bg-ember/10 px-1.5 py-0.5 font-display text-[9px] tracking-[0.15em] text-ember">TREINO</span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-snug text-foreground/90">{p.content}</p>
                      </div>
                    ))
                  )}
                </section>
              )}

              {tab === "desafios" && (
                <section className="space-y-3 px-4 pt-3">
                  <button
                    type="button"
                    onClick={() => setOpenCreateChallenge(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 py-2.5 font-display text-sm tracking-wide text-ember active:scale-[0.99]"
                  >
                    <Plus className="h-4 w-4" /> Criar desafio
                  </button>

                  {challenges === null ? (
                    <div className="h-24 animate-pulse rounded-2xl bg-charcoal-800" />
                  ) : groupChallenges.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      Nenhum desafio ainda. Crie o primeiro!
                    </p>
                  ) : (
                    <>
                      <ChallengeList label="Ativos" items={cActive} />
                      <ChallengeList label="Próximos" items={cUpcoming} />
                      <ChallengeList label="Encerrados" items={cEnded} muted />
                    </>
                  )}
                </section>
              )}

              {tab === "ranking" && (
                <section className="space-y-1.5 px-4 pt-3">
                  <p className="mb-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground">DIAS TREINADOS NESTA SEMANA</p>
                  {ranking === null ? (
                    <div className="h-24 animate-pulse rounded-2xl bg-charcoal-800" />
                  ) : ranking.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Sem dados ainda.</p>
                  ) : (
                    ranking.map((r, i) => (
                      <div key={r.user_id} className={"flex items-center gap-3 rounded-xl border px-3 py-2.5 " + (i === 0 ? "border-ember/50 bg-ember/5" : "border-border bg-charcoal-900")}>
                        <span className={"grid h-7 w-7 place-items-center rounded-full font-display text-sm " + (i === 0 ? "bg-ember text-charcoal-900" : "bg-charcoal-800 text-muted-foreground")}>{i + 1}</span>
                        <span className="flex-1 truncate font-display text-sm tracking-wide text-foreground">{r.display_name}</span>
                        <span className="font-display text-lg text-ember">{r.sessions}</span>
                      </div>
                    ))
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {openCreateChallenge && active && (
        <ChallengeForm
          groupId={active.id}
          onClose={() => setOpenCreateChallenge(false)}
          onCreated={async () => {
            setOpenCreateChallenge(false);
            await loadChallenges();
            toast.success("Desafio criado!");
          }}
        />
      )}

      <div className="h-24" />
    </MobileShell>
  );
}

function ChallengeList({ label, items, muted }: { label: string; items: Challenge[]; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 font-display text-[10px] tracking-[0.3em] text-muted-foreground">{label.toUpperCase()}</p>
      <div className="space-y-2">
        {items.map((c) => (
          <Link
            key={c.id}
            to="/circulo/desafio/$id"
            params={{ id: c.id }}
            className={"flex items-center gap-3 rounded-2xl border p-3 " + (muted ? "border-border bg-charcoal-900/60 opacity-70" : "forge-card")}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-800 text-ember">
              <Flame className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm tracking-wide text-foreground">{c.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {c.metric} · meta {c.target} · até {new Date(c.ends_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChallengeForm({
  groupId,
  onClose,
  onCreated,
}: {
  groupId: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<ChallengeMetric>("checkins");
  const [target, setTarget] = useState(7);
  const [starts, setStarts] = useState(today);
  const [ends, setEnds] = useState(in7);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createChallenge({
        group_id: groupId,
        title,
        description,
        metric,
        target,
        starts_at: new Date(starts + "T00:00:00").toISOString(),
        ends_at: new Date(ends + "T23:59:59").toISOString(),
      });
      await onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-[var(--shell-max,480px)] overflow-y-auto rounded-t-3xl border border-border bg-charcoal-900 p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-ember" />
          <h3 className="flex-1 font-display text-base tracking-wide text-foreground">Novo desafio</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="Ex: 30 treinos em novembro"
          className="mb-2 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          rows={2}
          placeholder="Descrição (opcional)"
          className="mb-2 w-full resize-none rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none"
        />
        <div className="mb-2 grid grid-cols-3 gap-2">
          {(["checkins", "treinos", "minutos"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={
                "rounded-xl border py-2 font-display text-[11px] tracking-wide " +
                (metric === m ? "border-ember/60 bg-ember/10 text-ember" : "border-border text-muted-foreground")
              }
            >
              {m}
            </button>
          ))}
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Meta
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
              className="rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Início
            <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className="rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Fim
            <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className="rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground" />
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !title.trim()}
          className="w-full rounded-xl bg-ember py-3 font-display text-sm tracking-wide text-charcoal-900 disabled:opacity-50 active:scale-[0.99]"
        >
          {busy ? "Criando..." : "Criar desafio"}
        </button>
      </div>
    </div>
  );
}
