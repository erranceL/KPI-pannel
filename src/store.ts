import { create } from 'zustand';
import type { AnnualConfig, AnnualMemberParams, AppData, IncidentEntry, Member, ScoreEntry } from './lib/types';
import { LocalStorageAdapter, type StorageAdapter } from './data/adapter';

const adapter: StorageAdapter = new LocalStorageAdapter();

const EMPTY: AppData = { members: [], scores: [], incidents: [], archivedMonths: [], annual: {} };

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Store {
  data: AppData;
  loaded: boolean;
  /** 当前以谁的身份操作(前端层面的轻量权限,真实鉴权待后端) */
  currentUserId: string;

  load: () => Promise<void>;
  setCurrentUser: (id: string) => void;

  mutate: (fn: (d: AppData) => void) => void;

  addScores: (entries: ScoreEntry[]) => void;
  updateScore: (entry: ScoreEntry) => void;
  removeScore: (id: string) => void;

  addIncident: (entry: IncidentEntry) => void;
  updateIncident: (entry: IncidentEntry) => void;
  removeIncident: (id: string) => void;

  upsertMember: (m: Member) => void;
  removeMember: (id: string) => void;

  archiveMonth: (month: string) => void;

  setAnnualConfig: (year: string, patch: Partial<Omit<AnnualConfig, 'perMember'>>) => void;
  setAnnualMember: (year: string, memberId: string, patch: Partial<AnnualMemberParams>) => void;

  exportJson: () => string;
  importJson: (json: string) => string | null;
  resetSeed: () => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  data: EMPTY,
  loaded: false,
  currentUserId: localStorage.getItem('kpi-pannel-user') || 'cto',

  load: async () => {
    const data = await adapter.load();
    const userId = get().currentUserId;
    const valid = data.members.some((m) => m.id === userId);
    set({ data, loaded: true, currentUserId: valid ? userId : data.members[0]?.id ?? '' });
  },

  setCurrentUser: (id) => {
    localStorage.setItem('kpi-pannel-user', id);
    set({ currentUserId: id });
  },

  mutate: (fn) => {
    const next: AppData = structuredClone(get().data);
    fn(next);
    set({ data: next });
    void adapter.save(next);
  },

  addScores: (entries) => get().mutate((d) => d.scores.push(...entries)),
  updateScore: (entry) =>
    get().mutate((d) => {
      const i = d.scores.findIndex((s) => s.id === entry.id);
      if (i >= 0) d.scores[i] = entry;
    }),
  removeScore: (id) => get().mutate((d) => (d.scores = d.scores.filter((s) => s.id !== id))),

  addIncident: (entry) => get().mutate((d) => d.incidents.push(entry)),
  updateIncident: (entry) =>
    get().mutate((d) => {
      const i = d.incidents.findIndex((s) => s.id === entry.id);
      if (i >= 0) d.incidents[i] = entry;
    }),
  removeIncident: (id) => get().mutate((d) => (d.incidents = d.incidents.filter((s) => s.id !== id))),

  upsertMember: (m) =>
    get().mutate((d) => {
      const i = d.members.findIndex((x) => x.id === m.id);
      if (i >= 0) d.members[i] = m;
      else d.members.push(m);
    }),
  removeMember: (id) =>
    get().mutate((d) => {
      const m = d.members.find((x) => x.id === id);
      if (m) m.active = false; // 软删除,保留历史记录
    }),

  archiveMonth: (month) =>
    get().mutate((d) => {
      if (!d.archivedMonths.includes(month)) d.archivedMonths.push(month);
    }),

  setAnnualConfig: (year, patch) =>
    get().mutate((d) => {
      const cfg = d.annual[year] ?? { budget: 0, coefficient: 1, perMember: {} };
      d.annual[year] = { ...cfg, ...patch };
    }),

  setAnnualMember: (year, memberId, patch) =>
    get().mutate((d) => {
      const cfg = d.annual[year] ?? { budget: 0, coefficient: 1, perMember: {} };
      cfg.perMember[memberId] = { ...cfg.perMember[memberId], ...patch };
      d.annual[year] = cfg;
    }),

  exportJson: () => JSON.stringify(get().data, null, 2),

  importJson: (json) => {
    try {
      const parsed = JSON.parse(json) as AppData;
      if (!Array.isArray(parsed.members) || !Array.isArray(parsed.scores) || !Array.isArray(parsed.incidents)) {
        return '文件格式不正确:缺少 members / scores / incidents';
      }
      const data: AppData = { ...parsed, archivedMonths: parsed.archivedMonths ?? [], annual: parsed.annual ?? {} };
      set({ data });
      void adapter.save(data);
      return null;
    } catch {
      return 'JSON 解析失败';
    }
  },

  resetSeed: async () => {
    const data = await adapter.reset();
    set({ data });
  },
}));

// ---------- 权限辅助(前端层面) ----------

export function useCurrentMember(): Member | undefined {
  const { data, currentUserId } = useStore();
  return data.members.find((m) => m.id === currentUserId);
}

export function canRecordScores(m?: Member): boolean {
  return !!m && (m.role === 'lead' || m.role === 'architect' || m.role === 'cto');
}

export function canArchive(m?: Member): boolean {
  return !!m && (m.role === 'architect' || m.role === 'cto');
}

export function canConfirmXl(m?: Member): boolean {
  return !!m && (m.role === 'architect' || m.role === 'cto');
}

/** 4.5:P0/P1 由 CTO 认定,P2 可由架构师认定,小问题 Lead 即可记录 */
export function maxIncidentLevel(m?: Member): 'P0' | 'P2' | 'minor' | null {
  if (!m) return null;
  if (m.role === 'cto') return 'P0';
  if (m.role === 'architect') return 'P2';
  if (m.role === 'lead') return 'minor';
  return null;
}

export function isManager(m?: Member): boolean {
  return !!m && m.role !== 'member';
}
