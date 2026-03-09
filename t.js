const API_KEY = "3ac87beb-fd5e-4b47-9e5b-f487fc886d5a";
const INTERVAL = 500;

// ─── Настройки ───
let SHOW_POLL_COUNTER = false;
let SOUND_ENABLED = true;

// ─── Цвета ───
const c = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    orange: "\x1b[38;5;208m",
    white: "\x1b[37m",
};

// ─── Извлечение Match ID ───
function extractMatchId(input) {
    const urlMatch = input.match(/room\/([a-zA-Z0-9-]+)/);
    if (urlMatch) return urlMatch[1];
    const idMatch = input.trim().match(/^[a-zA-Z0-9-]{20,}$/);
    if (idMatch) return idMatch[0];
    return null;
}

// ─── Запрос ввода ───
function askQuestion(question) {
    return new Promise((resolve) => {
        const readline = require("readline");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// ─── Главная функция ───
async function main() {
    console.clear();
    console.log(`
${c.orange}${c.bright}  ╔═══════════════════════════════════════════╗
  ║         FACEIT SCORE MONITOR 	      ║
  ╚═══════════════════════════════════════════╝${c.reset}
`);

    const input = await askQuestion(
        `${c.orange}  Вставь ссылку на матч FACEIT и нажми Enter:${c.reset}\n\n  > `
    );

    const matchId = extractMatchId(input);

    if (!matchId) {
        console.log(`\n${c.red}  ✕ Не удалось извлечь Match ID${c.reset}`);
        console.log(`${c.gray}  Пример: https://www.faceit.com/en/cs2/room/1-f420855a-6caa-4a79-9abd-a2b6f2ac2550${c.reset}\n`);
        process.exit(1);
    }

    console.log(`\n${c.green}  ✓ Match ID: ${c.white}${matchId}${c.reset}`);
    console.log(`${c.gray}  Подключение...\n${c.reset}`);

    await new Promise((r) => setTimeout(r, 1000));

    startMonitoring(matchId);
}

// ─── Мониторинг ───
function startMonitoring(matchId) {
    let prev = { a: null, b: null };
    let history = [];
    let team1Name = "Team 1";
    let team2Name = "Team 2";
    let mapName = "";
    let pollCount = 0;
    let errors = 0;
    let intervalId = null;
    let lastDraw = "";
    let forceRedraw = false;

    // ─── Обработка клавиш ───
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        process.stdin.on("data", (key) => {
            // Ctrl+C
            if (key === "\u0003") {
                clearInterval(intervalId);
                process.stdout.write("\x1b[?25h");
                process.exit(0);
            }

            // S или s — звук
            if (key.toLowerCase() === "s") {
                SOUND_ENABLED = !SOUND_ENABLED;
                forceRedraw = true;
            }

            // C или c — счётчик
            if (key.toLowerCase() === "c") {
                SHOW_POLL_COUNTER = !SHOW_POLL_COUNTER;
                forceRedraw = true;
            }
        });
    }

    function buildScreen(a, b, status) {
        const t1 = team1Name.padStart(20);
        const t2 = team2Name.padEnd(20);

        let c1, c2;
        if (a > b) {
            c1 = c.green;
            c2 = c.red;
        } else if (a < b) {
            c1 = c.red;
            c2 = c.green;
        } else {
            c1 = c.yellow;
            c2 = c.yellow;
        }

        const statusColor =
            status === "FINISHED"
                ? c.red
                : status === "ONGOING"
                ? c.green
                : status === "CANCELLED"
                ? c.red
                : c.yellow;

        const soundStatus = SOUND_ENABLED 
            ? `${c.green}ON${c.reset}` 
            : `${c.red}OFF${c.reset}`;
        const counterStatus = SHOW_POLL_COUNTER 
            ? `${c.green}ON${c.reset}` 
            : `${c.red}OFF${c.reset}`;

        let screen = `
${c.orange}${c.bright}  ╔═══════════════════════════════════════════╗
  ║         FACEIT SCORE MONITOR 	      ║
  ╚═══════════════════════════════════════════╝${c.reset}
${c.gray}  Match: ${matchId}${c.reset}
${c.gray}  ─────────────────────────────────────────────${c.reset}

${c.dim}${t1}${c.reset}     ${c.bright}VS${c.reset}     ${c.dim}${t2}${c.reset}

          ${c1}${c.bright}    ${String(a).padStart(2)}     ${c.reset}${c.gray}:${c.reset}     ${c2}${c.bright}${String(b).padEnd(2)}${c.reset}

${c.gray}  ─────────────────────────────────────────────${c.reset}
  ${c.gray}Раунд: ${c.orange}${c.bright}${a + b}${c.reset}${c.gray}  │  Карта: ${c.cyan}${mapName || "—"}${c.reset}${c.gray}  │  ${statusColor}${status || "—"}${c.reset}
`;

        if (history.length > 0) {
            screen += `\n${c.dim}  История:${c.reset}\n`;
            history.slice(0, 5).forEach((h) => {
                screen += `${c.gray}    ${h.time}  ${c.white}${h.text}${c.reset}\n`;
            });
        }

        screen += `
${c.gray}  ─────────────────────────────────────────────${c.reset}
  ${c.dim}[S]${c.reset} Звук: ${soundStatus}   ${c.dim}[C]${c.reset} Счётчик: ${counterStatus}
`;

        if (SHOW_POLL_COUNTER) {
            screen += `${c.gray}  Запросов: ${pollCount} | Ошибок: ${errors}${c.reset}\n`;
        }

        return screen;
    }

    function drawScoreboard(a, b, status) {
        const screen = buildScreen(a, b, status);

        // Рисуем только если что-то изменилось
        if (screen === lastDraw && !forceRedraw) return;
        lastDraw = screen;
        forceRedraw = false;

        process.stdout.write("\x1b[?25l");
        process.stdout.write("\x1b[H");
        process.stdout.write("\x1b[2J");
        process.stdout.write(screen);
    }

    function beep() {
        if (SOUND_ENABLED) {
            process.stdout.write("\x07");
        }
    }

    async function poll() {
        pollCount++;

        try {
            let data = null;

            // Official API
            try {
                const r = await fetch(
                    `https://open.faceit.com/data/v4/matches/${matchId}`,
                    { headers: { Authorization: `Bearer ${API_KEY}` } }
                );
                if (r.ok) data = await r.json();
            } catch (e) {}

            // Fallback
            if (!data) {
                try {
                    const r = await fetch(
                        `https://api.faceit.com/match/v2/match/${matchId}`
                    );
                    if (r.ok) {
                        const json = await r.json();
                        data = json.payload || json;
                    }
                } catch (e) {}
            }

            if (!data) {
                errors++;
                return;
            }

            // Парсинг
            const teams = data.teams || {};
            team1Name = teams.faction1?.name || "Team 1";
            team2Name = teams.faction2?.name || "Team 2";

            let a = 0, b = 0;

            if (data.results?.score) {
                a = parseInt(data.results.score.faction1) || 0;
                b = parseInt(data.results.score.faction2) || 0;
            }
            if (data.detailed_results && Array.isArray(data.detailed_results)) {
                const last = data.detailed_results[data.detailed_results.length - 1];
                if (last?.factions) {
                    a = parseInt(last.factions.faction1?.score) || a;
                    b = parseInt(last.factions.faction2?.score) || b;
                }
            }
            if (data.summaryResults?.factions) {
                a = parseInt(data.summaryResults.factions.faction1?.score) || a;
                b = parseInt(data.summaryResults.factions.faction2?.score) || b;
            }

            mapName = data.voting?.map?.pick?.[0] || data.maps?.[0]?.name || "";

            const status = (data.status || data.state || "").toUpperCase();

            // Изменился ли счёт?
            if (prev.a !== null && (a !== prev.a || b !== prev.b)) {
                beep();
                const now = new Date().toLocaleTimeString("ru-RU");
                history.unshift({
                    time: now,
                    text: `${prev.a}:${prev.b} → ${a}:${b}`,
                });
                if (history.length > 20) history.pop();
            }

            prev = { a, b };
            drawScoreboard(a, b, status);

            if (status === "FINISHED" || status === "CANCELLED") {
                clearInterval(intervalId);
                console.log(
                    `\n${c.orange}${c.bright}  🏁 Матч завершён${c.reset}\n`
                );
                process.stdout.write("\x1b[?25h");
            }
        } catch (e) {
            errors++;
        }
    }

    poll();
    intervalId = setInterval(poll, INTERVAL);
}

main();