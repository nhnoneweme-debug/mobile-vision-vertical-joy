import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Crown,
  Flame,
  KeyRound,
  Send,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { supabase } from "@/integrations/supabase/client";
import {
  inviteStudentByFriendCode,
  isOrientador,
  listMissionsForOrientador,
  listStudents,
  redeemOrientadorCode,
  sendMission,
  type OrientadorMission,
  type StudentSnapshot,
} from "@/lib/orientador";
import { AREAS } from "@/components/map/areas";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do Orientador — Personal IA" },
      { name: "description", content: "Gestão de alunos e missões personalizadas." },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [orientador, setOrientador] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setOrientador(await isOrientador(data.user.id));
    })();
  }, []);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const ok = await redeemOrientadorCode(code);
      if (ok) {
        toast.success("Bem-vindo, Orientador.");
        setOrientador(true);
      } else {
        toast.error("Código inválido ou já usado.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  if (orientador === null) {
    return (
      <MobileShell>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      </MobileShell>
    );
  }

  if (!orientador) {
    return (
      <MobileShell>
        <Header subtitle="Resgate seu assento" />
        <section className="px-4 py-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-ember" strokeWidth={2.2} />
              <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                CÓDIGO DE CONVITE
              </p>
            </div>
            <p className="mt-2 text-sm text-foreground">
              O Painel do Orientador é restrito. Use um código fornecido pela equipe
              para liberar o assento.
            </p>
            <form onSubmit={handleRedeem} className="mt-4 space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ORI-XXXX-XX"
                className="w-full rounded-xl border border-border bg-charcoal-900 px-4 py-3 font-display tracking-[0.2em] text-foreground placeholder:text-muted-foreground/60"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 font-display tracking-widest text-ember active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "ABRINDO…" : "RESGATAR ASSENTO"}
              </button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Sem código? Volte ao{" "}
              <Link to="/mapa" className="text-ember underline">
                mapa
              </Link>
              .
            </p>
          </div>
        </section>
      </MobileShell>
    );
  }

  return <OrientadorDashboard userId={userId!} />;
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header
      className="border-b border-border px-4 pb-5"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
    >
      <p className="font-display text-[10px] tracking-[0.4em] text-ember">
        PAINEL · ORIENTADOR
      </p>
      <h1 className="mt-1 font-display text-3xl tracking-wide text-foreground">
        {subtitle}
      </h1>
    </header>
  );
}

