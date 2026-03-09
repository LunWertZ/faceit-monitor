// ==UserScript==
// @name         FACEIT Score Monitor — Standalone
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  FACEIT с API ключом
// @author       lun
// @match        https://www.faceit.com/*/cs2/room/*
// @match        https://www.faceit.com/*/csgo/room/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const API_KEY = "3ac87beb-fd5e-4b47-9e5b-f487fc886d5a"; // Client-side key

    function getMatchId() {
        const m = window.location.pathname.match(/room\/([^/]+)/);
        return m ? m[1] : null;
    }

    const MATCH_ID = getMatchId();
    if (!MATCH_ID) return;

    GM_addStyle(`
        #fsm-launch {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #ff5500, #ff7733);
            color: white;
            border: none;
            border-radius: 50px;
            padding: 14px 28px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 24px rgba(255,85,0,0.5);
            font-family: 'Segoe UI', sans-serif;
            transition: all 0.3s;
        }
        #fsm-launch:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 32px rgba(255,85,0,0.6);
        }
    `);

    const btn = document.createElement('button');
    btn.id = 'fsm-launch';
    btn.textContent = '📺 Открыть монитор счёта';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
        openMonitor(MATCH_ID);
        btn.textContent = '✓ Можно закрыть эту вкладку';
        btn.style.background = '#333';
        setTimeout(() => btn.remove(), 4000);
    });

    function openMonitor(matchId) {
        const w = 400, h = 220;
        const left = screen.width - w - 30;

        const popup = window.open('', 'FSM',
            `width=${w},height=${h},left=${left},top=30,` +
            `menubar=no,toolbar=no,location=no,status=no,resizable=yes`
        );

        if (!popup) {
            alert('Разреши всплывающие окна для faceit.com!');
            return;
        }

        popup.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FACEIT Live Score</title>
    <link rel="icon" href="https://cdn-frontend.faceit.com/web/static/media/faceit.f47ee0b8.ico">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            background: #0a0a1a;
            font-family: 'Segoe UI', system-ui, sans-serif;
            color: #fff;
            overflow: hidden;
            user-select: none;
            height: 100vh;
        }
        .c { display:flex; flex-direction:column; height:100%; padding:10px 14px; }

        .hdr {
            display:flex; justify-content:space-between; align-items:center;
            padding-bottom:8px; border-bottom:1px solid rgba(255,85,0,0.2);
        }
        .hdr-l { display:flex; align-items:center; gap:6px; }
        .dot {
            width:7px; height:7px; border-radius:50%;
            background:#fbbf24; animation:p 1.5s infinite;
        }
        .dot.ok { background:#4ade80; }
        .dot.err { background:#f87171; }
        @keyframes p { 0%,100%{opacity:1} 50%{opacity:.3} }
        .ttl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#ff5500; }
        .sts { font-size:9px; color:#555; }
        .src { font-size:8px; color:#333; margin-left:4px; }

        .sb {
            display:flex; align-items:center; justify-content:center;
            flex:1; gap:10px;
        }
        .tm { text-align:center; flex:1; min-width:0; }
        .tn {
            font-size:11px; font-weight:600; color:#888;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            margin-bottom:4px;
        }
        .sc {
            font-size:52px; font-weight:900; line-height:1;
            transition: all 0.3s;
        }
        .sc.w { color:#4ade80; text-shadow:0 0 25px rgba(74,222,128,.5); }
        .sc.l { color:#f87171; text-shadow:0 0 25px rgba(248,113,113,.5); }
        .sc.d { color:#fbbf24; text-shadow:0 0 25px rgba(251,191,36,.5); }
        .dv { font-size:18px; font-weight:800; color:#333; }

        .ft {
            display:flex; justify-content:space-between; align-items:center;
            padding-top:8px; border-top:1px solid rgba(255,255,255,.05);
        }
        .rnd { font-size:11px; color:#666; }
        .rnd b { color:#ff5500; }
        .mp { font-size:10px; color:#555; }
        .lc { font-size:9px; color:#444; text-align:center; padding-top:3px; }

        .flash { animation: fl .5s ease-out; }
        @keyframes fl { 0%{background:rgba(255,85,0,.25)} 100%{background:transparent} }

        .fin-banner {
            background: rgba(255,85,0,0.1);
            border: 1px solid rgba(255,85,0,0.3);
            border-radius: 6px;
            padding: 4px 8px;
            margin-top: 4px;
            text-align: center;
            font-size: 10px;
            color: #ff5500;
            font-weight: 600;
            display: none;
        }
        .fin-banner.show { display: block; }
    </style>
</head>
<body>
    <div class="c">
        <div class="hdr">
            <div class="hdr-l">
                <div class="dot" id="dot"></div>
                <span class="ttl">FACEIT Live</span>
                <span class="src" id="src"></span>
            </div>
            <span class="sts" id="sts">Подключение...</span>
        </div>
        <div class="sb" id="sb">
            <div class="tm">
                <div class="tn" id="t1">—</div>
                <div class="sc d" id="s1">-</div>
            </div>
            <div class="dv">:</div>
            <div class="tm">
                <div class="tn" id="t2">—</div>
                <div class="sc d" id="s2">-</div>
            </div>
        </div>
        <div class="ft">
            <span class="rnd">Раунд: <b id="rnd">-</b></span>
            <span class="mp" id="mp"></span>
        </div>
        <div class="lc" id="lc"></div>
        <div class="fin-banner" id="fin">🏁 Матч завершён</div>
    </div>

    <script>
        const MID = "${matchId}";
        const API_KEY = "${API_KEY}";
        const INTERVAL = 500;
        let prev = { a: null, b: null };
        let matchFinished = false;

        function $(id) { return document.getElementById(id); }

        function beep() {
            try {
                const c = new AudioContext();
                const o = c.createOscillator();
                const g = c.createGain();
                o.connect(g); g.connect(c.destination);
                o.frequency.value = 880;
                g.gain.setValueAtTime(0.2, c.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
                o.start(); o.stop(c.currentTime + 0.25);
            } catch(e) {}
        }

        // ═══ Официальный API (с ключом) ═══
        async function pollOfficial() {
            try {
                const r = await fetch(
                    "https://open.faceit.com/data/v4/matches/" + MID,
                    { headers: { "Authorization": "Bearer " + API_KEY } }
                );
                if (!r.ok) throw new Error(r.status);
                const d = await r.json();
                $("src").textContent = "API v4";
                updateOfficial(d);
                return true;
            } catch(e) {
                return false;
            }
        }

        // ═══ Внутренний API (без ключа, fallback) ═══
        async function pollInternal() {
            try {
                const r = await fetch(
                    "https://api.faceit.com/match/v2/match/" + MID
                );
                if (!r.ok) throw new Error(r.status);
                const d = await r.json();
                $("src").textContent = "internal";
                updateInternal(d.payload || d);
                return true;
            } catch(e) {
                return false;
            }
        }

        // ═══ Главный цикл ═══
        async function poll() {
            if (matchFinished) return;

            // Сначала официальный, потом fallback
            const ok = await pollOfficial();
            if (!ok) {
                const ok2 = await pollInternal();
                if (!ok2) {
                    $("dot").className = "dot err";
                    $("sts").textContent = "Ошибка связи";
                }
            }
        }

        // ═══ Обработка: Official API v4 ═══
        function updateOfficial(d) {
            const teams = d.teams || {};
            $("t1").textContent = teams.faction1?.name || "Team 1";
            $("t2").textContent = teams.faction2?.name || "Team 2";

            let a = 0, b = 0;

            if (d.results && d.results.score) {
                a = parseInt(d.results.score.faction1) || 0;
                b = parseInt(d.results.score.faction2) || 0;
            }
            if (d.detailed_results && Array.isArray(d.detailed_results)) {
                const last = d.detailed_results[d.detailed_results.length - 1];
                if (last && last.factions) {
                    a = parseInt(last.factions.faction1?.score) || a;
                    b = parseInt(last.factions.faction2?.score) || b;
                }
            }

            // Карта
            const map = d.voting?.map?.pick?.[0] ||
                        d.maps?.[0]?.name || "";
            $("mp").textContent = map;

            applyScore(a, b, d.status);
        }

        // ═══ Обработка: Internal API ═══
        function updateInternal(p) {
            const t = p.teams || {};
            $("t1").textContent = t.faction1?.name || "Team 1";
            $("t2").textContent = t.faction2?.name || "Team 2";

            let a = 0, b = 0;

            if (p.summaryResults && p.summaryResults.factions) {
                a = parseInt(p.summaryResults.factions.faction1?.score) || 0;
                b = parseInt(p.summaryResults.factions.faction2?.score) || 0;
            }
            if (p.results && p.results.score) {
                a = parseInt(p.results.score.faction1) || a;
                b = parseInt(p.results.score.faction2) || b;
            }
            if (p.detailed_results && Array.isArray(p.detailed_results)) {
                const last = p.detailed_results[p.detailed_results.length - 1];
                if (last && last.factions) {
                    a = parseInt(last.factions.faction1?.score) || a;
                    b = parseInt(last.factions.faction2?.score) || b;
                }
            }

            const map = p.voting?.map?.pick?.[0] || "";
            $("mp").textContent = map;

            applyScore(a, b, p.status || p.state);
        }

        // ═══ Общая логика отображения ═══
        function applyScore(a, b, status) {
            $("s1").textContent = a;
            $("s2").textContent = b;
            $("rnd").textContent = a + b;

            $("s1").className = "sc " + (a > b ? "w" : a < b ? "l" : "d");
            $("s2").className = "sc " + (a > b ? "l" : a < b ? "w" : "d");

            // Изменение счёта
            if (prev.a !== null && (a !== prev.a || b !== prev.b)) {
                const sb = $("sb");
                sb.classList.remove("flash");
                void sb.offsetWidth;
                sb.classList.add("flash");
                beep();

                const now = new Date().toLocaleTimeString("ru-RU");
                $("lc").textContent =
                    prev.a + ":" + prev.b + " \\u2192 " + a + ":" + b + " (" + now + ")";
            }

            prev = { a, b };

            // Статус
            const s = (status || "").toUpperCase();
            if (s === "FINISHED" || s === "CANCELLED") {
                $("dot").className = "dot err";
                $("sts").textContent = s === "FINISHED" ? "Завершён" : "Отменён";
                $("fin").className = "fin-banner show";
                $("fin").textContent = s === "FINISHED"
                    ? "\\uD83C\\uDFC1 Матч завершён — " + a + " : " + b
                    : "\\u274C Матч отменён";
                document.title = a + " : " + b + " — " + s;
                matchFinished = true;
            } else {
                $("dot").className = "dot ok";
                $("sts").textContent = new Date().toLocaleTimeString("ru-RU");
                document.title = a + " : " + b + " — FACEIT Live";
            }
        }

        // ═══ Старт ═══
        poll();
        setInterval(poll, INTERVAL);
    </script>
</body>
</html>`);

        popup.document.close();
    }
})();