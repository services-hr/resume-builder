import { useState, useCallback, useRef, useEffect, useMemo } from "react";

/* ─── constants ─── */
const STEPS = [
  { id: "basic", label: "基本情報", icon: "①" },
  { id: "career", label: "職務経歴", icon: "②" },
  { id: "summary", label: "職務要約", icon: "③" },
  { id: "skills", label: "スキル", icon: "④" },
  { id: "qualifications", label: "資格・免許", icon: "⑤" },
  { id: "pr", label: "自己PR", icon: "⑥" },
  { id: "preview", label: "プレビュー", icon: "⑦" },
];
const CAREER_STEP = STEPS.findIndex((s) => s.id === "career");
const SUMMARY_STEP = STEPS.findIndex((s) => s.id === "summary");

// 年の選択肢は「今年から40年分」（年が変わっても自動で追従）
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => THIS_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEAR_OPTS = YEARS.map((y) => ({ value: String(y), label: `${y}年` }));
const MONTH_OPTS = MONTHS.map((m) => ({ value: String(m), label: `${m}月` }));
const EMPLOYMENT_OPTS = ["正社員", "契約社員", "派遣", "業務委託", "アルバイト"].map((v) => ({ value: v, label: v }));

let _idCounter = 1;
const nextId = () => _idCounter++;

const mkTask = () => ({ id: nextId(), text: "" });
// 部署：所属期間の初期値は会社の在籍期間（periodLinked=true の間は会社側の変更に追従）
const mkDept = (period = {}) => ({
  id: nextId(), name: "", title: "",
  fromYear: period.fromYear || "", fromMonth: period.fromMonth || "",
  toYear: period.toYear || "", toMonth: period.toMonth || "",
  periodLinked: true,
  jobType: "", tasks: [mkTask()], products: "",
  achievements: "", challenge: "", actions: "",
  refined: null, // AIで整えた⑥〜⑧ { achievements, challenge, actions }（実績・行動は1行1項目）
});
const mkCareer = () => ({
  id: nextId(), company: "", fromYear: "", fromMonth: "", toYear: "", toMonth: "",
  employment: "", business: "", revenue: "", employees: "", listing: "",
  departments: [mkDept()],
  isRefining: false, refineError: "", refinedKey: "",
});
const mkQual = () => ({ id: nextId(), name: "", year: "", month: "" });

/* ─── palette & font ─── */
const P = {
  bg: "#f5f3ef", card: "#fff", primary: "#2d5a45", pLight: "#e8f0eb",
  accent: "#c4956a", text: "#2c2c2c", sub: "#6b6b6b",
  border: "#e2ddd7", danger: "#c44d4d",
};
const font = `"Noto Sans JP","Hiragino Kaku Gothic ProN",sans-serif`;

/* ─── styles ─── */
const st = {
  card: { background: P.card, borderRadius: 14, padding: "28px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: P.primary },
  desc: { fontSize: 13, color: P.sub, margin: "0 0 24px", lineHeight: 1.6 },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 5, color: P.text },
  input: {
    width: "100%", padding: "10px 12px", border: `1.5px solid ${P.border}`, borderRadius: 8,
    fontSize: 14, fontFamily: font, outline: "none", transition: "border-color 0.2s", background: "#fff",
  },
  itemCard: { background: "#fafaf8", border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 16px", marginBottom: 14 },
  deptCard: { background: "#fff", border: `1px solid ${P.border}`, borderLeft: `3px solid ${P.primary}`, borderRadius: 10, padding: "16px 14px", marginBottom: 12 },
  refinedBox: { marginTop: 12, padding: 14, background: "#fffcf8", border: `1.5px solid ${P.accent}`, borderRadius: 10 },
  noticeBox: { background: "#fffcf0", border: `1.5px solid ${P.accent}`, borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: P.text },
  errorBox: { background: "#fdf0f0", border: `1.5px solid ${P.danger}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: P.danger },
  hint: { fontSize: 11, color: P.sub, margin: "-10px 0 16px", lineHeight: 1.6 },
  subTitle: { fontSize: 13, fontWeight: 700, color: P.primary, margin: "4px 0 10px" },
  secTitle: { fontSize: 14, fontWeight: 700, color: P.primary, margin: "24px 0 10px", paddingBottom: 4, borderBottom: `1px solid ${P.border}` },
  pdf: { background: "#fff", border: `1px solid ${P.border}`, borderRadius: 4, padding: "32px 28px", fontSize: 13, lineHeight: 1.6, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thP: { textAlign: "left", padding: "8px 12px", background: "#f5f3f0", border: `1px solid ${P.border}`, fontWeight: 600, fontSize: 12, width: 100, verticalAlign: "top" },
  tdP: { padding: "8px 12px", border: `1px solid ${P.border}`, verticalAlign: "top" },
};

/* ─── AI call (via serverless function) ─── */
async function callRefineAPI(type, text, context) {
  try {
    const res = await fetch("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, text, context }),
    });
    const data = await res.json();
    return data.result || null;
  } catch (e) {
    console.error("AI refine error:", e);
    return null;
  }
}

// 職務経歴の⑥〜⑧：1社分の部署をまとめて送り、部署ごとのJSONを受け取る
async function callRefineCareerAPI(departments) {
  try {
    const res = await fetch("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "career", departments }),
    });
    const data = await res.json().catch(() => ({}));
    const list = data && data.result && data.result.departments;
    if (!res.ok || !Array.isArray(list)) {
      return { error: (data && data.error) || "AIの処理に失敗しました。時間をおいて、もう一度お試しください" };
    }
    return { departments: list };
  } catch (e) {
    console.error("AI refine (career) error:", e);
    return { error: "通信に失敗しました。インターネット接続を確認して、もう一度お試しください" };
  }
}

/* ─── sub-components ─── */
const Req = () => <span style={{ color: "#e25c5c", marginLeft: 3, fontSize: 11 }}>*</span>;

function FormInput({ label, value, onChange, placeholder, type = "text", required, half }) {
  return (
    <div style={{ marginBottom: 16, width: half ? "48%" : "100%" }}>
      <label style={st.label}>{label}{required && <Req />}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} style={st.input}
        onFocus={(e) => (e.target.style.borderColor = P.primary)}
        onBlur={(e) => (e.target.style.borderColor = P.border)} />
    </div>
  );
}

function FormSelect({ label, value, onChange, options, placeholder, width = "100%", required }) {
  return (
    <div style={{ width }}>
      <label style={st.label}>{label}{required && <Req />}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          ...st.input, color: value ? P.text : "#b5b0a8", appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%236b6b6b' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
        }}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function YearMonthSelector({ labelPrefix, yearVal, monthVal, onYearChange, onMonthChange, required }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <FormSelect label={`${labelPrefix}年`} value={yearVal} onChange={onYearChange} width="105px" options={YEAR_OPTS} placeholder="年" required={required} />
      <FormSelect label="月" value={monthVal} onChange={onMonthChange} width="80px" options={MONTH_OPTS} placeholder="月" />
    </div>
  );
}

function FormTextarea({ label, value, onChange, placeholder, rows = 4, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={st.label}>{label}</label>
      {hint && <p style={{ margin: "0 0 6px", fontSize: 12, color: P.sub }}>{hint}</p>}
      <textarea value={value} placeholder={placeholder} rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...st.input, resize: "vertical", lineHeight: 1.7, fontFamily: font }}
        onFocus={(e) => (e.target.style.borderColor = P.primary)}
        onBlur={(e) => (e.target.style.borderColor = P.border)} />
    </div>
  );
}

function RefinedTextarea({ label, value, onChange, rows = 3 }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: P.text, marginBottom: 4 }}>{label}</div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.8, borderColor: P.accent, background: "#fffcf8" }} />
    </div>
  );
}

function Btn({ children, onClick, primary, disabled, small, style: sx }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: small ? "6px 14px" : "10px 24px", borderRadius: 8, border: "none",
        fontSize: small ? 13 : 14, fontWeight: 600, fontFamily: font,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        background: primary ? P.primary : P.pLight, color: primary ? "#fff" : P.primary, ...sx,
      }}>
      {children}
    </button>
  );
}

function AIBtn({ onClick, loading, label }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 20,
        border: `1.5px solid ${P.accent}`, background: loading ? "#fdf5ee" : "#fff",
        color: P.accent, fontSize: 13, fontWeight: 600, fontFamily: font,
        cursor: loading ? "wait" : "pointer", transition: "all 0.2s",
      }}>
      <span style={{ fontSize: 16, animation: loading ? "spin 1s linear infinite" : "none" }}>
        {loading ? "⏳" : "✨"}
      </span>
      {loading ? "AI変換中…" : (label || "AIで整える")}
    </button>
  );
}

function XBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: "none", border: "none", color: P.danger, cursor: "pointer",
        fontSize: 18, lineHeight: 1, padding: "4px 8px", borderRadius: 4, transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.target.style.background = "#fdf0f0")}
      onMouseLeave={(e) => (e.target.style.background = "none")}>
      ×
    </button>
  );
}

/* ─── helpers ─── */
const calcAge = (d) => {
  if (!d) return "";
  const b = new Date(d), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return `（${a}歳）`;
};
const formatDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
};
const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 現在`; })();

/* ─── 職務経歴：期間の計算 ─── */
const ymText = (y, m) => (y && m ? `${y}年${m}月` : "");
const ymNum = (y, m) => (y && m ? Number(y) * 12 + Number(m) - 1 : null);
const nowYmNum = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); };
// 退社年月が空欄なら現職
const isCurrentCareer = (c) => !(c.toYear && c.toMonth);

