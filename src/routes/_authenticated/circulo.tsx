import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Copy, LogOut, Trophy, Dumbbell, Send } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  listMyGroups, createGroup, joinByCode, leaveGroup, groupMemberCount,
  listGroupFeed, postToGroup, weeklyRanking,
  type Group, type GroupPost, type RankRow,
} from "@/lib/circles";

export const Route = createFileRoute("/_authenticated/circulo")({
  head: () => ({ meta: [{ title: "Círculo — Personal IA" }] }),
  component: CirculoPage,
});

function CirculoPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"feed" | "ranking">("feed");
  const [feed, setFeed] = useState<GroupPost[]>([]);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [members, setMembers] = useState(0);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [postText, setPostText] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function handleCreate() {
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
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Seus grupos de treino</p>
        </div>
      </header>

      {groups === null ? (
        <div className="space-y-2.5 px-4 pt-4">
          {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-charcoal-800" />)}
        </div>
      ) : (
        <>
          {/* Grupos */}
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

          {/* Criar / entrar */}
          <section className="space-y-2 px-4 pt-3">
            <div className="flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} placeholder="Criar grupo…"
                className="flex-1 rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" />
              <button type="button" onClick={handleCreate} disabled={!newName.trim() || busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-50 active:scale-95" aria-label="Criar grupo">
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
              {/* Cabeçalho do grupo */}
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

              {/* Tabs */}
              <section className="px-4 pt-3">
                <div className="flex rounded-xl border border-border bg-charcoal-900 p-0.5">
                  {(["feed", "ranking"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                      className={"flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-display text-[11px] tracking-[0.2em] " + (tab === t ? "bg-ember text-charcoal-900" : "text-muted-foreground")}>
                      {t === "feed" ? <Dumbbell className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
                      {t === "feed" ? "FEED" : "RANKING"}
                    </button>
                  ))}
                </div>
              </section>

              {tab === "feed" ? (
                <section className="space-y-2.5 px-4 pt-3">
                  {/* Registrar treino / postar */}
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

                  {feed.length === 0 ? (
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
                        <p className="text-sm leading-snug text-foreground/90">{p.content}</p>
                      </div>
                    ))
                  )}
                </section>
              ) : (
                <section className="space-y-1.5 px-4 pt-3">
                  <p className="mb-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground">DIAS TREINADOS NESTA SEMANA</p>
                  {ranking.length === 0 ? (
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

      <div className="h-24" />
    </MobileShell>
  );
}
