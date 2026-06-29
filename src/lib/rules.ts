// 规则计算器 —— 全部为纯函数,口径与《研发绩效积分办法 v2.3(试行)》一致。
// 未来后端落地时,本文件即计算口径的单一参照。

import type {
  AppData,
  Delivery,
  Grade,
  IncidentEntry,
  IncidentLevel,
  Liability,
  Member,
  Reporting,
  ScoreEntry,
  Squad,
  Tier,
} from './types';

// ---------- 3.1 档位 ----------

export const TIER_LABEL: Record<Tier, string> = {
  small: '小',
  medium: '中',
  large: '大',
  xlarge: '特大',
  online: '线上问题处理',
  ops: '运维杂项',
};

/** 各档分值区间 [下限, 上限](3.1),录入时区间内取整 */
export const TIER_RANGE: Record<Tier, [number, number]> = {
  small: [1, 4],
  medium: [5, 9],
  large: [10, 24],
  xlarge: [25, 50],
  online: [3, 30],
  ops: [0, 10],
};

/** 各档默认值:取区间中位;线上默认为及时响应基础分 3 */
export const TIER_DEFAULT_POINTS: Record<Tier, number> = {
  small: 3,
  medium: 7,
  large: 17,
  xlarge: 35,
  online: 3,
  ops: 0,
};

/** 分值须落在该档区间内(3.1) */
export function validTierPoints(tier: Tier, points: number): boolean {
  const [min, max] = TIER_RANGE[tier];
  return Number.isInteger(points) && points >= min && points <= max;
}

// ---------- 3.4 交付系数 ----------

export const DELIVERY_FACTOR: Record<Delivery, number> = { full: 1, half: 0.5, zero: 0 };

export const DELIVERY_LABEL: Record<Delivery, string> = {
  full: '全额',
  half: '减半(延期未预警)',
  zero: '0(未交付)',
};

/** 延期惩罚系数(3.4):工期单位=工作日 */
export const DELAY_PENALTY = 1.2;

/**
 * 交付系数(3.4):
 * - 线上问题处理 / 运维杂项:不适用,系数 1
 * - 未交付(delivery='zero'):0
 * - 原计划工期 ≥ 3 天:max(0, 1 − 延期天数 × 1.2 / 工期)
 * - 工期 < 3 天或缺省:全额(1)/未交付(0)二选一,不再用减半
 */
export function deliveryFactor(e: ScoreEntry): number {
  if (e.tier === 'online' || e.tier === 'ops') return 1;
  if (e.delivery === 'zero') return 0;
  if (e.plannedDays && e.plannedDays >= 3) {
    return Math.max(0, round1(1 - ((e.delayDays ?? 0) * DELAY_PENALTY) / e.plannedDays));
  }
  // 工期 < 3 天或老数据:half 也按全额处理(短任务只看交付与否)
  return e.delivery === 'half' ? 0.5 : 1;
}

/** 单条积分记录的实际得分(3.4 / 3.8) */
export function scoreFinal(e: ScoreEntry): number {
  if (e.selfFix) return 0; // 修复本人 90 天内引入的问题不计正分
  return round1(e.points * deliveryFactor(e));
}

// ---------- 4.2 / 4.3 扣分 ----------

export const INCIDENT_BASE: Record<IncidentLevel, number> = { asset: 300, P0: 150, P1: 50, P2: 15, minor: 0 };

export const INCIDENT_LABEL: Record<IncidentLevel, string> = {
  asset: '资损级',
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  minor: '小问题',
};

export const LIABILITY_FACTOR: Record<Liability, number> = { primary: 1, secondary: 0.5, none: 0 };

export const LIABILITY_LABEL: Record<Liability, string> = {
  primary: '主责',
  secondary: '次责',
  none: '无责',
};

export const REPORTING_FACTOR: Record<Reporting, number> = {
  proactive: 0.5,
  passive: 1,
  late: 1.2,
  concealed: 1.5,
};

export const REPORTING_LABEL: Record<Reporting, string> = {
  proactive: '主动发现并报告',
  passive: '被动发现、配合修复',
  late: '延迟报告未扩大影响',
  concealed: '隐瞒/误导/影响扩大',
};

// ---------- 日期工具 ----------

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

