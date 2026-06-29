import { COUNTRIES, type Country } from "@/lib/countries";

type Props = {
  country: Country;
  onCountryChange: (c: Country) => void;
  number: string;
  onNumberChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

export function PhoneInput({
  country,
  onCountryChange,
  number,
  onNumberChange,
  placeholder = "11 99999-8888",
  autoComplete = "tel-national",
  required,
}: Props) {
  return (
    <div className="flex gap-2">
      <div className="relative">
        <select
          value={country.code}
          onChange={(e) => {
            const next = COUNTRIES.find((c) => c.code === e.target.value);
            if (next) onCountryChange(next);
          }}
          className="h-full appearance-none rounded-xl border border-border bg-card px-3 py-3 pr-8 text-base text-foreground focus:border-ember focus:outline-none"
          aria-label="País"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.dial}
            </option>
          ))}
        </select>
      </div>
      <input
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s()-]/g, ""))}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
      />
    </div>
  );
}