const careerPeriodText = (c) => {
  const from = ymText(c.fromYear, c.fromMonth);
  if (!from) return "";
  return `${from}〜${isCurrentCareer(c) ? "現在" : ymText(c.toYear, c.toMonth)}`;
};

// 部署の期間：未選択の部分は会社の在籍期間で補う（今もいる部署は「現在」）
const deptPeriodText = (c, d) => {
  const from = ymText(d.fromYear, d.fromMonth) || ymText(c.fromYear, c.fromMonth);
  if (!from) return "";
  const to = ymText(d.toYear, d.toMonth) || (isCurrentCareer(c) ? "現在" : ymText(c.toYear, c.toMonth));
  return `${from}〜${to}`;
};

// 直近の部署：終了が新しい順 → 開始が新しい順 → 後に入力した順
const latestDept = (c) => {
  const cs = ymNum(c.fromYear, c.fromMonth);
  const ce = isCurrentCareer(c) ? Infinity : ymNum(c.toYear, c.toMonth);
  let best = null, be = -Infinity, bs = -Infinity;
  c.departments.forEach((d) => {
    const s = ymNum(d.fromYear, d.fromMonth) ?? cs ?? -1;
    const e = ymNum(d.toYear, d.toMonth) ?? ce ?? -1;
    if (!best || e > be || (e === be && s >= bs)) { best = d; be = e; bs = s; }
  });
  return best;
};
const latestPositionOf = (c) => {
  const d = latestDept(c);
  return d ? (d.title.trim() || d.name.trim()) : "";
};

// 通算年数：各社の在籍期間を月単位で合算（重なる期間は1回だけ数える。現職は今月まで）
const calcExperience = (careers) => {
  const now = nowYmNum();
  const ranges = careers
    .map((c) => ({ s: ymNum(c.fromYear, c.fromMonth), e: isCurrentCareer(c) ? now : ymNum(c.toYear, c.toMonth) }))
    .filter((r) => r.s != null && r.e != null && r.e >= r.s)
    .sort((a, b) => a.s - b.s);
  let months = 0, cur = null;
  ranges.forEach((r) => {
    if (cur && r.s <= cur.e) { cur.e = Math.max(cur.e, r.e); return; }
    if (cur) months += cur.e - cur.s + 1;
    cur = { ...r };
  });
  if (cur) months += cur.e - cur.s + 1;
  const y = Math.floor(months / 12), m = months % 12;
  const text = months === 0 ? "" : y === 0 ? `${m}ヶ月` : m === 0 ? `${y}年` : `${y}年${m}ヶ月`;
  return { months, text, companyCount: careers.filter((c) => c.company.trim()).length };
};

/* ─── 職務経歴：出力文面の組み立て（プレビュー・PDF・シート・要約はすべてこの文面を使う） ─── */
const BULLET_RE = /^\s*(?:[・･*＊•●○◦]|[-－‐](?![0-9０-９])|[0-9]{1,2}[.．)）](?![0-9])|[①-⑳])\s*/;
const stripBullet = (s) => String(s || "").replace(BULLET_RE, "").trim();
const toItems = (text) => String(text || "").split("\n").map(stripBullet).filter(Boolean);

// 出力に使う⑥〜⑧：AIで整えた結果があればそれ、なければ入力のまま
const finalSections = (d) => {
  const src = d.refined || d;
  return {
    achievements: toItems(src.achievements),
    challenge: String(src.challenge || "").trim(),
    actions: toItems(src.actions),
  };
};

