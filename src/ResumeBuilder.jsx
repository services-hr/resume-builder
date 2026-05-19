import { useState, useCallback, useRef } from "react";

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

const YEARS = Array.from({ length: 40 }, (_, i) => 2026 - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEAR_OPTS = YEARS.map((y) => ({ value: String(y), label: `${y}年` }));
const MONTH_OPTS = MONTHS.map((m) => ({ value: String(m), label: `${m}月` }));

let _idCounter = 1;
const nextId = () => _idCounter++;

const mkCareer = () => ({
  id: nextId(), company: "", fromYear: "", fromMonth: "", toYear: "", toMonth: "",
  position: "", rawDescription: "", refinedDescription: "", isRefining: false,
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
  refinedBox: { marginTop: 12, padding: 14, background: "#fffcf8", border: `1.5px solid ${P.accent}`, borderRadius: 10 },
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

/* ─── sub-components ─── */
function FormInput({ label, value, onChange, placeholder, type = "text", required, half }) {
  return (
    <div style={{ marginBottom: 16, width: half ? "48%" : "100%" }}>
      <label style={st.label}>{label}{required && <span style={{ color: "#e25c5c", marginLeft: 3, fontSize: 11 }}>*</span>}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} style={st.input}
        onFocus={(e) => (e.target.style.borderColor = P.primary)}
        onBlur={(e) => (e.target.style.borderColor = P.border)} />
    </div>
  );
}

function FormSelect({ label, value, onChange, options, placeholder, width = "100%" }) {
  return (
    <div style={{ width }}>
      <label style={st.label}>{label}</label>
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

function YearMonthSelector({ labelPrefix, yearVal, monthVal, onYearChange, onMonthChange }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <FormSelect label={`${labelPrefix}年`} value={yearVal} onChange={onYearChange} width="105px" options={YEAR_OPTS} placeholder="年" />
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
const periodStr = (c) => {
  const from = c.fromYear && c.fromMonth ? `${c.fromYear}年${c.fromMonth}月` : "";
  const hasTo = c.toYear && c.toMonth;
  const to = hasTo ? `${c.toYear}年${c.toMonth}月` : "現在";
  if (from) return `${from} 〜 ${to}`;
  return "";
};

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
  const [summaryRaw, setSummaryRaw] = useState("");
  const [summaryRefined, setSummaryRefined] = useState("");
  const [summaryRefining, setSummaryRefining] = useState(false);
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

  const goTo = (i) => { setAnim(false); setTimeout(() => { setStep(i); setAnim(true); }, 140); };
  const next = () => step < STEPS.length - 1 && goTo(step + 1);
  const prev = () => step > 0 && goTo(step - 1);

  const uBasic = useCallback((k, v) => setBasic((p) => ({ ...p, [k]: v })), []);
  const uCareer = useCallback((id, k, v) => setCareers((cs) => cs.map((c) => c.id === id ? { ...c, [k]: v } : c)), []);
  const addCareer = useCallback(() => setCareers((c) => [...c, mkCareer()]), []);
  const rmCareer = useCallback((id) => setCareers((c) => c.length > 1 ? c.filter((x) => x.id !== id) : c), []);

  const addQualFn = useCallback(() => setQuals((q) => [...q, mkQual()]), []);
  const uQualFn = useCallback((id, k, v) => setQuals((q) => q.map((x) => x.id === id ? { ...x, [k]: v } : x)), []);
  const rmQualFn = useCallback((id) => setQuals((q) => q.length > 1 ? q.filter((x) => x.id !== id) : q), []);

  const handleRefineCareer = useCallback(async (id) => {
    const c = careers.find((x) => x.id === id);
    if (!c || !c.rawDescription.trim()) return;
    uCareer(id, "isRefining", true);

    const fromStr = (c.fromYear && c.fromMonth) ? `${c.fromYear}年${c.fromMonth}月` : "";
    const hasTo = c.toYear && c.toMonth;
    const toStr = hasTo ? `${c.toYear}年${c.toMonth}月` : "現在";
    const periodTxt = fromStr ? `${fromStr} 〜 ${toStr}` : "";

    const contextParts = [];
    if (c.company) contextParts.push(`会社名：${c.company}`);
    if (c.position) contextParts.push(`役職・部署：${c.position}`);
    if (periodTxt) contextParts.push(`在籍期間：${periodTxt}`);
    const context = contextParts.join("、");

    const r = await callRefineAPI("career", c.rawDescription, context);
    if (r) uCareer(id, "refinedDescription", r);
    uCareer(id, "isRefining", false);
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

  // 職務要約：職歴情報をテキスト化してAIに渡す
  const handleRefineSummary = useCallback(async () => {
    const careersText = careers.map((c, i) => {
      const period = (c.fromYear && c.fromMonth)
        ? `${c.fromYear}年${c.fromMonth}月 〜 ${c.toYear && c.toMonth ? `${c.toYear}年${c.toMonth}月` : "現在"}`
        : "";
      const desc = (c.refinedDescription || c.rawDescription || "").trim();
      return `【経歴${i + 1}】
会社名：${c.company || "（未記入）"}
在籍期間：${period || "（未記入）"}
役職・部署：${c.position || "（未記入）"}
業務内容：
${desc || "（未記入）"}`;
    }).join("\n\n");

    if (!careersText.trim()) return;
    setSummaryRefining(true);
    const r = await callRefineAPI("summary", careersText);
    if (r) setSummaryRefined(r);
    setSummaryRefining(false);
  }, [careers]);

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
      summary: summaryRefined || summaryRaw,
      careers: careers.map((c) => ({
        company: c.company,
        fromYear: c.fromYear,
        fromMonth: c.fromMonth,
        toYear: c.toYear,
        toMonth: c.toMonth,
        position: c.position,
        rawDescription: c.rawDescription,
        refinedDescription: c.refinedDescription,
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
              業務内容はメモ書き・箇条書きでOK。
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
                AIが正確な情報を取得するため、以下を<strong>正式名称で</strong>記載してください：
              </div>
              <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
                <li><strong>会社欄</strong>：正式な会社名（例：「荏原」ではなく「株式会社荏原製作所」）</li>
                <li><strong>役職・部署欄</strong>：正式な役職名・部署名</li>
              </ul>

              <div style={{
                background: "#fff",
                padding: "10px 12px",
                borderRadius: 6,
                marginBottom: 10,
                lineHeight: 1.65,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: P.text }}>
                  📝 業務内容のメモに含めるべき項目（チェックリスト）
                </div>
                <div style={{ fontSize: 11, color: P.sub, marginBottom: 6 }}>
                  以下の項目はAIがメモから抽出します。記載がないと出力が空欄になります。
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                  <li>☐ <strong>雇用形態</strong>（正社員／契約社員／派遣／業務委託 など）</li>
                  <li>☐ <strong>職種</strong>（開発・設計／営業／マーケティング など）</li>
                  <li>☐ <strong>対応商材</strong>（取り扱った製品・サービス）</li>
                  <li>☐ <strong>業務内容</strong>（具体的に行った仕事の中身）</li>
                  <li>☐ <strong>実績</strong>（具体的な数字や成果）</li>
                  <li>☐ <strong>工夫した点</strong>（こだわり・問題解決の事例）</li>
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
                💡 <strong>箇条書きのメモでOK</strong>です。AIが整形して職務経歴書向けに変換します。
              </div>
            </div>

            {careers.map((c, i) => (
              <div key={c.id} style={st.itemCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>経歴 {i + 1}</span>
                  {careers.length > 1 && <XBtn onClick={() => rmCareer(c.id)} />}
                </div>

                <FormInput label="会社名" value={c.company} onChange={(v) => uCareer(c.id, "company", v)}
                  placeholder="例：株式会社サンプル" required />

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
                  <YearMonthSelector labelPrefix="入社" yearVal={c.fromYear} monthVal={c.fromMonth}
                    onYearChange={(v) => uCareer(c.id, "fromYear", v)}
                    onMonthChange={(v) => uCareer(c.id, "fromMonth", v)} />
                  <span style={{ padding: "10px 4px", color: P.sub }}>〜</span>
                  <YearMonthSelector labelPrefix="退社" yearVal={c.toYear} monthVal={c.toMonth}
                    onYearChange={(v) => uCareer(c.id, "toYear", v)}
                    onMonthChange={(v) => uCareer(c.id, "toMonth", v)} />
                </div>
                <p style={{ fontSize: 11, color: P.sub, margin: "-12px 0 16px" }}>
                  ※ 現職の場合は退社年月を空欄のままにしてください
                </p>

                <FormInput label="役職・部署" value={c.position} onChange={(v) => uCareer(c.id, "position", v)}
                  placeholder="例：営業部 主任" />

                <FormTextarea label="業務内容（メモ・箇条書きOK）" value={c.rawDescription}
                  onChange={(v) => uCareer(c.id, "rawDescription", v)} rows={5}
                  placeholder={"例：\n・法人向けITソリューションの提案営業\n・新規開拓で年間売上1.2億達成\n・5名チームのリーダーとしてメンバー育成"}
                  hint="気軽にメモ書きでOKです。" />

                <div style={{ marginBottom: 8 }}>
                  <AIBtn onClick={() => handleRefineCareer(c.id)} loading={c.isRefining} />
                </div>

                {c.refinedDescription && (
                  <div style={st.refinedBox}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 6 }}>✨ AI整形結果（編集可能）</div>
                    <textarea value={c.refinedDescription}
                      onChange={(e) => uCareer(c.id, "refinedDescription", e.target.value)} rows={10}
                      style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.8, borderColor: P.accent, background: "#fffcf8" }} />
                  </div>
                )}
              </div>
            ))}
            <Btn onClick={addCareer} small style={{ marginTop: 4 }}>＋ 経歴を追加</Btn>
          </div>
        );

      case "summary":
        return (
          <div>
            <h2 style={st.h2}>職務要約を作成してください</h2>
            <p style={st.desc}>
              職務経歴書の冒頭に表示される、キャリア全体のサマリーです。
              手入力もできますし、<strong style={{ color: P.accent }}>「AIで要約を整える」</strong>で職務経歴をもとに自動生成もできます。
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
                💡 職務要約とは
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
                <li>採用担当者が最初に読む「キャリア全体のサマリー」</li>
                <li>通算年数・主な職種・得意領域などを200〜300字程度でまとめる</li>
                <li>AI生成は、前ステップで入力した職務経歴をベースに作成します</li>
                <li>空欄のままAIボタンを押せばゼロから生成、何か書いた状態でも上書きされます</li>
              </ul>
            </div>

            <FormTextarea
              label="職務要約（手入力もOK）"
              value={summaryRaw}
              onChange={setSummaryRaw}
              rows={6}
              placeholder={"例：\n新卒入社後、〇〇株式会社にて◇年間、法人営業として中堅企業向けの提案営業に従事。その後、株式会社△△にて…"}
              hint="空欄のまま下のAIボタンを押せば、職歴をもとに自動生成します。"
            />
            <div style={{ marginBottom: 16 }}>
              <AIBtn onClick={handleRefineSummary} loading={summaryRefining} label="AIで要約を整える" />
            </div>

            {summaryRefined && (
              <div style={st.refinedBox}>
                <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 6 }}>
                  ✨ AI整形結果（編集可能）
                </div>
                <textarea
                  value={summaryRefined}
                  onChange={(e) => setSummaryRefined(e.target.value)}
                  rows={7}
                  style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.8, borderColor: P.accent, background: "#fffcf8" }}
                />
              </div>
            )}
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
        const summaryDisplay = summaryRefined || summaryRaw;
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
                <div key={c.id} style={{ marginBottom: 16 }}>
                  <table style={st.tbl}><tbody>
                    <tr><th style={{ ...st.thP, width: 100 }}>在籍期間</th><td style={st.tdP}>{periodStr(c)}</td></tr>
                    <tr><th style={st.thP}>会社名</th><td style={{ ...st.tdP, fontWeight: 600 }}>{c.company || "—"}</td></tr>
                    {c.position && <tr><th style={st.thP}>役職・部署</th><td style={st.tdP}>{c.position}</td></tr>}
                    <tr><th style={st.thP}>業務内容</th><td style={{ ...st.tdP, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{c.refinedDescription || c.rawDescription || "—"}</td></tr>
                  </tbody></table>
                </div>
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
          <button key={s.id} onClick={() => goTo(i)}
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
