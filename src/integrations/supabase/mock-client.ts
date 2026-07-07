// ---------------------------------------------------------------------------
// MOCK SUPABASE CLIENT — imita a superfície do @supabase/supabase-js usando
// dados em memória (mock-data.ts). Ativado por VITE_USE_MOCKS=true via client.ts.
// Objetivo: rodar o app OFFLINE, sem backend e sem login real.
// Nunca lança erro: toda query resolve { data, error: null }.
// ---------------------------------------------------------------------------
import { SEED, RPC_RESULTS, MOCK_USER, MOCK_SESSION } from "./mock-data";

type Ok<T> = { data: T; error: null; count: number | null; status: number; statusText: string };
const ok = <T,>(data: T, count: number | null = null): Ok<T> => ({
  data,
  error: null,
  count,
  status: 200,
  statusText: "OK",
});

const clone = <T,>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

// Builder encadeável e "thenable". Ignora filtros (todos os dados já são do mock user)
// e sempre resolve com o seed da tabela.
class MockQuery<T = any> implements PromiseLike<Ok<T>> {
  private rows: any[];
  private singleMode: "none" | "maybe" | "single" = "none";
  private pending: any[] | null = null; // linhas de insert/update/upsert p/ ecoar no .select()

  constructor(table: string) {
    this.rows = clone(SEED[table] ?? []);
  }

  // ---- filtros / modificadores: no-ops encadeáveis ----
  private self() {
    return this;
  }
  select(_cols?: string, _opts?: any) {
    if (this.pending) this.rows = this.pending;
    return this;
  }
  insert(values: any) {
    this.pending = Array.isArray(values) ? clone(values) : [clone(values)];
    this.rows = this.pending;
    return this;
  }
  upsert(values: any) {
    return this.insert(values);
  }
  update(values: any) {
    this.rows = this.rows.map((r) => ({ ...r, ...clone(values) }));
    this.pending = this.rows;
    return this;
  }
  delete() {
    this.pending = [];
    this.rows = [];
    return this;
  }
  eq() { return this.self(); }
  neq() { return this.self(); }
  gt() { return this.self(); }
  gte() { return this.self(); }
  lt() { return this.self(); }
  lte() { return this.self(); }
  like() { return this.self(); }
  ilike() { return this.self(); }
  is() { return this.self(); }
  in() { return this.self(); }
  contains() { return this.self(); }
  containedBy() { return this.self(); }
  range() { return this.self(); }
  overlaps() { return this.self(); }
  match() { return this.self(); }
  filter() { return this.self(); }
  not() { return this.self(); }
  or() { return this.self(); }
  order() { return this.self(); }
  limit(n?: number) {
    if (typeof n === "number") this.rows = this.rows.slice(0, n);
    return this;
  }
  textSearch() { return this.self(); }
  returns() { return this.self(); }
  throwOnError() { return this.self(); }
  abortSignal() { return this.self(); }

  single() {
    this.singleMode = "single";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  csv() {
    return Promise.resolve(ok(""));
  }

  private resolve(): Ok<any> {
    if (this.singleMode !== "none") {
      const row = this.rows[0] ?? null;
      return ok(row, this.rows.length);
    }
    return ok(this.rows, this.rows.length);
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
    subscribe: (cb?: (status: string) => void) => {
      cb?.("SUBSCRIBED");
      return ch;
    },
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
  // Namespace OAuth beta usado pela tela de consentimento MCP.
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
