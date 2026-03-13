// ==UserScript==
// @name         Steam Score Tracker
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Steam Score Tracker
// @author       LunWy
// @match        *://steamcommunity.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const btn = document.createElement('div');
    btn.innerHTML = '🎮';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #4a90b8 0%, #3a7ca5 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 99999;
    `;

    btn.onclick = () => {
        const w = window.open('', 'SteamTracker', 'width=900,height=700');
        if (!w) return alert('Разрешите всплывающие окна');

        w.document.write(`<!DOCTYPE html>
<html>
<head>
<title>🎮 Steam Score Tracker</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #1b2838; color: #c7d5e0; padding: 20px; }
.header { background: #2a475e; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center; }
.header h1 { color: #66c0f4; }
.input-row { display: flex; gap: 10px; margin-bottom: 20px; }
input { flex: 1; background: #1b2838; border: 1px solid #4a90b8; border-radius: 4px; padding: 12px; color: #c7d5e0; font-size: 14px; }
input:focus { outline: none; border-color: #66c0f4; }
.btn { background: #4a90b8; border: none; border-radius: 4px; padding: 12px 20px; color: white; cursor: pointer; }
.btn:hover { background: #5ba0c8; }
.btn-danger { background: #c0392b; }
.controls { display: flex; gap: 10px; margin-bottom: 20px; }
.status { background: #2a475e; border-radius: 8px; padding: 10px 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
.profiles { display: flex; flex-direction: column; gap: 10px; }
.card { background: #2a475e; border-radius: 8px; padding: 15px; border-left: 4px solid #4a90b8; }
.card.match { border-left-color: #5ba32b; }
.card .top { display: flex; justify-content: space-between; align-items: center; }
.card .nick { font-size: 16px; font-weight: bold; }
.card .score { font-size: 20px; font-weight: bold; color: #66c0f4; background: #1b2838; padding: 5px 15px; border-radius: 4px; }
.card .info { color: #8f98a0; font-size: 12px; margin-top: 5px; }
.card .rp { margin-top: 10px; padding: 10px; background: #1b2838; border-radius: 4px; font-size: 13px; }
.remove { background: none; border: none; color: #c0392b; font-size: 18px; cursor: pointer; }
.log { background: #1b2838; border-radius: 8px; padding: 15px; margin-top: 20px; max-height: 200px; overflow-y: auto; display: none; }
.log h3 { color: #66c0f4; margin-bottom: 10px; }
.log-entry { padding: 5px 0; border-bottom: 1px solid #2a475e; font-size: 12px; }
.empty { text-align: center; padding: 40px; color: #6a7d8a; }
.notif { position: fixed; top: 20px; right: 20px; background: #5ba32b; color: white; padding: 15px 20px; border-radius: 8px; }
</style>
</head>
<body>
<div class="header"><h1>🎮 Steam Score Tracker</h1><p>Интервал: 15с</p></div>
<div class="input-row"><input id="input" placeholder="Ссылка на профиль Steam..."><button class="btn" id="addBtn">Добавить</button></div>
<div class="controls"><button class="btn" id="soundBtn">🔊 Звук: ВКЛ</button><button class="btn btn-danger" id="clearBtn">Очистить</button></div>
<div class="status"><span id="statusText">Ожидание...</span><span id="checkCount">Проверок: 0</span></div>
<div class="profiles" id="list"><div class="empty">Добавьте профиль</div></div>
<div class="log" id="log"><h3>📋 История</h3><div id="logEntries"></div></div>
<script>
const INTERVAL = 15000;
const STEAM_BASE = 76561197960265728n;
const profiles = [];
const state = {};
let checkCount = 0;
let soundEnabled = true;
let loopId = null;

function toMini(id64) { try { const n = BigInt(id64) - STEAM_BASE; return n >= 0n ? n.toString() : null; } catch { return null; } }
function toId64(mini) { try { return (BigInt(mini) + STEAM_BASE).toString(); } catch { return null; } }

function extract(input) {
    const t = input.trim();
    if (/^\\d+$/.test(t)) {
        const n = BigInt(t);
        return n > STEAM_BASE ? { mini: toMini(t) } : { mini: t };
    }
    let m = t.match(/\\/profiles\\/(\\d+)/); if (m) return { mini: toMini(m[1]) };
    m = t.match(/miniprofile\\/(\\d+)/); if (m) return { mini: m[1] };
    m = t.match(/\\[U:1:(\\d+)\\]/); if (m) return { mini: m[1] };
    m = t.match(/\\/id\\/([\\w-]+)/); if (m) return { custom: m[1] };
    return null;
}

async function fetchMini(id) {
    const r = await fetch('https://steamcommunity.com/miniprofile/' + id + '?_=' + Date.now() + '&r=' + Math.random(), { cache: 'no-store' });
    return r.text();
}

async function resolveCustom(name) {
    const r = await fetch('https://steamcommunity.com/id/' + name + '/?xml=1');
    const t = await r.text();
    const m = t.match(/<steamID64>(\\d+)<\\/steamID64>/);
    return m ? toMini(m[1]) : null;
}

function parseRP(html) { const m = html.match(/<span class="rich_presence"[^>]*>(.*?)<\\/span>/i); return m ? m[1].trim() : null; }
function parseScore(rp) { if (!rp) return null; const m = rp.match(/\\[\\s*(\\d+)\\s*:\\s*(\\d+)\\s*\\]/); return m ? m[1]+':'+m[2] : null; }
function parseName(html) { const m = html.match(/<span class="persona[^"]*"[^>]*>(.*?)<\\/span>/i); return m ? m[1].trim() : '?'; }
function parseGame(html) { const m = html.match(/<span class="miniprofile_game_name"[^>]*>(.*?)<\\/span>/i); return m ? m[1].trim() : null; }

const fmtTime = () => new Date().toLocaleTimeString();
const fmtInt = ms => ms ? Math.floor(ms/60000)+'м '+Math.floor((ms%60000)/1000)+'с' : '-';

function playSound() {
    if (!soundEnabled) return;
    try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 800; g.gain.value = 0.3; o.start(); o.stop(a.currentTime + 0.2); } catch {}
}

function notify(msg) {
    const n = document.createElement('div'); n.className = 'notif'; n.textContent = msg; document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function addLog(nick, oldS, newS) {
    document.getElementById('log').style.display = 'block';
    const e = document.createElement('div'); e.className = 'log-entry';
    e.textContent = fmtTime() + ' | ' + nick + ' | ' + oldS + ' → ' + newS;
    document.getElementById('logEntries').prepend(e);
}

function render() {
    const list = document.getElementById('list');
    document.getElementById('checkCount').textContent = 'Проверок: ' + checkCount;
    document.getElementById('statusText').textContent = profiles.length ? 'Работает • ' + profiles.length + ' профилей' : 'Ожидание...';
    if (!profiles.length) { list.innerHTML = '<div class="empty">Добавьте профиль</div>'; return; }
    list.innerHTML = profiles.map(p => {
        const s = state[p.id] || {};
        const elapsed = s.lastTime ? fmtInt(Date.now() - s.lastTime) : '';
        const info = s.inMatch ? s.rp : (s.game ? '🎮 ' + s.game : 'Не в игре');
        return '<div class="card ' + (s.inMatch ? 'match' : '') + '">' +
            '<div class="top"><div><div class="nick">' + (p.nick || '...') + '</div><div class="info">' + (elapsed ? 'Обновлено: ' + elapsed + ' назад' : '') + '</div></div>' +
            '<div style="display:flex;gap:10px;align-items:center">' + (s.inMatch ? '<div class="score">' + (s.score || '?') + '</div>' : '') +
            '<button class="remove" data-id="' + p.id + '">✕</button></div></div>' +
            '<div class="rp">' + info + '</div></div>';
    }).join('');
    list.querySelectorAll('.remove').forEach(b => b.onclick = () => { const i = profiles.findIndex(p => p.id === b.dataset.id); if (i >= 0) { profiles.splice(i, 1); delete state[b.dataset.id]; render(); } });
}

async function check(p) {
    const s = state[p.id];
    try {
        const html = await fetchMini(p.id);
        const rp = parseRP(html), score = parseScore(rp), game = parseGame(html);
        if (!p.nick) p.nick = parseName(html);
        if (game) s.game = game;

        if (s.first) {
            s.first = false;
            if (score) { s.inMatch = true; s.lastTime = Date.now(); playSound(); notify('🎯 ' + p.nick + ' в матче: ' + score); }
            s.rp = rp; s.score = score; return;
        }

        if (!rp && s.inMatch) { s.nullCount++; if (s.nullCount > 5) { s.inMatch = false; s.score = null; s.rp = null; s.lastTime = null; s.nullCount = 0; notify('⚠️ ' + p.nick + ' вышел'); } return; }
        s.nullCount = 0;

        if (!s.inMatch && score) { s.inMatch = true; s.lastTime = Date.now(); s.rp = rp; s.score = score; playSound(); notify('🎯 ' + p.nick + ' зашёл: ' + score); return; }
        if (s.inMatch && s.score && score && score !== s.score) { playSound(); addLog(p.nick, s.score, score); notify('▶ ' + p.nick + ': ' + s.score + ' → ' + score); s.lastTime = Date.now(); }
        s.rp = rp; s.score = score;
    } catch {}
}

async function loop() { checkCount++; await Promise.all(profiles.map(check)); render(); }

async function add(input) {
    const info = extract(input);
    if (!info) { notify('❌ Неверный формат'); return; }
    let mini = info.mini;
    if (info.custom) { mini = await resolveCustom(info.custom); if (!mini) { notify('❌ Не найден'); return; } }
    if (profiles.find(p => p.id === mini)) { notify('⚠️ Уже добавлен'); return; }
    profiles.push({ id: mini, nick: null });
    state[mini] = { rp: null, score: null, lastTime: null, game: null, nullCount: 0, first: true, inMatch: false };
    notify('✅ Добавлен');
    if (!loopId) { loop(); loopId = setInterval(loop, INTERVAL); }
    else render();
}

document.getElementById('addBtn').onclick = () => { const i = document.getElementById('input'); if (i.value.trim()) { add(i.value); i.value = ''; } };
document.getElementById('input').onkeypress = e => { if (e.key === 'Enter') document.getElementById('addBtn').click(); };
document.getElementById('soundBtn').onclick = () => { soundEnabled = !soundEnabled; document.getElementById('soundBtn').textContent = soundEnabled ? '🔊 Звук: ВКЛ' : '🔇 Звук: ВЫКЛ'; if (soundEnabled) playSound(); };
document.getElementById('clearBtn').onclick = () => { profiles.length = 0; Object.keys(state).forEach(k => delete state[k]); checkCount = 0; render(); };
</script>
</body>
</html>`);
        w.document.close();
    };

    document.body.appendChild(btn);
})();