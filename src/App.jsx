import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "vzla_cambio_cache_v3";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 1. ACTUALIZADO: Tasas se vencen cada 2 horas
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
    display: flex; align-items: center; justify-content: center; gap: 6px; background: transparent; color: #475569;
  }
  .toggle-btn.active-bs {
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
  .donate-wallet-copy:active { background: rgba(255,255,255,0.14); color: 
