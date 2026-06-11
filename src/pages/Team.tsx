import { useRef, useState } from 'react';
import { Badge, Card, Field, Info, Modal, Warn, btnDanger, btnGhost, btnPrimary, inputCls } from '../components/ui';
import { tenureMonths, todayISO } from '../lib/rules';
import type { Level, Member, Role, Squad } from '../lib/types';
import { LEVEL_LABEL, ROLE_LABEL, SQUADS } from '../lib/types';
import { isManager, useCurrentMember, useStore, uid } from '../store';

export default function Team() {
  const { data, upsertMember, removeMember, exportJson, importJson, resetSeed } = useStore();
  const me = useCurrentMember();
  const manager = isManager(me);
  const [editing, setEditing] = useState<Member | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const unmapped = data.members.filter((m) => m.active && m.level === 'unmapped').length;

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpi-data-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const err = importJson(String(reader.result));
      setMsg(err ? `导入失败:${err}` : '导入成功');
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">团队设置</h1>
        <div className="flex-1" />
        {manager && (
          <button className={btnPrimary} onClick={() => setShowAdd(true)}>
            + 添加成员
          </button>
        )}
      </div>

      {unmapped > 0 && (
        <Warn>
          有 {unmapped} 名成员职级未映射:全员职级映射完成并经本人确认前,Token 职级系数一律按 1.0 执行(9.3)。
        </Warn>
      )}

      <Card title="成员列表">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
              <th className="py-2 pr-3">姓名</th>
              <th className="py-2 pr-3">端</th>
              <th className="py-2 pr-3">角色</th>
              <th className="py-2 pr-3">职级</th>
              <th className="py-2 pr-3">入职日期</th>
              <th className="py-2 pr-3">状态</th>
              {manager && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {data.members
              .filter((m) => m.active)
              .map((m) => {
                const newbie = tenureMonths(m.joinDate, todayISO()) < 3;
                return (
                  <tr key={m.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium">{m.name}</td>
                    <td className="py-2 pr-3">{m.squad}</td>
                    <td className="py-2 pr-3">
                      <Badge color={m.role === 'cto' ? 'violet' : m.role === 'architect' ? 'blue' : m.role === 'lead' ? 'green' : 'slate'}>
                        {ROLE_LABEL[m.role]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">{LEVEL_LABEL[m.level]}</td>
                    <td className="py-2 pr-3 text-slate-500">{m.joinDate}</td>
                    <td className="py-2 pr-3">{newbie && <Badge color="green">保护期(10.2)</Badge>}</td>
                    {manager && (
                      <td className="py-2 text-right whitespace-nowrap">
                        <button className="mr-3 text-xs text-indigo-600 hover:underline" onClick={() => setEditing(m)}>
                          编辑
                        </button>
                        <button
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => {
                            if (confirm(`移除 ${m.name}?历史记录将保留。`)) removeMember(m.id);
                          }}
                        >
                          移除
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>

      <Card title="数据管理">
        <Info>
          当前数据保存在本机浏览器(localStorage);后端上线前,可用导出/导入 JSON 在成员间同步。导出文件含薪酬敏感信息,请勿外传。
        </Info>
        <div className="mt-3 flex gap-2">
          <button className={btnGhost} onClick={doExport}>
            导出 JSON
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
          {manager && (
            <button
              className={btnDanger}
              onClick={() => {
                if (confirm('重置为演示种子数据?当前全部数据将被覆盖。')) void resetSeed();
              }}
            >
              重置为演示数据
            </button>
          )}
        </div>
        {msg && <div className="mt-2 text-sm text-slate-500">{msg}</div>}
      </Card>

      {(showAdd || editing) && (
        <MemberModal
          member={editing ?? undefined}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSave={(m) => {
            upsertMember(m);
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MemberModal({ member, onClose, onSave }: { member?: Member; onClose: () => void; onSave: (m: Member) => void }) {
  const [name, setName] = useState(member?.name ?? '');
  const [squad, setSquad] = useState<Squad>(member?.squad ?? '前端');
  const [role, setRole] = useState<Role>(member?.role ?? 'member');
  const [level, setLevel] = useState<Level>(member?.level ?? 'unmapped');
  const [joinDate, setJoinDate] = useState(member?.joinDate ?? todayISO());
  const [error, setError] = useState('');

  const save = () => {
    if (!name.trim()) return setError('请填写姓名');
    onSave({
      id: member?.id ?? uid('m'),
      name: name.trim(),
      squad,
      role,
      level,
      joinDate,
      active: true,
    });
  };

  return (
    <Modal title={member ? '编辑成员' : '添加成员'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="姓名">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="端">
            <select className={inputCls} value={squad} onChange={(e) => setSquad(e.target.value as Squad)}>
              {SQUADS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="角色">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="职级(经本人确认后填写)">
            <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="入职日期">
            <input type="date" className={inputCls} value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </Field>
        </div>
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
