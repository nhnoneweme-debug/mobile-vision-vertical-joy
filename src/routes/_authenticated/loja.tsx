import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, Lock, Check, Sparkles, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  listShopItems,
  listInventory,
  listBrasasEvents,
  purchaseShopItem,
  equipInventoryItem,
  CATEGORY_LABEL,
  SOURCE_LABEL,
  type ShopItem,
  type InventoryItem,
  type BrasasEvent,
  type ShopCategory,
} from "@/lib/shop";

export const Route = createFileRoute("/_authenticated/loja")({
  head: () => ({
    meta: [
      { title: "Loja de Brasas — Personal IA" },
      { name: "description", content: "Troque suas Brasas por molduras, títulos e temas exclusivos." },
    ],
  }),
  component: LojaPage,
});

const CATEGORIES: ShopCategory[] = ["frame", "title", "avatar_icon", "theme"];

function LojaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [brasas, setBrasas] = useState(0);
  const [level, setLevel] = useState(1);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [events, setEvents] = useState<BrasasEvent[]>([]);
  const [tab, setTab] = useState<ShopCategory>("frame");
  const [showHistory, setShowHistory] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const loadAll = useCallback(async (uid: string) => {
    const [prof, sh, inv, ev] = await Promise.all([
      supabase.from("profiles").select("brasas, xp").eq("id", uid).maybeSingle(),
      listShopItems(),
      listInventory(uid),
      listBrasasEvents(uid, 30),
    ]);
    setBrasas(prof.data?.brasas ?? 0);
    setLevel(Math.max(1, Math.floor((prof.data?.xp ?? 0) / 500) + 1));
    setItems(sh);
    setInventory(inv);
    setEvents(ev);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !active) return;
      setUserId(data.user.id);
      await loadAll(data.user.id);
    })();
    return () => {
      active = false;
    };
  }, [loadAll]);

  const ownedIds = useMemo(() => new Set(inventory.map((i) => i.item_id)), [inventory]);
  const visibleItems = items.filter((i) => i.category === tab);

  async function handleBuy(item: ShopItem) {
    if (!userId || pending) return;
    setPending(item.id);
    try {
      const res = await purchaseShopItem(item.id);
      if (res.ok) {
        toast.success(`Adquirido: ${item.name}`, {
          description: `−${item.price} Brasas`,
        });
        await loadAll(userId);
      } else {
        const map: Record<string, string> = {
          insufficient_brasas: "Brasas insuficientes.",
          level_locked: `Requer nível ${res.required_level}.`,
          already_owned: "Você já possui este item.",
          item_unavailable: "Item indisponível.",
        };
        toast.error(map[res.error] ?? "Compra recusada.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na compra.");
    } finally {
      setPending(null);
    }
  }

  async function handleEquip(inv: InventoryItem) {
    if (!userId) return;
    try {
      await equipInventoryItem(inv.item_id, !inv.equipped);
      await loadAll(userId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao equipar.");
    }
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/90 px-4 pb-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">LOJA</p>
            <h1 className="font-display text-2xl tracking-wide text-foreground">Forja de Brasas</h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-ember/30 bg-charcoal-800 px-3 py-2">
            <Coins className="h-4 w-4 text-ember ember-pulse" strokeWidth={2.4} />
            <span className="font-display text-xl leading-none text-foreground">{brasas}</span>
          </div>
        </div>
        <p className="mt-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground">
          NÍVEL {String(level).padStart(2, "0")} · 1 BRASA A CADA 10 XP CONQUISTADO
        </p>

        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-display text-[11px] tracking-[0.2em] transition-colors ${
                tab === c
                  ? "bg-ember text-charcoal-900"
                  : "border border-border bg-charcoal-800 text-muted-foreground"
              }`}
            >
              {CATEGORY_LABEL[c].toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => setShowHistory((s) => !s)}
            className={`ml-auto flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-display text-[11px] tracking-[0.2em] ${
              showHistory ? "bg-ember/10 text-ember" : "bg-charcoal-800 text-muted-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" strokeWidth={2.4} />
            HIST.
          </button>
        </nav>
      </header>

      <div className="space-y-3 px-4 pb-32 pt-4">
        {showHistory ? (
          <HistoryList events={events} />
        ) : (
          <>
            {visibleItems.length === 0 && (
              <p className="rounded-xl border border-dashed border-border bg-charcoal-800/40 p-4 text-center font-display text-xs tracking-wider text-muted-foreground">
                Nenhum item nesta categoria ainda.
              </p>
            )}
            {visibleItems.map((item) => {
              const owned = ownedIds.has(item.id);
              const invRow = inventory.find((i) => i.item_id === item.id);
              const locked = level < item.required_level;
              const cantAfford = !owned && brasas < item.price;
              return (
                <ShopItemRow
                  key={item.id}
                  item={item}
                  owned={owned}
                  equipped={invRow?.equipped ?? false}
                  locked={locked}
                  cantAfford={cantAfford}
                  pending={pending === item.id}
                  onBuy={() => handleBuy(item)}
                  onEquip={() => invRow && handleEquip(invRow)}
                />
              );
            })}
          </>
        )}
      </div>

    </MobileShell>
  );
}

function ShopItemRow({
  item,
  owned,
  equipped,
  locked,
  cantAfford,
  pending,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  locked: boolean;
  cantAfford: boolean;
  pending: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border p-3 ${
        equipped
          ? "border-ember/60 bg-ember/5"
          : owned
            ? "border-border bg-charcoal-800/60"
            : "border-border bg-card"
      }`}
    >
      <div
        className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${
          locked ? "bg-charcoal-900 text-muted-foreground" : "bg-charcoal-800 text-ember"
        }`}
      >
        {locked ? <Lock className="h-5 w-5" /> : <Sparkles className="h-5 w-5" strokeWidth={2.2} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-base tracking-wide text-foreground">{item.name}</h3>
          {equipped && (
            <span className="rounded-md border border-ember/40 bg-ember/10 px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] text-ember">
              EQUIPADO
            </span>
          )}
        </div>
        <p className="line-clamp-2 mt-0.5 font-sans text-xs text-muted-foreground">{item.description}</p>
        <div className="mt-1.5 flex items-center gap-3">
          {!owned && (
            <span className="flex items-center gap-1 font-display text-xs tracking-wider text-ember">
              <Coins className="h-3 w-3" strokeWidth={2.4} />
              {item.price}
            </span>
          )}
          <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
            NÍVEL {item.required_level}+
          </span>
        </div>
      </div>
      {owned ? (
        <button
          onClick={onEquip}
          className={`shrink-0 rounded-lg px-3 py-2 font-display text-[11px] tracking-[0.2em] ${
            equipped
              ? "border border-border bg-charcoal-900 text-muted-foreground"
              : "bg-ember text-charcoal-900"
          }`}
        >
          {equipped ? "TIRAR" : "EQUIPAR"}
        </button>
      ) : (
        <button
          onClick={onBuy}
          disabled={locked || cantAfford || pending}
          className="shrink-0 rounded-lg bg-ember px-3 py-2 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-40"
        >
          {pending ? "..." : locked ? <Lock className="h-3.5 w-3.5" /> : owned ? <Check className="h-3.5 w-3.5" /> : "FORJAR"}
        </button>
      )}
    </article>
  );
}

function HistoryList({ events }: { events: BrasasEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-charcoal-800/40 p-4 text-center font-display text-xs tracking-wider text-muted-foreground">
        Nenhuma movimentação ainda.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const positive = e.amount > 0;
        return (
          <li
            key={e.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="font-display text-sm tracking-wide text-foreground">
                {SOURCE_LABEL[e.source] ?? e.source}
              </p>
              <p className="font-display text-[10px] tracking-[0.2em] text-muted-foreground">
                {new Date(e.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <span
              className={`flex items-center gap-1 font-display text-base ${
                positive ? "text-ember" : "text-muted-foreground"
              }`}
            >
              <Coins className="h-3.5 w-3.5" strokeWidth={2.4} />
              {positive ? "+" : ""}
              {e.amount}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
