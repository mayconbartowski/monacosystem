import { Account, Role, Session } from "./domain";

const K = {
  accounts: "monaco.accounts",
  session: "monaco.session",
  seeded: "monaco.accountsSeededV1",
};

const SEED: { role: Role; login: string; password: string }[] = [
  { role: "atendimento", login: "Atendimento", password: "#Elefante98" },
  { role: "lavajato",    login: "Lavacarro",   password: "#SkylineGTR34" },
  { role: "gerente",     login: "Degenuly",    password: "#Vacasgordas22" },
];

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(K.accounts);
    if (!raw) return [];
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

function writeAccounts(list: Account[]) {
  localStorage.setItem(K.accounts, JSON.stringify(list));
}

let seedPromise: Promise<void> | null = null;
export function ensureSeed(): Promise<void> {
  if (typeof localStorage === "undefined") return Promise.resolve();
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const existing = readAccounts();
    const byRole = new Map(existing.map((a) => [a.role, a]));
    const next: Account[] = [];
    for (const s of SEED) {
      const cur = byRole.get(s.role);
      if (cur) {
        next.push(cur);
      } else {
        next.push({
          role: s.role,
          login: s.login,
          passwordHash: await sha256(s.password),
        });
      }
    }
    // Sempre exatamente 3 contas, na ordem definida.
    writeAccounts(next);
    localStorage.setItem(K.seeded, "1");
  })();
  return seedPromise;
}

export async function login(loginInput: string, password: string): Promise<Session | null> {
  await ensureSeed();
  const accounts = readAccounts();
  const hash = await sha256(password);
  const match = accounts.find(
    (a) => a.login.toLowerCase() === loginInput.trim().toLowerCase() && a.passwordHash === hash
  );
  if (!match) return null;
  const session: Session = {
    role: match.role,
    login: match.login,
    loggedAt: new Date().toISOString(),
  };
  localStorage.setItem(K.session, JSON.stringify(session));
  return session;
}

export function logout() {
  localStorage.removeItem(K.session);
}

export function currentSession(): Session | null {
  try {
    const raw = localStorage.getItem(K.session);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function listAccounts(): Account[] {
  return readAccounts();
}

/** Atualiza login e/ou senha de UMA das 3 contas existentes. Nunca cria contas novas. */
export async function updateCredentials(
  role: Role,
  patch: { login?: string; password?: string }
): Promise<void> {
  const accounts = readAccounts();
  const idx = accounts.findIndex((a) => a.role === role);
  if (idx < 0) throw new Error("Conta inexistente");
  const next = { ...accounts[idx] };
  if (patch.login && patch.login.trim().length >= 3) {
    const login = patch.login.trim();
    const dup = accounts.find(
      (a) => a.role !== role && a.login.toLowerCase() === login.toLowerCase()
    );
    if (dup) throw new Error("Login já está em uso por outra conta");
    next.login = login;
  }
  if (patch.password && patch.password.length >= 6) {
    next.passwordHash = await sha256(patch.password);
  }
  accounts[idx] = next;
  writeAccounts(accounts);
}
