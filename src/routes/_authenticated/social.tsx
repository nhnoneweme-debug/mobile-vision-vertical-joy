import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { BottomNav } from "@/components/shell/BottomNav";
import {
  bumpMyProgress,
  createChallenge,
  createGroup,
  getMyFriendCode,
  joinGroupByCode,
  leaveGroup,
  listChallenges,
  listFriendships,
  listGroupMembers,
  listMyGroups,
  METRIC_LABEL,
  removeFriendship,
  respondToFriendship,
  sendFriendRequestByCode,
  type ChallengeMetric,
  type ChallengeWithProgress,
  type FriendshipRow,
  type GroupRow,
} from "@/lib/social";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Crown,
  Flame,
  LogOut,
  Plus,
  Send,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({
    meta: [
      { title: "Praça Social — Personal IA" },
      { name: "description", content: "Amigos, guildas e desafios coletivos." },
    ],
  }),
  component: SocialPage,
});

type Tab = "feed" | "amigos" | "grupos" | "desafios";

function SocialPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("amigos");
  const [loading, setLoading] = useState(true);

  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);

  const refresh = useCallback(async (uid: string) => {
    const [fs, gs, code] = await Promise.all([
      listFriendships(uid),
      listMyGroups(uid),
      getMyFriendCode(uid),
    ]);
    setFriendships(fs);
    setGroups(gs);
    setMyCode(code);
    setActiveGroupId((prev) => prev ?? gs[0]?.id ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      try {
        await refresh(data.user.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar.");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!activeGroupId || !userId) return;
    listChallenges(activeGroupId, userId).then(setChallenges).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar desafios.");
    });
  }, [activeGroupId, userId]);

  return (
    <MobileShell>
      <section
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 px-4 pb-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">PRAÇA</p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-foreground">Social</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Amigos, guildas e desafios para acender a chama coletiva.
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto">
          {(["amigos", "grupos", "desafios"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full border px-4 py-1.5 font-display text-[12px] tracking-[0.2em] transition ${
                tab === t
                  ? "border-ember bg-ember/10 text-ember"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4 px-4 py-5 pb-32">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : tab === "amigos" ? (
          <FriendsPanel
            userId={userId!}
            myCode={myCode}
            friendships={friendships}
            onChange={() => refresh(userId!)}
          />
        ) : tab === "grupos" ? (
          <GroupsPanel
            userId={userId!}
            groups={groups}
            activeGroupId={activeGroupId}
            setActiveGroupId={setActiveGroupId}
            onChange={() => refresh(userId!)}
          />
        ) : (
          <ChallengesPanel
            userId={userId!}
            groups={groups}
            activeGroupId={activeGroupId}
            setActiveGroupId={setActiveGroupId}
            challenges={challenges}
            onChange={async () => {
              if (activeGroupId && userId) {
                setChallenges(await listChallenges(activeGroupId, userId));
              }
            }}
          />
        )}
      </div>

      <BottomNav />
    </MobileShell>
  );
}

// ============ Friends ============

function FriendsPanel({
  userId,
  myCode,
  friendships,
  onChange,
}: {
  userId: string;
  myCode: string | null;
  friendships: FriendshipRow[];
  onChange: () => void;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const incoming = friendships.filter(
    (f) => f.status === "pending" && f.direction === "incoming",
  );
  const outgoing = friendships.filter(
    (f) => f.status === "pending" && f.direction === "outgoing",
  );
  const accepted = friendships.filter((f) => f.status === "accepted");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await sendFriendRequestByCode(userId, code);
      toast.success("Convite enviado.");
      setCode("");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setPending(false);
    }
  }

  async function copyCode() {
    if (!myCode) return;
    await navigator.clipboard.writeText(myCode);
    toast.success("Código copiado.");
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-charcoal-800/60 p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          SEU CÓDIGO
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="font-display text-3xl tracking-[0.3em] text-ember">
            {myCode ?? "—"}
          </p>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" /> copiar
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 rounded-2xl border border-border bg-charcoal-800/60 p-3"
      >
        <UserPlus className="h-4 w-4 text-ember" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CÓDIGO DO AMIGO"
          maxLength={8}
          className="flex-1 bg-transparent font-display tracking-[0.25em] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !code}
          className="rounded-full bg-ember p-2 text-charcoal-900 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {incoming.length > 0 && (
        <Section label="Convites recebidos">
          {incoming.map((f) => (
            <FriendCard
              key={f.id}
              row={f}
              actions={
                <>
                  <IconBtn
                    variant="accept"
                    label="Aceitar"
                    onClick={async () => {
                      await respondToFriendship(f.id, "accepted");
                      onChange();
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    variant="ghost"
                    label="Recusar"
                    onClick={async () => {
                      await respondToFriendship(f.id, "declined");
                      onChange();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </IconBtn>
                </>
              }
            />
          ))}
        </Section>
      )}

      {accepted.length > 0 && (
        <Section label={`Amigos (${accepted.length})`}>
          {accepted
            .slice()
            .sort((a, b) => (b.other?.xp ?? 0) - (a.other?.xp ?? 0))
            .map((f) => (
              <FriendCard
                key={f.id}
                row={f}
                actions={
                  <IconBtn
                    variant="ghost"
                    label="Remover"
                    onClick={async () => {
                      await removeFriendship(f.id);
                      onChange();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </IconBtn>
                }
              />
            ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section label="Enviados">
          {outgoing.map((f) => (
            <FriendCard
              key={f.id}
              row={f}
              actions={
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  aguardando
                </span>
              }
            />
          ))}
        </Section>
      )}

      {friendships.length === 0 && (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Sua praça está vazia."
          subtitle="Compartilhe seu código e convide alguém para caminhar junto."
        />
      )}
    </>
  );
}

function FriendCard({
  row,
  actions,
}: {
  row: FriendshipRow;
  actions: React.ReactNode;
}) {
  const p = row.other;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-charcoal-800/60 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-display text-lg tracking-wide text-foreground">
          {p?.display_name ?? "Viajante"}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{p?.behavioral_class ?? "—"}</span>
          <span className="text-ember">·</span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-ember" /> {p?.xp ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3 text-ember" /> {p?.streak ?? 0}d
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

// ============ Groups ============

function GroupsPanel({
  userId,
  groups,
  activeGroupId,
  setActiveGroupId,
  onChange,
}: {
  userId: string;
  groups: GroupRow[];
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  onChange: () => void;
}) {
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pending, setPending] = useState(false);
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof listGroupMembers>>
  >([]);

  useEffect(() => {
    if (!activeGroupId) {
      setMembers([]);
      return;
    }
    listGroupMembers(activeGroupId).then(setMembers).catch(() => setMembers([]));
  }, [activeGroupId, groups.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await createGroup(userId, { name, description: desc });
      toast.success("Guilda forjada.");
      setName("");
      setDesc("");
      setMode("none");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setPending(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const id = await joinGroupByCode(userId, joinCode);
      toast.success("Entrou na guilda.");
      setJoinCode("");
      setMode("none");
      setActiveGroupId(id);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setPending(false);
    }
  }

  const active = groups.find((g) => g.id === activeGroupId) ?? null;

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "create" ? "none" : "create")}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-ember/40 bg-ember/10 px-3 py-3 font-display text-[12px] tracking-[0.2em] text-ember"
        >
          <Plus className="h-4 w-4" /> NOVA
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "join" ? "none" : "join")}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border px-3 py-3 font-display text-[12px] tracking-[0.2em] text-foreground"
        >
          <UserPlus className="h-4 w-4" /> ENTRAR
        </button>
      </div>

      {mode === "create" && (
        <form
          onSubmit={handleCreate}
          className="space-y-2 rounded-2xl border border-border bg-charcoal-800/60 p-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da guilda"
            className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-foreground focus:border-ember focus:outline-none"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Propósito (opcional)"
            rows={2}
            className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground focus:border-ember focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-ember py-2 font-display tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
          >
            FORJAR
          </button>
        </form>
      )}

      {mode === "join" && (
        <form
          onSubmit={handleJoin}
          className="flex items-center gap-2 rounded-2xl border border-border bg-charcoal-800/60 p-3"
        >
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO DA GUILDA"
            maxLength={8}
            className="flex-1 bg-transparent font-display tracking-[0.25em] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !joinCode}
            className="rounded-full bg-ember p-2 text-charcoal-900 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      {groups.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Nenhuma guilda ainda."
          subtitle="Forje a sua ou entre com um código de convite."
        />
      ) : (
        <Section label="Suas guildas">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGroupId(g.id)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                activeGroupId === g.id
                  ? "border-ember bg-ember/10"
                  : "border-border bg-charcoal-800/60"
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-display text-lg tracking-wide text-foreground">
                  {g.is_owner && <Crown className="h-4 w-4 text-ember" />}
                  {g.name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.member_count} {g.member_count === 1 ? "membro" : "membros"} ·{" "}
                  <span className="font-display tracking-[0.2em] text-ember">
                    {g.invite_code}
                  </span>
                </p>
              </div>
            </button>
          ))}
        </Section>
      )}

      {active && (
        <Section label={`Membros — ${active.name}`}>
          {members.map((m, idx) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between rounded-2xl border border-border bg-charcoal-800/60 px-4 py-2.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-5 text-center font-display text-sm text-ember">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-base tracking-wide text-foreground">
                    {m.profile?.display_name ?? "Viajante"}
                    {m.role === "owner" && (
                      <Crown className="ml-1 inline h-3 w-3 text-ember" />
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    {m.profile?.behavioral_class ?? "—"}
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-1 font-display text-sm text-ember">
                <Sparkles className="h-3 w-3" /> {m.profile?.xp ?? 0}
              </p>
            </div>
          ))}
          {!active.is_owner && (
            <button
              type="button"
              onClick={async () => {
                await leaveGroup(active.id, userId);
                setActiveGroupId(null);
                onChange();
                toast.success("Saiu da guilda.");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair da guilda
            </button>
          )}
        </Section>
      )}
    </>
  );
}

// ============ Challenges ============

function ChallengesPanel({
  userId,
  groups,
  activeGroupId,
  setActiveGroupId,
  challenges,
  onChange,
}: {
  userId: string;
  groups: GroupRow[];
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  challenges: ChallengeWithProgress[];
  onChange: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const active = groups.find((g) => g.id === activeGroupId) ?? null;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-6 w-6" />}
        title="Crie uma guilda primeiro."
        subtitle="Desafios vivem dentro de guildas."
      />
    );
  }

  return (
    <>
      <select
        value={activeGroupId ?? ""}
        onChange={(e) => setActiveGroupId(e.target.value || null)}
        className="w-full rounded-2xl border border-border bg-charcoal-800/60 px-4 py-3 font-display tracking-wide text-foreground focus:border-ember focus:outline-none"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {active?.is_owner && (
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ember/40 bg-ember/10 px-3 py-3 font-display text-[12px] tracking-[0.2em] text-ember"
        >
          <Plus className="h-4 w-4" /> {showForm ? "FECHAR" : "NOVO DESAFIO"}
        </button>
      )}

      {showForm && active && (
        <ChallengeForm
          groupId={active.id}
          userId={userId}
          onDone={async () => {
            setShowForm(false);
            await onChange();
          }}
        />
      )}

      {challenges.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Nenhum desafio ativo."
          subtitle={active?.is_owner ? "Você é o dono — crie o primeiro." : "Aguardando o dono lançar um desafio."}
        />
      ) : (
        challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            userId={userId}
            onBump={async () => {
              await bumpMyProgress(c.id, userId, 1);
              await onChange();
            }}
          />
        ))
      )}
    </>
  );
}

