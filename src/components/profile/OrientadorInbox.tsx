import { useEffect, useState } from "react";
import { Crown, Inbox, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  completeOrientadorMission,
  listMissionsForStudent,
  listMyOrientadorInvites,
  respondToInvite,
  type OrientadorMission,
  type OrientadorStudentLink,
} from "@/lib/orientador";

export function OrientadorInbox({ userId }: { userId: string | null }) {
  const [invites, setInvites] = useState<OrientadorStudentLink[]>([]);
  const [missions, setMissions] = useState<OrientadorMission[]>([]);
  const [namesByOrientador, setNames] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  async function refresh(uid: string) {
    const [inv, ms] = await Promise.all([
      listMyOrientadorInvites(uid),
      listMissionsForStudent(uid),
    ]);
    setInvites(inv);
    setMissions(ms);
    const orientadorIds = Array.from(
      new Set([...inv.map((i) => i.orientador_id), ...ms.map((m) => m.orientador_id)]),
    );
    if (orientadorIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", orientadorIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        map[p.id] = p.display_name ?? "Orientador";
      });
      setNames(map);
    }
  }

  useEffect(() => {
    if (!userId) return;
    void refresh(userId);
  }, [userId]);

  const pendingInvites = invites.filter((i) => i.status === "pending");
  const pendingMissions = missions.filter((m) => m.status === "pending");

  if (!userId || (pendingInvites.length === 0 && pendingMissions.length === 0)) {
    return null;
  }

  async function handleInvite(linkId: string, accept: boolean) {
    setPending(linkId);
    try {
      await respondToInvite(linkId, accept);
      toast.success(accept ? "Vínculo aceito." : "Convite recusado.");
      if (userId) await refresh(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  async function handleComplete(missionId: string) {
    setPending(missionId);
    try {
      await completeOrientadorMission(missionId);
      toast.success("Missão selada. +XP");
      if (userId) await refresh(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-ember/40 bg-card p-4">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-ember" strokeWidth={2.2} />
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">
          DO ORIENTADOR
        </p>
      </div>

      {pendingInvites.length > 0 && (
        <div className="mt-3 space-y-2">
          {pendingInvites.map((i) => (
            <div
              key={i.id}
              className="rounded-xl border border-border bg-charcoal-900 p-3"
            >
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-ember" strokeWidth={2.2} />
                <p className="text-sm text-foreground">
                  <span className="font-display tracking-wide">
                    {namesByOrientador[i.orientador_id] ?? "Um orientador"}
                  </span>{" "}
                  quer te acompanhar.
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={pending === i.id}
                  onClick={() => handleInvite(i.id, true)}
                  className="flex-1 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 font-display text-xs tracking-widest text-ember active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-1">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> ACEITAR
                  </span>
                </button>
                <button
                  type="button"
                  disabled={pending === i.id}
                  onClick={() => handleInvite(i.id, false)}
                  className="flex-1 rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-display text-xs tracking-widest text-muted-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-1">
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} /> RECUSAR
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingMissions.length > 0 && (
        <div className="mt-3 space-y-2">
          {pendingMissions.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-charcoal-900 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-base tracking-wide text-foreground">
                  {m.title}
                </p>
                <span className="font-display text-[10px] tracking-[0.25em] text-ember">
                  +{m.xp_reward} XP
                </span>
              </div>
              {m.detail && (
                <p className="mt-1 text-xs text-muted-foreground">{m.detail}</p>
              )}
              <p className="mt-2 text-[10px] font-display tracking-[0.25em] text-muted-foreground">
                DE {(namesByOrientador[m.orientador_id] ?? "ORIENTADOR").toUpperCase()}
              </p>
              <button
                type="button"
                disabled={pending === m.id}
                onClick={() => handleComplete(m.id)}
                className="mt-3 w-full rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 font-display text-xs tracking-widest text-ember active:scale-[0.98] disabled:opacity-50"
              >
                {pending === m.id ? "SELANDO…" : "MARCAR CONCLUÍDA"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
