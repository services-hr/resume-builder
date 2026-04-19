import { useState, useCallback, useRef } from "react";

/* ─── constants ─── */
const STEPS = [
  { id: "basic", label: "基本情報", icon: "①" },
  { id: "career", label: "職務経歴", icon: "②" },
  { id: "skills", label: "スキル", icon: "③" },
  { id: "qualifications", label: "資格・免許", icon: "④" },
  { id: "pr", label: "自己PR", icon: "⑤" },
  { id: "preview", label: "プレビュー", icon: "⑥" },
];

const YEARS = Array.from({ length: 40 }, (_, i) => 2026 - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEAR_OPTS = YEARS.map((y) => ({ value: String(y), label: `${y}年` }));
const MONTH_OPTS = MONTHS.map((m) => ({ value: String(m), label: `${m}月` }));

let _idCounter = 1;
const nextId = () => _idCounter++;

const mkCareer = () => ({
  id: nextId(), company: "", fromYear: "", fromMonth: "", toYear: "", toMonth: "",
  isCurrent: false, position: "", rawDescription: "", refinedDescription: "", isRefining: false,
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

function AIBtn({ onClick, loading }) {
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
      {loading ? "AI変換中…" : "AIで整える"}
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
  const to = c.isCurrent ? "現在" : (c.toYear && c.toMonth ? `${c.toYear}年${c.toMonth}月` : "");
  if (from && to) return `${from} 〜 ${to}`;
  if (from) return `${from} 〜`;
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
    birthDate: "", email: "", phone: "", address: "", nearestStation: "",
  });
  const [careers, setCareers] = useState(() => [mkCareer()]);
  const [skillsRaw, setSkillsRaw] = useState("");
  const [skillsRefined, setSkillsRefined] = useState("");
  const [skillsRefining, setSkillsRefining] = useState(false);
  const [quals, setQuals] = useState(() => [mkQual()]);
  const [prRaw, setPrRaw] = useState("");
  const [prRefined, setPrRefined] = useState("");
  const [prRefining, setPrRefining] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(""); // "", "generating", "uploading", "done", "error"
  const [uploadMessage, setUploadMessage] = useState("");
  const [driveLink, setDriveLink] = useState("");
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
    const r = await callRefineAPI("career", c.rawDescription, `会社名：${c.company}、役職：${c.position}`);
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

  const getFileName = () => {
    const d = new Date();
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const fullName = `${basic.lastName || ""} ${basic.firstName || ""}`.trim();
    const name = fullName || "名前未入力";
    return `${name}_職務経歴書_${yyyymmdd}`;
  };

  /* ────────────────────────────────────────
     PDF GENERATION — server-side (Google Apps Script)
     ─────────────────────────────────────────
     クライアント側では入力データをJSONとしてVercel APIに送るだけ。
     実際のPDF生成（テンプレート差し込み・PDF変換・Drive保存）はすべて
     Google Apps Scriptが担当する。テキストベースのPDFが生成されるため
     文字コピー・検索・日本語フォントがすべて自然に成立する。
  */
  const handleGenerateAndUpload = async () => {
    setDriveLink("");
    setUploadStatus("generating");
    setUploadMessage("PDFを生成中… (Googleドキュメントで差し込み中)");

    // 送信用にデータを整理
    const payload = {
      basic,
      careers: careers.map((c) => ({
        company: c.company,
        fromYear: c.fromYear,
        fromMonth: c.fromMonth,
        toYear: c.toYear,
        toMonth: c.toMonth,
        isCurrent: c.isCurrent,
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
        if (result.webViewLink) setDriveLink(result.webViewLink);
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
            <p style={st.desc}>求職者の基本的なプロフィール情報です。</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0 4%" }}>
              <FormInput label="姓" value={basic.lastName} onChange={(v) => uBasic("lastName", v)} placeholder="山田" required half />
              <FormInput label="名" value={basic.firstName} onChange={(v) => uBasic("firstName", v)} placeholder="太郎" required half />
              <FormInput label="姓（フリガナ）" value={basic.lastNameKana} onChange={(v) => uBasic("lastNameKana", v)} placeholder="ヤマダ" half />
              <FormInput label="名（フリガナ）" value={basic.firstNameKana} onChange={(v) => uBasic("firstNameKana", v)} placeholder="タロウ" half />
              <FormInput label="生年月日" type="date" value={basic.birthDate} onChange={(v) => uBasic("birthDate", v)} required half />
              <div style={{ width: "48%", marginBottom: 16 }}>
                <label style={st.label}>年齢（自動計算）</label>
                <div style={{ ...st.input, background: "#f5f3f0", color: P.sub }}>
                  {basic.birthDate ? calcAge(basic.birthDate).replace(/[（）]/g, "") : "—"}
                </div>
              </div>
              <FormInput label="メールアドレス" type="email" value={basic.email} onChange={(v) => uBasic("email", v)} placeholder="example@mail.com" half />
              <FormInput label="電話番号" value={basic.phone} onChange={(v) => uBasic("phone", v)} placeholder="090-1234-5678" half />
              <FormInput label="現住所" value={basic.address} onChange={(v) => uBasic("address", v)} placeholder="東京都渋谷区恵比寿1-2-3" />
              <FormInput label="最寄駅" value={basic.nearestStation} onChange={(v) => uBasic("nearestStation", v)} placeholder="JR恵比寿駅 徒歩5分" half />
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
            {careers.map((c, i) => (
              <div key={c.id} style={st.itemCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontWeight: 700, color: P.primary, fontSize: 15 }}>経歴 {i + 1}</span>
                  {careers.length > 1 && <XBtn onClick={() => rmCareer(c.id)} />}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0 4%" }}>
                  <FormInput label="会社名" value={c.company} onChange={(v) => uCareer(c.id, "company", v)} placeholder="株式会社〇〇" required half />
                  <FormInput label="役職・部署" value={c.position} onChange={(v) => uCareer(c.id, "position", v)} placeholder="営業部 主任" half />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
                  <YearMonthSelector labelPrefix="開始"
                    yearVal={c.fromYear} monthVal={c.fromMonth}
                    onYearChange={(v) => uCareer(c.id, "fromYear", v)}
                    onMonthChange={(v) => uCareer(c.id, "fromMonth", v)} />
                  <span style={{ fontSize: 20, color: P.sub, paddingBottom: 8 }}>〜</span>
                  {c.isCurrent ? (
                    <div style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, color: P.primary }}>現在</div>
                  ) : (
                    <YearMonthSelector labelPrefix="終了"
                      yearVal={c.toYear} monthVal={c.toMonth}
                      onYearChange={(v) => uCareer(c.id, "toYear", v)}
                      onMonthChange={(v) => uCareer(c.id, "toMonth", v)} />
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 8, fontSize: 13, color: P.sub, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={c.isCurrent}
                      onChange={(e) => uCareer(c.id, "isCurrent", e.target.checked)}
                      style={{ accentColor: P.primary, width: 16, height: 16 }} />
                    現職
                  </label>
                </div>
                <FormTextarea label="業務内容（メモ・箇条書きOK）" value={c.rawDescription}
                  onChange={(v) => uCareer(c.id, "rawDescription", v)}
                  placeholder={"例：\n・法人向けITソリューションの営業\n・新規開拓メイン、年間売上1.2億\n・5人チームのリーダー"}
                  rows={4} hint="気軽にメモ書きしてください。AIが文章に整えます。" />
                <AIBtn onClick={() => handleRefineCareer(c.id)} loading={c.isRefining} />
                {c.refinedDescription && (
                  <div style={st.refinedBox}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 6 }}>✨ AI整形結果（編集可能）</div>
                    <textarea value={c.refinedDescription}
                      onChange={(e) => uCareer(c.id, "refinedDescription", e.target.value)}
                      rows={5}
                      style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.7, borderColor: P.accent, background: "#fffcf8" }} />
                  </div>
                )}
              </div>
            ))}
            <Btn onClick={addCareer} small style={{ marginTop: 4 }}>＋ 経歴を追加</Btn>
          </div>
        );

      case "skills":
        return (
          <div>
            <h2 style={st.h2}>スキルを入力してください</h2>
            <p style={st.desc}>
              業務で使えるツール、ソフトウェア、PCスキルなどを自由に書いてください。
              <strong style={{ color: P.accent }}>「AIで整える」</strong>でカテゴリ分類・正式名称に整形できます。
            </p>
            <FormTextarea label="スキル（メモ・箇条書きOK）" value={skillsRaw} onChange={setSkillsRaw} rows={6}
              placeholder={"例：\nエクセル vlookup ピボットテーブル\nパワポ 提案資料作成\nセールスフォース 3年\nhtml css 少し\nfigma ワイヤーフレーム作成"}
              hint="ツール名を羅列するだけでOKです。AIが分類・整形します。" />
            <div style={{ marginBottom: 16 }}>
              <AIBtn onClick={handleRefineSkills} loading={skillsRefining} />
            </div>
            {skillsRefined && (
              <div style={st.refinedBox}>
                <div style={{ fontSize: 12, fontWeight: 600, color: P.accent, marginBottom: 6 }}>✨ AI整形結果（編集可能）</div>
                <textarea value={skillsRefined} onChange={(e) => setSkillsRefined(e.target.value)} rows={8}
                  style={{ ...st.input, resize: "vertical", fontFamily: font, lineHeight: 1.7, borderColor: P.accent, background: "#fffcf8" }} />
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
            <FormTextarea label="自己PR（メモ・箇条書きOK）" value={prRaw} onChange={setPrRaw} rows={5}
              placeholder={"例：\n・営業で鍛えた提案力が強み\n・数字ベースで考えるのが得意\n・新規事業の立ち上げ経験あり"}
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
        const isBusy = uploadStatus === "generating" || uploadStatus === "uploading";
        return (
          <div>
            <h2 style={st.h2}>プレビュー</h2>
            <p style={st.desc}>職務経歴書の仕上がりイメージです。内容を確認してPDFを生成できます。</p>
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
                    {basic.birthDate && <span style={{ fontSize: 12, color: P.sub, marginLeft: 8 }}>{formatDate(basic.birthDate)} 生 {calcAge(basic.birthDate)}</span>}
                  </td>
                </tr>
                <tr>
                  <th style={st.thP}>連絡先</th>
                  <td style={st.tdP}>
                    {basic.address && <div>{basic.address}</div>}
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
                      {basic.phone && <span>TEL: {basic.phone}</span>}
                      {basic.email && <span>Email: {basic.email}</span>}
                    </div>
                    {basic.nearestStation && <div style={{ fontSize: 12, color: P.sub }}>最寄駅: {basic.nearestStation}</div>}
                  </td>
                </tr>
              </tbody></table>

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
                disabled={isBusy}
                style={{
                  width: "100%", padding: "14px 24px", borderRadius: 10, border: "none",
                  fontSize: 15, fontWeight: 700, fontFamily: font,
                  cursor: isBusy ? "wait" : "pointer",
                  background: P.primary, color: "#fff",
                  opacity: isBusy ? 0.7 : 1,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {isBusy ? (
                  <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>{uploadMessage}</>
                ) : (
                  <>📄 PDFを生成してGoogle Driveに保存</>
                )}
              </button>

              {uploadMessage && !isBusy && (
                <div style={{
                  padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: uploadStatus === "done" ? P.pLight : "#fdf0f0",
                  color: uploadStatus === "done" ? P.primary : P.danger,
                }}>
                  {uploadMessage}
                  {driveLink && (
                    <div style={{ marginTop: 8 }}>
                      <a href={driveLink} target="_blank" rel="noreferrer"
                        style={{ color: P.primary, fontWeight: 600, textDecoration: "underline" }}>
                        → Google Driveで開く
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div style={{ padding: 12, background: "#f9f8f6", borderRadius: 8, fontSize: 12, color: P.sub, lineHeight: 1.6 }}>
                💡 ファイル名：<strong>{getFileName()}.pdf</strong><br />
                保存先：Google Drive 指定フォルダ<br />
                仕様：テキスト検索・コピー可能なPDF（Googleドキュメント経由で生成）
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
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
