import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { ChatThread } from "@/components/orientador/ChatThread";
import { listMyOrientadores } from "@/lib/orientador-chat";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/orientador-chat")({
  head: () => ({
    meta: [
      { title: "Conversa com o Orientador" },
      { name: "description", content: "Fale com seu orientador em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrientadorChatPage,
});

function OrientadorChatPage() {
  const [me, setMe] = useState<string | null>(null);
  const [list, setList] = useState<
    Array<{ id: string; display_name: string | null }>
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setMe(uid);
      if (uid) {
        try {
          const rows = await listMyOrientadores(uid);
          setList(rows);
          if (rows.length === 1) setSelected(rows[0].id);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <MobileShell>
      <header
        className="flex items-center gap-3 border-b border-border px-4 pb-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <Link
          to="/perfil"
          className="rounded-full border border-border p-2"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
        </Link>
        <div>
          <p className="font-display text-[10px] tracking-[0.4em] text-ember">
            ORIENTADOR
          </p>
          <h1 className="font-display text-2xl tracking-wide text-foreground">
            Conversa
          </h1>
        </div>
      </header>

      <div className="space-y-4 px-4 py-5 pb-32">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="mx-auto mb-2 h-6 w-6 text-ember" />
            Você ainda não tem um orientador vinculado. Peça o código de convite.
          </div>
        ) : (
          <>
            {list.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {list.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    className={
                      "rounded-full border px-3 py-1.5 font-display text-[11px] tracking-[0.2em] " +
                      (selected === o.id
                        ? "border-ember bg-ember/10 text-ember"
                        : "border-border text-foreground")
                    }
                  >
                    {(o.display_name ?? "Orientador").toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {selected && me && (
              <ChatThread
                orientadorId={selected}
                studentId={me}
                heightClass="h-[68vh]"
              />
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
