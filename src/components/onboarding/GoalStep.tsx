import { ChoiceGrid } from "./inputs/ChoiceGrid";
import { NumberStepper } from "./inputs/NumberStepper";

export type GoalData = {
  goal?: string;
  level?: string;
  time_per_day_min?: number;
  days_per_week?: number;
};

type Props = {
  value: GoalData;
  onChange: (next: GoalData) => void;
};

export function GoalStep({ value, onChange }: Props) {
  const set = <K extends keyof GoalData>(k: K, v: GoalData[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-6 pt-4">
      <Block label="SEU FOCO PRINCIPAL">
        <ChoiceGrid
          columns={1}
          options={[
            { value: "emagrecer", label: "Emagrecer", hint: "Queima e composição" },
            { value: "hipertrofia", label: "Hipertrofia", hint: "Ganhar massa magra" },
            { value: "saude", label: "Saúde geral", hint: "Equilíbrio e energia" },
            { value: "performance", label: "Performance", hint: "Força, ritmo, condicionamento" },
            { value: "mente", label: "Mente & hábitos", hint: "Foco, sono, consistência" },
          ]}
          value={value.goal}
          onChange={(v) => set("goal", v)}
        />
      </Block>

      <Block label="SEU NÍVEL ATUAL">
        <ChoiceGrid
          options={[
            { value: "iniciante", label: "Iniciante" },
            { value: "intermediario", label: "Intermediário" },
            { value: "avancado", label: "Avançado" },
          ]}
          value={value.level}
          onChange={(v) => set("level", v)}
        />
      </Block>

      <Block label="TEMPO POR DIA">
        <ChoiceGrid
          options={[
            { value: "15", label: "15 min" },
            { value: "30", label: "30 min" },
            { value: "45", label: "45 min" },
            { value: "60", label: "60+ min" },
          ]}
          value={value.time_per_day_min?.toString()}
          onChange={(v) => set("time_per_day_min", Number(v))}
        />
      </Block>

      <Block label="DIAS POR SEMANA">
        <NumberStepper
          value={value.days_per_week}
          onChange={(v) => set("days_per_week", v)}
          min={1}
          max={7}
          placeholder={4}
          suffix="dias"
        />
      </Block>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