/** 在职月数(浮点) */
export function tenureMonths(joinDate: string, asOf: string): number {
  return Math.max(0, daysBetween(joinDate, asOf) / 30.44);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------- 正分统计 ----------

/** 某成员在 [from, to] 日期区间内的正向积分合计 */
export function positiveInRange(scores: ScoreEntry[], memberId: string, from: string, to: string): number {
  return round1(
    scores
      .filter((s) => s.memberId === memberId && s.date >= from && s.date <= to)
      .reduce((acc, s) => acc + scoreFinal(s), 0),
  );
}

// ---------- 4.1 封顶 ----------

export interface CapInfo {
  cap: number;
  basis: string;
  trailingPositive: number;
  tenure: number;
}

/**
 * 单次事故扣分封顶(4.1):
 * - 原则上不超过本人近 12 个月正分的 40%
 * - 入职未满 6 个月:按已入职月份正分折算为年化正分后计算
 */
export function deductionCap(member: Member, scores: ScoreEntry[], asOf: string): CapInfo {
  const tenure = tenureMonths(member.joinDate, asOf);
  const from12 = new Date(asOf);
  from12.setFullYear(from12.getFullYear() - 1);
  const fromISO = from12.toISOString().slice(0, 10);
  const start = member.joinDate > fromISO ? member.joinDate : fromISO;
  const positive = positiveInRange(scores, member.id, start, asOf);

  if (tenure < 6) {
    const annualized = tenure > 0.5 ? (positive / tenure) * 12 : positive * 12;
    return {
      cap: round1(annualized * 0.4),
      basis: `入职 ${tenure.toFixed(1)} 个月,按年化正分 ${round1(annualized)} × 40%`,
      trailingPositive: positive,
      tenure,
    };
  }
  return {
    cap: round1(positive * 0.4),
    basis: `近 12 个月正分 ${positive} × 40%`,
    trailingPositive: positive,
    tenure,
  };
}

export interface DeductionResult {
  base: number;
  liabilityFactor: number;
  reportingFactor: number;
  raw: number;
  cap: number;
  capBasis: string;
  capApplied: boolean;
  /** 新人保护期减半(10.2,红线不适用) */
  newbieHalved: boolean;
  final: number;
  /** Lead 连带扣分(7.1) */
  leadDeduction: number;
}

/** 实际扣分 = 档位分 × 责任系数 × 报告系数,含封顶与新人保护(4.1 / 10.2 / 7.1) */
export function computeDeduction(incident: IncidentEntry, member: Member, scores: ScoreEntry[]): DeductionResult {
  const base = INCIDENT_BASE[incident.level];
  const liabilityFactor = LIABILITY_FACTOR[incident.liability];
  const reportingFactor = REPORTING_FACTOR[incident.reporting];
  const raw = round1(base * liabilityFactor * reportingFactor);

  const capInfo = deductionCap(member, scores, incident.date);
  // 红线与资损级不适用封顶(4.1 / 4.2)
  const capExempt = incident.redline || incident.level === 'asset';
  let final = raw;
  let capApplied = false;
  if (!capExempt && raw > capInfo.cap) {
    final = capInfo.cap;
    capApplied = true;
  }

  let newbieHalved = false;
  const tenure = tenureMonths(member.joinDate, incident.date);
  if (!capExempt && tenure < 3) {
    final = round1(final * 0.5);
    newbieHalved = true;
  }

  const leadDeduction = incident.leadFault && incident.leadMemberId ? round1(final * 0.3) : 0;

  return {
    base,
    liabilityFactor,
    reportingFactor,
    raw,
    cap: capInfo.cap,
    capBasis: capInfo.basis,
    capApplied,
    newbieHalved,
    final: round1(final),
    leadDeduction,
  };
}

// ---------- 4.4 小问题重复判定 ----------

/** 同责任人同类小问题在 30 天内的数量(含当前这条之前的记录) */
export function minorRepeatCount(
  incidents: IncidentEntry[],
  memberId: string,
  category: string,
  date: string,
  excludeId?: string,
): number {
  return incidents.filter(
    (i) =>
      i.id !== excludeId &&
      i.memberId === memberId &&
      i.category === category &&
      Math.abs(daysBetween(i.date, date)) <= 30,
  ).length;
}

// ---------- 月度 / 年度汇总 ----------

export interface MemberTotals {
  memberId: string;
  positive: number;
  ops: number;
  /** Leader 管理加成(7.3):被管理任务实得分的 10%,每月封顶 15 */
  leadBonus: number;
  deduction: number;
  leadLiability: number;
  total: number;
}

/** Leader 管理加成比例与每月封顶(7.3),集中于此便于调整 */
export const LEAD_BONUS_RATE = 0.1;
export const LEAD_BONUS_CAP = 15;

/** 某端管理加成的承接人:本端 Lead → 架构师 →(架构端)CTO */
export function squadManager(data: AppData, squad: Squad): Member | undefined {
  const lead = data.members.find((m) => m.active && m.squad === squad && m.role === 'lead');
  if (lead) return lead;
  if (squad === '架构') return data.members.find((m) => m.active && m.role === 'cto');
  const arch = data.members.find((m) => m.active && m.role === 'architect');
  return arch ?? data.members.find((m) => m.active && m.role === 'cto');
}

/** 闭区间 [from,to] 覆盖的自然月列表(YYYY-MM) */
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let m = from.slice(0, 7);
  const end = to.slice(0, 7);
  let guard = 0;
  while (m <= end && guard++ < 600) {
    months.push(m);
    m = addMonths(m, 1);
  }
  return months;
}

