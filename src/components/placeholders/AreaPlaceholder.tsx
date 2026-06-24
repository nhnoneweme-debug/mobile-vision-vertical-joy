import { Link } from "@tanstack/react-router";
import { ArrowLeft, Hammer } from "lucide-react";
import type { Area } from "@/components/map/areas";

export function AreaPlaceholder({ area }: { area: Area }) {
  const Icon = area.icon;
  return (
    <div className="flex flex-col">
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 px-4 pb-4 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <Link
          to="/mapa"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground hover:border-ember/40"
          aria-label="Voltar pro mapa"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            ÁREA · {area.tagline.toUpperCase()}
          </p>
          <h1 className="truncate font-display text-2xl leading-none tracking-wide text-foreground">
            {area.name}
          </h1>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charcoal-800 text-ember">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </header>

      <div className="flex-1 px-4 py-6">
        <p className="text-base text-foreground">{area.description}</p>

        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-5 text-center">
          <Hammer className="mx-auto h-6 w-6 text-ember" strokeWidth={2.2} />
          <h2 className="mt-3 font-display text-xl tracking-wide text-foreground">
            Em construção
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta área abre nas próximas fases da jornada. O esqueleto do mundo
            já está no lugar — em breve as missões, dados e NPCs chegam aqui.
          </p>
        </div>

        <ul className="mt-6 space-y-2">
          {placeholderHints(area.slug).map((hint) => (
            <li
              key={hint}
              className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
              {hint}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function placeholderHints(slug: string): string[] {
  switch (slug) {
    case "missoes":
      return [
        "Missões diárias com XP e streak",
        "Quests semanais de consistência",
        "Check-in honesto guiado pelo Guardião da Consistência",
      ];
    case "treino":
      return [
        "Treino do dia adaptado à sua energia",
        "Percepção de esforço pós-treino",
        "Histórico e limitações físicas",
      ];
    case "cozinha":
      return [
        "Registro de água e refeições",
        "Restrições, preferências e alergias",
        "Hábitos como álcool, doces e fast food",
      ];
    case "quarto":
      return [
        "Horas e qualidade do sono",
        "Energia ao acordar (1-10)",
        "Status de recuperação muscular",
      ];
    case "mental":
      return [
        "Motivação, disciplina e autoconfiança",
        "Crença limitante atual",
        "Reflexão diária com a IA",
      ];
    case "casa":
      return [
        "Dados básicos do avatar",
        "Classe comportamental",
        "Consentimentos e privacidade",
      ];
    default:
      return [
        "Área prevista no blueprint",
        "Conteúdo será desbloqueado em fase futura",
      ];
  }
}
