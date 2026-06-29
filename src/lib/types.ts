// 数据类型定义 —— 与《研发绩效积分办法 v2.3(试行)》条款对应

export type Squad = '前端' | '后端' | '链端' | 'App' | 'DevOps' | 'QA' | '架构';

export type Role = 'member' | 'lead' | 'architect' | 'cto';

export type Level = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'unmapped';

export interface Member {
  id: string;
  name: string;
  squad: Squad;
  role: Role;
  level: Level;
  joinDate: string; // YYYY-MM-DD,驱动 4.1 封顶年化折算与 10.2 新人保护期
  active: boolean;
}

/** 档位:小/中/大/特大/线上问题处理/运维杂项(3.1 / 3.9) */
export type Tier = 'small' | 'medium' | 'large' | 'xlarge' | 'online' | 'ops';

/** 交付结果:全额/减半/0(3.4);减半仅作老数据兼容,新数据用工期+延期公式 */
export type Delivery = 'full' | 'half' | 'zero';

export interface ScoreEntry {
  id: string;
  date: string; // YYYY-MM-DD
  memberId: string;
  title: string;
  tier: Tier;
  /** 档位分值,区间内取整(3.1):小 1–4 / 中 5–9 / 大 10–24 / 特大 25–50 / 线上 3–30 / 运维 0–10 */
  points: number;
  delivery: Delivery;
  /** 原计划工期(工作日,3.4);≥3 天才套延期公式,<3 天只用全额/未交付 */
  plannedDays?: number;
  /** 未预警、超出约定/重排后期限的延期天数(3.4 / 3.5) */
  delayDays?: number;
  /** 大档及以上必填进入该档的理由(3.2) */
  tierReason?: string;
  /** 特大档确认人(3.1),未确认则视为待确认 */
  xlConfirmedBy?: string;
  /** 重排期次数(3.5),超过 2 次须架构师复核 */
  reschedules: number;
  /** 多人拆分组 id(3.7),同组拆分总分不得超过原档位分值 */
  splitGroupId?: string;
  /** 修复本人 90 天内引入的问题,不计正分(3.8) */
  selfFix?: boolean;
  note?: string;
  recordedBy: string; // memberId
}

/** 事故档位(4.2):资损违规级 > P0 > P1 > P2 > 小问题(4.4) */
export type IncidentLevel = 'asset' | 'P0' | 'P1' | 'P2' | 'minor';

/** 责任:主责/次责/无责(4.3) */
export type Liability = 'primary' | 'secondary' | 'none';

/** 报告情形(4.3) */
export type Reporting = 'proactive' | 'passive' | 'late' | 'concealed';

export interface AssetLossEntry {
  /** 资产/资金损失总额,默认按 USDT/USD 等值口径 */
  amount?: number;
  /** 已追回/已覆盖金额,净损失 = amount - recovered */
  recovered?: number;
  /** 是否按既定 Review/审批/回滚流程执行 */
  processFollowed?: boolean;
  /** 系统按当前参考线给出的建议,最终事故级别仍由人决定 */
  suggestedLevel?: IncidentLevel;
  note?: string;
}

export interface IncidentEntry {
  id: string;
  date: string;
  memberId: string;
  title: string;
  /** 同类问题归类,用于 4.4 的 30 天重复判定 */
  category: string;
  level: IncidentLevel;
  liability: Liability;
  reporting: Reporting;
  /** 红线标记:不适用封顶(4.1),年度评级暂缓(9.1) */
  redline: boolean;
  /** Lead 管理失误,连带成员实际扣分 30%(7.1) */
  leadFault: boolean;
  leadMemberId?: string;
  /** 4.4:同类小问题是否已有明确规范/检查清单 */
  hasChecklist?: boolean;
  /** 资损单列项:只记录事实与系统建议,不自动决定最终事故档位 */
  assetLoss?: AssetLossEntry;
  note?: string;
  decidedBy: string; // memberId,P0/P1 须 CTO,P2 可架构师(4.5)
}

/** 年度评级(9.1) */
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

/** 年度分配参数(9.2),按年份保存 */
export interface AnnualMemberParams {
  grade?: Grade;
}

export interface AnnualConfig {
  /** 公司年度奖金预算 */
  budget: number;
  /** 经营系数 0–1.2(9.2) */
  coefficient: number;
  perMember: Record<string, AnnualMemberParams>;
}

export interface TierRuleConfig {
  min: number;
  max: number;
  defaultPoints: number;
}

export interface DeliveryRuleConfig {
  delayPenalty: number;
  formulaMinPlannedDays: number;
}

export interface IncidentRuleConfig {
  base: Record<IncidentLevel, number>;
  liabilityFactor: Record<Liability, number>;
  reportingFactor: Record<Reporting, number>;
  capRatio: number;
  capAbsolute: number;
  newbieHalfMonths: number;
  leadDeductionRate: number;
}

export interface LeaderRuleConfig {
  bonusRate: number;
  monthlyCap: number;
}

export interface AssetLossRuleConfig {
  observeMax: number;
  p2Max: number;
  p1Max: number;
  currency: string;
}

export interface KpiRuleConfig {
  tiers: Record<Tier, TierRuleConfig>;
  delivery: DeliveryRuleConfig;
  incidents: IncidentRuleConfig;
  leader: LeaderRuleConfig;
  assetLoss: AssetLossRuleConfig;
}

export interface AppData {
  members: Member[];
  scores: ScoreEntry[];
  incidents: IncidentEntry[];
  /** 已归档月份 YYYY-MM,归档后锁定(8.1) */
  archivedMonths: string[];
  annual: Record<string, AnnualConfig>;
  /** KPI 规则配置;旧数据缺失时由存储层补默认值 */
  config?: KpiRuleConfig;
}

export const SQUADS: Squad[] = ['前端', '后端', '链端', 'App', 'DevOps', 'QA', '架构'];

export const ROLE_LABEL: Record<Role, string> = {
  member: '成员',
  lead: 'Lead',
  architect: '架构师',
  cto: 'CTO',
};

export const LEVEL_LABEL: Record<Level, string> = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  L4: 'L4',
  L5: 'L5',
  unmapped: '未映射',
};