/**
 * Leader 管理加成(7.3):按月计算,每月每位承接人封顶 15,再按区间相加。
 * 不含承接人本人的任务;只计正分任务(非 ops、实得 > 0)。
 */
export function leadBonusInRange(data: AppData, from: string, to: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const month of monthsBetween(from, to)) {
    const mFrom = `${month}-01`;
    const mTo = `${month}-31`;
    const perRecipient = new Map<string, number>();
    for (const s of data.scores) {
      if (s.tier === 'ops' || s.date < mFrom || s.date > mTo) continue;
      const final = scoreFinal(s);
      if (final <= 0) continue;
      const member = data.members.find((x) => x.id === s.memberId);
      if (!member) continue;
      const mgr = squadManager(data, member.squad);
      if (!mgr || mgr.id === s.memberId) continue;
      perRecipient.set(mgr.id, (perRecipient.get(mgr.id) ?? 0) + final * LEAD_BONUS_RATE);
    }
    for (const [id, amt] of perRecipient) {
      result.set(id, round1((result.get(id) ?? 0) + Math.min(amt, LEAD_BONUS_CAP)));
    }
  }
  return result;
}

export function totalsInRange(data: AppData, from: string, to: string): MemberTotals[] {
  const bonusMap = leadBonusInRange(data, from, to);
  return data.members
    .filter((m) => m.active)
    .map((m) => {
      const myScores = data.scores.filter((s) => s.memberId === m.id && s.date >= from && s.date <= to);
      const ops = round1(myScores.filter((s) => s.tier === 'ops').reduce((a, s) => a + scoreFinal(s), 0));
      const positive = round1(myScores.filter((s) => s.tier !== 'ops').reduce((a, s) => a + scoreFinal(s), 0));
      const leadBonus = round1(bonusMap.get(m.id) ?? 0);

      let deduction = 0;
      let leadLiability = 0;
      for (const inc of data.incidents) {
        if (inc.date < from || inc.date > to) continue;
        const target = data.members.find((x) => x.id === inc.memberId);
        if (!target) continue;
        const r = computeDeduction(inc, target, data.scores);
        if (inc.memberId === m.id) deduction += r.final;
        if (inc.leadFault && inc.leadMemberId === m.id) leadLiability += r.leadDeduction;
      }
      deduction = round1(deduction);
      leadLiability = round1(leadLiability);

      return {
        memberId: m.id,
        positive,
        ops,
        leadBonus,
        deduction,
        leadLiability,
        total: round1(positive + ops + leadBonus - deduction - leadLiability),
      };
    });
}

export function monthlyTotals(data: AppData, month: string): MemberTotals[] {
  return totalsInRange(data, `${month}-01`, `${month}-31`);
}

export interface AnnualTotals extends MemberTotals {
  /** 年度有效积分 = max(正分 − 扣分, 0)(9.1) */
  effective: number;
  allPositive: number;
}