function OrientadorDashboard({ userId }: { userId: string }) {
  const [students, setStudents] = useState<StudentSnapshot[]>([]);
  const [missions, setMissions] = useState<OrientadorMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [activeStudent, setActiveStudent] = useState<StudentSnapshot | null>(null);
  const [myFriendCode, setMyFriendCode] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("friend_code")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setMyFriendCode(data?.friend_code ?? null));
  }, [userId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        listStudents(userId),
        listMissionsForOrientador(userId),
      ]);
      setStudents(s);
      setMissions(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar painel");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const c = inviteCode.trim().toUpperCase();
    if (c.length < 4) return;
    try {
      await inviteStudentByFriendCode(userId, c);
      toast.success("Convite enviado.");
      setInviteCode("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const active = students.filter((s) => s.link.status === "active");
  const pending = students.filter((s) => s.link.status === "pending");

  return (
    <MobileShell>
      <Header subtitle="Seus alunos" />

      <section className="space-y-4 px-4 py-5 pb-32">
        {myFriendCode && (
          <div className="rounded-2xl border border-ember/40 bg-ember/5 p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-ember" strokeWidth={2.2} />
              <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                SEU CÓDIGO DE ORIENTADOR
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="font-display text-2xl tracking-[0.3em] text-ember">
                {myFriendCode}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(myFriendCode);
                    toast.success("Código copiado.");
                  }}
                  className="rounded-full border border-border px-3 py-1.5 font-display text-[10px] tracking-[0.2em] text-foreground active:scale-[0.97]"
                >
                  COPIAR
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const text = `Sou seu orientador na Personal IA. Meu código: ${myFriendCode}`;
                    if (navigator.share) {
                      try {
                        await navigator.share({ text });
                      } catch {
                        /* user cancelled */
                      }
                    } else {
                      navigator.clipboard.writeText(text);
                      toast.success("Mensagem copiada.");
                    }
                  }}
                  className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 font-display text-[10px] tracking-[0.2em] text-ember active:scale-[0.97]"
                >
                  COMPARTILHAR
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Sou seu orientador na Personal IA. Meu código: ${myFriendCode}`)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-charcoal-900 px-2 py-2 text-center font-display text-[10px] tracking-[0.2em] text-foreground active:scale-[0.97]"
              >
                WHATSAPP
              </a>
              <a
                href={`sms:?&body=${encodeURIComponent(`Sou seu orientador na Personal IA. Meu código: ${myFriendCode}`)}`}
                className="rounded-lg border border-border bg-charcoal-900 px-2 py-2 text-center font-display text-[10px] tracking-[0.2em] text-foreground active:scale-[0.97]"
              >
                SMS
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent("Convite Personal IA")}&body=${encodeURIComponent(`Sou seu orientador na Personal IA. Meu código: ${myFriendCode}`)}`}
                className="rounded-lg border border-border bg-charcoal-900 px-2 py-2 text-center font-display text-[10px] tracking-[0.2em] text-foreground active:scale-[0.97]"
              >
                EMAIL
              </a>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Compartilhe com seus alunos. Eles te buscam em <span className="text-ember">/social</span> e
              enviam pedido de amizade.
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-ember" strokeWidth={2.2} />
            <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              CONVIDAR ALUNO
            </p>
          </div>
          <form onSubmit={handleInvite} className="mt-3 flex gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="CÓDIGO DO ALUNO"
              className="flex-1 rounded-xl border border-border bg-charcoal-900 px-3 py-2.5 font-display tracking-[0.18em] text-sm text-foreground placeholder:text-muted-foreground/60"
            />
            <button
              type="submit"
              className="rounded-xl border border-ember/40 bg-ember/10 px-3 py-2.5 font-display text-xs tracking-widest text-ember active:scale-[0.97]"
            >
              ENVIAR
            </button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Use o código curto exibido em <span className="text-ember">/social</span> do
            aluno.
          </p>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Carregando…
          </p>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <SectionTitle>CONVITES PENDENTES</SectionTitle>
                <div className="space-y-2">
                  {pending.map((s) => (
                    <div
                      key={s.link.id}
                      className="rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground"
                    >
                      Aguardando o aluno aceitar.
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionTitle>
                <UsersIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                ATIVOS ({active.length})
              </SectionTitle>
              {active.length === 0 ? (
                <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum aluno ativo ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {active.map((s) => (
                    <Link
                      key={s.link.id}
                      to="/painel-aluno/$id"
                      params={{ id: s.link.student_id }}
                      className="block w-full rounded-xl border border-border bg-card p-4 text-left active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-display text-lg tracking-wide text-foreground">
                            {s.display_name ?? "Viajante"}
                          </p>
                          <p className="mt-0.5 font-display text-[10px] tracking-[0.3em] text-ember">
                            {(s.behavioral_class ?? "executor").toUpperCase()}
                          </p>
                        </div>
                        {s.inactive_days !== null && s.inactive_days >= 3 && (
                          <span className="flex items-center gap-1 rounded-full border border-ember/40 bg-ember/10 px-2 py-1 text-[10px] font-display tracking-widest text-ember">
                            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
                            {s.inactive_days}D OFF
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 font-display text-[10px] tracking-[0.2em] text-muted-foreground">
                        <Mini label="XP" value={s.xp.toString()} />
                        <Mini
                          label="STREAK"
                          value={
                            <span className="flex items-center justify-center gap-1">
                              <Flame className="h-3 w-3 text-ember" strokeWidth={2.5} />
                              {s.streak}
                            </span>
                          }
                        />
                        <Mini
                          label="ÚLTIMA"
                          value={
                            s.inactive_days === null
                              ? "—"
                              : s.inactive_days === 0
                                ? "HOJE"
                                : `${s.inactive_days}D`
                          }
                        />
                      </div>
                      <p className="mt-3 text-right font-display text-[10px] tracking-[0.3em] text-ember">
                        VER PAINEL →
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionTitle>MISSÕES ENVIADAS</SectionTitle>
              {missions.length === 0 ? (
                <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma missão enviada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {missions.slice(0, 10).map((m) => {
                    const s = students.find((x) => x.link.student_id === m.student_id);
                    return (
                      <div
                        key={m.id}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-display text-base tracking-wide text-foreground">
                            {m.title}
                          </p>
                          <span className="font-display text-[10px] tracking-[0.25em] text-ember">
                            +{m.xp_reward} XP
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          → {s?.display_name ?? "aluno"} · {statusLabel(m.status)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {activeStudent && (
        <SendMissionSheet
          orientadorId={userId}
          student={activeStudent}
          onClose={() => setActiveStudent(null)}
          onSent={async () => {
            setActiveStudent(null);
            await refresh();
          }}
        />
      )}

    </MobileShell>
  );
}

function statusLabel(s: OrientadorMission["status"]) {
  if (s === "completed") return "concluída";
  if (s === "cancelled") return "cancelada";
  return "pendente";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <p className="flex items-center gap-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {children}
      </p>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 text-center">
      <p className="text-[9px] tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-sm tracking-wide text-foreground">
        {value}
      </p>
    </div>
  );
}

function SendMissionSheet({
  orientadorId,
  student,
  onClose,
  onSent,
}: {
  orientadorId: string;
  student: StudentSnapshot;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [areaSlug, setAreaSlug] = useState<string>("");
  const [xp, setXp] = useState(50);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Dê um título à missão.");
      return;
    }
    setSending(true);
    try {
      await sendMission({
        orientadorId,
        studentId: student.link.student_id,
        title: title.trim(),
        detail: detail.trim() || undefined,
        area_slug: areaSlug || undefined,
        xp_reward: xp,
      });
      toast.success("Missão enviada.");
      await onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-t-3xl border border-border bg-card p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-border" />
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-ember" strokeWidth={2.2} />
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            ENVIAR MISSÃO PARA{" "}
            <span className="text-foreground">
              {(student.display_name ?? "ALUNO").toUpperCase()}
            </span>
          </p>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da missão"
            className="w-full rounded-xl border border-border bg-charcoal-900 px-4 py-3 text-foreground placeholder:text-muted-foreground/60"
          />
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detalhes (opcional)"
            rows={3}
            className="w-full rounded-xl border border-border bg-charcoal-900 px-4 py-3 text-foreground placeholder:text-muted-foreground/60"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                ÁREA
              </span>
              <select
                value={areaSlug}
                onChange={(e) => setAreaSlug(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-charcoal-900 px-3 py-2.5 text-sm text-foreground"
              >
                <option value="">— nenhuma —</option>
                {AREAS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                XP
              </span>
              <input
                type="number"
                min={10}
                max={500}
                step={10}
                value={xp}
                onChange={(e) => setXp(Number(e.target.value) || 50)}
                className="mt-1 w-full rounded-xl border border-border bg-charcoal-900 px-3 py-2.5 text-foreground"
              />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-charcoal-900 px-4 py-3 font-display tracking-widest text-muted-foreground"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 font-display tracking-widest text-ember active:scale-[0.99] disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-2">
                <Send className="h-4 w-4" strokeWidth={2.3} />
                {sending ? "ENVIANDO…" : "ENVIAR"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



