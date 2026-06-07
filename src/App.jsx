import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "vzla_cambio_cache";
const CACHE_TTL = 12 * 60 * 60 * 1000;
const APP_URL = typeof window !== "undefined" ? window.location.href : "https://claude.ai";

const FALLBACK_RATES = {
  bcv: 567.68,
  euro: 655.38,
  usdt: 760.18,
  intervencion: 615.52,
};

/* ─── ESTILOS ─────────────────────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #0a0d12; font-family: 'Exo 2', sans-serif; color: #e2e8f0; min-height: 100vh; }

  .app {
    max-width: 420px; margin: 0 auto; min-height: 100vh;
    background: linear-gradient(160deg, #0f1420 0%, #0a0d12 60%, #0d1117 100%);
    display: flex; flex-direction: column; position: relative; overflow: hidden;
  }
  .app::before {
    content:''; position:fixed; top:-120px; left:-80px; width:320px; height:320px;
    background:radial-gradient(circle,rgba(207,48,48,0.08) 0%,transparent 70%);
    pointer-events:none; z-index:0;
  }
  .app::after {
    content:''; position:fixed; bottom:-80px; right:-60px; width:260px; height:260px;
    background:radial-gradient(circle,rgba(234,179,8,0.06) 0%,transparent 70%);
    pointer-events:none; z-index:0;
  }

  /* OFFLINE BANNER */
  .offline-banner {
    background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25);
    border-radius: 10px; padding: 8px 14px; margin: 0 16px 10px;
    font-size: 11px; color: #fbbf24; text-align: center;
    font-family: 'JetBrains Mono', monospace; position: relative; z-index:2;
  }

  /* HEADER */
  .header { padding: 24px 20px 14px; position: relative; z-index: 1; }
  .header-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .flag-accent { display:flex; gap:3px; align-items:center; }
  .flag-bar { height:18px; border-radius:2px; }
  .flag-bar.red   { background:#cf3030; width:6px; }
  .flag-bar.yellow{ background:#eab308; width:6px; }
  .flag-bar.blue  { background:#1e40af; width:6px; }
  .header-title { font-size:22px; font-weight:900; letter-spacing:-0.5px; color:#f1f5f9; }
  .header-title span { color:#eab308; }
  .sync-badge {
    display:flex; align-items:center; gap:5px;
    background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2);
    border-radius:20px; padding:3px 10px; font-size:11px; color:#4ade80;
    font-family:'JetBrains Mono',monospace; cursor:pointer; user-select:none;
  }
  .sync-badge.offline { background:rgba(245,158,11,0.1); border-color:rgba(245,158,11,0.25); color:#fbbf24; }
  .sync-dot { width:6px; height:6px; border-radius:50%; background:#4ade80; animation:pulse 2s infinite; }
  .sync-dot.loading { animation:spin 1s linear infinite; background:#facc15; border-radius:2px; }
  .sync-dot.offline-dot { background:#fbbf24; animation:none; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .last-update { font-size:11px; color:#64748b; font-family:'JetBrains Mono',monospace; margin-top:6px; }

  /* ACTION BUTTONS ROW */
  .action-row {
    display: flex; gap: 8px; padding: 0 16px; margin-bottom: 14px;
    position: relative; z-index: 1;
  }
  .action-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 9px 8px; border-radius: 12px; border: none; cursor: pointer;
    font-family: 'Exo 2', sans-serif; font-size: 12px; font-weight: 700;
    transition: all 0.18s ease; user-select: none;
  }
  .action-btn:active { transform: scale(0.95); }
  .btn-share  { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
  .btn-qr     { background: rgba(139,92,246,0.15); color: #a78bfa; border: 1px solid rgba(139,92,246,0.25); }
  .btn-wa-quote { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }

  /* RATES */
  .section-label {
    font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
    color:#475569; padding:0 20px; margin-bottom:10px; position:relative; z-index:1;
  }
  .rates-grid { padding:0 16px; display:flex; flex-direction:column; gap:10px; position:relative; z-index:1; }
  .rate-card {
    background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
    border-radius:16px; padding:14px 16px;
    display:flex; align-items:center; justify-content:space-between;
    transition:all .2s ease; position:relative; overflow:hidden;
  }
  .rate-card::before {
    content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:3px 0 0 3px;
  }
  .rate-card.bcv::before          { background:linear-gradient(to bottom,#3b82f6,#1d4ed8); }
  .rate-card.euro::before         { background:linear-gradient(to bottom,#8b5cf6,#6d28d9); }
  .rate-card.usdt::before         { background:linear-gradient(to bottom,#10b981,#059669); }
  .rate-card.intervencion::before { background:linear-gradient(to bottom,#f59e0b,#d97706); }
  .rate-card:active { transform:scale(0.98); background:rgba(255,255,255,0.05); }
  .rate-left { display:flex; align-items:center; gap:12px; }
  .rate-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
  .rate-icon.bcv          { background:rgba(59,130,246,0.15); }
  .rate-icon.euro         { background:rgba(139,92,246,0.15); }
  .rate-icon.usdt         { background:rgba(16,185,129,0.15); }
  .rate-icon.intervencion { background:rgba(245,158,11,0.15); }
  .rate-name { font-size:14px; font-weight:700; color:#f1f5f9; line-height:1.2; }
  .rate-subtitle { font-size:11px; color:#64748b; margin-top:1px; }
  .rate-value { text-align:right; }
  .rate-amount { font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:600; color:#f8fafc; line-height:1.2; }
  .rate-amount.loading-text { color:#475569; font-size:13px; animation:shimmer 1.5s infinite; }
  @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:1} }
  .rate-unit { font-size:10px; color:#64748b; text-align:right; font-family:'JetBrains Mono',monospace; }
  .source-tag {
    display:inline-block; font-size:9px; color:#4ade80;
    background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.15);
    border-radius:4px; padding:1px 5px; margin-top:2px;
    font-family:'JetBrains Mono',monospace; letter-spacing:.5px;
  }

  /* DIVIDER */
  .divider { height:1px; background:rgba(255,255,255,0.05); margin:16px 20px; position:relative; z-index:1; }

  /* CALCULATOR */
  .calculator { padding:0 16px; position:relative; z-index:1; flex:1; }
  .calc-title { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#475569; margin-bottom:12px; }
  .input-wrapper {
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
    border-radius:14px; padding:14px 16px;
    display:flex; align-items:center; gap:10px; margin-bottom:14px; transition:border-color .2s;
  }
  .input-wrapper:focus-within { border-color:rgba(234,179,8,0.4); background:rgba(234,179,8,0.03); }
  .input-label { font-size:12px; font-weight:700; color:#eab308; background:rgba(234,179,8,0.1); border-radius:6px; padding:3px 8px; white-space:nowrap; flex-shrink:0; }
  .bs-input { flex:1; background:none; border:none; outline:none; color:#f1f5f9; font-family:'JetBrains Mono',monospace; font-size:18px; font-weight:600; text-align:right; width:100%; }
  .bs-input::placeholder { color:#334155; }
  .results-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .result-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:14px; position:relative; overflow:hidden; }
  .result-card::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; border-radius:0 0 14px 14px; opacity:.6; }
  .result-card.bcv::after          { background:linear-gradient(to right,#3b82f6,#1d4ed8); }
  .result-card.euro::after         { background:linear-gradient(to right,#8b5cf6,#6d28d9); }
  .result-card.usdt::after         { background:linear-gradient(to right,#10b981,#059669); }
  .result-card.intervencion::after { background:linear-gradient(to right,#f59e0b,#d97706); }
  .result-label { font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748b; margin-bottom:6px; }
  .result-value { font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:600; color:#f1f5f9; word-break:break-all; }
  .result-value.empty { color:#334155; }
  .result-currency { font-size:10px; color:#475569; margin-top:2px; }

  /* CURRENCY TOGGLE */
  .currency-toggle {
    display: flex; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 14px;
    padding: 4px; gap: 4px; margin-bottom: 14px;
  }
  .toggle-btn {
    flex: 1; padding: 10px 8px; border: none; border-radius: 10px;
    font-family: 'Exo 2', sans-serif; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: all .2s ease; user-select: none;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    background: transparent; color: #475569;
  }
  .toggle-btn.active-bs {
    background: linear-gradient(135deg, #eab308, #ca8a04);
    color: #0a0d12; box-shadow: 0 2px 12px rgba(234,179,8,0.3);
  }
  .toggle-btn.active-usd {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: #fff; box-shadow: 0 2px 12px rgba(59,130,246,0.3);
  }
  .toggle-btn:not(.active-bs):not(.active-usd):active { background: rgba(255,255,255,0.06); }

  /* WA SEND BUTTON under calc */
  .wa-send-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; margin-top: 12px; padding: 12px;
    background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25);
    border-radius: 14px; color: #4ade80; font-family: 'Exo 2', sans-serif;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: all .18s;
    user-select: none;
  }
  .wa-send-btn:active { transform: scale(0.97); background: rgba(34,197,94,0.2); }
  .wa-send-btn:disabled { opacity: 0.4; cursor: default; }

  /* MODAL OVERLAY */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100;
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn .2s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal-sheet {
    background: #131820; border-radius: 24px 24px 0 0;
    width: 100%; max-width: 420px; padding: 24px 20px 36px;
    animation: slideUp .25s ease;
    border-top: 1px solid rgba(255,255,255,0.08);
  }
  @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  .modal-handle { width:40px; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; margin:0 auto 20px; }
  .modal-title { font-size:16px; font-weight:800; color:#f1f5f9; margin-bottom:18px; text-align:center; }

  /* SHARE OPTIONS */
  .share-options { display:flex; flex-direction:column; gap:10px; }
  .share-opt {
    display:flex; align-items:center; gap:14px;
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
    border-radius:14px; padding:14px 16px; cursor:pointer; transition:all .15s;
    user-select:none;
  }
  .share-opt:active { background:rgba(255,255,255,0.08); transform:scale(0.98); }
  .share-opt-icon { font-size:22px; width:36px; text-align:center; flex-shrink:0; }
  .share-opt-text { flex:1; }
  .share-opt-title { font-size:14px; font-weight:700; color:#f1f5f9; }
  .share-opt-desc  { font-size:11px; color:#64748b; margin-top:2px; }
  .share-opt-arrow { color:#475569; font-size:16px; }

  /* QR CONTAINER */
  .qr-wrap { display:flex; flex-direction:column; align-items:center; gap:14px; }
  .qr-box {
    background: #fff; border-radius: 16px; padding: 16px;
    display:flex; align-items:center; justify-content:center;
  }
  .qr-caption { font-size:11px; color:#64748b; text-align:center; font-family:'JetBrains Mono',monospace; line-height:1.6; }
  .qr-url { color:#eab308; font-size:10px; word-break:break-all; margin-top:4px; }

  /* MODAL CLOSE BTN */
  .modal-close {
    width:100%; margin-top:16px; padding:12px;
    background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
    border-radius:12px; color:#94a3b8; font-size:13px; font-weight:600;
    font-family:'Exo 2',sans-serif; cursor:pointer; transition:all .15s;
  }
  .modal-close:active { background:rgba(255,255,255,0.1); }

  /* COPY TOAST */
  .toast {
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    background:#1e293b; border:1px solid rgba(255,255,255,0.12);
    border-radius:10px; padding:9px 18px; font-size:12px; color:#94a3b8;
    font-family:'JetBrains Mono',monospace; z-index:200;
    animation: toastIn .25s ease;
    white-space:nowrap;
  }
  @keyframes toastIn { from{opacity:0;transform:translate(-50%,10px)} to{opacity:1;transform:translate(-50%,0)} }

  /* FOOTER */
  .footer { padding:20px 20px 28px; position:relative; z-index:1; margin-top:auto; }
  .footer-divider { height:1px; background:rgba(255,255,255,0.05); margin-bottom:14px; }
  .footer-text { text-align:center; font-size:10.5px; color:#475569; line-height:1.7; font-family:'JetBrains Mono',monospace; }
  .footer-text .highlight { color:#eab308; }
`;

/* ─── FETCH RATES ─────────────────────────────────────────────────────── */
async function fetchRates() {
  const results = { ...FALLBACK_RATES };
  let fromApi = false;

  // 1. dolarapi.com → BCV y Euro (fuente principal venezolana)
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares", { signal: AbortSignal.timeout(7000) });
    const data = await res.json();
    if (Array.isArray(data)) {
      const bcvData    = data.find(item => item.fuente === "bcv");
      const euroData   = data.find(item => item.fuente === "bcv" && item.moneda === "EUR");
      const paraleloData = data.find(item =>
        item.fuente === "paralelo" || item.fuente === "enparalelovzla" || item.fuente === "promedio"
      );

      if (bcvData?.promedio   && bcvData.promedio > 100)   { results.bcv   = bcvData.promedio;   fromApi = true; }
      if (euroData?.promedio  && euroData.promedio > 100)  { results.euro  = euroData.promedio; }
      // Si la API devuelve paralelo, lo usamos como referencia de USDT cuando Binance falla
      if (paraleloData?.promedio && paraleloData.promedio > 100) { results._paralelo = paraleloData.promedio; }
    }
  } catch (_) {}

  // 2. USDT vía Binance P2P promedio
  try {
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: "USDT", fiat: "VES", merchantCheck: false, page: 1, rows: 10, tradeType: "SELL" }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const prices = data?.data?.map(d => parseFloat(d.adv?.price)).filter(Boolean);
    if (prices?.length) { results.usdt = prices.reduce((a,b)=>a+b,0)/prices.length; fromApi = true; }
    else if (results._paralelo) results.usdt = results._paralelo; // fallback al paralelo
  } catch (_) {
    if (results._paralelo) results.usdt = results._paralelo;
  }

  // 3. Intervención Digital – tasa fija mensual BCV
  results.intervencion = 615.52;
  results._fromApi = fromApi;
  return results;
}

/* ─── HELPERS ─────────────────────────────────────────────────────────── */
function fmt(val) {
  if (!val) return "—";
  return val.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtConv(val) {
  if (!val || isNaN(val)) return null;
  if (val < 0.001) return val.toFixed(6);
  if (val < 1)     return val.toFixed(4);
  if (val < 1000)  return val.toFixed(2);
  return val.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function todayStr() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2,"0")}-${String(n.getMonth()+1).padStart(2,"0")}-${n.getFullYear()}`;
}
function lastUpdStr(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-VE",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
}

/* QR generator using qrserver.com (works offline via cached img after first load) */
function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a0d12`;
}

/* Build WhatsApp cotización message */
function buildWaQuote(rates, amount, calcMode, conv, today) {
  const num = parseFloat(String(amount).replace(",",".")) || 0;
  let msg = `🇻🇪 *Cotizaciones BCV - ${today}*\n\n`;
  msg += `🏦 Dólar BCV:         *${fmt(rates.bcv)} Bs/USD*\n`;
  msg += `💶 Euro BCV:          *${fmt(rates.euro)} Bs/EUR*\n`;
  msg += `₮  USDT Binance:     *${fmt(rates.usdt)} Bs/USDT*\n`;
  msg += `📱 Intervención Dig: *${fmt(rates.intervencion)} Bs/USD*\n`;
  if (num > 0) {
    const fromLabel = calcMode === "bs" ? `${fmt(num)} Bs` : `${fmtConv(num)} USD`;
    msg += `\n💱 *Conversión de ${fromLabel}:*\n`;
    if (calcMode === "bs") {
      if (conv.bcv != null)          msg += `  → USD BCV:     *${fmtConv(conv.bcv)} $*\n`;
      if (conv.euro != null)         msg += `  → EUR BCV:     *${fmtConv(conv.euro)} €*\n`;
      if (conv.usdt != null)         msg += `  → USDT:        *${fmtConv(conv.usdt)} ₮*\n`;
      if (conv.intervencion != null) msg += `  → USD Digital: *${fmtConv(conv.intervencion)} $*\n`;
    } else {
      if (conv.bcv != null)          msg += `  → Bs (BCV):     *${fmtConv(conv.bcv)} Bs*\n`;
      if (conv.euro != null)         msg += `  → Bs (Euro):    *${fmtConv(conv.euro)} Bs*\n`;
      if (conv.usdt != null)         msg += `  → Bs (USDT):    *${fmtConv(conv.usdt)} Bs*\n`;
      if (conv.intervencion != null) msg += `  → Bs (Digital): *${fmtConv(conv.intervencion)} Bs*\n`;
    }
  }
  msg += `\n_Cambio VES · Sincronización vía API_`;
  return msg;
}

/* ─── MAIN COMPONENT ──────────────────────────────────────────────────── */
export default function App() {
  const [rates, setRates]         = useState(FALLBACK_RATES);
  const [loading, setLoading]     = useState(false);
  const [fromApi, setFromApi]     = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isOnline, setIsOnline]   = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [calcMode, setCalcMode]   = useState("bs"); // "bs" | "usd"
  const [amount, setAmount]       = useState("");
  const [modal, setModal]         = useState(null); // null | 'share' | 'qr'
  const [toast, setToast]         = useState(null);
  const toastTimer = useRef(null);

  /* Online/offline listeners */
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* Show toast helper */
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  /* Load rates with localStorage cache */
  const loadRates = useCallback(async (force = false) => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached && !force) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setRates(data); setFromApi(!!data._fromApi); setLastUpdate(ts); return;
        }
      }
    } catch (_) {}
    if (!navigator.onLine) return; // offline: keep cache/fallback
    setLoading(true);
    try {
      const data = await fetchRates();
      setRates(data); setFromApi(!!data._fromApi);
      const ts = Date.now(); setLastUpdate(ts);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, ts })); } catch (_) {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRates(); }, [loadRates]);

  /* Derived – dual mode calculator */
  const inputNum = parseFloat(String(amount).replace(",",".")) || 0;

  // When mode=bs: input is Bolívares → results in foreign currency
  // When mode=usd: input is USD → results in Bolívares via each rate
  const conv = {
    bcv:          inputNum && rates.bcv          ? (calcMode==="bs" ? inputNum/rates.bcv          : inputNum*rates.bcv)          : null,
    euro:         inputNum && rates.euro         ? (calcMode==="bs" ? inputNum/rates.euro         : inputNum*rates.euro)         : null,
    usdt:         inputNum && rates.usdt         ? (calcMode==="bs" ? inputNum/rates.usdt         : inputNum*rates.usdt)         : null,
    intervencion: inputNum && rates.intervencion ? (calcMode==="bs" ? inputNum/rates.intervencion : inputNum*rates.intervencion) : null,
  };

  // Result labels & currencies change with mode
  const resultMeta = {
    bcv:          { label: calcMode==="bs" ? "USD BCV"     : "Bs · BCV",     currency: calcMode==="bs" ? "USD"   : "Bs.S" },
    euro:         { label: calcMode==="bs" ? "EUR BCV"     : "Bs · Euro",    currency: calcMode==="bs" ? "Euros" : "Bs.S" },
    usdt:         { label: calcMode==="bs" ? "USDT"        : "Bs · USDT",    currency: calcMode==="bs" ? "USDT"  : "Bs.S" },
    intervencion: { label: calcMode==="bs" ? "USD Digital" : "Bs · Digital", currency: calcMode==="bs" ? "USD"   : "Bs.S" },
  };
  const today = todayStr();

  const rateCards = [
    { id:"bcv",          icon:"🏦", name:"Dólar BCV",           subtitle:"Banco Central de Venezuela", value:rates.bcv,          unit:"Bs/USD",  src:"dolarapi.com"  },
    { id:"euro",         icon:"💶", name:"Euro BCV",             subtitle:"Cotización oficial EUR",     value:rates.euro,         unit:"Bs/EUR",  src:"dolarapi.com"  },
    { id:"usdt",         icon:"₮",  name:"USDT / Paralelo",      subtitle:"Binance P2P · Monitor",      value:rates.usdt,         unit:"Bs/USDT", src:"Binance P2P"   },
    { id:"intervencion", icon:"📱", name:"Intervención Digital", subtitle:"Tasa BCV Bancos Digital",    value:rates.intervencion, unit:"Bs/USD",  src:"BCV Mensual"   },
  ];

  /* ── Share actions ── */
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Cambio VES", text: "Cotizaciones BCV Venezuela", url: APP_URL });
        return;
      } catch (_) {}
    }
    setModal("share");
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(APP_URL); showToast("✓ Enlace copiado"); }
    catch (_) { showToast("No se pudo copiar"); }
  };

  const openWhatsAppShare = () => {
    const msg = `🇻🇪 *Cambio VES* – Tasas BCV al ${today}\nAbre la app: ${APP_URL}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const openBrowserShare = () => {
    if (navigator.share) { navigator.share({ title:"Cambio VES", url: APP_URL }); }
    else { copyLink(); }
    setModal(null);
  };

  /* ── WA Cotización ── */
  const sendWaCotizacion = () => {
    const msg = buildWaQuote(rates, amount, calcMode, conv, today);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* OFFLINE BANNER */}
        {!isOnline && (
          <div className="offline-banner">
            📵 Sin conexión · Mostrando cotizaciones guardadas
          </div>
        )}

        {/* HEADER */}
        <div className="header">
          <div className="header-top">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div className="flag-accent">
                <div className="flag-bar red"/><div className="flag-bar yellow"/><div className="flag-bar blue"/>
              </div>
              <div className="header-title">Cambio <span>VES</span></div>
            </div>
            <div className={`sync-badge ${!isOnline?"offline":""}`} onClick={() => loadRates(true)}>
              <div className={`sync-dot ${loading?"loading":!isOnline?"offline-dot":""}`}/>
              {loading ? "Actualizando…" : !isOnline ? "Sin internet" : fromApi ? "En vivo" : "Referencia"}
            </div>
          </div>
          {lastUpdate
            ? <div className="last-update">Actualizado: {lastUpdStr(lastUpdate)}</div>
            : <div className="last-update">Tasas al {today}</div>
          }
        </div>

        {/* ACTION ROW: Compartir · QR · Enviar cotización */}
        <div className="action-row">
          <button className="action-btn btn-share" onClick={handleShare}>
            🔗 Compartir
          </button>
          <button className="action-btn btn-qr" onClick={() => setModal("qr")}>
            ▦ QR
          </button>
          <button className="action-btn btn-wa-quote" onClick={sendWaCotizacion}>
            📤 Cotización
          </button>
        </div>

        {/* RATES */}
        <div className="section-label">Cotizaciones del día</div>
        <div className="rates-grid">
          {rateCards.map(card => (
            <div key={card.id} className={`rate-card ${card.id}`}>
              <div className="rate-left">
                <div className={`rate-icon ${card.id}`}>{card.icon}</div>
                <div>
                  <div className="rate-name">{card.name}</div>
                  <div className="rate-subtitle">{card.subtitle}</div>
                  <div className="source-tag">{card.src}</div>
                </div>
              </div>
              <div className="rate-value">
                <div className={`rate-amount ${loading?"loading-text":""}`}>
                  {loading ? "···" : fmt(card.value)}
                </div>
                <div className="rate-unit">{card.unit}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="divider"/>

        {/* CALCULATOR */}
        <div className="calculator">
          <div className="calc-title">⇄ Calculadora Convertible</div>

          {/* Currency mode toggle */}
          <div className="currency-toggle">
            <button
              className={`toggle-btn ${calcMode==="bs" ? "active-bs" : ""}`}
              onClick={() => { setCalcMode("bs"); setAmount(""); }}
            >
              <span>🇻🇪</span> Bolívares → Divisas
            </button>
            <button
              className={`toggle-btn ${calcMode==="usd" ? "active-usd" : ""}`}
              onClick={() => { setCalcMode("usd"); setAmount(""); }}
            >
              <span>💵</span> USD → Bolívares
            </button>
          </div>

          {/* Input */}
          <div className="input-wrapper">
            <span className="input-label" style={calcMode==="usd"?{background:"rgba(59,130,246,0.15)",color:"#60a5fa"}:{}}>
              {calcMode==="bs" ? "Bs.S" : "USD $"}
            </span>
            <input
              className="bs-input"
              type="number" inputMode="decimal"
              placeholder={calcMode==="bs" ? "Monto en bolívares" : "Monto en dólares"}
              value={amount} onChange={e => setAmount(e.target.value)}
            />
          </div>

          {/* Results */}
          <div className="results-grid">
            {rateCards.map(card => (
              <div key={card.id} className={`result-card ${card.id}`}>
                <div className="result-label">{resultMeta[card.id].label}</div>
                <div className={`result-value ${conv[card.id]==null?"empty":""}`}>
                  {conv[card.id]!=null ? fmtConv(conv[card.id]) : "—"}
                </div>
                <div className="result-currency">{resultMeta[card.id].currency}</div>
              </div>
            ))}
          </div>

          {/* Enviar cotización vía WhatsApp */}
          <button className="wa-send-btn" onClick={sendWaCotizacion}>
            <span style={{fontSize:18}}>💬</span>
            Enviar cotización por WhatsApp
          </button>
        </div>

        {/* FOOTER */}
        <div className="footer">
          <div className="footer-divider"/>
          <div className="footer-text">
            Sincronización vía API.<br/>
            Las cotizaciones del BCV son las oficiales vigentes para:{" "}
            <span className="highlight">{today}</span>.<br/>
            Se utiliza la API de Binance para obtener el promedio de USDT.
          </div>
        </div>
      </div>

      {/* ── MODAL: COMPARTIR ── */}
      {modal === "share" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Compartir app</div>
            <div className="share-options">
              <div className="share-opt" onClick={openWhatsAppShare}>
                <div className="share-opt-icon">💬</div>
                <div className="share-opt-text">
                  <div className="share-opt-title">WhatsApp</div>
                  <div className="share-opt-desc">Enviar enlace por mensaje</div>
                </div>
                <div className="share-opt-arrow">›</div>
              </div>
              <div className="share-opt" onClick={copyLink}>
                <div className="share-opt-icon">🔗</div>
                <div className="share-opt-text">
                  <div className="share-opt-title">Copiar enlace</div>
                  <div className="share-opt-desc">Para compartir en cualquier app</div>
                </div>
                <div className="share-opt-arrow">›</div>
              </div>
              <div className="share-opt" onClick={openBrowserShare}>
                <div className="share-opt-icon">🌐</div>
                <div className="share-opt-text">
                  <div className="share-opt-title">Más opciones</div>
                  <div className="share-opt-desc">Menú nativo del navegador</div>
                </div>
                <div className="share-opt-arrow">›</div>
              </div>
              <div className="share-opt" onClick={() => { setModal("qr"); }}>
                <div className="share-opt-icon">▦</div>
                <div className="share-opt-text">
                  <div className="share-opt-title">Código QR</div>
                  <div className="share-opt-desc">Escanear para abrir</div>
                </div>
                <div className="share-opt-arrow">›</div>
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* ── MODAL: QR ── */}
      {modal === "qr" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Código QR</div>
            <div className="qr-wrap">
              <div className="qr-box">
                <img
                  src={qrUrl(APP_URL)}
                  alt="QR Cambio VES"
                  width={200} height={200}
                  style={{borderRadius:8,display:"block"}}
                />
              </div>
              <div className="qr-caption">
                Escanea para abrir la app<br/>
                <span className="qr-url">{APP_URL}</span>
              </div>
              <div className="share-options" style={{width:"100%"}}>
                <div className="share-opt" onClick={copyLink}>
                  <div className="share-opt-icon">🔗</div>
                  <div className="share-opt-text">
                    <div className="share-opt-title">Copiar enlace</div>
                    <div className="share-opt-desc">Para compartir manualmente</div>
                  </div>
                </div>
                <div className="share-opt" onClick={openWhatsAppShare}>
                  <div className="share-opt-icon">💬</div>
                  <div className="share-opt-text">
                    <div className="share-opt-title">Enviar por WhatsApp</div>
                    <div className="share-opt-desc">Compartir enlace por chat</div>
                  </div>
                </div>
              </div>
            </div>
            <button className="modal-close" onClick={() => setModal(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
