import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import policyMd from '../assets/policy.md?raw';
import { PageHeader } from '../components/ui';

const QUICK_CARDS = [
  { n: 1, title: '活按区间定分', text: '按规模分小/中/大/特大档,线上问题处理单独成档;Lead 分活时在既定区间内取整数定分' },
  { n: 2, title: '交付看工期', text: '工期 ≥3 天:实得 = max(0, 1 − 延期天数 ×1.2 / 工期) × 分值;短活只看交付与否;未交付 0 分。延期提前一天预警不算' },
  { n: 3, title: '线上问题处理', text: '及时响应基础 3 分;非工作时间支援、分析准确、推动解决、有效止损取高位;自己 bug 不计正分' },
  { n: 4, title: '事故与资损', text: '按流程资损由管理者和 CTO 评定;未按流程导致资损可认定为资损违规级 −300,强制红线、不封顶' },
  { n: 5, title: 'Leader 管理加成', text: '所带任务实得分的 10% 计入 Lead 正分,每月封顶 15,计入月度/年度与年终奖分子' },
  { n: 6, title: '红线别碰', text: '私钥、未审批动资产、泄密、隐瞒事故、伪造记录,触碰即冻结权限并专项调查' },
  { n: 7, title: '软性评定项', text: '自驱力、责任心、有始有终是弹性项,不进硬公式,但影响年度评级与奖金倾斜(9.4)' },
  { n: 8, title: '走流程有保护', text: '合约/资金/私钥/生产操作走完 Review+上线审批+回滚预案并留痕,出问题最多按次责、主动报告再减半;绕过流程不享此保护' },
  { n: 9, title: '有异议能申诉', text: '定档争议找架构师、事故责任由 CTO、奖金/纪律由管理层复核;公示期内提出' },
  { n: 10, title: '新人有保护期', text: '入职 3 个月内扣分减半、不参与排名、不担高危主责(红线/资损违规等除外)' },
  { n: 11, title: '在岗可达', text: '工作时间内保持在线、能及时找到人;突发不便尽快通知 Lead 并做好交接' },
  { n: 12, title: '请假提前报备', text: '非临时紧急的事情请假要提前申请并安排好交接;突发情况尽快通知 Lead' },
];

export default function Policy() {
  const html = useMemo(() => marked.parse(policyMd, { async: false }) as string, []);
  const articleRef = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const headings = articleRef.current?.querySelectorAll('h2');
    if (!headings?.length) return;
    const secs = [...headings].map((h, i) => {
      h.id = `sec-${i}`;
      return { id: h.id, text: h.textContent ?? '' };
    });
    setSections(secs);
    setActive(secs[0]?.id ?? '');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '0px 0px -75% 0px' },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="研发绩效积分办法 v2.3(试行)" />

      <div className="grid grid-cols-3 gap-3">
        {QUICK_CARDS.map((c) => (
          <div key={c.n} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {c.n}
              </span>
              <span className="text-sm font-semibold text-indigo-900">{c.title}</span>
            </div>
            <p className="text-xs leading-5 text-indigo-800/80">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-5">
        <nav className="sticky top-6 w-44 shrink-0 space-y-0.5 rounded-xl border border-slate-200 bg-white p-2">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                active === s.id ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {s.text}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <article
            ref={articleRef}
            className="policy-doc max-w-none text-sm leading-7 text-slate-700"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