export function annualTotals(data: AppData, year: string): AnnualTotals[] {
  return totalsInRange(data, `${year}-01-01`, `${year}-12-31`).map((t) => {
    // 管理加成计入年度正分(进年终奖分子与年度有效积分)
    const allPositive = round1(t.positive + t.ops + t.leadBonus);
    return {
      ...t,
      allPositive,
      effective: Math.max(0, round1(allPositive - t.deduction - t.leadLiability)),
    };
  });
}

// ---------- 9.1 年度评级辅助 ----------

export const GRADE_FACTOR: Record<Grade, number> = { S: 1.5, A: 1.2, B: 1.0, C: 0.5, D: 0 };

export interface GradeHint {
  memberId: string;
  rank: number;
  percentile: number; // 0 = 最高
  p0Primary: boolean; // 封顶 B
  redline: boolean; // 暂缓评定
  p1Primary: boolean;
  belowHalfMedian: boolean; // C 线
  suggested: Grade;
}

export function gradeHints(data: AppData, year: string): GradeHint[] {
  const totals = annualTotals(data, year);
  const sorted = [...totals].sort((a, b) => b.effective - a.effective);
  const effectives = sorted.map((t) => t.effective);
  const median = effectives.length
    ? effectives.length % 2
      ? effectives[(effectives.length - 1) / 2]
      : (effectives[effectives.length / 2 - 1] + effectives[effectives.length / 2]) / 2
    : 0;

  const yearIncidents = data.incidents.filter((i) => i.date.startsWith(year));

  return totals.map((t) => {
    const rank = sorted.findIndex((s) => s.memberId === t.memberId) + 1;
    const percentile = sorted.length > 1 ? (rank - 1) / (sorted.length - 1) : 0;
    const mine = yearIncidents.filter((i) => i.memberId === t.memberId);
    // 资损级视同 P0 主责处理(封顶 B)
    const p0Primary = mine.some((i) => (i.level === 'P0' || i.level === 'asset') && i.liability === 'primary');
    const p1Primary = mine.some((i) => i.level === 'P1' && i.liability === 'primary');
    const redline = mine.some((i) => i.redline);
    const belowHalfMedian = t.effective < median * 0.5;
    const hasXl = data.scores.some(
      (s) => s.memberId === t.memberId && s.tier === 'xlarge' && s.date.startsWith(year) && scoreFinal(s) > 0,
    );

    let suggested: Grade = 'B';
    if (t.effective <= 0 || redline) suggested = 'D';
    else if (belowHalfMedian) suggested = 'C';
    else if (percentile <= 0.15 && hasXl && !p0Primary && !p1Primary) suggested = 'S';
    else if (percentile <= 0.4 && !p0Primary) suggested = 'A';
    if (p0Primary && (suggested === 'S' || suggested === 'A')) suggested = 'B'; // P0 主责封顶 B

    return { memberId: t.memberId, rank, percentile, p0Primary, p1Primary, redline, belowHalfMedian, suggested };
  });
}

// ---------- 9.2 年终奖模拟 ----------

export interface BonusRow {
  memberId: string;
  effective: number;
  allPositive: number;
  share: number;
  over3x: boolean;
}

export interface BonusSimulation {
  pool: number;
  totalPositive: number;
  totalEffective: number;
  rows: BonusRow[];
  distributed: number;
  retained: number;
  zeroDenominator: boolean;
}

export function simulateBonus(data: AppData, year: string, budget: number, coefficient: number): BonusSimulation {
  const pool = round1(budget * coefficient);
  const totals = annualTotals(data, year);
  const totalPositive = round1(totals.reduce((a, t) => a + t.allPositive, 0));
  const totalEffective = round1(totals.reduce((a, t) => a + t.effective, 0));

  if (totalPositive <= 0) {
    return {
      pool,
      totalPositive: 0,
      totalEffective,
      rows: totals.map((t) => ({ memberId: t.memberId, effective: t.effective, allPositive: t.allPositive, share: 0, over3x: false })),
      distributed: 0,
      retained: pool,
      zeroDenominator: true,
    };
  }

  const rows: BonusRow[] = totals.map((t) => ({
    memberId: t.memberId,
    effective: t.effective,
    allPositive: t.allPositive,
    share: Math.round((pool * t.effective) / totalPositive),
    over3x: false,
  }));
  const avg = rows.reduce((a, r) => a + r.share, 0) / Math.max(1, rows.length);
  for (const r of rows) r.over3x = avg > 0 && r.share > avg * 3;

  const distributed = rows.reduce((a, r) => a + r.share, 0);
  return {
    pool,
    totalPositive,
    totalEffective,
    rows,
    distributed,
    retained: round1(pool - distributed),
    zeroDenominator: false,
  };
}

