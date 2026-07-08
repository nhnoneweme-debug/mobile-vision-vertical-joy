// ---------------------------------------------------------------------------
// MOCK SUPABASE CLIENT — imita a superfície do @supabase/supabase-js usando
// dados em memória (mock-data.ts). Ativado por VITE_USE_MOCKS=true via client.ts.
// Objetivo: rodar o app OFFLINE, sem backend e sem login real.
//
// Suporta filtros (.eq/.neq/.in/.gte/.lte/.is/.ilike/...), ordenação e limite,
// e PERSISTE inserts/updates/deletes em memória durante a sessão — então criar
// um hábito/compromisso reflete de verdade nas outras telas.
// ---------------------------------------------------------------------------
import { SEED, RPC_RESULTS, MOCK_USER, MOCK_SESSION } from "./mock-data";

type Ok<T> = { data: T; error: null; count: number | null; status: number; statusText: string };
const ok = <T,>(data: T, count: number | null = null): Ok<T> => ({
  data, error: null, count, status: 200, statusText: "OK",
});
const clone = <T,>(v: T): T =>
  typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));

let idSeq = 0;
function genId(table: string) {
  idSeq += 1;
  return `mock-${table}-${Date.now().toString(36)}-${idSeq}`;
}

type Filter = { op: string; col: string; val: any };

class MockQuery<T = any> implements PromiseLike<Ok<T>> {
  private table: string;
  private store: any[];
  private filters: Filter[] = [];
  private orderSpec: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private singleMode: "none" | "maybe" | "one" = "none";
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private writeValues: any = null;
  private inserted: any[] | null = null;

  constructor(table: string) {
    this.table = table;
    if (!SEED[table]) SEED[table] = [];
    this.store = SEED[table];
  }

  private f(op: string, col: string, val: any) {
    this.filters.push({ op, col, val });
    return this;
  }

  select() { return this; }
  insert(values: any) {
    this.mode = "insert";
    const rows = (Array.isArray(values) ? values : [values]).map((r) => {
      const row = clone(r);
      if (row.id == null) row.id = genId(this.table);
      if (row.created_at == null) row.created_at = new Date().toISOString();
      if (row.updated_at == null) row.updated_at = new Date().toISOString();
      // Emula defaults do Postgres para colunas comuns (senão os filtros
      // .eq("active", true) barram linhas recém-criadas).
      if (row.active === undefined) row.active = true;
      return row;
    });
    this.store.push(...rows);
    this.inserted = rows;
    return this;
  }
  upsert(values: any) { return this.insert(values); }
  update(values: any) { this.mode = "update"; this.writeValues = clone(values); return this; }
  delete() { this.mode = "delete"; return this; }

