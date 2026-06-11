import { useMemo, useState } from 'react';
import { Badge, Card, EmptyHint, Field, Info, Modal, MonthPicker, Warn, btnGhost, btnPrimary, inputBase, inputCls } from '../components/ui';
import {
  DELIVERY_FACTOR,
  DELIVERY_LABEL,
  TIER_DEFAULT_POINTS,
  TIER_LABEL,
  currentMonth,
  monthOf,
  scoreFinal,
  todayISO,
} from '../lib/rules';
import type { Delivery, ScoreEntry, Tier } from '../lib/types';
import { SQUADS } from '../lib/types';
import { canConfirmXl, canRecordScores, useCurrentMember, useStore, uid } from '../store';

const TIERS: Tier[] = ['small', 'medium', 'large', 'xlarge'];
const DELIVERIES: Delivery[] = ['full', 'half', 'zero'];

interface Participant {
  memberId: string;
  points: number;
}

export default function ScoreLedger() {
  const { data, addScores, removeScore, updateScore } = useStore();
  const me = useCurrentMember();
  const [month, setMonth] = useState(currentMonth());
  const [squad, setSquad] = useState<string>('全部');
  const [showAdd, setShowAdd] = useState(false);
  const [showOps, setShowOps] = useState(false);

  const archived = data.archivedMonths.includes(month);
  const manager = canRecordScores(me);

  const entries = useMemo(() => {
    let list = data.scores.filter((s) => monthOf(s.date) === month);
    if (!manager && me) list = list.filter((s) => s.memberId === me.id); // 成员只看本人(8.2)
    if (squad !== '全部') {
      list = list.filter((s) => data.members.find((m) => m.id === s.memberId)?.squad === squad);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data, month, squad, manager, me]);

  const memberName = (id: string) => data.members.find((m) => m.id === id)?.name ?? id;
  const memberSquad = (id: string) => data.members.find((m) => m.id === id)?.squad ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">积分台账</h1>
        <MonthPicker value={month} onChange={setMonth} />
        <select className={inputBase} value={squad} onChange={(e) => setSquad(e.target.value)}>
          <option>全部</option>
          {SQUADS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {archived && <Badge color="violet">本月已归档,记录锁定</Badge>}
        <div className="flex-1" />
        {manager && !archived && (
          <>
            <button className={btnGhost} onClick={() => setShowOps(true)}>
              + 运维杂项
            </button>
            <button className={btnPrimary} onClick={() => setShowAdd(true)}>
              + 记一笔
            </button>
          </>
        )}
      </div>

      {!manager && <Info>成员身份仅可查看本人明细(8.2);记账由各端 Lead 完成。</Info>}

      <Card>
        {entries.length === 0 ? (
          <EmptyHint text="本月暂无记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3">日期</th>
                  <th className="py-2 pr-3">端</th>
                  <th className="py-2 pr-3">姓名</th>
                  <th className="py-2 pr-3">事项</th>
                  <th className="py-2 pr-3">档位</th>
                  <th className="py-2 pr-3">交付</th>
                  <th className="py-2 pr-3 text-right">实得</th>
                  <th className="py-2 pr-3">状态</th>
                  {manager && !archived && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{s.date}</td>
                    <td className="py-2 pr-3">{memberSquad(s.memberId)}</td>
                    <td className="py-2 pr-3 font-medium">{memberName(s.memberId)}</td>
                    <td className="py-2 pr-3">
                      <div>{s.title}</div>
                      {(s.tierReason || s.note) && (
                        <div className="text-xs text-slate-400">{s.tierReason || s.note}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <Badge color={s.tier === 'xlarge' ? 'violet' : s.tier === 'large' ? 'blue' : 'slate'}>
                        {TIER_LABEL[s.tier]} {s.points}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs">
                      {s.tier === 'ops' ? '—' : DELIVERY_LABEL[s.delivery].split('(')[0]}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{scoreFinal(s)}</td>
                    <td className="py-2 pr-3 space-x-1 whitespace-nowrap">
                      {s.selfFix && <Badge color="amber">自修不计分</Badge>}
                      {s.tier === 'xlarge' && !s.xlConfirmedBy && <Badge color="red">特大待确认</Badge>}
                      {s.tier === 'xlarge' && s.xlConfirmedBy && <Badge color="green">已确认</Badge>}
                      {s.reschedules > 0 && (
                        <Badge color={s.reschedules > 2 ? 'red' : 'amber'}>重排 ×{s.reschedules}</Badge>
                      )}
                      {s.splitGroupId && <Badge>拆分</Badge>}
                    </td>
                    {manager && !archived && (
                      <td className="py-2 text-right whitespace-nowrap">
                        {s.tier === 'xlarge' && !s.xlConfirmedBy && canConfirmXl(me) && (
                          <button
                            className="mr-2 text-xs text-emerald-600 hover:underline"
                            onClick={() => updateScore({ ...s, xlConfirmedBy: me!.id })}
                          >
                            确认特大
                          </button>
                        )}
                        <button className="text-xs text-red-500 hover:underline" onClick={() => removeScore(s.id)}>
                          删除
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && me && (
        <AddScoreModal
          onClose={() => setShowAdd(false)}
          onSave={(list) => {
            addScores(list);
            setShowAdd(false);
          }}
          recordedBy={me.id}
        />
      )}
      {showOps && me && (
        <OpsModal
          onClose={() => setShowOps(false)}
          onSave={(e) => {
            addScores([e]);
            setShowOps(false);
          }}
          recordedBy={me.id}
        />
      )}
    </div>
  );
}

function AddScoreModal({
  onClose,
  onSave,
  recordedBy,
}: {
  onClose: () => void;
  onSave: (entries: ScoreEntry[]) => void;
  recordedBy: string;
}) {
  const { data } = useStore();
  const activeMembers = data.members.filter((m) => m.active);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [tier, setTier] = useState<Tier>('medium');
  const [largePoints, setLargePoints] = useState<25 | 30>(25);
  const [tierReason, setTierReason] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('full');
  const [reschedules, setReschedules] = useState(0);
  const [selfFix, setSelfFix] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([
    { memberId: activeMembers[0]?.id ?? '', points: TIER_DEFAULT_POINTS.medium },
  ]);
  const [error, setError] = useState('');

  const tierPoints = tier === 'large' ? largePoints : TIER_DEFAULT_POINTS[tier];
  const split = participants.length > 1;
  const sum = participants.reduce((a, p) => a + (Number.isFinite(p.points) ? p.points : 0), 0);
  const overSplit = split && sum > tierPoints; // 3.7

  const setTierAndPoints = (t: Tier) => {
    setTier(t);
    const pts = t === 'large' ? largePoints : TIER_DEFAULT_POINTS[t];
    setParticipants((ps) => (ps.length === 1 ? [{ ...ps[0], points: pts }] : ps));
  };

  const save = () => {
    if (!title.trim()) return setError('请填写事项名称');
    if ((tier === 'large' || tier === 'xlarge') && !tierReason.trim())
      return setError('大档及以上须备注进入该档的理由(3.2)');
    if (tier === 'large' && largePoints === 30 && !tierReason.trim())
      return setError('大档记 30 分须备注理由(3.1)');
    if (overSplit) return setError(`拆分总分 ${sum} 超过原档位分值 ${tierPoints}(3.7),请调整或拆成独立事项`);
    if (!split && participants[0].points !== tierPoints)
      return setError('单人事项分值须等于档位分值');
    if (participants.some((p) => !p.memberId)) return setError('请选择成员');

    const groupId = split ? uid('grp') : undefined;
    const entries: ScoreEntry[] = participants.map((p) => ({
      id: uid('s'),
      date,
      memberId: p.memberId,
      title,
      tier,
      points: p.points,
      delivery,
      tierReason: tierReason.trim() || undefined,
      xlConfirmedBy: undefined,
      reschedules,
      splitGroupId: groupId,
      selfFix: selfFix || undefined,
      recordedBy,
    }));
    onSave(entries);
  };

  return (
    <Modal title="记一笔积分" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="事项(一句话)">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如:桥合约提现限额逻辑" />
          </Field>
          <Field label="日期">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="档位(3.1)">
          <div className="flex gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  tier === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'
                }`}
                onClick={() => setTierAndPoints(t)}
              >
                {TIER_LABEL[t]} {t === 'large' ? '25/30' : TIER_DEFAULT_POINTS[t]}
              </button>
            ))}
          </div>
        </Field>

        {tier === 'large' && (
          <Field label="大档分值">
            <div className="flex gap-2">
              {([25, 30] as const).map((p) => (
                <button
                  key={p}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    largePoints === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'
                  }`}
                  onClick={() => {
                    setLargePoints(p);
                    setParticipants((ps) => (ps.length === 1 ? [{ ...ps[0], points: p }] : ps));
                  }}
                >
                  {p} 分{p === 30 ? '(接近 2 周工作量)' : ''}
                </button>
              ))}
            </div>
          </Field>
        )}

        {(tier === 'large' || tier === 'xlarge') && (
          <Field label="进入该档的理由(必填,3.2)">
            <input
              className={inputCls}
              value={tierReason}
              onChange={(e) => setTierReason(e.target.value)}
              placeholder="工作量/涉及范围/风险面,一句话即可"
            />
          </Field>
        )}

        {tier === 'xlarge' && (
          <Warn>特大档需架构师或 CTO 确认(3.1);保存后将标记为「待确认」。超过 1 个月的工作应拆为阶段性特大事项分别验收。</Warn>
        )}

        <Field label="参与成员(多人即拆分,3.7)">
          <div className="space-y-2">
            {participants.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  className={inputBase + ' min-w-0 flex-1'}
                  value={p.memberId}
                  onChange={(e) =>
                    setParticipants((ps) => ps.map((x, i) => (i === idx ? { ...x, memberId: e.target.value } : x)))
                  }
                >
                  <option value="">选择成员</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}({m.squad})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={inputBase + ' w-24 shrink-0'}
                  value={p.points}
                  disabled={!split}
                  onChange={(e) =>
                    setParticipants((ps) => ps.map((x, i) => (i === idx ? { ...x, points: Number(e.target.value) } : x)))
                  }
                />
                {split && (
                  <button
                    className="text-xs text-red-500"
                    onClick={() =>
                      setParticipants((ps) => {
                        const next = ps.filter((_, i) => i !== idx);
                        // 回到单人时,分值恢复为档位分值
                        return next.length === 1 ? [{ ...next[0], points: tierPoints }] : next;
                      })
                    }
                  >
                    移除
                  </button>
                )}
              </div>
            ))}
            <button
              className="text-xs text-indigo-600 hover:underline"
              onClick={() => setParticipants((ps) => [...ps, { memberId: '', points: 0 }])}
            >
              + 添加协作者(按人头拆分值)
            </button>
            {split && (
              <div className={`text-xs ${overSplit ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                拆分合计 {sum} / 档位上限 {tierPoints}
                {overSplit && ' —— 超出上限,违反 3.7'}
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="交付结果(3.4)">
            <select className={inputCls} value={delivery} onChange={(e) => setDelivery(e.target.value as Delivery)}>
              {DELIVERIES.map((d) => (
                <option key={d} value={d}>
                  {DELIVERY_LABEL[d]} ×{DELIVERY_FACTOR[d]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="重排期次数(3.5)" hint={reschedules > 2 ? undefined : '提前 1 个工作日预警并经 Lead 确认的重排,不算延期'}>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={reschedules}
              onChange={(e) => setReschedules(Math.max(0, Number(e.target.value)))}
            />
          </Field>
        </div>
        {reschedules > 2 && <Warn>同一事项重排期已超过 2 次,须架构师复核(3.5)。</Warn>}

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={selfFix} onChange={(e) => setSelfFix(e.target.checked)} />
          这是修复本人 90 天内引入的问题
        </label>
        {selfFix && <Warn>修复本人近期引入的问题不计正分(3.8),该条实得将记为 0。</Warn>}

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} onClick={save}>
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OpsModal({
  onClose,
  onSave,
  recordedBy,
}: {
  onClose: () => void;
  onSave: (entry: ScoreEntry) => void;
  recordedBy: string;
}) {
  const { data } = useStore();
  const activeMembers = data.members.filter((m) => m.active);
  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [points, setPoints] = useState(3);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const month = monthOf(date);
  const dup = data.scores.some((s) => s.tier === 'ops' && s.memberId === memberId && monthOf(s.date) === month);

  const band = points <= 3 ? '常规低强度发布/值班(0–3)' : points <= 7 ? '多次发布、排障、告警响应(4–7)' : '高频发布、夜间响应(8–10)';

  const save = () => {
    if (points < 0 || points > 10) return setError('运维杂项为 0–10 分(3.9)');
    if (dup) return setError('该成员本月已有一条运维杂项,3.9 规定每月一笔总账');
    onSave({
      id: uid('s'),
      date,
      memberId,
      title: '当月发布/值班杂项',
      tier: 'ops',
      points,
      delivery: 'full',
      reschedules: 0,
      note: note || band,
      recordedBy,
    });
  };

  return (
    <Modal title="运维杂项(每人每月一笔,3.9)" onClose={onClose}>
      <div className="space-y-4">
        <Field label="成员">
          <select className={inputCls} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {activeMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}({m.squad})
              </option>
            ))}
          </select>
        </Field>
        <Field label="日期(决定记入哪个月)">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={`分值:${points}(${band})`}>
          <input type="range" min={0} max={10} value={points} className="w-full" onChange={(e) => setPoints(Number(e.target.value))} />
        </Field>
        <Field label="备注">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={band} />
        </Field>
        {dup && <Warn>该成员本月已记过运维杂项。</Warn>}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} onClick={save} disabled={dup}>
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}
