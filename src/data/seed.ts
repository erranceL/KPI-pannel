// 种子示例数据:演示用,可在「团队设置」页一键清空或重置。

import type { AppData, Delivery, Member, ScoreEntry, Tier } from '../lib/types';
import { addMonths, currentMonth } from '../lib/rules';

// 确定性伪随机,保证每次重置得到相同演示数据
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260612);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function isoDate(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function seedData(): AppData {
  const cm = currentMonth();
  const m1 = addMonths(cm, -1);
  const m2 = addMonths(cm, -2);
  const m3 = addMonths(cm, -3);
  const m4 = addMonths(cm, -4);
  const m5 = addMonths(cm, -5);
  const history = [m5, m4, m3, m2, m1, cm];

  const members: Member[] = [
    { id: 'cto', name: '陈拓', squad: '架构', role: 'cto', level: 'L5', joinDate: isoDate(addMonths(cm, -30), 1), active: true },
    { id: 'arch', name: '沈岩', squad: '架构', role: 'architect', level: 'L4', joinDate: isoDate(addMonths(cm, -26), 1), active: true },
    { id: 'fe-lead', name: '李航', squad: '前端', role: 'lead', level: 'L3', joinDate: isoDate(addMonths(cm, -22), 1), active: true },
    { id: 'fe-1', name: '王悦', squad: '前端', role: 'member', level: 'L2', joinDate: isoDate(addMonths(cm, -14), 1), active: true },
    { id: 'fe-2', name: '周翔', squad: '前端', role: 'member', level: 'L1', joinDate: isoDate(addMonths(cm, -2), 10), active: true },
    { id: 'be-lead', name: '赵铭', squad: '后端', role: 'lead', level: 'L3', joinDate: isoDate(addMonths(cm, -24), 1), active: true },
    { id: 'be-1', name: '孙莉', squad: '后端', role: 'member', level: 'L2', joinDate: isoDate(addMonths(cm, -16), 1), active: true },
    { id: 'chain-lead', name: '张澈', squad: '链端', role: 'lead', level: 'L4', joinDate: isoDate(addMonths(cm, -28), 1), active: true },
    { id: 'chain-1', name: '吴桐', squad: '链端', role: 'member', level: 'L3', joinDate: isoDate(addMonths(cm, -18), 1), active: true },
    { id: 'app-lead', name: '林可', squad: 'App', role: 'lead', level: 'L3', joinDate: isoDate(addMonths(cm, -20), 1), active: true },
    { id: 'qa-1', name: '何静', squad: 'QA', role: 'member', level: 'L2', joinDate: isoDate(addMonths(cm, -12), 1), active: true },
    { id: 'ops-1', name: '高远', squad: 'DevOps', role: 'member', level: 'L2', joinDate: isoDate(addMonths(cm, -15), 1), active: true },
  ];

  const leadOf: Record<string, string> = {
    前端: 'fe-lead',
    后端: 'be-lead',
    链端: 'chain-lead',
    App: 'app-lead',
    DevOps: 'arch',
    QA: 'arch',
    架构: 'cto',
  };

  const titles: Record<Tier, string[]> = {
    small: ['修复列表分页样式', '调整风控阈值配置', '补充接口字段', '修正推送文案'],
    medium: ['活动页改版', '订单查询接口开发', '行情模块联调', '回归测试一轮', '告警规则梳理'],
    large: ['提现限额逻辑改造', '撮合服务性能优化', '资金对账模块重构', '发布流水线自动化'],
    xlarge: ['跨链桥结算链路重构', '核心风控引擎升级'],
    ops: ['当月发布/值班杂项'],
  };

  const scores: ScoreEntry[] = [];
  let sid = 0;

  for (const month of history) {
    for (const m of members) {
      if (m.role === 'cto') continue;
      if (m.joinDate > isoDate(month, 28)) continue; // 未入职月份不生成
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const tierRoll = rand();
        const tier: Tier =
          m.level === 'L1' ? (tierRoll < 0.6 ? 'small' : 'medium')
          : tierRoll < 0.3 ? 'small'
          : tierRoll < 0.75 ? 'medium'
          : tierRoll < 0.95 ? 'large'
          : 'xlarge';
        const points = tier === 'large' ? (rand() < 0.15 ? 30 : 25) : tier === 'xlarge' ? 50 : tier === 'small' ? 5 : 10;
        const delivery: Delivery = rand() < 0.85 ? 'full' : rand() < 0.7 ? 'half' : 'zero';
        scores.push({
          id: `seed-s-${sid++}`,
          date: isoDate(month, 2 + Math.floor(rand() * 25)),
          memberId: m.id,
          title: pick(titles[tier]),
          tier,
          points,
          delivery,
          tierReason: tier === 'large' || tier === 'xlarge' ? (points === 30 ? '工作量接近 2 周' : '涉及资金路径,需审批与回滚预案') : undefined,
          xlConfirmedBy: tier === 'xlarge' ? 'arch' : undefined,
          reschedules: rand() < 0.12 ? 1 : 0,
          recordedBy: leadOf[m.squad],
        });
      }
      // 运维杂项(3.9)
      if (m.squad === 'DevOps' || rand() < 0.4) {
        scores.push({
          id: `seed-s-${sid++}`,
          date: isoDate(month, 28),
          memberId: m.id,
          title: '当月发布/值班杂项',
          tier: 'ops',
          points: m.squad === 'DevOps' ? 6 : 2,
          delivery: 'full',
          reschedules: 0,
          note: m.squad === 'DevOps' ? '多次发布+告警响应(4–7 档)' : '常规低强度(0–3 档)',
          recordedBy: leadOf[m.squad],
        });
      }
    }
  }

  const incidents: AppData['incidents'] = [
    {
      id: 'seed-i-1',
      date: isoDate(m1, 12),
      memberId: 'be-1',
      title: '下单接口故障 40 分钟',
      category: '核心接口故障',
      level: 'P1',
      liability: 'primary',
      reporting: 'proactive',
      redline: false,
      leadFault: false,
      decidedBy: 'cto',
      note: '流程完整,主动报告并止损',
    },
    {
      id: 'seed-i-2',
      date: isoDate(m2, 20),
      memberId: 'fe-1',
      title: '活动页文案错误',
      category: '文案错误',
      level: 'minor',
      liability: 'primary',
      reporting: 'passive',
      redline: false,
      leadFault: false,
      hasChecklist: true,
      decidedBy: 'arch',
    },
    {
      id: 'seed-i-3',
      date: isoDate(m1, 5),
      memberId: 'fe-1',
      title: '活动页文案错误(同类重复)',
      category: '文案错误',
      level: 'minor',
      liability: 'primary',
      reporting: 'passive',
      redline: false,
      leadFault: false,
      hasChecklist: true,
      decidedBy: 'arch',
    },
    {
      id: 'seed-i-4',
      date: isoDate(cm, 6),
      memberId: 'chain-1',
      title: '桥参数配置错误致结算延迟',
      category: '配置错误',
      level: 'P2',
      liability: 'secondary',
      reporting: 'proactive',
      redline: false,
      leadFault: true,
      leadMemberId: 'chain-lead',
      decidedBy: 'arch',
      note: '排期压缩导致 Review 缺位,Lead 连带 30%',
    },
  ];

  return {
    members,
    scores,
    incidents,
    archivedMonths: [m5, m4, m3, m2],
    annual: {},
  };
}
