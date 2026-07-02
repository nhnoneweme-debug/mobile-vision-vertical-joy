import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Map,
  CalendarDays,
  Sparkles,
  Flame,
  MoreHorizontal,
  User,
  ShoppingBag,
  Trophy,
  BookOpen,
  Users,
  LineChart,
  ClipboardCheck,
  Moon,
  Gem,
  Swords,
  Wand2,
  Clock,
  MoonStar,
  MapPin,
  MessageCircle,
  ChevronRight,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Crown } from "lucide-react";
import { getMentorTip } from "@/lib/mentor-tips";

const MENTOR_PREF_KEY = "mentor.enabled";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const UPPER_MENU: { section: string; items: NavItem[] }[] = [
  {
    section: "Jornada",
    items: [
      { to: "/progresso", label: "Progresso", icon: LineChart },
      { to: "/missoes", label: "Minhas Missões", icon: ClipboardCheck },
      { to: "/classe", label: "Classe & Perks", icon: Sparkles },
      { to: "/conquistas", label: "Conquistas & Saga", icon: Trophy },
      { to: "/cristais", label: "Cristais do Poder", icon: Gem },
      { to: "/alarme", label: "Despertar/Alarme", icon: Clock },
      { to: "/despertar", label: "Acordar agora", icon: Sparkles },
      { to: "/sonhos", label: "Sonhos", icon: MoonStar },
      { to: "/dormir", label: "Dormir (Dump do dia)", icon: Moon },
      { to: "/jornada", label: "Jornada do Dia", icon: MapPin },
      { to: "/ritual", label: "Rituais", icon: Moon },
    ],
  },
  {
    section: "Convívio",
    items: [
      { to: "/social", label: "Social", icon: Users },
      { to: "/desafios", label: "Desafios", icon: Swords },
      { to: "/painel", label: "Painel do Orientador", icon: ClipboardCheck },
      { to: "/area/orientador", label: "Falar com a IA", icon: BookOpen },
    ],
  },
  {
    section: "Conta",
    items: [
      { to: "/perfil", label: "Perfil", icon: User },
      { to: "/loja", label: "Forja de Brasas", icon: ShoppingBag },
      { to: "/planos", label: "Planos Brasas+", icon: Crown },
      { to: "/studio", label: "Studio (admin)", icon: Wand2 },
    ],
  },
];

const ALL_UPPER_ITEMS = UPPER_MENU.flatMap((s) => s.items);