function ChallengeForm({
  groupId,
  userId,
  onDone,
}: {
  groupId: string;
  userId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [metric, setMetric] = useState<ChallengeMetric>("xp");
  const [target, setTarget] = useState(500);
  const [days, setDays] = useState(7);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await createChallenge(userId, {
        group_id: groupId,
        title,
        description: desc,
        metric,
        target,
        days,
      });
      toast.success("Desafio lançado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-border bg-charcoal-800/60 p-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do desafio"
        required
        className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-foreground focus:border-ember focus:outline-none"
      />
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full rounded-lg border border-border bg-charcoal-900/60 px-3 py-2 text-sm text-foreground focus:border-ember focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Métrica
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as ChallengeMetric)}
            className="mt-1 w-full rounded-lg border border-border bg-charcoal-900/60 px-2 py-2 text-foreground focus:border-ember focus:outline-none"
          >
            {(Object.keys(METRIC_LABEL) as ChallengeMetric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Alvo
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-border bg-charcoal-900/60 px-2 py-2 text-foreground focus:border-ember focus:outline-none"
          />
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Duração (dias)
        <input
          type="number"
          min={1}
          max={90}
          value={days}
          onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
          className="mt-1 w-full rounded-lg border border-border bg-charcoal-900/60 px-2 py-2 text-foreground focus:border-ember focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ember py-2 font-display tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
      >
        LANÇAR
      </button>
    </form>
  );
}

function ChallengeCard({
  challenge,
  userId,
  onBump,
}: {
  challenge: ChallengeWithProgress;
  userId: string;
  onBump: () => void;
}) {
  const pct = Math.min(100, (challenge.my_value / challenge.target) * 100);
  const endsIn = useMemo(() => {
    const days = Math.max(
      0,
      Math.ceil((new Date(challenge.ends_at).getTime() - Date.now()) / 86400000),
    );
    return days;
  }, [challenge.ends_at]);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-charcoal-800/60 p-4">
      <div>
        <p className="font-display text-xl tracking-wide text-foreground">
          {challenge.title}
        </p>
        {challenge.description && (
          <p className="mt-1 text-xs text-muted-foreground">{challenge.description}</p>
        )}
        <p className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="text-ember">{METRIC_LABEL[challenge.metric]}</span>
          <span>·</span>
          <span>{endsIn === 0 ? "encerra hoje" : `${endsIn}d restantes`}</span>
        </p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="font-display text-sm text-foreground">
            Você: <span className="text-ember">{challenge.my_value}</span> / {challenge.target}
          </p>
          <button
            type="button"
            onClick={onBump}
            className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-ember"
          >
            +1
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal-900">
          <div
            className="h-full rounded-full bg-ember transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {challenge.leaderboard.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            RANKING
          </p>
          {challenge.leaderboard.slice(0, 5).map((row, idx) => (
            <div
              key={row.user_id}
              className={`flex items-center justify-between text-sm ${
                row.user_id === userId ? "text-ember" : "text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-4 font-display text-xs">{idx + 1}</span>
                <span className="truncate">
                  {row.display_name ?? "Viajante"}
                  {row.user_id === userId && " · você"}
                </span>
              </span>
              <span className="font-display">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ shared ============

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {label.toUpperCase()}
      </p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-charcoal-800/40 px-6 py-10 text-center">
      <div className="text-ember">{icon}</div>
      <p className="font-display text-lg tracking-wide text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function IconBtn({
  variant,
  label,
  onClick,
  children,
}: {
  variant: "accept" | "ghost";
  label: string;
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const cls =
    variant === "accept"
      ? "bg-ember text-charcoal-900"
      : "border border-border text-muted-foreground";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full ${cls}`}
    >
      {children}
    </button>
  );
}