// ---------- 10.1 试运行观察指标 ----------

export interface SquadTierStats {
  squad: string;
  counts: Record<Tier, number>;
  total: number;
  largeShare: number; // 大档及以上占比(按条数)
  largePointShare: number; // 大档及以上占比(按分值)
}

export function tierStatsBySquad(data: AppData, fromMonth: string, toMonth: string): SquadTierStats[] {
  const from = `${fromMonth}-01`;
  const to = `${toMonth}-31`;
  const stats = new Map<string, SquadTierStats>();
  for (const s of data.scores) {
    if (s.date < from || s.date > to || s.tier === 'ops') continue;
    const member = data.members.find((m) => m.id === s.memberId);
    if (!member) continue;
    let st = stats.get(member.squad);
    if (!st) {
      st = {
        squad: member.squad,
        counts: { small: 0, medium: 0, large: 0, xlarge: 0, online: 0, ops: 0 },
        total: 0,
        largeShare: 0,
        largePointShare: 0,
      };
      stats.set(member.squad, st);
    }
    st.counts[s.tier] += 1;
    st.total += 1;
  }
  for (const st of stats.values()) {
    const large = st.counts.large + st.counts.xlarge;
    st.largeShare = st.total ? large / st.total : 0;
  }
  // 分值占比
  for (const st of stats.values()) {
    let largePts = 0;
    let allPts = 0;
    for (const s of data.scores) {
      if (s.date < from || s.date > to || s.tier === 'ops') continue;
      const member = data.members.find((m) => m.id === s.memberId);
      if (!member || member.squad !== st.squad) continue;
      const pts = scoreFinal(s);
      allPts += pts;
      if (s.tier === 'large' || s.tier === 'xlarge') largePts += pts;
    }
    st.largePointShare = allPts ? largePts / allPts : 0;
  }
  return [...stats.values()].sort((a, b) => a.squad.localeCompare(b.squad));
}

/** 线上问题处理条数/人(10.1 监控),用于观察是否出现"抢答刷分" */
export interface OnlineHandlingStat {
  memberId: string;
  count: number;
  points: number;
}

export function onlineHandlingStats(data: AppData, fromMonth: string, toMonth: string): OnlineHandlingStat[] {
  const from = `${fromMonth}-01`;
  const to = `${toMonth}-31`;
  const map = new Map<string, OnlineHandlingStat>();
  for (const s of data.scores) {
    if (s.tier !== 'online' || s.date < from || s.date > to) continue;
    const cur = map.get(s.memberId) ?? { memberId: s.memberId, count: 0, points: 0 };
    cur.count += 1;
    cur.points = round1(cur.points + scoreFinal(s));
    map.set(s.memberId, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface RescheduleStat {
  entry: ScoreEntry;
  overLimit: boolean;
}

export function rescheduleStats(data: AppData, fromMonth: string, toMonth: string): RescheduleStat[] {
  const from = `${fromMonth}-01`;
  const to = `${toMonth}-31`;
  return data.scores
    .filter((s) => s.date >= from && s.date <= to && s.reschedules > 0)
    .map((entry) => ({ entry, overLimit: entry.reschedules > 2 }))
    .sort((a, b) => b.entry.reschedules - a.entry.reschedules);
}

export interface RepeatedMinor {
  memberId: string;
  category: string;
  count: number;
  hasChecklist: boolean;
}

export function repeatedMinors(data: AppData, fromMonth: string, toMonth: string): RepeatedMinor[] {
  const from = `${fromMonth}-01`;
  const to = `${toMonth}-31`;
  const map = new Map<string, RepeatedMinor>();
  for (const i of data.incidents) {
    if (i.level !== 'minor' || i.date < from || i.date > to) continue;
    const key = `${i.memberId}|${i.category}`;
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      cur.hasChecklist = cur.hasChecklist || !!i.hasChecklist;
    } else {
      map.set(key, { memberId: i.memberId, category: i.category, count: 1, hasChecklist: !!i.hasChecklist });
    }
  }
  return [...map.values()].filter((r) => r.count >= 2).sort((a, b) => b.count - a.count);
}
