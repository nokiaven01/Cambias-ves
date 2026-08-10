import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "vzla_cambio_cache_v3";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas

const FALLBACK_RATES = {
  bcv: 602.33,          // BCV oficial USD — 18/06/2026 (bcv.today)
  euro: 698.22,         // Euro BCV oficial — 18/06/2026 (bcv.today)
  usdt: 780.00,
};

/* ─── MONEDAS DE LA CALCULADORA CONVERTIBLE ────────────────────────────── */
const CURRENCIES = [
  { id: "bs",   label: "Bs",   symbol: "Bs", icon: "🇻🇪", full: "Bolívares" },
  { id: "usd",  label: "USD",  symbol: "$",  icon: "💵", full: "Dólares" },
  { id: "eur",  label: "EUR",  symbol: "€",  icon: "💶", full: "Euros" },
  { id: "usdt", label: "USDT", symbol: "₮",  icon: "₮",  full: "Tether USDT" },
];

/* Valor en Bolívares de 1 unidad de la moneda indicada, según las tasas actuales. */
function rateToBs(id, rates) {
  switch (id) {
    case "bs":   return 1;
    case "usd":  return rates.bcv;
    case "eur":  return rates.euro;
    case "usdt": return rates.usdt;
    default:     return null;
  }
}

/* ─── BANCOS NACIONALES DE VENEZUELA (código IBP · nombre) ─────────────── */
const BANCOS_VE = [
  { code: "0102", name: "Banco de Venezuela" },
  { code: "0104", name: "Banco Venezolano de Crédito" },
  { code: "0105", name: "Banco Mercantil" },
  { code: "0108", name: "Banco Provincial (BBVA)" },
  { code: "0114", name: "Bancaribe" },
  { code: "0115", name: "Banco Exterior" },
  { code: "0128", name: "Banco Caroní" },
  { code: "0134", name: "Banesco" },
  { code: "0137", name: "Banco Sofitasa" },
  { code: "0138", name: "Banco Plaza" },
  { code: "0146", name: "Bangente" },
  { code: "0151", name: "BFC Banco Fondo Común" },
  { code: "0156", name: "100% Banco" },
  { code: "0157", name: "DelSur Banco Universal" },
  { code: "0163", name: "Banco del Tesoro" },
  { code: "0166", name: "Banco Agrícola de Venezuela" },
  { code: "0168", name: "Bancrecer" },
  { code: "0169", name: "Mi Banco" },
  { code: "0171", name: "Banco Activo" },
  { code: "0172", name: "Bancamiga" },
  { code: "0173", name: "Banco Internacional de Desarrollo" },
  { code: "0174", name: "Banplus" },
  { code: "0175", name: "Banco Bicentenario del Pueblo" },
  { code: "0177", name: "Banco de la FANB (Banfanb)" },
  { code: "0191", name: "Banco Nacional de Crédito (BNC)" },
];

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

  /* RATES */
  .section-label {
    font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
    color:#475569; padding:0 20px; margin-bottom:10px; position:relative; z-index:1;
  }
  .rates-grid { padding:0 16px; display:flex; flex-direction:column; gap:7px; position:relative; z-index:1; }
  .rate-card {
    background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
    border-radius:12px; padding:9px 12px;
    display:flex; align-items:center; justify-content:space-between;
    transition:all .2s ease; position:relative; overflow:hidden;
  }
  .rate-card::before {
    content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:3px 0 0 3px;
  }
  .rate-card.bcv::before          { background:linear-gradient(to bottom,#3b82f6,#1d4ed8); }
  .rate-card.euro::before         { background:linear-gradient(to bottom,#8b5cf6,#6d28d9); }
  .rate-card.usdt::before         { background:linear-gradient(to bottom,#10b981,#059669); }
  .rate-card:active { transform:scale(0.98); background:rgba(255,255,255,0.05); }
  .rate-left { display:flex; align-items:center; gap:9px; }
  .rate-icon { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
  .rate-icon-img { width:22px; height:22px; object-fit:contain; display:block; }
  .rate-icon.bcv          { background:rgba(59,130,246,0.15); }
  .rate-icon.euro         { background:rgba(139,92,246,0.15); }
  .rate-icon.usdt         { background:rgba(16,185,129,0.15); }
  .rate-name { font-size:12.5px; font-weight:700; color:#f1f5f9; line-height:1.15; }
  .rate-subtitle { font-size:10px; color:#64748b; margin-top:1px; }
  .rate-value { text-align:right; }
  .rate-amount { font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:600; color:#f8fafc; line-height:1.15; }
  .rate-amount.loading-text { color:#475569; font-size:12px; animation:shimmer 1.5s infinite; }
  @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:1} }
  .rate-unit { font-size:9px; color:#64748b; text-align:right; font-family:'JetBrains Mono',monospace; }
  .source-tag {
    display:inline-block; font-size:8px; color:#4ade80;
    background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.15);
    border-radius:4px; padding:1px 4px; margin-top:2px;
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
  .result-label { font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#64748b; margin-bottom:6px; }
  .result-value { font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:600; color:#f1f5f9; word-break:break-all; }
  .result-value.empty { color:#334155; }
  .result-currency { font-size:10px; color:#475569; margin-top:2px; }

  /* EXTRA CONVERSION ROW (Bs↔USD inline summary) */
  .extra-conv {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .extra-conv-label { font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace; }
  .extra-conv-value { font-size: 14px; font-weight: 700; color: #eab308; font-family: 'JetBrains Mono', monospace; }
  .extra-conv-unit  { font-size: 10px; color: #475569; }

  /* FUEL CALCULATOR CARD */
  .fuel-card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 12px 14px; position: relative; overflow: hidden;
    grid-column: span 2;
  }
  .fuel-card::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
    border-radius: 0 0 14px 14px;
    background: linear-gradient(to right, #f97316, #eab308);
    opacity: 0.7;
  }
  .fuel-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    border-radius: 3px 0 0 3px;
    background: linear-gradient(to bottom, #f97316, #eab308);
  }
  .fuel-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  }
  .fuel-icon {
    width: 28px; height: 28px; border-radius: 8px;
    background: rgba(249,115,22,0.15); display: flex; align-items: center;
    justify-content: center; font-size: 15px; flex-shrink: 0;
  }
  .fuel-title { font-size: 12px; font-weight: 700; color: #f1f5f9; }
  .fuel-subtitle { font-size: 10px; color: #64748b; margin-top: 1px; }
  .fuel-rows { display: flex; flex-direction: column; gap: 6px; }
  .fuel-row {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(0,0,0,0.2); border-radius: 8px; padding: 7px 10px;
  }
  .fuel-row-left { display: flex; flex-direction: column; }
  .fuel-row-type { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; }
  .fuel-row-price { font-size: 9px; color: #475569; font-family: 'JetBrains Mono', monospace; margin-top: 1px; }
  .fuel-row-liters { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 700; color: #f97316; }
  .fuel-row-unit { font-size: 9px; color: #64748b; margin-top: 1px; text-align: right; }
  .fuel-empty { color: #334155; }

  /* Litros deseados → costo en Bs y USD */
  .fuel-litros-block { margin-top: 4px; }
  .fuel-litros-label { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
  .fuel-input-wrapper {
    display: flex; align-items: center; gap: 8px;
    background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.25);
    border-radius: 10px; padding: 8px 12px; transition: border-color .2s;
  }
  .fuel-input-wrapper:focus-within { border-color: rgba(249,115,22,0.5); background: rgba(249,115,22,0.1); }
  .fuel-litros-input { flex: 1; background: none; border: none; outline: none; color: #f1f5f9; font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; text-align: right; width: 100%; }
  .fuel-litros-input::placeholder { color: #334155; }
  .fuel-litros-unit { font-size: 12px; font-weight: 700; color: #f97316; background: rgba(249,115,22,0.12); border-radius: 6px; padding: 3px 8px; flex-shrink: 0; }
  .fuel-cost-bs { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: #eab308; }
  .fuel-cost-usd { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: #4ade80; margin-top: 1px; }

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

  /* CONVERSOR MULTI-MONEDA — 4 cuadros (Bs / USD / EUR / USDT) en 2x2 */
  .cur-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;
  }
  .cur-box {
    display: flex; flex-direction: column; justify-content: center; gap: 4px;
    min-height: 62px; padding: 9px 12px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 13px; cursor: text; transition: border-color .2s, background .2s;
  }
  .cur-box.active {
    border-color: rgba(234,179,8,0.5); background: rgba(234,179,8,0.06);
    box-shadow: 0 0 0 1px rgba(234,179,8,0.25);
  }
  .cur-box-head { display: flex; align-items: center; gap: 6px; }
  .cur-box-icon { font-size: 14px; line-height: 1; }
  .cur-box-label {
    font-size: 11px; font-weight: 800; letter-spacing: 0.5px; color: #94a3b8;
  }
  .cur-box.active .cur-box-label { color: #eab308; }
  .cur-box-input {
    background: none; border: none; outline: none; width: 100%; padding: 0;
    color: #f1f5f9; font-family: 'JetBrains Mono', monospace;
    font-size: 17px; font-weight: 700;
  }
  .cur-box.active .cur-box-input { color: #eab308; }
  .cur-box-input::placeholder { color: #334155; }

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

  /* ACCIONES LADO A LADO (Pago/Cobro + Apoya este proyecto) */
  .action-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-top: 14px;
  }
  .action-btn {
    position: relative; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; min-height: 62px; padding: 9px 8px;
    border-radius: 13px; cursor: pointer; user-select: none;
    font-family: 'Exo 2', sans-serif; font-weight: 800; text-align: center;
    transition: transform .16s ease;
  }
  .action-btn:active { transform: scale(0.97); }
  .action-icon { font-size: 18px; line-height: 1; }
  .action-text { font-size: 11px; line-height: 1.15; }

  .action-btn.wa-action {
    background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3);
    color: #4ade80;
  }
  .action-btn.wa-action:active { background: rgba(34,197,94,0.2); }

  .action-btn.donate-action {
    color: #fff; border: 1.5px solid rgba(255,255,255,0.35);
    text-shadow: 0 1px 3px rgba(0,0,0,0.45);
    background: linear-gradient(135deg, #f97316, #eab308, #ec4899, #8b5cf6, #3b82f6, #10b981, #f97316);
    background-size: 300% 300%;
    animation: donateGradient 6s ease infinite, donateGlow 3s ease-in-out infinite;
  }
  .action-badge {
    position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
    font-size: 7px; font-weight: 900; letter-spacing: 0.4px; white-space: nowrap;
    background: rgba(0,0,0,0.3); color: #fff; padding: 1px 5px; border-radius: 5px;
  }
  .action-btn.donate-action .action-text { margin-top: 4px; }
  .action-btn.donate-action .donate-chevron { font-size: 11px; }

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

  /* PAGO MÓVIL FORM (cotización WhatsApp) */
  .pm-intro { font-size:12px; color:#94a3b8; text-align:center; margin:-8px 0 16px; line-height:1.5; }
  .pm-toggle {
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.2);
    border-radius:12px; padding:11px 14px; margin-bottom:14px; cursor:pointer; user-select:none;
  }
  .pm-toggle-text { font-size:13px; font-weight:700; color:#fbbf24; display:flex; align-items:center; gap:8px; }
  .pm-switch { width:40px; height:22px; border-radius:20px; background:rgba(255,255,255,0.12); position:relative; transition:all .2s; flex-shrink:0; }
  .pm-switch.on { background:rgba(234,179,8,0.5); }
  .pm-switch::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#f1f5f9; transition:all .2s; }
  .pm-switch.on::after { left:20px; }
  .pm-form { display:flex; flex-direction:column; gap:10px; margin-bottom:6px; }
  .pm-field { display:flex; flex-direction:column; gap:5px; }
  .pm-field-label { font-size:11px; font-weight:700; color:#94a3b8; letter-spacing:0.3px; padding-left:2px; }
  .pm-input {
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
    border-radius:10px; padding:11px 13px; color:#f1f5f9;
    font-family:'Exo 2',sans-serif; font-size:14px; font-weight:600; outline:none; transition:all .15s; width:100%;
  }
  .pm-input:focus { border-color:rgba(234,179,8,0.4); background:rgba(234,179,8,0.04); }
  .pm-input::placeholder { color:#475569; font-weight:400; }

  /* SELECTOR DE BANCO (desplegable) */
  .pm-bank-select { position:relative; }
  .pm-bank-trigger {
    width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px;
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
    border-radius:10px; padding:11px 13px; cursor:pointer; user-select:none;
    font-family:'Exo 2',sans-serif; transition:all .15s; text-align:left;
  }
  .pm-bank-trigger:active { transform:scale(0.99); }
  .pm-bank-trigger.open { border-color:rgba(234,179,8,0.4); background:rgba(234,179,8,0.04); }
  .pm-bank-current { font-size:14px; font-weight:600; color:#f1f5f9; }
  .pm-bank-placeholder { font-size:14px; font-weight:400; color:#475569; }
  .pm-bank-arrow { color:#94a3b8; font-size:11px; transition:transform .2s; flex-shrink:0; }
  .pm-bank-arrow.open { transform:rotate(180deg); }
  .pm-bank-list {
    margin-top:8px; max-height:230px; overflow-y:auto;
    background:rgba(15,20,32,0.98); border:1px solid rgba(255,255,255,0.12);
    border-radius:12px; padding:5px; display:flex; flex-direction:column; gap:2px;
    box-shadow:0 12px 30px rgba(0,0,0,0.45);
  }
  .pm-bank-list::-webkit-scrollbar { width:6px; }
  .pm-bank-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:6px; }
  .pm-bank-item {
    display:flex; align-items:center; gap:10px; padding:9px 10px;
    border-radius:9px; cursor:pointer; transition:background .12s;
  }
  .pm-bank-item:active { background:rgba(255,255,255,0.06); }
  .pm-bank-item.sel { background:rgba(234,179,8,0.14); }
  .pm-bank-code {
    font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; color:#eab308;
    background:rgba(234,179,8,0.1); border-radius:6px; padding:3px 7px; flex-shrink:0; min-width:44px; text-align:center;
  }
  .pm-bank-name { font-size:13px; font-weight:600; color:#e2e8f0; line-height:1.25; }
  .pm-send-btn {
    display:flex; align-items:center; justify-content:center; gap:8px;
    width:100%; margin-top:8px; padding:14px;
    background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3);
    border-radius:14px; color:#4ade80; font-family:'Exo 2',sans-serif;
    font-size:14px; font-weight:800; cursor:pointer; transition:all .18s; user-select:none;
  }
  .pm-send-btn:active { transform:scale(0.97); background:rgba(34,197,94,0.25); }

  /* SELECTOR DE TASA PARA EL PAGO */
  .pm-section-label { font-size:11px; font-weight:800; color:#94a3b8; letter-spacing:0.5px; text-transform:uppercase; margin:4px 0 10px; }
  .pm-rates { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; }
  .pm-rate-chip {
    display:flex; flex-direction:column; gap:2px;
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
    border-radius:12px; padding:10px 12px; cursor:pointer; transition:all .15s; user-select:none;
  }
  .pm-rate-chip:active { transform:scale(0.97); }
  .pm-rate-chip.sel { background:rgba(34,197,94,0.12); border-color:rgba(34,197,94,0.45); }
  .pm-rate-name { font-size:13px; font-weight:700; color:#f1f5f9; display:flex; align-items:center; gap:6px; }
  .pm-rate-val { font-size:12px; color:#94a3b8; font-family:'JetBrains Mono',monospace; }
  .pm-rate-chip.sel .pm-rate-val { color:#4ade80; }

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

  /* DONATIONS */
  .donate-section {
    margin: 8px 16px 0; padding: 20px 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px; position: relative; z-index: 1; overflow: hidden;
  }
  .donate-section::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, #eab308, #f97316, #ec4899, #8b5cf6, #3b82f6, #10b981);
    border-radius: 20px 20px 0 0;
  }
  .donate-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
  }
  .donate-heart {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, rgba(236,72,153,0.2), rgba(239,68,68,0.2));
    border: 1px solid rgba(236,72,153,0.25);
    display: flex; align-items: center; justify-content: center; font-size: 18px;
    flex-shrink: 0;
  }
  .donate-title { font-size: 14px; font-weight: 800; color: #f1f5f9; }
  .donate-subtitle { font-size: 11px; color: #64748b; margin-top: 1px; }

  .donate-method {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 13px 14px; margin-bottom: 10px;
    position: relative; overflow: hidden;
  }
  .donate-method:last-child { margin-bottom: 0; }
  .donate-method::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px; border-radius: 3px 0 0 3px;
  }
  .donate-method.pago-movil::before { background: linear-gradient(to bottom, #eab308, #f97316); }
  .donate-method.trc20::before      { background: linear-gradient(to bottom, #ef4444, #dc2626); }
  .donate-method.erc20::before      { background: linear-gradient(to bottom, #8b5cf6, #6d28d9); }
  .donate-method.bep20::before      { background: linear-gradient(to bottom, #f59e0b, #92400e); }

  .donate-method-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
  }
  .donate-method-left { display: flex; align-items: center; gap: 8px; }
  .donate-method-icon {
    width: 28px; height: 28px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
  }
  .donate-method-icon.pago-movil { background: rgba(234,179,8,0.15); }
  .donate-method-icon.trc20      { background: rgba(239,68,68,0.15); }
  .donate-method-icon.erc20      { background: rgba(139,92,246,0.15); }
  .donate-method-icon.bep20      { background: rgba(245,158,11,0.15); }

  .donate-method-name { font-size: 12px; font-weight: 700; color: #f1f5f9; }
  .donate-method-tag  { font-size: 9px; color: #64748b; margin-top: 1px; font-family: 'JetBrains Mono', monospace; }

  .donate-copy-btn {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600;
    color: #94a3b8; font-family: 'Exo 2', sans-serif; cursor: pointer;
    transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .donate-copy-btn:active { background: rgba(255,255,255,0.12); color: #f1f5f9; transform: scale(0.95); }

  .donate-row {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(0,0,0,0.2); border-radius: 8px; padding: 7px 10px; margin-bottom: 6px;
  }
  .donate-row:last-child { margin-bottom: 0; }
  .donate-row-label { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .donate-row-value { font-size: 12px; font-weight: 600; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; word-break: break-all; }
  .donate-row-copy  { font-size: 14px; cursor: pointer; padding: 2px 4px; flex-shrink: 0; opacity: .7; transition: opacity .15s; }
  .donate-row-copy:active { opacity: 1; }

  .donate-wallet {
    background: rgba(0,0,0,0.2); border-radius: 10px; padding: 10px 12px;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
  }
  .donate-wallet-addr {
    font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #cbd5e1;
    word-break: break-all; line-height: 1.6; flex: 1;
  }
  .donate-wallet-copy {
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; padding: 5px 9px; font-size: 11px; font-weight: 600;
    color: #94a3b8; font-family: 'Exo 2', sans-serif; cursor: pointer;
    transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .donate-wallet-copy:active { background: rgba(255,255,255,0.14); color: #f1f5f9; transform: scale(0.95); }
  .donate-thanks {
    text-align: center; font-size: 11px; color: #475569; margin-top: 14px;
    font-family: 'JetBrains Mono', monospace; line-height: 1.6;
  }
  .donate-thanks span { color: #ec4899; }

  /* DONATE TOGGLE BUTTON — anuncio importante con colores animados */
  @keyframes donateGradient {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes donateGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(249,115,22,0.55), 0 0 22px rgba(236,72,153,0.35); }
    50%      { box-shadow: 0 0 20px rgba(139,92,246,0.7), 0 0 34px rgba(59,130,246,0.45); }
  }
  @keyframes donatePulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.015); }
  }
  .donate-toggle-btn {
    display: flex; align-items: center; justify-content: space-between;
    width: calc(100% - 32px); margin: 16px 16px 4px;
    padding: 14px 16px;
    background: linear-gradient(90deg, #f97316, #eab308, #ec4899, #8b5cf6, #3b82f6, #10b981, #f97316);
    background-size: 300% 300%;
    border: 1.5px solid rgba(255,255,255,0.35);
    border-radius: 14px; color: #fff; font-family: 'Exo 2', sans-serif;
    font-size: 14px; font-weight: 800; letter-spacing: 0.3px; cursor: pointer;
    text-shadow: 0 1px 3px rgba(0,0,0,0.45);
    user-select: none; position: relative; z-index: 1; overflow: hidden;
    animation: donateGradient 6s ease infinite, donateGlow 3s ease-in-out infinite, donatePulse 2.5s ease-in-out infinite;
  }
  .donate-toggle-btn:active { transform: scale(0.98); }
  .donate-toggle-btn-left { display: flex; align-items: center; gap: 8px; }
  .donate-toggle-btn-left::before {
    content: '★ IMPORTANTE'; font-size: 8px; font-weight: 900; letter-spacing: 1px;
    background: rgba(0,0,0,0.28); color: #fff; padding: 2px 6px; border-radius: 6px;
    margin-right: 2px; white-space: nowrap;
  }
  .donate-chevron {
    font-size: 14px; transition: transform .25s ease; display: inline-block; color: #fff;
  }
  .donate-chevron.open { transform: rotate(180deg); }

  /* DONATE COLLAPSIBLE BODY */
  .donate-body {
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.35s ease, opacity 0.25s ease;
    opacity: 0;
    margin: 0 16px;
  }
  .donate-body.open {
    max-height: 1200px;
    opacity: 1;
  }
`;

/* ─── FETCH RATES ─────────────────────────────────────────────────────── */
async function fetchRates() {
  const results = { ...FALLBACK_RATES };
  let fromApi = false;

  // 0. FUENTE OFICIAL PROPIA: /api/bcv (función serverless de Vercel que scrapea el
  //    BCV directamente, mismo origen, sin CORS ni dependencia de terceros).
  //    Respuesta: { ok, usd:{valor}, eur:{valor}, fecha_valor, ... }
  try {
    const res = await fetch("/api/bcv", {
      cache: "no-cache",
      signal: AbortSignal.timeout(7000),
    });
    const data = await res.json();
    if (data?.ok) {
      if (data.usd?.valor > 100) { results.bcv  = data.usd.valor; fromApi = true; }
      if (data.eur?.valor > 100) { results.euro = data.eur.valor; fromApi = true; }
    }
  } catch (_) {}

  // 1. FALLBACK USD+EUR: bcv.today/api/v1/rate.json
  //    JSON estático sin API key, CORS abierto, devuelve USD + EUR en un solo request.
  //    Formato: { USD: 602.33, EUR: 698.22, updated_at, effective_date, date }
  if (!fromApi) {
    try {
      const res = await fetch("https://bcv.today/api/v1/rate.json", {
        cache: "no-cache",
        signal: AbortSignal.timeout(7000),
      });
      const data = await res.json();
      if (data?.USD && data.USD > 100) { results.bcv  = data.USD; fromApi = true; }
      if (data?.EUR && data.EUR > 100) { results.euro = data.EUR; fromApi = true; }
    } catch (_) {}
  }

  // 2. FALLBACK USD+EUR: jsDelivr CDN (espejo del mismo repo de bcv.today)
  if (!fromApi) {
    try {
      const res = await fetch(
        "https://cdn.jsdelivr.net/gh/grupoclip/bcv-api/api/v1/rate.json",
        { cache: "no-cache", signal: AbortSignal.timeout(7000) }
      );
      const data = await res.json();
      if (data?.USD && data.USD > 100) { results.bcv  = data.USD; fromApi = true; }
      if (data?.EUR && data.EUR > 100) { results.euro = data.EUR; fromApi = true; }
    } catch (_) {}
  }

  // 3. FALLBACK USD: ve.dolarapi.com (solo si aun no tenemos USD)
  if (results.bcv === FALLBACK_RATES.bcv) {
    try {
      const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(7000) });
      const data = await res.json();
      if (data?.promedio && data.promedio > 100) { results.bcv = data.promedio; fromApi = true; }
    } catch (_) {}
  }

  // 4. FALLBACK EURO: bcv-api.deno.dev (solo si aun no tenemos EUR)
  if (results.euro === FALLBACK_RATES.euro) {
    try {
      const res = await fetch("https://bcv-api.deno.dev/v1/exchange/euro", { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (data?.exchange && data.exchange > 100) { results.euro = data.exchange; fromApi = true; }
    } catch (_) {}
  }

  // 5. USDT via Criptoya (Binance P2P) — precio minuto a minuto
  //    GET https://criptoya.com/api/binancep2p/USDT/VES/1
  //    Respuesta: { ask, totalAsk, bid, totalBid, time }
  try {
    const res = await fetch("https://criptoya.com/api/binancep2p/USDT/VES/1", {
      cache: "no-cache",
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const price = parseFloat(data?.ask ?? data?.totalAsk ?? data?.bid);
    if (price && price > 100) { results.usdt = price; fromApi = true; }
  } catch (_) {}

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
/* Formato de monto VE para el input usando Intl.NumberFormat (es-VE).
   - Agrupa miles con "." y usa "," como separador decimal.
   - Permite escribir decimales en vivo (no fuerza los 2 decimales mientras escribes).
   - La precisión exacta de 2 decimales se aplica al salir del campo (blurAmount). */
const veIntFmt = new Intl.NumberFormat("es-VE", { style: "decimal", maximumFractionDigits: 0 });
function formatVEInput(amount) {
  if (amount === "" || amount == null) return "";
  const [intStr, decStr] = String(amount).split(".");
  const intNum = parseInt(intStr || "0", 10) || 0;
  const intFmt = veIntFmt.format(intNum);
  if (decStr === undefined) return intFmt;       // aún sin coma
  return `${intFmt},${decStr.slice(0, 2)}`;       // conserva lo que escribe (máx 2)
}
/* Normaliza lo que escribe el usuario a un número limpio ("1234.56"), máx 2 decimales.
   Detección inteligente del separador decimal:
   - Si hay coma → la coma es el decimal (convención venezolana), los puntos son miles.
   - Si solo hay puntos → el último punto se toma como decimal si lo siguen ≤2 dígitos
     (ej: "1650.15" → 1650.15); si lo siguen 3+ dígitos, todos los puntos son miles
     (ej: "1.234.567" → 1234567). Los miles se agrupan solos al mostrar. */
function cleanVEAmount(value) {
  let v = String(value).replace(/[^0-9.,]/g, "");
  if (v.includes(",")) {
    const li = v.lastIndexOf(",");
    const intp = v.slice(0, li).replace(/\D/g, "");
    const dec = v.slice(li + 1).replace(/\D/g, "").slice(0, 2);
    return `${intp}.${dec}`;
  }
  if (v.includes(".")) {
    const li = v.lastIndexOf(".");
    const after = v.slice(li + 1).replace(/\D/g, "");
    if (after.length <= 2) {
      const intp = v.slice(0, li).replace(/\D/g, "");
      return `${intp}.${after}`;
    }
    return v.replace(/\./g, "");
  }
  return v;
}
/* Formato de precisión final: 2 decimales exactos (es-VE) */
function toPreciseAmount(amount) {
  const n = parseFloat(amount);
  return isNaN(n) ? "" : n.toFixed(2);
}
function todayStr() {
  const n = new Date();
  return `${String(n.getDate()).padStart(2,"0")}-${String(n.getMonth()+1).padStart(2,"0")}-${n.getFullYear()}`;
}
function lastUpdStr(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-VE",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"});
}

/* Build WhatsApp cotización message */
function buildWaQuote(rates, amountInBs, activeCur, today, pagoMovil, tasaPago) {
  let msg = `🇻🇪 *Cotizaciones BCV - ${today}*\n`;
  if (amountInBs > 0) {
    const activeMeta = CURRENCIES.find(c => c.id === activeCur) || CURRENCIES[0];
    const activeVal = activeCur === "bs" ? amountInBs : amountInBs / rateToBs(activeCur, rates);
    msg += `\n💱 *Conversión de ${fmtConv(activeVal)} ${activeMeta.label}:*\n`;
    CURRENCIES.filter(c => c.id !== activeCur).forEach(c => {
      const r = rateToBs(c.id, rates);
      if (r) msg += `  → ${c.label}: *${fmtConv(amountInBs / r)}*\n`;
    });
  }
  // Tasa elegida para realizar el pago
  if (tasaPago && rates[tasaPago] != null) {
    const TASA_LABELS = {
      bcv: "Dólar BCV", euro: "Euro BCV", usdt: "USDT",
    };
    const TASA_UNIT = {
      bcv: "Bs/USD", euro: "Bs/EUR", usdt: "Bs/USDT",
    };
    msg += `\n💲 *El pago debe realizarse a la tasa ${TASA_LABELS[tasaPago]}: ${fmt(rates[tasaPago])} ${TASA_UNIT[tasaPago]}*\n`;
  }
  // Datos de Pago Móvil (opcional, los llena el usuario antes de enviar)
  if (pagoMovil) {
    const pmRows = [
      { label: "🏦 Banco",    value: pagoMovil.banco },
      { label: "📱 Teléfono", value: pagoMovil.telefono },
      { label: "🪪 Cédula/RIF", value: pagoMovil.cedula },
      { label: "👤 Titular",  value: pagoMovil.titular },
    ].filter(r => r.value && String(r.value).trim());
    if (pmRows.length) {
      msg += `\n\n📲 *Datos para Pago Móvil:*\n`;
      pmRows.forEach(r => { msg += `${r.label}: *${String(r.value).trim()}*\n`; });
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
  const [activeCur, setActiveCur] = useState("bs"); // cuadro que el usuario está editando
  const [amount, setAmount]       = useState("");    // monto escrito en el cuadro activo
  const [litros, setLitros]       = useState(""); // litros deseados para calcular costo
  const [modal, setModal]         = useState(null); // null | 'cotizacion'
  const [toast, setToast]         = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const toastTimer = useRef(null);

  /* Datos de Pago Móvil del usuario (se guardan localmente para no reescribirlos) */
  const PM_KEY = "vzla_pago_movil_v1";
  const [incluirPago, setIncluirPago] = useState(true);
  const [bancoOpen, setBancoOpen] = useState(false); // desplegable de bancos
  const [tasaPago, setTasaPago] = useState("bcv"); // tasa elegida para el pago
  const [pagoMovil, setPagoMovil] = useState(() => {
    try {
      const saved = localStorage.getItem(PM_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { banco: "", telefono: "", cedula: "", titular: "" };
  });
  const updatePago = (field, value) => {
    setPagoMovil(prev => {
      const next = { ...prev, [field]: value };
      try { localStorage.setItem(PM_KEY, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

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

  /* Monto estilo "centavos": los dígitos entran por la derecha, los 2 últimos
     son decimales. Formatea en vivo (es-VE) sin saltos de cursor ni ambigüedad. */
  const veMontoFmt = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const handleAmountChange = (e) => {
    const soloNumeros = e.target.value.replace(/\D/g, "");
    if (!soloNumeros) { setAmount(""); return; }
    const numeroFlotante = parseInt(soloNumeros, 10) / 100;
    setAmount(veMontoFmt.format(numeroFlotante));
  };

  /* Al elegir otro cuadro de moneda, se limpia el monto para escribir uno nuevo. */
  const selectCur = (id) => {
    setActiveCur(prev => {
      if (prev !== id) setAmount("");
      return id;
    });
  };

  /* Litros deseados: permite dígitos y un separador decimal (coma o punto). */
  const handleLitrosChange = (e) => {
    let v = e.target.value.replace(/[^\d.,]/g, "").replace(/,/g, ".");
    const parts = v.split(".");
    if (parts.length > 1) v = parts[0] + "." + parts.slice(1).join("");
    setLitros(v);
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

  useEffect(() => {
    loadRates();
    const interval = setInterval(() => loadRates(true), 2 * 60 * 60 * 1000); // auto-actualizar cada 2h
    return () => clearInterval(interval);
  }, [loadRates]);

  /* Derived – calculadora convertible entre 4 monedas (Bs, USD, EUR, USDT).
     El usuario escribe en cualquiera de los 4 cuadros (activeCur) y los otros
     se calculan automáticamente: monto activo → Bs → cada moneda. */
  const inputNum = parseFloat(cleanVEAmount(amount)) || 0;
  const activeBsRate = rateToBs(activeCur, rates);
  const amountInBs = inputNum && activeBsRate ? inputNum * activeBsRate : 0;

  // Valor mostrado en cada cuadro
  const curValues = {};
  CURRENCIES.forEach(c => {
    if (c.id === activeCur) {
      curValues[c.id] = amount; // el cuadro activo muestra lo que el usuario escribe
    } else {
      const r = rateToBs(c.id, rates);
      curValues[c.id] = amountInBs && r ? fmtConv(amountInBs / r) : "";
    }
  });

  // Precios de gasolina Venezuela 2026 (Bs/litro usando tasa BCV)
  const FUEL = [
    { id:"internacional", label:"Internacional",  priceUSD: 0.50,   priceBs: null,  tag:"Sin límite · Biopago/divisas" },
    { id:"premium",    label:"Super Premium 97",  priceUSD: 1.00,   priceBs: null,  tag:"Solo efectivo USD" },
  ].map(f => ({
    ...f,
    priceBs: f.priceUSD * (rates.bcv || FALLBACK_RATES.bcv),
  }));

  // Litros que dan según modo y monto
  // Costo de los litros deseados por el usuario (en Bs y USD según cada tipo)
  const litrosNum = parseFloat(litros) || 0;
  const fuelCosts = litrosNum > 0
    ? FUEL.map(f => ({ ...f, costBs: litrosNum * f.priceBs, costUSD: litrosNum * f.priceUSD }))
    : null;

  const today = todayStr();

  const rateCards = [
    { id:"bcv",  icon:"🏦", img:"https://commons.wikimedia.org/wiki/Special:FilePath/Banco_Central_de_Venezuela_logo.svg?width=120", name:"Dólar BCV", subtitle:"Banco Central de Venezuela", value:rates.bcv,  unit:"Bs/USD",  src:"bcv.today"    },
    { id:"euro", icon:"💶", img:"https://commons.wikimedia.org/wiki/Special:FilePath/Euro_symbol.svg?width=120",                     name:"Euro BCV",  subtitle:"Cotización oficial EUR",     value:rates.euro, unit:"Bs/EUR",  src:"bcv.today"    },
    { id:"usdt", icon:"₮",  img:"https://cryptologos.cc/logos/tether-usdt-logo.png",                                                  name:"USDT",      subtitle:"Binance P2P · Promedio",     value:rates.usdt, unit:"Bs/USDT", src:"Binance P2P"   },
  ];

  /* ── WA Cotización ── */
  // Abre el formulario de Pago Móvil antes de enviar
  const sendWaCotizacion = () => setModal("cotizacion");

  // Confirma y envía la cotización por WhatsApp (con o sin datos de Pago Móvil)
  const confirmWaCotizacion = () => {
    const pm = incluirPago ? pagoMovil : null;
    const msg = buildWaQuote(rates, amountInBs, activeCur, today, pm, tasaPago);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    setModal(null);
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

        {/* RATES */}
        <div className="section-label">Cotizaciones del día</div>
        <div className="rates-grid">
          {rateCards.map(card => (
            <div key={card.id} className={`rate-card ${card.id}`}>
              <div className="rate-left">
                <div className={`rate-icon ${card.id}`}>
                  {card.img
                    ? <img
                        src={card.img}
                        alt={card.name}
                        className="rate-icon-img"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentNode.textContent = card.icon; }}
                      />
                    : card.icon}
                </div>
                <div>
                  <div className="rate-name">{card.name}</div>
                  <div className="rate-subtitle">{card.subtitle}</div>
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

          {/* Conversor multi-moneda: 4 cuadros (Bs, USD, EUR, USDT).
              Escribe en cualquiera y los otros se calculan automáticamente. */}
          <div className="cur-grid">
            {CURRENCIES.map(c => {
              const isActive = c.id === activeCur;
              return (
                <div
                  key={c.id}
                  className={`cur-box ${isActive ? "active" : ""}`}
                  onClick={() => selectCur(c.id)}
                >
                  <div className="cur-box-head">
                    <span className="cur-box-icon">{c.icon}</span>
                    <span className="cur-box-label">{c.label}</span>
                  </div>
                  <input
                    className="cur-box-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={curValues[c.id] || ""}
                    onFocus={() => selectCur(c.id)}
                    onChange={(e) => { setActiveCur(c.id); handleAmountChange(e); }}
                  />
                </div>
              );
            })}
          </div>

          {/* Results grid — calculadora de gasolina */}
          <div className="results-grid">

            {/* ⛽ CALCULADORA DE GASOLINA — ubicada debajo de EURO BCV y USDT */}
            <div className="fuel-card">
              <div className="fuel-header">
                <div className="fuel-icon">⛽</div>
                <div>
                  <div className="fuel-title">Gasolina · Costo por litros</div>
                  <div className="fuel-subtitle">Tasa BCV · Precios PDVSA 2026</div>
                </div>
              </div>

              {/* ⛽ Calcular costo por litros deseados → Bs y USD */}
              <div className="fuel-litros-block">
                <div className="fuel-litros-label">¿Cuántos litros deseas?</div>
                <div className="fuel-input-wrapper">
                  <input
                    className="fuel-litros-input"
                    type="text" inputMode="decimal"
                    placeholder="0"
                    value={litros}
                    onChange={handleLitrosChange}
                  />
                  <span className="fuel-litros-unit">L</span>
                </div>

                <div className="fuel-rows" style={{marginTop:8}}>
                  {FUEL.map(f => {
                    const cost = fuelCosts?.find(c => c.id === f.id);
                    return (
                      <div className="fuel-row" key={`cost-${f.id}`}>
                        <div className="fuel-row-left">
                          <div className="fuel-row-type">{f.label}</div>
                          <div className="fuel-row-price">{fmt(f.priceBs)} Bs/L · ${f.priceUSD.toFixed(3)}/L</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div className={`fuel-cost-bs ${!cost?"fuel-empty":""}`}>
                            {cost ? `${fmt(cost.costBs)} Bs` : "—"}
                          </div>
                          <div className={`fuel-cost-usd ${!cost?"fuel-empty":""}`}>
                            {cost ? `$${fmtConv(cost.costUSD)}` : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Acciones lado a lado: Pago/Cobro vía WhatsApp + Apoya este proyecto */}
          <div className="action-row">
            <button className="action-btn wa-action" onClick={sendWaCotizacion}>
              <span className="action-icon">💬</span>
              <span className="action-text">Pago/Cobro<br/>vía Whatsapp</span>
            </button>
            <button className="action-btn donate-action" onClick={() => setShowDonate(v => !v)}>
              <span className="action-badge">★ IMPORTANTE</span>
              <span className="action-icon">💛</span>
              <span className="action-text">
                Apoya este proyecto{" "}
                <span className={`donate-chevron ${showDonate ? "open" : ""}`}>▼</span>
              </span>
            </button>
          </div>
        </div>

        {/* ── DONACIONES (contenido desplegable) ── */}
        <div className={`donate-body ${showDonate ? "open" : ""}`}>
        <div className="donate-section" style={{margin:"8px 0 0",borderRadius:16}}>
          <div className="donate-header">
            <div className="donate-heart">💛</div>
            <div>
              <div className="donate-title">Apoya este proyecto</div>
              <div className="donate-subtitle">Si te es útil, puedes contribuir con una donación</div>
            </div>
          </div>

          {/* Pago Móvil */}
          <div className="donate-method pago-movil">
            <div className="donate-method-header">
              <div className="donate-method-left">
                <div className="donate-method-icon pago-movil">📲</div>
                <div>
                  <div className="donate-method-name">Pago Móvil · Bolívares</div>
                  <div className="donate-method-tag">BNC · MERCANTIL · BANCAMIGA</div>
                </div>
              </div>
            </div>
            {[
              { label: "Teléfono", value: "0412-611.08.07" },
              { label: "Cédula",   value: "V-19.507.318"   },
              { label: "Bancos",   value: "BNC · Mercantil · Bancamiga" },
            ].map(row => (
              <div className="donate-row" key={row.label}>
                <div>
                  <div className="donate-row-label">{row.label}</div>
                  <div className="donate-row-value">{row.value}</div>
                </div>
                <span
                  className="donate-row-copy"
                  onClick={() => { navigator.clipboard?.writeText(row.value.replace(/[\s.\-·]/g,"")); showToast(`✓ ${row.label} copiado`); }}
                >📋</span>
              </div>
            ))}
          </div>

          {/* USDT TRC20 */}
          <div className="donate-method trc20">
            <div className="donate-method-header">
              <div className="donate-method-left">
                <div className="donate-method-icon trc20">₮</div>
                <div>
                  <div className="donate-method-name">USDT · TRC20</div>
                  <div className="donate-method-tag">Red Tron</div>
                </div>
              </div>
            </div>
            <div className="donate-wallet">
              <div className="donate-wallet-addr">TEj5xL4Hmg3TeSC7tL6kNTP9zGAkz2cdjG</div>
              <button className="donate-wallet-copy" onClick={() => { navigator.clipboard?.writeText("TEj5xL4Hmg3TeSC7tL6kNTP9zGAkz2cdjG"); showToast("✓ Wallet TRC20 copiada"); }}>Copiar</button>
            </div>
          </div>

          {/* USDT ERC20 */}
          <div className="donate-method erc20">
            <div className="donate-method-header">
              <div className="donate-method-left">
                <div className="donate-method-icon erc20">⟠</div>
                <div>
                  <div className="donate-method-name">USDT · ERC20</div>
                  <div className="donate-method-tag">Red Ethereum</div>
                </div>
              </div>
            </div>
            <div className="donate-wallet">
              <div className="donate-wallet-addr">0xc1abeb99d5ce84ebbaa22253dd80bedd06f1ecc7</div>
              <button className="donate-wallet-copy" onClick={() => { navigator.clipboard?.writeText("0xc1abeb99d5ce84ebbaa22253dd80bedd06f1ecc7"); showToast("✓ Wallet ERC20 copiada"); }}>Copiar</button>
            </div>
          </div>

          {/* USDT BEP20 */}
          <div className="donate-method bep20">
            <div className="donate-method-header">
              <div className="donate-method-left">
                <div className="donate-method-icon bep20">🔶</div>
                <div>
                  <div className="donate-method-name">USDT · BEP20</div>
                  <div className="donate-method-tag">Red BNB Smart Chain</div>
                </div>
              </div>
            </div>
            <div className="donate-wallet">
              <div className="donate-wallet-addr">0xc1abeb99d5ce84ebbaa22253dd80bedd06f1ecc7</div>
              <button className="donate-wallet-copy" onClick={() => { navigator.clipboard?.writeText("0xc1abeb99d5ce84ebbaa22253dd80bedd06f1ecc7"); showToast("✓ Wallet BEP20 copiada"); }}>Copiar</button>
            </div>
          </div>

          <div className="donate-thanks">
            Cada aporte ayuda a mantener la app activa y actualizada<br/>
            <span>♥</span> ¡Gracias por tu apoyo!
          </div>
        </div>
        </div> {/* end donate-body */}

        {/* FOOTER */}
        <div className="footer">
          <div className="footer-divider"/>
          <div className="footer-text">
            Sincronización vía API.<br/>
            Las cotizaciones del BCV son las oficiales vigentes para:{" "}
            <span className="highlight">{today}</span>.<br/>
            Se utiliza la API de Binance para obtener el promedio diario de USDT.
          </div>
        </div>
      </div>

      {/* ── MODAL: COTIZACIÓN + PAGO MÓVIL ── */}
      {modal === "cotizacion" && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Pago/Cobro vía Whatsapp</div>
            <div className="pm-intro">
              Elige la tasa para el pago y agrega tus datos de Pago Móvil.
              Todo se incluirá en el mensaje.
            </div>

            {/* Selector de tasa para el pago (una de las 5 tasas) */}
            <div className="pm-section-label">💲 Pagar a la tasa de:</div>
            <div className="pm-rates">
              {rateCards.map(card => (
                <div
                  key={card.id}
                  className={`pm-rate-chip ${tasaPago === card.id ? "sel" : ""}`}
                  onClick={() => setTasaPago(card.id)}
                >
                  <div className="pm-rate-name">
                    <span>{card.icon}</span> {card.name}
                  </div>
                  <div className="pm-rate-val">{fmt(card.value)} {card.unit}</div>
                </div>
              ))}
            </div>

            <div
              className="pm-toggle"
              onClick={() => setIncluirPago(v => !v)}
            >
              <div className="pm-toggle-text">📲 Incluir datos de Pago Móvil</div>
              <div className={`pm-switch ${incluirPago ? "on" : ""}`} />
            </div>

            {incluirPago && (
              <div className="pm-form">
                <div className="pm-field">
                  <label className="pm-field-label">BANCO</label>
                  <div className="pm-bank-select">
                    <button
                      type="button"
                      className={`pm-bank-trigger ${bancoOpen ? "open" : ""}`}
                      onClick={() => setBancoOpen(v => !v)}
                    >
                      {pagoMovil.banco
                        ? <span className="pm-bank-current">{pagoMovil.banco}</span>
                        : <span className="pm-bank-placeholder">Selecciona tu banco</span>}
                      <span className={`pm-bank-arrow ${bancoOpen ? "open" : ""}`}>▼</span>
                    </button>
                    {bancoOpen && (
                      <div className="pm-bank-list">
                        {BANCOS_VE.map(b => {
                          const label = `${b.name} (${b.code})`;
                          return (
                            <div
                              key={b.code}
                              className={`pm-bank-item ${pagoMovil.banco === label ? "sel" : ""}`}
                              onClick={() => { updatePago("banco", label); setBancoOpen(false); }}
                            >
                              <span className="pm-bank-code">{b.code}</span>
                              <span className="pm-bank-name">{b.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="pm-field">
                  <label className="pm-field-label">TELÉFONO</label>
                  <input
                    className="pm-input"
                    type="tel"
                    inputMode="tel"
                    placeholder="Ej: 0412-000.00.00"
                    value={pagoMovil.telefono}
                    onChange={e => updatePago("telefono", e.target.value)}
                  />
                </div>
                <div className="pm-field">
                  <label className="pm-field-label">CÉDULA / RIF</label>
                  <input
                    className="pm-input"
                    type="text"
                    placeholder="Ej: V-00.000.000"
                    value={pagoMovil.cedula}
                    onChange={e => updatePago("cedula", e.target.value)}
                  />
                </div>
                <div className="pm-field">
                  <label className="pm-field-label">TITULAR</label>
                  <input
                    className="pm-input"
                    type="text"
                    placeholder="Nombre del titular de la cuenta"
                    value={pagoMovil.titular}
                    onChange={e => updatePago("titular", e.target.value)}
                  />
                </div>
              </div>
            )}

            <button className="pm-send-btn" onClick={confirmWaCotizacion}>
              <span style={{ fontSize: 18 }}>💬</span>
              Enviar por WhatsApp
            </button>
            <button className="modal-close" onClick={() => setModal(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