  eq(col: string, val: any) { return this.f("eq", col, val); }
  neq(col: string, val: any) { return this.f("neq", col, val); }
  gt(col: string, val: any) { return this.f("gt", col, val); }
  gte(col: string, val: any) { return this.f("gte", col, val); }
  lt(col: string, val: any) { return this.f("lt", col, val); }
  lte(col: string, val: any) { return this.f("lte", col, val); }
  is(col: string, val: any) { return this.f("is", col, val); }
  in(col: string, val: any[]) { return this.f("in", col, val); }
  like(col: string, val: string) { return this.f("like", col, val); }
  ilike(col: string, val: string) { return this.f("ilike", col, val); }
  contains(col: string, val: any) { return this.f("contains", col, val); }
  match(obj: Record<string, any>) { Object.entries(obj).forEach(([c, v]) => this.f("eq", c, v)); return this; }
  filter() { return this; }
  not() { return this; }
  or() { return this; }
  overlaps() { return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderSpec = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  range() { return this; }
  returns() { return this; }
  throwOnError() { return this; }
  abortSignal() { return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "one"; return this; }
  csv() { return Promise.resolve(ok("")); }

  private matches(row: any): boolean {
    for (const f of this.filters) {
      const v = row[f.col];
      switch (f.op) {
        case "eq": if (v !== f.val) return false; break;
        case "neq": if (v === f.val) return false; break;
        case "gt": if (!(v > f.val)) return false; break;
        case "gte": if (!(v >= f.val)) return false; break;
        case "lt": if (!(v < f.val)) return false; break;
        case "lte": if (!(v <= f.val)) return false; break;
        case "is": if ((v ?? null) !== (f.val ?? null)) return false; break;
        case "in": if (!Array.isArray(f.val) || !f.val.includes(v)) return false; break;
        case "like":
        case "ilike": {
          const pat = String(f.val).replace(/%/g, "").toLowerCase();
          if (!String(v ?? "").toLowerCase().includes(pat)) return false;
          break;
        }
        case "contains":
          if (Array.isArray(v) && Array.isArray(f.val)) {
            if (!f.val.every((x: any) => v.includes(x))) return false;
          }
          break;
        default: break;
      }
    }
    return true;
  }

  private run(): any[] {
    if (this.mode === "insert") return this.inserted ?? [];
    const matched = this.store.filter((r) => this.matches(r));
    if (this.mode === "update") {
      matched.forEach((r) => Object.assign(r, this.writeValues, { updated_at: new Date().toISOString() }));
      return matched;
    }
    if (this.mode === "delete") {
      for (const r of matched) {
        const i = this.store.indexOf(r);
        if (i >= 0) this.store.splice(i, 1);
      }
      return matched;
    }
    let rows = matched;
    if (this.orderSpec) {
      const { col, asc } = this.orderSpec;
      rows = [...rows].sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1);
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  private resolve(): Ok<any> {
    const rows = clone(this.run());
    if (this.singleMode !== "none") return ok(rows[0] ?? null, rows.length);
    return ok(rows, rows.length);
  }

  then<R1 = Ok<T>, R2 = never>(
    onfulfilled?: ((value: Ok<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.resolve() as Ok<T>).then(onfulfilled, onrejected);
  }
  catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | null) {
    return Promise.resolve(this.resolve()).catch(onrejected);
  }
  finally(onfinally?: (() => void) | null) {
    return Promise.resolve(this.resolve()).finally(onfinally);
  }
}

// ---- realtime (no-op) ----
function makeChannel() {
  const ch: any = {
    on: () => ch,
    subscribe: (cb?: (status: string) => void) => { cb?.("SUBSCRIBED"); return ch; },
    unsubscribe: async () => "ok",
    send: async () => "ok",
    track: async () => "ok",
    untrack: async () => "ok",
  };
  return ch;
}

// ---- auth ----
const noopSub = { data: { subscription: { id: "mock", callback: () => {}, unsubscribe: () => {} } } };
const auth: any = {
  getUser: async () => ok({ user: MOCK_USER }),
  getSession: async () => ok({ session: MOCK_SESSION }),
  getClaims: async () => ok({ claims: { sub: MOCK_USER.id, role: "authenticated", aud: "authenticated" } }),
  onAuthStateChange: (cb?: (e: string, s: any) => void) => {
    try { cb?.("SIGNED_IN", MOCK_SESSION); } catch { /* noop */ }
    return noopSub;
  },
  signInWithPassword: async () => ok({ user: MOCK_USER, session: MOCK_SESSION }),
  signInWithOtp: async () => ok({ user: null, session: null }),
  signInWithOAuth: async () => ok({ provider: "mock", url: "" }),
  verifyOtp: async () => ok({ user: MOCK_USER, session: MOCK_SESSION }),
  signUp: async () => ok({ user: MOCK_USER, session: MOCK_SESSION }),
  signOut: async () => ({ error: null }),
  updateUser: async () => ok({ user: MOCK_USER }),
  resend: async () => ok({}),
  setSession: async () => ok({ user: MOCK_USER, session: MOCK_SESSION }),
  refreshSession: async () => ok({ user: MOCK_USER, session: MOCK_SESSION }),
  exchangeCodeForSession: async () => ok({ user: MOCK_USER, session: MOCK_SESSION }),
  resetPasswordForEmail: async () => ok({}),
  oauth: {
    getAuthorizationDetails: async () => ok({ client: { name: "Cliente MCP (mock)" }, redirect_url: "/" }),
    approveAuthorization: async () => ok({ redirect_url: "/" }),
    denyAuthorization: async () => ok({ redirect_url: "/" }),
  },
};

// ---- storage ----
const storage: any = {
  from: () => ({
    upload: async (path: string) => ok({ path, id: "mock", fullPath: path }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `/mock-storage/${path}` } }),
    createSignedUrl: async (path: string) => ok({ signedUrl: `/mock-storage/${path}` }),
    createSignedUrls: async () => ok([]),
    remove: async () => ok([]),
    list: async () => ok([]),
    download: async () => ok(new Blob()),
  }),
};

export const mockSupabase: any = {
  from: (table: string) => new MockQuery(table),
  rpc: async (fn: string, _args?: any) => ok(fn in RPC_RESULTS ? RPC_RESULTS[fn] : null),
  channel: () => makeChannel(),
  removeChannel: async () => "ok",
  removeAllChannels: async () => "ok",
  getChannels: () => [],
  auth,
  storage,
  functions: { invoke: async () => ok(null) },
  realtime: { setAuth: () => {} },
};

export default mockSupabase;
