import { ChoiceGrid } from "./inputs/ChoiceGrid";
import { NumberStepper } from "./inputs/NumberStepper";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/lib/countries";

export type AvatarData = {
  display_name: string;
  age?: number;
  gender?: string;
  height_cm?: number;
  weight_kg?: number;
  phone_number?: string; // só o número, sem prefixo
  phone_country?: string; // código ISO (ex: BR)
};

type Props = {
  value: AvatarData;
  onChange: (next: AvatarData) => void;
};

export function AvatarStep({ value, onChange }: Props) {
  const set = <K extends keyof AvatarData>(k: K, v: AvatarData[K]) =>
    onChange({ ...value, [k]: v });

  const country: Country =
    COUNTRIES.find((c) => c.code === value.phone_country) ?? DEFAULT_COUNTRY;

  return (
    <div className="space-y-6 pt-4">
      <Block label="NOME DO AVATAR *">
        <input
          value={value.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          placeholder="ex: Luna"
          maxLength={40}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
        />
      </Block>

      <Block label="TELEFONE">
        <PhoneInput
          country={country}
          onCountryChange={(c) => set("phone_country", c.code)}
          number={value.phone_number ?? ""}
          onNumberChange={(v) => set("phone_number", v)}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Usaremos para lembretes e login alternativo.
        </p>
      </Block>

      <Block label="IDADE">
        <NumberStepper
          value={value.age}
          onChange={(v) => set("age", v)}
          min={13}
          max={99}
          placeholder={28}
          suffix="anos"
        />
      </Block>

      <Block label="GÊNERO">
        <ChoiceGrid
          options={[
            { value: "f", label: "Feminino" },
            { value: "m", label: "Masculino" },
            { value: "outro", label: "Outro" },
            { value: "na", label: "Prefiro não dizer" },
          ]}
          value={value.gender}
          onChange={(v) => set("gender", v)}
        />
      </Block>

      <div className="grid grid-cols-2 gap-3">
        <Block label="ALTURA">
          <NumberStepper
            value={value.height_cm}
            onChange={(v) => set("height_cm", v)}
            min={120}
            max={230}
            placeholder={170}
            suffix="cm"
          />
        </Block>
        <Block label="PESO">
          <NumberStepper
            value={value.weight_kg}
            onChange={(v) => set("weight_kg", v)}
            min={35}
            max={200}
            placeholder={70}
            suffix="kg"
          />
        </Block>
      </div>

      <p className="text-[11px] text-muted-foreground">
        * Apenas o nome é obrigatório agora. O restante refina sua jornada e
        pode ser preenchido depois no perfil.
      </p>
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