const buildCompanyText = (c) => {
  const period = careerPeriodText(c);
  const lines = [
    [period, c.company.trim()].filter(Boolean).join("　"),
    `事業内容：${c.business.trim()}`,
    `売上高：${c.revenue.trim()}　従業員数：${c.employees.trim()}　上場：${c.listing.trim()}`,
  ];
  if (c.employment) lines.push(`${c.employment}として勤務`);

  c.departments.forEach((d) => {
    const dp = deptPeriodText(c, d);
    let head = `■ ${d.name.trim()}${dp ? `（${dp}）` : ""}`;
    if (d.title.trim()) head += `　役職：${d.title.trim()}`;
    lines.push("", head);

    if (d.jobType.trim()) lines.push(`【職種】${d.jobType.trim()}`);
    if (d.products.trim()) lines.push(`【取扱商材】${d.products.trim()}`);
    const tasks = d.tasks.map((t) => stripBullet(t.text)).filter(Boolean);
    if (tasks.length) lines.push("【業務内容】", ...tasks.map((t) => `・${t}`));

    const f = finalSections(d);
    if (f.achievements.length) lines.push("【実績】", ...f.achievements.map((t) => `・${t}`));
    if (f.challenge) lines.push("【課題】", f.challenge);
    if (f.actions.length) lines.push("【課題解決にあたり行った行動】", ...f.actions.map((t) => `・${t}`));
  });
  return lines.join("\n");
};

// 「AIで整える」の対象（⑥〜⑧）が1つでも入っているか
const hasAiTarget = (c) => c.departments.some((d) => [d.achievements, d.challenge, d.actions].some((v) => v.trim()));

// AIに渡す①〜⑧が変わったかの判定用
const careerAiKey = (c) => JSON.stringify(c.departments.map((d) => [
  d.name, d.title, d.fromYear, d.fromMonth, d.toYear, d.toMonth, d.jobType,
  d.tasks.map((t) => t.text), d.products, d.achievements, d.challenge, d.actions,
]));
const isRefineStale = (c) => !!c.refinedKey && c.departments.some((d) => d.refined) && careerAiKey(c) !== c.refinedKey;

/* ─── 職務経歴：入力チェック（ステップ③以降へ進む前に確認） ─── */
const validateCareers = (careers) => {
  const errs = [];
  careers.forEach((c, ci) => {
    const where = `経歴${ci + 1}${c.company.trim() ? `（${c.company.trim()}）` : ""}`;
    const miss = [];
    if (!c.company.trim()) miss.push("会社名");
    if (!(c.fromYear && c.fromMonth)) miss.push("入社年月");
    if (!c.employment) miss.push("雇用形態");
    if (miss.length) errs.push(`${where}：${miss.join("・")}を入力してください`);
    if (!!c.toYear !== !!c.toMonth) errs.push(`${where}：退社年月は年と月の両方を選んでください（現職なら両方とも空欄）`);
    const cs = ymNum(c.fromYear, c.fromMonth), ce = ymNum(c.toYear, c.toMonth);
    if (cs != null && ce != null && ce < cs) errs.push(`${where}：退社年月が入社年月より前になっています`);

    c.departments.forEach((d, di) => {
      const dw = `${where} 部署${di + 1}${d.name.trim() ? `（${d.name.trim()}）` : ""}`;
      const dm = [];
      if (!d.name.trim()) dm.push("所属部署");
      if (!(d.fromYear && d.fromMonth)) dm.push("所属期間の開始年月");
      if (!d.jobType.trim()) dm.push("職種");
      if (!d.tasks.some((t) => t.text.trim())) dm.push("業務内容");
      if (dm.length) errs.push(`${dw}：${dm.join("・")}を入力してください`);
      if (!!d.toYear !== !!d.toMonth) errs.push(`${dw}：所属期間の終了は年と月の両方を選んでください（今もこの部署なら両方とも空欄）`);
      const ds = ymNum(d.fromYear, d.fromMonth), de = ymNum(d.toYear, d.toMonth);
      if (ds != null && de != null && de < ds) errs.push(`${dw}：所属期間の終了が開始より前になっています`);
    });
  });
  return errs;
};