function NavSlot({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-1 flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
      activeProps={{ className: "text-ember" }}
    >
      <Icon className="h-5 w-5" strokeWidth={2.2} />
      <span className="font-display text-[11px] tracking-[0.18em]">{label}</span>
      {active ? (
        <span className="absolute -top-[1px] h-[2px] w-8 rounded-full bg-ember shadow-[0_0_8px_var(--ember)]" />
      ) : null}
    </Link>
  );
}

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);
  const [mentorEnabled, setMentorEnabled] = useState(true);
  const [iaPrompt, setIaPrompt] = useState("");
  const iaInputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();


  useEffect(() => {
    try {
      const v = localStorage.getItem(MENTOR_PREF_KEY);
      if (v !== null) setMentorEnabled(v === "1");
    } catch {}
  }, []);

  function toggleMentor(next: boolean) {
    setMentorEnabled(next);
    try {
      localStorage.setItem(MENTOR_PREF_KEY, next ? "1" : "0");
    } catch {}
  }

  const tip = getMentorTip(pathname);
  const onIaRoute = pathname.startsWith("/ia");

  function goToIA(seed?: string, autosend = true) {
    setIaOpen(false);
    const payload = (seed ?? iaPrompt).trim();
    if (payload) {
      try {
        sessionStorage.setItem("ia.seed", payload);
        if (autosend) sessionStorage.setItem("ia.autosend", "1");
        else sessionStorage.removeItem("ia.autosend");
      } catch {}
    }
    setIaPrompt("");
    if (payload && onIaRoute) {
      // Já está em /ia: componente não remonta — sinaliza via evento
      try {
        window.dispatchEvent(new CustomEvent("ia:seed"));
      } catch {}
      return;
    }
    void navigate({ to: "/ia" });
  }


  useEffect(() => {
    if (!iaOpen) return;
    const t = setTimeout(() => iaInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [iaOpen]);


  const upperMatch = ALL_UPPER_ITEMS.find((i) =>
    i.to === "/" ? pathname === "/" : pathname.startsWith(i.to),
  );
  const moreActive = Boolean(upperMatch);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[var(--shell-max)] border-t border-border bg-charcoal-900/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="relative flex items-stretch justify-around px-2 pt-2">
        <li className="relative flex-1">
          <NavSlot to="/mapa" label="MAPA" Icon={Map} active={pathname.startsWith("/mapa") || pathname.startsWith("/area")} />
        </li>
        <li className="relative flex-1">
          <NavSlot to="/calendario" label="PLANO" Icon={CalendarDays} active={pathname.startsWith("/calendario")} />
        </li>

        {/* Centro destacado — IA hub (dicas contextuais + chat) */}
        <li className="relative flex-1">
          <button
            type="button"
            onClick={() => setIaOpen(true)}
            className={
              "group flex w-full flex-col items-center gap-1 px-1 pt-1 " +
              (onIaRoute ? "text-ember" : "text-muted-foreground")
            }
            aria-label="Abrir IA"
          >
            <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-ember text-charcoal-900 shadow-[0_8px_24px_-6px_var(--ember)] ring-4 ring-charcoal-900/90 transition-transform group-active:scale-95">
              <Sparkles className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <span className="font-display text-[10px] tracking-[0.18em] text-foreground">
              IA
            </span>
          </button>

          <Sheet open={iaOpen} onOpenChange={setIaOpen}>
            <SheetContent
              side="bottom"
              className="mx-auto max-w-[var(--shell-max)] rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
            >
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-ember/15 text-ember">
                    <Sparkles className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                  IA-AGREGADORA
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground">
                  Coleta, agrega e dá sentido. Digite abaixo e envie — ou escolha uma sugestão desta tela.
                </p>
              </SheetHeader>

              <div className="mt-4 space-y-4 pb-4">
                {/* Composer — foco imediato, menor fricção */}
                <div className="rounded-2xl border border-ember/40 bg-charcoal-800/60 p-2">
                  <textarea
                    ref={iaInputRef}
                    value={iaPrompt}
                    onChange={(e) => setIaPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        goToIA();
                      }
                    }}
                    rows={2}
                    placeholder="Fale, despeje, pergunte…"
                    className="max-h-40 min-h-[56px] w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-between gap-2 px-1 pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Enter envia · Shift+Enter quebra linha
                    </span>
                    <button
                      type="button"
                      onClick={() => goToIA()}
                      disabled={!iaPrompt.trim() && !onIaRoute}
                      className="flex h-9 items-center gap-2 rounded-xl bg-ember px-3 font-display text-[11px] tracking-[0.22em] text-charcoal-900 transition-opacity disabled:opacity-40"
                    >
                      {iaPrompt.trim() ? (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          ENVIAR
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-3.5 w-3.5" />
                          {onIaRoute ? "CONTINUAR" : "ABRIR CHAT"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Toggle dicas contextuais */}
                <label className="flex items-center justify-between rounded-xl border border-border bg-charcoal-800/40 px-3 py-2">
                  <div>
                    <p className="font-display text-[11px] tracking-[0.18em] text-foreground">
                      GUIA DESTA TELA
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Explicação do ambiente e perguntas rápidas.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mentorEnabled}
                    onClick={() => toggleMentor(!mentorEnabled)}
                    className={
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                      (mentorEnabled ? "bg-ember" : "bg-border")
                    }
                  >
                    <span
                      className={
                        "absolute top-[2px] h-5 w-5 rounded-full bg-charcoal-900 transition-all " +
                        (mentorEnabled ? "left-[22px]" : "left-[2px]")
                      }
                    />
                  </button>
                </label>

                {/* Bloco contextual */}
                {mentorEnabled && (
                  <div className="rounded-xl border border-ember/30 bg-ember/5 p-3">
                    <p className="font-display text-[10px] tracking-[0.3em] text-ember">
                      NESTA TELA
                    </p>
                    <p className="mt-1 font-display text-base tracking-wide text-foreground">
                      {tip.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/85">
                      {tip.blurb}
                    </p>

                    <p className="mt-3 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                      SUGESTÕES RÁPIDAS
                    </p>
                    <div className="mt-1 space-y-2">
                      {tip.questions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => goToIA(q)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground active:scale-[0.99]"
                        >
                          <span className="flex-1">{q}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </SheetContent>
          </Sheet>
        </li>

        <li className="relative flex-1">
          <NavSlot to="/habitos" label="HÁBITOS" Icon={Flame} active={pathname.startsWith("/habitos")} />
        </li>


        <li className="relative flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={
                  "flex w-full flex-col items-center gap-1 px-2 py-2 transition-colors " +
                  (moreActive ? "text-ember" : "text-muted-foreground")
                }
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />
                <span className="font-display text-[11px] tracking-[0.18em] truncate max-w-[60px]">
                  {moreActive && upperMatch ? upperMatch.label.toUpperCase() : "MAIS"}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mx-auto max-w-[var(--shell-max)] rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
            >
              <SheetHeader>
                <SheetTitle className="font-display tracking-[0.18em] text-foreground">
                  NAVEGAR
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5 pb-6">
                {UPPER_MENU.map((section) => (
                  <div key={section.section}>
                    <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">
                      {section.section.toUpperCase()}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {section.items.map((item) => {
                        const active =
                          item.to === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.to);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setOpen(false)}
                            className={
                              "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors " +
                              (active
                                ? "border-ember/60 bg-ember/10 text-ember"
                                : "border-border/60 text-muted-foreground hover:text-foreground")
                            }
                          >
                            <Icon className="h-5 w-5" strokeWidth={2.2} />
                            <span className="font-display text-[10px] tracking-[0.15em]">
                              {item.label.toUpperCase()}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
