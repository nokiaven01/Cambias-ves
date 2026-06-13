import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "vzla_cambio_cache_v3";
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 horas
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

  .btn-apk {
    background: rgba(34,197,94,0.12); color: #4ade80;
    border: 1px solid rgba(34,197,94,0.25);
    font-size: 11px; padding: 7px 8px; border-radius: 10px;
  }

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
`;

/* ─── FETCH RATES ─────────────────────────────────────────────────────── */
async function fetchRates() {
  const results = { ...FALLBACK_RATES };
  let fromApi = false;

  // 1. dolarapi.com endpoint oficial BCV → más confiable y sin límites
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(7000) });
    const data = await res.json();
    // Respuesta: { fuente, promedio, fechaActualizacion, ... }
    if (data?.promedio && data.promedio > 100) {
      results.bcv = data.promedio;
      fromApi = true;
    }
  } catch (_) {}

  // 2. Euro BCV vía dolarapi
  try {
    const res = await fetch("https://ve.dolarapi.com/v1/dolares", { signal: AbortSignal.timeout(7000) });
    const data = await res.json();
    if (Array.isArray(data)) {
      const euroData     = data.find(item => item.moneda === "EUR" || item.fuente === "euro");
      const paraleloData = data.find(item =>
        item.fuente === "paralelo" || item.fuente === "enparalelovzla" || item.fuente === "promedio"
      );
      if (euroData?.promedio     && euroData.promedio > 100)     { results.euro     = euroData.promedio; }
      if (paraleloData?.promedio && paraleloData.promedio > 100) { results._paralelo = paraleloData.promedio; }
    }
  } catch (_) {}

  // Fallback Euro: bcv-api.deno.dev si dolarapi no trajo el euro
  if (!results.euro || results.euro === FALLBACK_RATES.euro) {
    try {
      const res = await fetch("https://bcv-api.deno.dev/v1/exchange/euro", { signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (data?.exchange && data.exchange > 100) { results.euro = data.exchange; }
    } catch (_) {}
  }

  // 3. USDT vía Binance P2P promedio
  try {
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: "USDT", fiat: "VES", merchantCheck: false, page: 1, rows: 10, tradeType: "SELL" }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const prices = data?.data?.map(d => parseFloat(d.adv?.price)).filter(Boolean);
    if (prices?.length) { results.usdt = prices.reduce((a,b)=>a+b,0)/prices.length; fromApi = true; }
    else if (results._paralelo) results.usdt = results._paralelo;
  } catch (_) {
    if (results._paralelo) results.usdt = results._paralelo;
  }

  // 4. Intervención Digital – tasa fija mensual BCV
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

  // Precios de gasolina Venezuela 2026 (Bs/litro usando tasa BCV)
  const FUEL = [
    { id:"subsidiada", label:"Subsidiada 91 oct", priceUSD: 0.024,  priceBs: null,  tag:"Cupo Patria · ~120 L/mes" },
    { id:"internacional", label:"Internacional",  priceUSD: 0.50,   priceBs: null,  tag:"Sin límite · Biopago/divisas" },
    { id:"premium",    label:"Super Premium 97",  priceUSD: 1.00,   priceBs: null,  tag:"Solo efectivo USD" },
  ].map(f => ({
    ...f,
    priceBs: f.priceUSD * (rates.bcv || FALLBACK_RATES.bcv),
  }));

  // Litros que dan según modo y monto
  const fuelLiters = inputNum > 0
    ? FUEL.map(f => {
        const montoBs = calcMode === "bs" ? inputNum : inputNum * (rates.bcv || FALLBACK_RATES.bcv);
        return { ...f, liters: montoBs / f.priceBs };
      })
    : null;
  const today = todayStr();

  const rateCards = [
    { id:"bcv",          icon:"🏦", name:"Dólar BCV",           subtitle:"Banco Central de Venezuela", value:rates.bcv,          unit:"Bs/USD",  src:"bcv.today"    },
    { id:"euro",         icon:"💶", name:"Euro BCV",             subtitle:"Cotización oficial EUR",     value:rates.euro,         unit:"Bs/EUR",  src:"bcv.today"    },
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

        {/* ACTION ROW: Compartir · QR · APK · Enviar cotización */}
        <div className="action-row">
          <button className="action-btn btn-share" onClick={handleShare}>
            🔗 Compartir
          </button>
          <button className="action-btn btn-qr" onClick={() => setModal("qr")}>
            ▦ QR
          </button>
          <a className="action-btn btn-apk" href="https://t.me/cambiasves/2" target="_blank" rel="noreferrer">
            ⬇ APK
          </a>
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

          {/* Extra conversion: Bs→USD o USD→Bs usando tasa BCV */}
          {inputNum > 0 && rates.bcv && (
            <div className="extra-conv">
              {calcMode === "bs" ? (
                <>
                  <div>
                    <div className="extra-conv-label">Equivale en USD (BCV)</div>
                    <div className="extra-conv-value">${fmtConv(inputNum / rates.bcv)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="extra-conv-label">Tasa usada</div>
                    <div className="extra-conv-unit">{fmt(rates.bcv)} Bs/USD</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="extra-conv-label">Equivale en Bs (BCV)</div>
                    <div className="extra-conv-value">{fmt(inputNum * rates.bcv)} Bs</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="extra-conv-label">Tasa usada</div>
                    <div className="extra-conv-unit">{fmt(rates.bcv)} Bs/USD</div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results grid — BCV slot replaced by fuel calculator */}
          <div className="results-grid">

            {/* ⛽ CALCULADORA DE GASOLINA — ocupa el espacio de USD BCV */}
            <div className="fuel-card">
              <div className="fuel-header">
                <div className="fuel-icon">⛽</div>
                <div>
                  <div className="fuel-title">Gasolina · Litros equivalentes</div>
                  <div className="fuel-subtitle">Tasa BCV · Precios PDVSA 2026</div>
                </div>
              </div>
              <div className="fuel-rows">
                {FUEL.map(f => {
                  const liters = fuelLiters?.find(l => l.id === f.id)?.liters;
                  return (
                    <div className="fuel-row" key={f.id}>
                      <div className="fuel-row-left">
                        <div className="fuel-row-type">{f.label}</div>
                        <div className="fuel-row-price">{fmt(f.priceBs)} Bs/L · ${f.priceUSD.toFixed(3)}/L</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className={`fuel-row-liters ${!liters?"fuel-empty":""}`}>
                          {liters ? fmtConv(liters) : "—"}
                        </div>
                        <div className="fuel-row-unit">litros</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resto de tarjetas: Euro, USDT, Intervención */}
            {rateCards.filter(c => c.id !== "bcv").map(card => (
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

        {/* ── DONACIONES ── */}
        <div className="donate-section">
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