/* ─── 職務経歴：部署カード ─── */
function DeptCard({ d, index, canRemove, onUpdate, onRemove }) {
  const setTask = (tid, v) => onUpdate((x) => ({ tasks: x.tasks.map((t) => (t.id === tid ? { ...t, text: v } : t)) }));
  const addTask = () => onUpdate((x) => ({ tasks: [...x.tasks, mkTask()] }));
  // 最後の1行は消さずに空欄にする
  const rmTask = (tid) => onUpdate((x) => ({
    tasks: x.tasks.length > 1 ? x.tasks.filter((t) => t.id !== tid) : [{ ...x.tasks[0], text: "" }],
  }));
  const setPeriod = (k, v) => onUpdate({ [k]: v, periodLinked: false });
  const setRefined = (k, v) => onUpdate((x) => ({ refined: { ...x.refined, [k]: v } }));

  return (
    <div style={st.deptCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: P.primary }}>部署 {index + 1}</span>
        {canRemove && <XBtn onClick={onRemove} />}
      </div>

      <FormInput label="所属部署" value={d.name} onChange={(v) => onUpdate({ name: v })}
        placeholder="例：営業部 第一営業課" required />
      <FormInput label="役職（任意）" value={d.title} onChange={(v) => onUpdate({ title: v })}
        placeholder="例：主任（なければ空欄）" />

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <YearMonthSelector labelPrefix="所属開始" yearVal={d.fromYear} monthVal={d.fromMonth} required
          onYearChange={(v) => setPeriod("fromYear", v)} onMonthChange={(v) => setPeriod("fromMonth", v)} />
        <span style={{ padding: "10px 4px", color: P.sub }}>〜</span>
        <YearMonthSelector labelPrefix="所属終了" yearVal={d.toYear} monthVal={d.toMonth}
          onYearChange={(v) => setPeriod("toYear", v)} onMonthChange={(v) => setPeriod("toMonth", v)} />
      </div>
      <p style={st.hint}>
        ※ 初期値は会社の在籍期間です。異動した場合は、この部署にいた期間に直してください（今もこの部署なら終了は空欄）
      </p>

      <FormInput label="職種" value={d.jobType} onChange={(v) => onUpdate({ jobType: v })}
        placeholder="例：法人営業、経理、Webエンジニア" required />

      <div style={{ marginBottom: 16 }}>
        <label style={st.label}>業務内容<Req /></label>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: P.sub }}>1つの欄に1つずつ書いてください。行頭の「・」は自動で付きます。</p>
        {d.tasks.map((t) => (
          <div key={t.id} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
            <input value={t.text} onChange={(e) => setTask(t.id, e.target.value)}
              placeholder="例：中小企業向けの新規開拓営業" style={st.input}
              onFocus={(e) => (e.target.style.borderColor = P.primary)}
              onBlur={(e) => (e.target.style.borderColor = P.border)} />
            <XBtn onClick={() => rmTask(t.id)} />
          </div>
        ))}
        <Btn onClick={addTask} small style={{ marginTop: 2 }}>＋ 項目を追加</Btn>
      </div>

      <FormInput label="取扱商材（営業職の方のみ）" value={d.products} onChange={(v) => onUpdate({ products: v })}
        placeholder="例：勤怠管理SaaS" />

      <FormTextarea label="実績" value={d.achievements} onChange={(v) => onUpdate({ achievements: v })} rows={3}
        hint="数字があれば書いてください。メモ書きでOKです。"
        placeholder={"例：\n2022年度 売上目標120%達成（社内表彰）\n新規顧客を年間30社開拓"} />
      <FormTextarea label="課題" value={d.challenge} onChange={(v) => onUpdate({ challenge: v })} rows={2}
        hint="当時ぶつかった壁や問題を1〜2文で。"
        placeholder="例：既存顧客の解約が増え、売上が伸び悩んでいた" />
      <FormTextarea label="課題解決にあたり行った行動" value={d.actions} onChange={(v) => onUpdate({ actions: v })} rows={3}
        hint="課題に対して自分がやったことを、1行に1つずつ。"
        placeholder={"例：\n解約理由を50社にヒアリング\n定期訪問の仕組みを作りチームに展開"} />

      {d.refined && (
        <div style={st.refinedBox}>
          <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 4 }}>
            ✨ AIが整えた文章（このまま職務経歴書に使われます・修正OK）
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: P.sub }}>実績と行動は1行に1項目です。行頭の「・」は自動で付きます。</p>
          {(d.refined.achievements || d.achievements.trim()) && (
            <RefinedTextarea label="実績" value={d.refined.achievements} onChange={(v) => setRefined("achievements", v)} rows={3} />
          )}
          {(d.refined.challenge || d.challenge.trim()) && (
            <RefinedTextarea label="課題" value={d.refined.challenge} onChange={(v) => setRefined("challenge", v)} rows={3} />
          )}
          {(d.refined.actions || d.actions.trim()) && (
            <RefinedTextarea label="課題解決にあたり行った行動" value={d.refined.actions} onChange={(v) => setRefined("actions", v)} rows={3} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── プレビュー：職務経歴の文面を見出しごとに装飾して表示（PDFと同じ見え方） ─── */
function CareerTextBlock({ text }) {
  const lines = text.split("\n");
  return (
    <div style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.8 }}>
      {lines.map((ln, i) => {
        if (i === 0) {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 14, color: P.primary, borderBottom: `1px solid ${P.border}`, paddingBottom: 2, marginBottom: 4 }}>
              {ln}
            </div>
          );
        }
        if (ln === "") return <div key={i} style={{ height: 8 }} />;
        if (ln.startsWith("■")) return <div key={i} style={{ fontWeight: 700 }}>{ln}</div>;
        const m = ln.match(/^(【[^】]+】)(.*)$/);
        if (m) return <div key={i}><span style={{ fontWeight: 700 }}>{m[1]}</span>{m[2]}</div>;
        return <div key={i} style={{ whiteSpace: "pre-wrap" }}>{ln}</div>;
      })}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function ResumeBuilder() {
  const [step, setStep] = useState(0);
  const [anim, setAnim] = useState(true);
  const [basic, setBasic] = useState({
    lastName: "", firstName: "",
    lastNameKana: "", firstNameKana: "",
  });
  const [careers, setCareers] = useState(() => [mkCareer()]);
  const [showCareerErrors, setShowCareerErrors] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryGenerated, setSummaryGenerated] = useState(""); // AIが最後に出した文章（手直しの有無の判定用）
  const [summaryKey, setSummaryKey] = useState("");             // 要約を作った時点の職務経歴
  const [summaryRefining, setSummaryRefining] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const summaryAutoDone = useRef(false);
  const [skillsRaw, setSkillsRaw] = useState("");
  const [skillsRefined, setSkillsRefined] = useState("");
  const [skillsRefining, setSkillsRefining] = useState(false);
  const [quals, setQuals] = useState(() => [mkQual()]);
  const [prRaw, setPrRaw] = useState("");
  const [prRefined, setPrRefined] = useState("");
  const [prRefining, setPrRefining] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const pdfRef = useRef(null);

  const careerErrors = useMemo(() => validateCareers(careers), [careers]);
  // 職務要約の「変更されています」判定用（画面表示用の状態は除く）
  const careersKey = useMemo(
    () => JSON.stringify(careers.map(({ isRefining, refineError, ...rest }) => rest)),
    [careers]
  );

  const goTo = (i) => { setAnim(false); setTimeout(() => { setStep(i); setAnim(true); }, 140); };
  // 職務経歴に未入力の必須項目があるときは、ステップ③以降へ進めない
  const navigate = (i) => {
    if (i > CAREER_STEP && careerErrors.length > 0) {
      setShowCareerErrors(true);
      if (step !== CAREER_STEP) goTo(CAREER_STEP);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    goTo(i);
  };
  const next = () => step < STEPS.length - 1 && navigate(step + 1);
  const prev = () => step > 0 && goTo(step - 1);

  const uBasic = useCallback((k, v) => setBasic((p) => ({ ...p, [k]: v })), []);
  const uCareer = useCallback((id, k, v) => setCareers((cs) => cs.map((c) => c.id === id ? { ...c, [k]: v } : c)), []);
  // 会社の在籍期間：部署側を手で変えていなければ、部署の所属期間も一緒に変える
  const uCareerPeriod = useCallback((id, k, v) => setCareers((cs) => cs.map((c) => c.id !== id ? c : {
    ...c, [k]: v,
    departments: c.departments.map((d) => d.periodLinked ? { ...d, [k]: v } : d),
  })), []);
  const addCareer = useCallback(() => setCareers((c) => [...c, mkCareer()]), []);
  const rmCareer = useCallback((id) => setCareers((c) => c.length > 1 ? c.filter((x) => x.id !== id) : c), []);

  const uDept = useCallback((cid, did, patch) => setCareers((cs) => cs.map((c) => c.id !== cid ? c : {
    ...c,
    departments: c.departments.map((d) => d.id !== did ? d : { ...d, ...(typeof patch === "function" ? patch(d) : patch) }),
  })), []);
  const addDept = useCallback((cid) => setCareers((cs) => cs.map((c) => c.id !== cid ? c : {
    ...c, departments: [...c.departments, mkDept(c)],
  })), []);
  const rmDept = useCallback((cid, did) => setCareers((cs) => cs.map((c) => (c.id !== cid || c.departments.length <= 1) ? c : {
    ...c, departments: c.departments.filter((d) => d.id !== did),
  })), []);

  const addQualFn = useCallback(() => setQuals((q) => [...q, mkQual()]), []);
  const uQualFn = useCallback((id, k, v) => setQuals((q) => q.map((x) => x.id === id ? { ...x, [k]: v } : x)), []);
  const rmQualFn = useCallback((id) => setQuals((q) => q.length > 1 ? q.filter((x) => x.id !== id) : q), []);

  // 職務経歴：会社ごとに、配下の全部署の⑥〜⑧をまとめて整える
  const handleRefineCareer = useCallback(async (id) => {
    const c = careers.find((x) => x.id === id);
    if (!c || c.isRefining) return;
    if (!hasAiTarget(c)) {
      uCareer(id, "refineError", "実績・課題・課題解決にあたり行った行動のどれかを入力してから押してください");
      return;
    }

    const keyAtRequest = careerAiKey(c);
    const deptIds = c.departments.map((d) => d.id);
    const payload = c.departments.map((d) => ({
      name: d.name.trim(), title: d.title.trim(), period: deptPeriodText(c, d), jobType: d.jobType.trim(),
      tasks: d.tasks.map((t) => stripBullet(t.text)).filter(Boolean), products: d.products.trim(),
      achievements: d.achievements.trim(), challenge: d.challenge.trim(), actions: d.actions.trim(),
    }));

    setCareers((cs) => cs.map((x) => x.id === id ? { ...x, isRefining: true, refineError: "" } : x));
    const r = await callRefineCareerAPI(payload);

    setCareers((cs) => cs.map((x) => {
      if (x.id !== id) return x;
      if (r.error) return { ...x, isRefining: false, refineError: r.error };
      return {
        ...x, isRefining: false, refineError: "", refinedKey: keyAtRequest,
        departments: x.departments.map((d) => {
          const i = deptIds.indexOf(d.id);
          if (i === -1) return d; // 整えている間に追加された部署はそのまま
          const out = r.departments[i] || {};
          const list = (v) => (Array.isArray(v) ? v.map((s) => stripBullet(s)).filter(Boolean) : toItems(v));
          const refined = {
            achievements: list(out.achievements).join("\n"),
            challenge: String(out.challenge || "").trim(),
            actions: list(out.actions).join("\n"),
          };
          const empty = !refined.achievements && !refined.challenge && !refined.actions;
          return { ...d, refined: empty ? null : refined };
        }),
      };
    }));
  }, [careers, uCareer]);

  const handleRefineSkills = useCallback(async () => {
    if (!skillsRaw.trim()) return;
    setSkillsRefining(true);
    const r = await callRefineAPI("skills", skillsRaw);
    if (r) setSkillsRefined(r);
    setSkillsRefining(false);
  }, [skillsRaw]);

  const handleRefinePR = useCallback(async () => {
    if (!prRaw.trim()) return;
    setPrRefining(true);
    const r = await callRefineAPI("pr", prRaw);
    if (r) setPrRefined(r);
    setPrRefining(false);
  }, [prRaw]);

  // 職務要約：職務経歴の文面＋通算年数・在籍社数（フロントで計算）をAIに渡す
  const generateSummary = useCallback(async () => {
    const exp = calcExperience(careers);
    const careersText = careers.map(buildCompanyText).join("\n\n");
    const stats = `通算年数：${exp.text || "（記載なし）"}\n在籍社数：${exp.companyCount ? `${exp.companyCount}社` : "（記載なし）"}`;
    const keyAtRequest = careersKey;

    setSummaryRefining(true);
    setSummaryError("");
    const r = await callRefineAPI("summary", careersText, stats);
    if (r) {
      setSummary(r);
      setSummaryGenerated(r);
      setSummaryKey(keyAtRequest);
    } else {
      setSummaryError("職務要約を作成できませんでした。「再生成」を押して、もう一度お試しください。");
    }
    setSummaryRefining(false);
  }, [careers, careersKey]);

  // 再生成：手直し済みの文章を上書きする場合だけ確認する（force=true は確認済みの操作）
  const handleRegenerateSummary = (force) => {
    if (summaryRefining) return;
    const edited = summary.trim() && summary !== summaryGenerated;
    if (!force && edited && !window.confirm("手直しした内容は上書きされます。再生成しますか？")) return;
    generateSummary();
  };

  // ステップ③を初めて開いたときに、職務要約を自動で作る
  useEffect(() => {
    if (step !== SUMMARY_STEP || summaryAutoDone.current) return;
    summaryAutoDone.current = true;
    if (!summary.trim()) generateSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const summaryStale = !!summary && !!summaryKey && summaryKey !== careersKey && !summaryRefining;

  const getFileName = () => {
    const d = new Date();
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const fullName = `${basic.lastName || ""} ${basic.firstName || ""}`.trim();
    const name = fullName || "名前未入力";
    return `${name}_職務経歴書_${yyyymmdd}`;
  };

  /* ────────────────────────────────────────
     PDF GENERATION — server-side (Google Apps Script)
     ─────────────────────────────────────── */
  const handleGenerateAndUpload = async () => {
    setUploadStatus("generating");
    setUploadMessage("PDFを生成中… (Googleドキュメントで差し込み中)");

    const payload = {
      basic,
      summary: summary.trim(),
      careers: careers.map((c) => ({
        company: c.company.trim(),
        fromYear: c.fromYear,
        fromMonth: c.fromMonth,
        toYear: c.toYear,
        toMonth: c.toMonth,
        employmentType: c.employment,
        latestPosition: latestPositionOf(c),  // シートの jobtitle / position_n 用
        formattedText: buildCompanyText(c),   // PDFの {{careers}} とシートの description_n 用
      })),
      skillsRaw,
      skillsRefined,
      qualifications: quals.map((q) => ({
        name: q.name, year: q.year, month: q.month,
      })),
      prRaw,
      prRefined,
    };

    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setUploadStatus("done");
        setUploadMessage(`✅ PDF生成・Google Drive保存が完了しました：${result.fileName}`);
      } else {
        setUploadStatus("error");
        setUploadMessage(`❌ 生成に失敗しました：${result.error || "不明なエラー"}`);
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      setUploadStatus("error");
      setUploadMessage(`❌ サーバーとの通信に失敗しました: ${error.message}`);
    }
  };

  /* ─── step renderer ─── */
  const renderStep = () => {
    switch (STEPS[step].id) {

      case "basic":
        return (
          <div>
            <h2 style={st.h2}>基本情報を入力してください</h2>
            <p style={st.desc}>お名前とフリガナを入力してください。</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0 4%" }}>
              <FormInput label="姓" value={basic.lastName} onChange={(v) => uBasic("lastName", v)} placeholder="山田" required half />
              <FormInput label="名" value={basic.firstName} onChange={(v) => uBasic("firstName", v)} placeholder="太郎" required half />
              <FormInput label="姓（フリガナ）" value={basic.lastNameKana} onChange={(v) => uBasic("lastNameKana", v)} placeholder="ヤマダ" half />
              <FormInput label="名（フリガナ）" value={basic.firstNameKana} onChange={(v) => uBasic("firstNameKana", v)} placeholder="タロウ" half />
            </div>
          </div>
        );

      case "career":
        return (
          <div>
            <h2 style={st.h2}>職務経歴を入力してください</h2>
            <p style={st.desc}>
              会社ごとに入力し、異動があった場合は部署を追加してください。
              <strong style={{ color: P.accent }}>「AIで整える」</strong>で、実績・課題・行動の文章を職務経歴書向けに整えられます。
            </p>

            {showCareerErrors && careerErrors.length > 0 && (
              <div style={st.errorBox}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>次のステップへ進む前に、以下を入力してください</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                  {careerErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            <div style={st.noticeBox}>
              <div style={{ fontWeight: 700, color: P.accent, marginBottom: 8, fontSize: 14 }}>
                ⚠️ 入力のポイント
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                <li>会社名は<strong>正式名称</strong>で入力してください（例：「荏原」ではなく「株式会社荏原製作所」）</li>
                <li>現職の場合は、退社年月を空欄のままにしてください</li>
                <li>異動があった場合は「＋部署を追加」で、部署ごとに分けて入力してください</li>
                <li>事業内容・売上高・従業員数・上場区分は、わからなければ空欄でOKです</li>
                <li>「AIで整える」は実績・課題・行動の表現だけを整えます。書いていない数字や事実は追加されません</li>
              </ul>
            </div>

            {careers.map((c, i) => {
              const stale = isRefineStale(c);
              return (
                <div key={c.id} style={st.itemCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>経歴 {i + 1}</span>
                    {careers.length > 1 && <XBtn onClick={() => rmCareer(c.id)} />}
                  </div>

                  <FormInput label="会社名（正式名称）" value={c.company} onChange={(v) => uCareer(c.id, "company", v)}
                    placeholder="例：株式会社サンプル" required />

                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
                    <YearMonthSelector labelPrefix="入社" yearVal={c.fromYear} monthVal={c.fromMonth} required
                      onYearChange={(v) => uCareerPeriod(c.id, "fromYear", v)}
                      onMonthChange={(v) => uCareerPeriod(c.id, "fromMonth", v)} />
                    <span style={{ padding: "10px 4px", color: P.sub }}>〜</span>
                    <YearMonthSelector labelPrefix="退社" yearVal={c.toYear} monthVal={c.toMonth}
                      onYearChange={(v) => uCareerPeriod(c.id, "toYear", v)}
                      onMonthChange={(v) => uCareerPeriod(c.id, "toMonth", v)} />
                  </div>
                  <p style={st.hint}>※ 現職の場合は退社年月を空欄のままにしてください</p>

                  <div style={{ marginBottom: 16 }}>
                    <FormSelect label="雇用形態" value={c.employment} onChange={(v) => uCareer(c.id, "employment", v)}
                      options={EMPLOYMENT_OPTS} placeholder="選択してください" width="220px" required />
                  </div>

                  <div style={st.subTitle}>
                    会社情報<span style={{ fontWeight: 400, fontSize: 12, color: P.sub, marginLeft: 6 }}>（任意・わからなければ空欄でOK）</span>
                  </div>
                  <FormInput label="事業内容" value={c.business} onChange={(v) => uCareer(c.id, "business", v)}
                    placeholder="例：人材紹介事業、SaaSの開発・販売" />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0 4%" }}>
                    <FormInput label="売上高" value={c.revenue} onChange={(v) => uCareer(c.id, "revenue", v)}
                      placeholder="例：120億円" half />
                    <FormInput label="従業員数" value={c.employees} onChange={(v) => uCareer(c.id, "employees", v)}
                      placeholder="例：500名" half />
                    <FormInput label="上場区分" value={c.listing} onChange={(v) => uCareer(c.id, "listing", v)}
                      placeholder="例：東証プライム、非上場" half />
                  </div>

                  <div style={{ ...st.subTitle, marginTop: 8 }}>部署ごとの経歴</div>
                  {c.departments.map((d, di) => (
                    <DeptCard key={d.id} d={d} index={di}
                      canRemove={c.departments.length > 1}
                      onUpdate={(patch) => uDept(c.id, d.id, patch)}
                      onRemove={() => rmDept(c.id, d.id)} />
                  ))}
                  <Btn onClick={() => addDept(c.id)} small>＋ 部署を追加（異動があった場合）</Btn>

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${P.border}` }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: P.sub, lineHeight: 1.6 }}>
                      この会社の全部署の「実績・課題・課題解決にあたり行った行動」を、まとめて整えます。
                    </p>
                    {stale && !c.isRefining && (
                      <div style={{ ...st.noticeBox, padding: "8px 12px", marginBottom: 10, fontSize: 12 }}>
                        入力が変更されています。もう一度整えますか？
                      </div>
                    )}
                    <AIBtn onClick={() => handleRefineCareer(c.id)} loading={c.isRefining}
                      label={stale ? "もう一度整える" : "AIで整える"} />
                    {c.refineError && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: P.danger }}>{c.refineError}</p>
                    )}
                  </div>
                </div>
              );
            })}
            <Btn onClick={addCareer} small style={{ marginTop: 4 }}>＋ 経歴を追加</Btn>
          </div>
        );

      case "summary":
        return (
          <div>
            <h2 style={st.h2}>職務要約を確認してください</h2>
            <p style={st.desc}>
              職務経歴書の冒頭に表示される、キャリア全体のサマリーです。
              前のステップの職務経歴をもとにAIが作成します。文章は自由に直せます。
            </p>

            <div style={st.noticeBox}>
              <div style={{ fontWeight: 700, color: P.accent, marginBottom: 8, fontSize: 14 }}>
                💡 職務要約とは
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                <li>採用担当者が最初に読む「キャリア全体のサマリー」</li>
                <li>通算年数・主な職種・得意領域などを200〜300字程度でまとめたもの</li>
                <li>職務経歴を直しても自動では書き換わりません。必要なときに「再生成」を押してください</li>
              </ul>
            </div>

            {summaryStale && (
              <div style={{ ...st.noticeBox, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <div style={{ flex: "1 1 260px" }}>
                  <div style={{ fontWeight: 700 }}>職務経歴が変更されています。再生成しますか？</div>
                  <div style={{ fontSize: 11, color: P.sub }}>※ 再生成すると、手直しした内容も置き換わります</div>
                </div>
                <Btn onClick={() => handleRegenerateSummary(true)} small>再生成する</Btn>
              </div>
            )}

            {summaryRefining && (
              <div style={{ ...st.refinedBox, marginTop: 0, marginBottom: 16, fontSize: 13, color: P.sub }}>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⏳</span>
                職務経歴をもとに、職務要約を作成しています…
              </div>
            )}

            {summaryError && !summaryRefining && (
              <div style={st.errorBox}>{summaryError}</div>
            )}

            {summary && !summaryRefining && (
              <div style={{ ...st.refinedBox, marginTop: 0, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: P.accent }}>✨ 職務要約（編集可能）</span>
                  <span style={{ fontSize: 11, color: P.sub }}>{summary.length}字</span>
                </div>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={7}
                  style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.8, borderColor: P.accent, background: "#fffcf8" }}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <AIBtn onClick={() => handleRegenerateSummary(false)} loading={summaryRefining}
                label={summary ? "再生成" : "職務要約を作成する"} />
            </div>
          </div>
        );

      case "skills":
        return (
          <div>
            <h2 style={st.h2}>スキルを入力してください</h2>
            <p style={st.desc}>
              使えるツールや言語をメモ書きで。
              <strong style={{ color: P.accent }}>「AIで整える」</strong>でカテゴリ別に整理されます。
            </p>
            <FormTextarea label="スキル（メモ・箇条書きOK）" value={skillsRaw} onChange={setSkillsRaw} rows={5}
              placeholder={"例：\nエクセル中級、パワーポイント初級\nhubspotは2年触って管理や構築まで\nTOEIC800点"}
              hint="ツール名と、使えるレベルや年数を書いてください。" />
            <div style={{ marginBottom: 16 }}><AIBtn onClick={handleRefineSkills} loading={skillsRefining} /></div>
            {skillsRefined && (
              <div style={st.refinedBox}>
                <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 6 }}>✨ AI整形結果（編集可能）</div>
                <textarea value={skillsRefined} onChange={(e) => setSkillsRefined(e.target.value)} rows={10}
                  style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.8, borderColor: P.accent, background: "#fffcf8" }} />
              </div>
            )}
          </div>
        );

      case "qualifications":
        return (
          <div>
            <h2 style={st.h2}>保有資格・免許を入力してください</h2>
            <p style={st.desc}>資格名と取得年月を入力してください。</p>
            {quals.map((q, i) => (
              <div key={q.id} style={st.itemCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>資格 {i + 1}</span>
                  {quals.length > 1 && <XBtn onClick={() => rmQualFn(q.id)} />}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={st.label}>資格・免許名</label>
                  <input value={q.name}
                    onChange={(e) => uQualFn(q.id, "name", e.target.value)}
                    placeholder="例：普通自動車第一種運転免許、TOEIC 780点、基本情報技術者"
                    style={st.input}
                    onFocus={(e) => (e.target.style.borderColor = P.primary)}
                    onBlur={(e) => (e.target.style.borderColor = P.border)} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <FormSelect label="取得年" value={q.year} onChange={(v) => uQualFn(q.id, "year", v)} width="110px"
                    options={YEAR_OPTS} placeholder="年" />
                  <FormSelect label="取得月" value={q.month} onChange={(v) => uQualFn(q.id, "month", v)} width="85px"
                    options={MONTH_OPTS} placeholder="月" />
                </div>
              </div>
            ))}
            <Btn onClick={addQualFn} small style={{ marginTop: 4 }}>＋ 資格を追加</Btn>
          </div>
        );

      case "pr":
        return (
          <div>
            <h2 style={st.h2}>自己PRを書いてください</h2>
            <p style={st.desc}>
              思いつくまま書いてみてください。
              <strong style={{ color: P.accent }}>「AIで整える」</strong>で職務経歴書向けに変換できます。
            </p>

            <div style={{
              background: "#fffcf0",
              border: `1.5px solid ${P.accent}`,
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 20,
              fontSize: 13,
              lineHeight: 1.7,
              color: P.text,
            }}>
              <div style={{ fontWeight: 700, color: P.accent, marginBottom: 8, fontSize: 14 }}>
                ⚠️ 「AIで整える」を押す前にご確認ください
              </div>
              <div style={{ marginBottom: 8 }}>
                自己PRしたい素養に加えて、説得力を持たせるため以下の内容も含めてください：
              </div>

              <div style={{
                background: "#fff",
                padding: "10px 12px",
                borderRadius: 6,
                marginBottom: 10,
                lineHeight: 1.65,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: P.text }}>
                  📝 自己PRに含めるべき項目（チェックリスト）
                </div>
                <div style={{ fontSize: 11, color: P.sub, marginBottom: 6 }}>
                  以下の項目を含めると、説得力のある自己PRになります。
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                  <li>☐ <strong>素養（強み）</strong>（自分の核となる能力・特長）</li>
                  <li>☐ <strong>その素養が活かされた経験の概要</strong>（いつ・どこで・何の業務で）</li>
                  <li>☐ <strong>当時の課題</strong>（何が問題だったか）</li>
                  <li>☐ <strong>そこに対する施策</strong>（具体的にどう動いたか）</li>
                  <li>☐ <strong>成果</strong>（できれば数字や具体的な変化で）</li>
                </ul>
              </div>

              <div style={{
                background: "#fff",
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 12,
                color: P.sub,
                lineHeight: 1.6,
              }}>
                💡 <strong>箇条書きのメモでOK</strong>です。AIが自然な文章に整えます。
                書きづらければ、知っている範囲で書いてください。
                記載がない項目は無理に作成せず、書かれた内容だけで整形します。
              </div>
            </div>

            <FormTextarea label="自己PR（メモ・箇条書きOK）" value={prRaw} onChange={setPrRaw} rows={5}
              placeholder={"例：\n・強み：課題発見と巻き込み力\n・前職で売上が伸び悩んでいた\n・営業・企画・開発を巻き込み顧客ヒアリングを実施\n・新規施策で売上1.2億達成"}
              hint="気軽にメモ書きでOKです。" />
            <div style={{ marginBottom: 16 }}><AIBtn onClick={handleRefinePR} loading={prRefining} /></div>
            {prRefined && (
              <div style={st.refinedBox}>
                <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 6 }}>✨ AI整形結果（編集可能）</div>
                <textarea value={prRefined} onChange={(e) => setPrRefined(e.target.value)} rows={7}
                  style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.8, borderColor: P.accent, background: "#fffcf8" }} />
              </div>
            )}
          </div>
        );

      case "preview": {
        const fQuals = quals.filter((q) => q.name.trim());
        const skillsDisplay = skillsRefined || skillsRaw;
        const summaryDisplay = summary.trim();
        return (
          <div>
            <h2 style={st.h2}>プレビュー</h2>
            <p style={st.desc}>職務経歴書の仕上がりイメージです。内容を確認してPDFをダウンロードできます。</p>
            <div style={st.pdf} ref={pdfRef}>
              <div style={{ textAlign: "center", marginBottom: 24, borderBottom: `2px solid ${P.primary}`, paddingBottom: 16 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 8, color: P.primary, margin: 0 }}>職 務 経 歴 書</h1>
                <p style={{ fontSize: 11, color: P.sub, margin: "8px 0 0" }}>{todayStr}</p>
              </div>
              <table style={st.tbl}><tbody>
                <tr>
                  <th style={st.thP}>氏名</th>
                  <td style={st.tdP}>
                    {(basic.lastNameKana || basic.firstNameKana) && (
                      <><span style={{ fontSize: 10, color: P.sub }}>{`${basic.lastNameKana || ""} ${basic.firstNameKana || ""}`.trim()}</span><br /></>
                    )}
                    <span style={{ fontSize: 16, fontWeight: 700 }}>
                      {(basic.lastName || basic.firstName) ? `${basic.lastName || ""} ${basic.firstName || ""}`.trim() : "—"}
                    </span>
                  </td>
                </tr>
              </tbody></table>

              {summaryDisplay && (<>
                <h3 style={st.secTitle}>■ 職務要約</h3>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.9, padding: "8px 12px", background: "#fafaf8", borderRadius: 4 }}>
                  {summaryDisplay}
                </div>
              </>)}

              <h3 style={st.secTitle}>■ 職務経歴</h3>
              {careers.map((c) => (
                <CareerTextBlock key={c.id} text={buildCompanyText(c)} />
              ))}

              {skillsDisplay && (<>
                <h3 style={st.secTitle}>■ スキル</h3>
                <div style={{ padding: "8px 12px", background: "#fafaf8", borderRadius: 4, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {skillsDisplay}
                </div>
              </>)}

              {fQuals.length > 0 && (<>
                <h3 style={st.secTitle}>■ 保有資格・免許</h3>
                <table style={st.tbl}><tbody>
                  {fQuals.map((q) => (
                    <tr key={q.id}>
                      <td style={{ ...st.tdP, width: 120, fontSize: 12, color: P.sub }}>
                        {q.year && q.month ? `${q.year}年${q.month}月` : q.year ? `${q.year}年` : ""}
                      </td>
                      <td style={st.tdP}>{q.name}</td>
                    </tr>
                  ))}
                </tbody></table>
              </>)}

              {(prRefined || prRaw) && (<>
                <h3 style={st.secTitle}>■ 自己PR</h3>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.9, padding: "8px 12px", background: "#fafaf8", borderRadius: 4 }}>
                  {prRefined || prRaw}
                </div>
              </>)}

              <div style={{ marginTop: 32, textAlign: "right", fontSize: 11, color: P.sub }}>以上</div>
            </div>

            {/* Action buttons */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleGenerateAndUpload}
                disabled={uploadStatus === "generating" || uploadStatus === "uploading"}
                style={{
                  width: "100%", padding: "14px 24px", borderRadius: 10, border: "none",
                  fontSize: 15, fontWeight: 700, fontFamily: font,
                  cursor: (uploadStatus === "generating" || uploadStatus === "uploading") ? "wait" : "pointer",
                  background: P.primary, color: "#fff",
                  opacity: (uploadStatus === "generating" || uploadStatus === "uploading") ? 0.7 : 1,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {uploadStatus === "generating" || uploadStatus === "uploading" ? (
                  <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>生成中…</>
                ) : (
                  <>履歴書を生成する</>
                )}
              </button>

              {uploadMessage && uploadStatus !== "generating" && uploadStatus !== "uploading" && (
                <div style={{
                  padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: uploadStatus === "done" ? P.pLight : "#fdf0f0",
                  color: uploadStatus === "done" ? P.primary : P.danger,
                  textAlign: "center",
                  fontWeight: uploadStatus === "done" ? 600 : 400,
                }}>
                  {uploadStatus === "done"
                    ? "生成が完了しましたので担当にお知らせください"
                    : uploadMessage}
                </div>
              )}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div style={{ fontFamily: font, background: P.bg, minHeight: "100vh", color: P.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #b5b0a8; }
        select { cursor: pointer; }
      `}</style>

      <div style={{ background: P.primary, padding: "20px 24px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>職務経歴書ビルダー</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>ステップに沿って入力するだけ。AIが文章を整えます。</p>
      </div>

      <div style={{ display: "flex", background: "#fff", borderBottom: `1px solid ${P.border}`, padding: "0 4px", overflowX: "auto" }}>
        {STEPS.map((s, i) => (
          <button key={s.id} onClick={() => navigate(i)}
            style={{
              flex: "1 0 auto", padding: "12px 6px", background: "none", border: "none",
              borderBottom: i === step ? `3px solid ${P.primary}` : "3px solid transparent",
              color: i === step ? P.primary : P.sub, fontWeight: i === step ? 700 : 400,
              fontSize: 11, fontFamily: font, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
            }}>
            <span style={{ fontSize: 13 }}>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 100px", animation: anim ? "fadeUp 0.3s ease" : "none" }}>
        <div style={st.card}>{renderStep()}</div>
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff",
        borderTop: `1px solid ${P.border}`, padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Btn onClick={prev} disabled={step === 0}>← 戻る</Btn>
        <span style={{ fontSize: 12, color: P.sub }}>{step + 1} / {STEPS.length}</span>
        <Btn onClick={next} primary disabled={step === STEPS.length - 1}>
          {step === STEPS.length - 2 ? "プレビューへ →" : "次へ →"}
        </Btn>
      </div>
    </div>
  );
}
