import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "vzla_cambio_cache_v3";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 1. ACTUALIZADO: Tasas se vencen cada 2 hours
const APP_URL = typeof window !== "undefined" ? window.location.href : "https://claude.ai";

const FALLBACK_RATES = {
  bcv: 572.68,          // BCV oficial USD — 10/06/2026
  euro: 662.25,         // Euro BCV oficial — 10/06/2026
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
    display: flex; gap: 8px; padding: 0 16px; margin-bottom: 14px; position: relative; z-index: 1;
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

  /* 6. ACTUALIZADO: Estilo del botón "Descarga App" */
  .btn-apk {
    background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.25);
  }

  /* RATES */
  .section-label {
    font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
    color:#475569; padding:0 20px; margin-bottom:10px; position:relative; z-index:1;
  }
  .rates-grid { padding:0 16px; display:flex; flex-direction:column; gap:10px; position:relative; z-index:1; }
  .rate-card {
    background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07);
    border-radius:16px; padding:14px 16px; display:flex; align-items:center; justify-content:space-between;
    transition:all .2s ease; position:relative; overflow:hidden;
  }
  .rate-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:3px 0 0 3px; }
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
  .rate-unit { font-size:10px; color:#64748b; text-align:right; font-family:'JetBrains Mono',monospace; }

  /* DIVIDER */
  .divider { height:1px; background:rgba(255,255,255,0.05); margin:16px 20px; position:relative; z-index:1; }

  /* CALCULATOR */
  .calculator { padding:0 16px; position:relative; z-index:1; flex:1; }
  .calc-title { font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#475569; margin-bottom:12px; }
  .input-wrapper {
    background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
    border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:10px;
    margin-bottom:14px; transition:border-color .2s;
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

  /* EXTRA CONVERSION ROW */
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
    border-radius: 14px; padding: 12px 14px; position: relative; overflow: hidden; grid-column: span 2;
  }
  .fuel-card::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; border-radius: 0 0 14px 14px;
    background: linear-gradient(to right, #f97316, #eab308); opacity: 0.7;
  }
  .fuel-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 3px 0 0 3px;
    background: linear-gradient(to bottom, #f97316, #eab308);
  }
  .fuel-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .fuel-icon {
    width: 28px; height: 28px; border-radius: 8px; background: rgba(249,115,22,0.15);
    display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0;
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

  .currency-toggle {
    display: flex; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 4px; gap: 4px; margin-bottom: 14px;
  }
  .toggle-btn {
    flex: 1; padding: 10px 8px; border: none; border-radius: 10px; font-family: 'Exo 2', sans-serif;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: all .2s ease; user-select: none;
    display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; color: #475569;  .toggle-btn.active-bs {
    background: linear-gradient(135deg, #eab308, #ca8a04); color: #0a0d12; box-shadow: 0 2px 12px rgba(234,179,8,0.3);
  }
  .toggle-btn.active-usd {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; box-shadow: 0 2px 12px rgba(59,130,246,0.3);
  }
  .toggle-btn:not(.active-bs):not(.active-usd):active { background: rgba(255,255,255,0.06); }

  /* 4. ACTUALIZADO: Botón enviar cotización por WhatsApp inferior */
  .wa-send-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; margin-top: 12px; padding: 12px;
    background: linear-gradient(135deg, #22c55e, #16a34a); border: none;
    border-radius: 14px; color: #ffffff; font-family: 'Exo 2', sans-serif;
    font-size: 13px; font-weight: 700; cursor: pointer; transition: all .18s; user-select: none;
    box-shadow: 0 4px 12px rgba(34,197,94,0.2);
  }
  .wa-send-btn:active { transform: scale(0.97); filter: brightness(0.9); }

  /* 5. ACTUALIZADO: Estilos del contenedor desplegable de apoyo */
  .donate-toggle-header {
    margin: 16px 16px 0; padding: 14px 16px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; display: flex; align-items: center; justify-content: space-between;
    cursor: pointer; user-select: none; transition: background 0.2s;
  }
  .donate-toggle-header:active { background: rgba(255,255,255,0.06); }
  .donate-wrapper-collapse {
    max-height: 0; overflow: hidden; transition: max-height 0.35s ease-out; padding: 0 16px;
  }
  .donate-wrapper-collapse.open {
    max-height: 800px; transition: max-height 0.4s ease-in; padding: 10px 16px 0;
  }
  .donate-section-dropdown {
    padding: 16px 0 20px; position: relative; z-index: 1;
  }
  .arrow-indicator { font-size: 11px; color: #64748b; font-weight: 600; }
  .arrow-indicator.rotated { color: #eab308; }

  /* MODAL OVERLAY & SHEETS */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 100;
    display: flex; align-items: flex-end; justify-content: center; animation: fadeIn .2s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal-sheet {
    background: #131820; border-radius: 24px 24px 0 0; width: 100%; max-width: 420px;
    padding: 24px 20px 36px; animation: slideUp .25s ease; border-top: 1px solid rgba(255,255,255,0.08);
  }
  @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  .modal-handle { width:40px; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; margin:0 auto 20px; }
  .modal-title { font-size:16px; font-weight:800; color:#f1f5f9; margin-bottom:18px; text-align:center; }

  /* SHARE OPTIONS IN MODAL */
  .share-options { display:flex; flex-direction:column; gap:10px; }
  .share-opt {
    display:flex; align-items:center; gap:14px; background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:14px 16px;
    cursor:pointer; transition:all .15s; user-select:none;
  }
  .share-opt:active { background:rgba(255,255,255,0.08); transform:scale(0.98); }
  .share-opt-icon { font-size:22px; width:36px; text-align:center; flex-shrink:0; }
  .share-opt-text { flex:1; }
  .share-opt-title { font-size:14px; font-weight:700; color:#f1f5f9; }
  .share-opt-desc  { font-size:11px; color:#64748b; margin-top:2px; }

  /* QR CONTAINER */
  .qr-container { display:flex; flex-direction:column; align-items:center; gap:16px; width:100%; }
  .qr-box { background: #fff; border-radius: 16px; padding: 16px; display:flex; align-items:center; justify-content:center; }
  .qr-caption { font-size:11px; color:#64748b; text-align:center; font-family:'JetBrains Mono',monospace; line-height:1.6; }
  .qr-url { color:#eab308; font-size:10px; word-break:break-all; margin-top:4px; display:inline-block; }

  /* MODAL CLOSE BTN */
  .modal-close {
    width:100%; margin-top:16px; padding:12px; background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:#94a3b8;
    font-size:13px; font-weight:600; font-family:'Exo 2',sans-serif; cursor:pointer; transition:all .15s;
  }
  .modal-close:active { background:rgba(255,255,255,0.1); }

  /* COPY TOAST */
  .toast {
    position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:#1e293b;
    border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:9px 18px;
    font-size:12px; color:#94a3b8; font-family:'JetBrains Mono',monospace; z-index:200;
    animation: toastIn .25s ease; white-space:nowrap;
  }
  @keyframes toastIn { from{opacity:0;transform:translate(-50%,10px)} to{opacity:1;transform:translate(-50%,0)} }

  /* FOOTER */
  .footer { padding:20px 20px 28px; position:relative; z-index:1; margin-top:auto; }
  .footer-divider { height:1px; background:rgba(255,255,255,0.05); margin-bottom:14px; }
  .footer-text { text-align:center; font-size:10.5px; color:#475569; line-height:1.7; font-family:'JetBrains Mono',monospace; }
  .footer-text .highlight { color:#eab308; }

  /* ELEMENTOS DE DONACIONES */
  .donate-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .donate-heart {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, rgba(236,72,153,0.2), rgba(239,68,68,0.2));
    border: 1px solid rgba(236,72,153,0.25); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
  }
  .donate-title { font-size: 14px; font-weight: 800; color: #f1f5f9; }
  .donate-subtitle { font-size: 11px; color: #64748b; margin-top: 1px; }
  .donate-method {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 13px 14px; margin-bottom: 10px; position: relative; overflow: hidden;
  }
  .donate-method:last-child { margin-bottom: 0; }
  .donate-method::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 3px 0 0 3px; }
  .donate-method.pago-movil::before { background: linear-gradient(to bottom, #eab308, #f97316); }
  .donate-method.trc20::before      { background: linear-gradient(to bottom, #ef4444, #dc2626); }
  .donate-method-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .donate-method-left { display: flex; align-items: center; gap: 8px; }
  .donate-method-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .donate-method-icon.pago-movil { background: rgba(234,179,8,0.15); }
  .donate-method-icon.trc20      { background: rgba(239,68,68,0.15); }
  .donate-method-name { font-size: 12px; font-weight: 700; color: #f1f5f9; }
  .donate-method-tag  { font-size: 9px; color: #64748b; margin-top: 1px; font-family: 'JetBrains Mono', monospace; }
  .donate-copy-btn {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600;
    color: #94a3b8; font-family: 'Exo 2', sans-serif; cursor: pointer;
    transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .donate-copy-btn:active { background: rgba(255,255,255,0.12); color: #f1f5f9; transform: scale(0.95); }
  .donate-row { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 7px 10px; margin-bottom: 6px; }
  .donate-row:last-child { margin-bottom: 0; }
  .donate-row-label { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .donate-row-value { font-size: 12px; font-weight: 600; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; word-break: break-all; }
  .donate-wallet { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 10px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .donate-wallet-addr { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #cbd5e1; word-break: break-all; line-height: 1.6; flex: 1; }
  .donate-wallet-copy {
    background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; padding: 5px 9px; font-size: 11px; font-weight: 600;
    color: #94a3b8; font-family: 'Exo 2', sans-serif; cursor: pointer; transition: all .15s; white-space: nowrap; flex-shrink: 0;
  }
  .donate-wallet-copy:active { background: rgba(255,255,255,0.14); color: #f1f5f9; transform: scale(0.95); }
  .donate-thanks { text-align: center; font-size: 11px; color: #475569; margin-top: 14px; font-family: 'JetBrains Mono', monospace; line-height: 1.6; }
  .donate-thanks span { color: #ec4899; }
`;

/* ─── FETCH RATES ─────────────────────────────────────────────────────── */
async function fetchRates() {
  const results = { ...FALLBACK_RATES };
  let fromApi = false;

  // 1. Dolarapi endpoint oficial BCV USD
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(7000) });
    const data = await res.json();
    if (data?.promedio && data.promedio > 100) {
      results.bcv = data.promedio;
      fromApi = true;
    }
  } catch (_) {}

  // 2. ACTUALIZADO: Consulta dedicada e independiente al endpoint de Euros de dolarapi
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/cotizaciones/euro", { signal: AbortSignal.timeout(7000) });
    const data = await res.json();
    if (data?.promedio && data.promedio > 100) {
      results.euro = data.promedio;
    }
  } catch (_) {}

  // Contingencia de Euro alternativa si dolarapi directo fallara
  if (!results.euro || results.euro === FALLBACK_RATES.euro) {
    try {
      const res = await fetch("https://bcv-api.deno.dev/v1/exchange/euro", { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (data?.exchange && data.exchange > 100) {
        results.euro = data.exchange;
      }
    } catch (_) {}
  }

  // 3. USDT vía Binance P2P promedio de ofertas de Venta (SELL)
  try {
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: "USDT", fiat: "VES", merchantCheck: false, page: 1, rows: 10, tradeType: "SELL" }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const prices = data?.data?.map(d => parseFloat(d.adv?.price)).filter(Boolean);
    if (prices?.length) {
      results.usdt = prices.reduce((a,b) => a + b, 0) / prices.length;
      fromApi = true;
    }
  } catch (_) {}

  // 4. Intervención Digital fija
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
  if (val < 1) return val.toFixed(4);
  if (val < 1000) return val.toFixed(2);
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
function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a0d12`;
}

// Generador de cadena de texto de la cotización para WhatsApp
function buildWaQuote(rates, amount, calcMode, conv, today) {
  const num = parseFloat(String(amount).replace(",",".")) || 0;
  let msg = `🇻🇪 *Cotización de Tasas VES — ${today}*\n\n`;
  msg += `💵 *BCV:* 1 $ = ${fmt(rates.bcv)} Bs\n`;
  msg += `💶 *EURO:* 1 € = ${fmt(rates.euro)} Bs\n`;
  msg += `🟢 *USDT:* 1 $ = ${fmt(rates.usdt)} Bs\n`;
  msg += `🔸 *Intervención:* ${fmt(rates.intervencion)} Bs\n\n`;

  if (num > 0) {
    msg += `📊 *Conversión realizada:*\n`;
    if (calcMode === "bs") {
      msg += `> Input: *${num.toLocaleString("es-VE")} Bs*\n`;
      msg += `> BCV: *${fmtConv(conv.bcv)} $* \n`;
      msg += `> EURO: *${fmtConv(conv.euro)} €* \n`;
      msg += `> USDT: *${fmtConv(conv.usdt)} USDT*\n`;
    } else {
      msg += `> Input: *${num.toLocaleString("es-VE")} $* (Divisas)\n`;
      msg += `> A Bolívares (BCV): *${fmtConv(conv.bcv)} Bs*\n`;
      msg += `> A Bolívares (USDT): *${fmtConv(conv.usdt)} Bs*\n`;
    }
    msg += `\n`;
  }
  msg += `_Generado automáticamente desde nuestra App_ 📲`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

/* ─── MAIN COMPONENT ──────────────────────────────────────────────────── */
export default function App() {
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  // Estados del Convertidor
  const [calcAmount, setCalcAmount] = useState("");
  const [calcMode, setCalcMode] = useState("bs"); // 'bs' o 'usd'

  // 5. ACTUALIZADO: Estado React para el menú colapsable/desplegable de apoyo
  const [showDonations, setShowDonations] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadRatesData = useCallback(async (forced = false) => {
    setLoading(true);
    if (!navigator.onLine) {
      setIsOffline(true);
      const cache = localStorage.getItem(STORAGE_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);
        setRates(parsed.rates);
        setLastSync(parsed.timestamp);
      }
      setLoading(false);
      return;
    }

    setIsOffline(false);
    if (!forced) {
      const cache = localStorage.getItem(STORAGE_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          setRates(parsed.rates);
          setLastSync(parsed.timestamp);
          setLoading(false);
          return;
        }
      }
    }

    const freshRates = await fetchRates();
    const newSync = Date.now();
    setRates(freshRates);
    setLastSync(newSync);
    setLoading(false);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rates: freshRates, timestamp: newSync }));
  }, []);

  useEffect(() => {
    loadRatesData();
    
    // 1. ACTUALIZADO: Intervalo cíclico interno para refrescar en segundo plano cada 2 horas
    const interval = setInterval(() => {
      loadRatesData(true);
    }, CACHE_TTL);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadRatesData]);

  // Conversiones reactivas matemáticas
  const amt = parseFloat(String(calcAmount).replace(",", ".")) || 0;
  const conversions = { bcv: 0, euro: 0, usdt: 0, intervencion: 0 };

  if (amt > 0) {
    if (calcMode === "bs") {
      conversions.bcv = amt / (rates.bcv || 1);
      conversions.euro = amt / (rates.euro || 1);
      conversions.usdt = amt / (rates.usdt || 1);
      conversions.intervencion = amt / (rates.intervencion || 1);
    } else {
      conversions.bcv = amt * (rates.bcv || 0);
      conversions.euro = amt * (rates.euro || 0);
      conversions.usdt = amt * (rates.usdt || 0);
      conversions.intervencion = amt * (rates.intervencion || 0);
    }
  }

  // Funciones nativas de la App
  const copyLink = () => {
    navigator.clipboard.writeText(APP_URL);
    showToast("¡Enlace web copiado!");
    setModal(null);
  };

  const openWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent("Te comparto mi app de Monitoreo de Tasas CambioVES: " + APP_URL)}`;
    window.open(waUrl, "_blank");
    setModal(null);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`¡Copiado: ${label}!`);
  };

  const handleDownloadApp = () => {
    showToast("Iniciando la descarga del instalador...");
    window.location.href = "#"; // Vincula aquí la ruta real de tu archivo de distribución
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        
        {isOffline && (
          <div className="offline-banner">
            ⚠️ Modo Sin Conexión. Mostrando tasas guardadas en caché.
          </div>
        )}

        {/* HEADER */}
        <header className="header">
          <div className="header-top">
            <div className="flag-accent">
              <div className="flag-bar yellow" />
              <div className="flag-bar blue" />
              <div className="flag-bar red" />
              <h1 className="header-title">Cambio<span>VES</span></h1>
            </div>

            <div className={`sync-badge ${isOffline ? 'offline' : ''}`} onClick={() => loadRatesData(true)}>
              <div className={`sync-dot ${loading ? 'loading' : isOffline ? 'offline-dot' : ''}`} />
              <span>{loading ? "Cargando..." : isOffline ? "Offline" : "Actualizar"}</span>
            </div>
          </div>
          <div className="last-update">
            Sincronizado: {lastSync ? lastUpdStr(lastSync) : "Pendiente..."}
          </div>
        </header>

        {/* ACTION ROW (4. ACTUALIZADO: Botón de cotización superior removido completamente) */}
        <div className="action-row">
          <button className="action-btn btn-share" onClick={() => setModal("share")}>
            <span>🔗</span> Compartir Web
          </button>
          <button className="action-btn btn-qr" onClick={() => setModal("qr")}>
            <span>📱</span> Código QR
          </button>
          {/* 6. ACTUALIZADO: Botón renombrado a Descarga App */}
          <button className="action-btn btn-share btn-apk" onClick={handleDownloadApp}>
            <span>📥</span> Descarga App
          </button>
        </div>

        {/* RATES GRID */}
        <div className="section-label">Tasas Oficiales</div>
        <div className="rates-grid">
          <div className="rate-card bcv">
            <div className="rate-left">
              <div className="rate-icon bcv">💵</div>
              <div>
                <div className="rate-name">BCV Oficial</div>
                <div className="rate-subtitle">Banco Central de Venezuela</div>
              </div>
            </div>
            <div className="rate-value">
              <div className="rate-amount">{loading ? "..." : fmt(rates.bcv)}</div>
              <div className="rate-unit">Bs / USD</div>
            </div>
          </div>

          <div className="rate-card euro">
            <div className="rate-left">
              <div className="rate-icon euro">💶</div>
              <div>
                <div className="rate-name">Euro BCV</div>
                <div className="rate-subtitle">Oficial del Estado</div>
              </div>
            </div>
            <div className="rate-value">
              <div className="rate-amount">{loading ? "..." : fmt(rates.euro)}</div>
              <div className="rate-unit">Bs / EUR</div>
            </div>
          </div>

          <div className="rate-card usdt">
            <div className="rate-left">
              <div className="rate-icon usdt">🟢</div>
              <div>
                <div className="rate-name">USDT C2C</div>
                <div className="rate-subtitle">Promedio Binance P2P</div>
              </div>
            </div>
            <div className="rate-value">
              <div className="rate-amount">{loading ? "..." : fmt(rates.usdt)}</div>
              <div className="rate-unit">Bs / USDT</div>
            </div>
          </div>

          <div className="rate-card intervencion">
            <div className="rate-left">
              <div className="rate-icon intervencion">🔸</div>
              <div>
                <div className="rate-name">Intervención</div>
                <div className="rate-subtitle">Tasa Bancaria Asignada</div>
              </div>
            </div>
            <div className="rate-value">
              <div className="rate-amount">{fmt(rates.intervencion)}</div>
              <div className="rate-unit">Bs / USD</div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* CALCULATOR */}
        <div className="calculator">
          <div className="calc-title">Convertidor Inteligente</div>
          
          <div className="currency-toggle">
            <button className={`toggle-btn ${calcMode === 'bs' ? 'active-bs' : ''}`} onClick={() => setCalcMode("bs")}>
              🇻🇪 Bolívares
            </button>
            <button className={`toggle-btn ${calcMode === 'usd' ? 'active-usd' : ''}`} onClick={() => setCalcMode("usd")}>
              💵 Dólares / USDT
            </button>
          </div>

          <div className="input-wrapper">
            {/* 3. ACTUALIZADO: Cambiado dinámicamente de Divisa a Dólares */}
            <div className="input-label">
              {calcMode === "bs" ? "Bolívares - Dólares" : "Dólares - Bolívares"}
            </div>
            <input
              type="text"
              className="bs-input"
              inputMode="decimal"
              placeholder="0,00"
              value={calcAmount}
              onChange={(e) => setCalcAmount(e.target.value)}
            />
          </div>

          {amt > 0 && calcMode === "bs" && (
            <div className="extra-conv">
              <div className="extra-conv-label">Conversión base USD Oficial (BCV):</div>
              <div className="extra-conv-value">{fmtConv(conversions.bcv)} <span className="extra-conv-unit">$</span></div>
            </div>
          )}

          <div className="results-grid">
            <div className="result-card bcv">
              <div className="result-label">BCV Dólar</div>
              <div className={`result-value ${amt === 0 ? 'empty' : ''}`}>
                {amt === 0 ? "0,00" : fmtConv(conversions.bcv)}
              </div>
              <div className="result-currency">{calcMode === "bs" ? "USD ($)" : "VES (Bs)"}</div>
            </div>

            <div className="result-card euro">
              <div className="result-label">BCV Euro</div>
              <div className={`result-value ${amt === 0 ? 'empty' : ''}`}>
                {amt === 0 ? "0,00" : fmtConv(conversions.euro)}
              </div>
              <div className="result-currency">{calcMode === "bs" ? "EUR (€)" : "VES (Bs)"}</div>
            </div>

            <div className="result-card usdt">
              <div className="result-label">Binance USDT</div>
              <div className={`result-value ${amt === 0 ? 'empty' : ''}`}>
                {amt === 0 ? "0,00" : fmtConv(conversions.usdt)}
              </div>
              <div className="result-currency">{calcMode === "bs" ? "USDT" : "VES (Bs)"}</div>
            </div>

            <div className="result-card intervencion">
              <div className="result-label">Intervención</div>
              <div className={`result-value ${amt === 0 ? 'empty' : ''}`}>
                {amt === 0 ? "0,00" : fmtConv(conversions.intervencion)}
              </div>
              <div className="result-currency">{calcMode === "bs" ? "USD ($)" : "VES (Bs)"}</div>
            </div>

            {/* FUEL ESTIMATION CARD */}
            <div className="fuel-card">
              <div className="fuel-header">
                <div className="fuel-icon">⛽</div>
                <div>
                  <div className="fuel-title">Cálculo de Combustible</div>
                  <div className="fuel-subtitle">Litros estimados según valor ingresado</div>
                </div>
              </div>
              <div className="fuel-rows">
                <div className="fuel-row">
                  <div className="fuel-row-left">
                    <span className="fuel-row-type">Subsidiado</span>
                    <span className="fuel-row-price">Tasa: 0,10 Bs/L</span>
                  </div>
                  <span className="fuel-row-liters">
                    {calcMode === "bs" && amt > 0 ? `${fmtConv(amt / 0.10)} L` : calcMode === "usd" && amt > 0 ? `${fmtConv((amt * rates.bcv) / 0.10)} L` : <span className="fuel-empty">—</span>}
                  </span>
                </div>
                <div className="fuel-row">
                  <div className="fuel-row-left">
                    <span className="fuel-row-type">Internacional</span>
                    <span className="fuel-row-price">Precio fijo: 0,50 $/L</span>
                  </div>
                  <span className="fuel-row-liters" style={{ color: '#f97316' }}>
                    {calcMode === "bs" && amt > 0 ? `${fmtConv(amt / rates.bcv / 0.50)} L` : calcMode === "usd" && amt > 0 ? `${fmtConv(amt / 0.50)} L` : <span className="fuel-empty">—</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. ACTUALIZADO: Botón interactivo inferior para enviar cotizaciones directas a WhatsApp */}
          <button 
            className="wa-send-btn"
            onClick={() => window.open(buildWaQuote(rates, calcAmount, calcMode, conversions, todayStr()), "_blank")}
          >
            💬 Enviar cotización por WhatsApp
          </button>
        </div>

        {/* 5. ACTUALIZADO: Cabecera interactiva y bloque desplegable de Datos de Apoyo */}
        <div 
          className="donate-toggle-header" 
          onClick={() => setShowDonations(!showDonations)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px' }}>❤️</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '0.3px' }}>Datos de apoyo y cuentas</span>
          </div>
          <span className={`arrow-indicator ${showDonations ? 'rotated' : ''}`}>
            {showDonations ? "▲ Ocultar" : "▼ Mostrar"}
          </span>
        </div>

        <div className={`donate-wrapper-collapse ${showDonations ? 'open' : ''}`}>
          <div className="donate-section-dropdown">
            <div className="donate-header">
              <div className="donate-heart">💝</div>
              <div>
                <div className="donate-title">¿Te es de utilidad la App?</div>
                <div className="donate-subtitle">Puedes apoyar al mantenimiento del servidor</div>
              </div>
            </div>

            <div className="donate-method pago-movil">
              <div className="donate-method-header">
                <div className="donate-method-left">
                  <div className="donate-method-icon pago-movil">📱</div>
                  <div>
                    <div className="donate-method-name">Pago Móvil</div>
                    <div className="donate-method-tag">Bancamiga (0172)</div>
                  </div>
                </div>
                <button className="donate-copy-btn" onClick={() => copyToClipboard("0172 04126105342 16960856", "Pago Móvil Completo")}>
                  Copiar Todo
                </button>
              </div>
              <div className="donate-row">
                <span className="donate-row-label">Cédula:</span>
                <span className="donate-row-value">V-16.960.856</span>
              </div>
              <div className="donate-row">
                <span className="donate-row-label">Teléfono:</span>
                <span className="donate-row-value">0412-6105342</span>
              </div>
            </div>

            <div className="donate-method trc20">
              <div className="donate-method-header">
                <div className="donate-method-left">
                  <div className="donate-method-icon trc20">🪙</div>
                  <div>
                    <div className="donate-method-name">USDT (TRC-20)</div>
                    <div className="donate-method-tag">Red TRON</div>
                  </div>
                </div>
              </div>
              <div className="donate-wallet">
                <div className="donate-wallet-addr">TYX6H7wS7Yg9vXUvXgqC6gYgYgYgYgYgYgYgYg</div>
                <button className="donate-wallet-copy" onClick={() => copyToClipboard("TYX6H7wS7Yg9vXUvXgqC6gYgYgYgYgYgYgYg", "Dirección TRC20")}>
                  Copiar
                </button>
              </div>
            </div>

            <div className="donate-thanks">
              Hecho con <span>♥</span> en Venezuela.
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-divider" />
          <div className="footer-text">
            Tasas informativas actualizadas de APIs abiertas.<br />
            App de uso personal v3.2.0 • <span className="highlight">{todayStr()}</span>
          </div>
        </footer>

        {/* MODAL SHEET SYSTEM */}
        {modal && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-handle" />
              
              {modal === "share" && (
                <>
                  <div className="modal-title">Compartir Aplicación</div>
                  <div className="share-options" style={{ width: "100%" }}>
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
                </>
              )}

              {modal === "qr" && (
                <div className="qr-container">
                  <div className="modal-title">Escanea el Código QR</div>
                  <div className="qr-box">
                    <img 
                      src={qrUrl(APP_URL)} 
                      alt="QR Cambio VES" 
                      width={200} 
                      height={200} 
                      style={{ borderRadius: 8, display: "block" }} 
                    />
                  </div>
                  <div className="qr-caption">
                    Escanea para abrir la app<br />
                    <span className="qr-url">{APP_URL}</span>
                  </div>
                </div>
              )}

              <button className="modal-close" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

  }
