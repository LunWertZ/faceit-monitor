// tracker.js
const https = require('https');
const readline = require('readline');
const { exec } = require('child_process');
const crypto = require('crypto');

const INTERVAL = 15000;

const profiles = [];
const state = {};
let checkCount = 0;
let isRunning = false;
let loopTimeout = null;
let soundEnabled = true;

const c = {
    reset: '\x1b[0m', bright: '\x1b[1m',
    green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m',
    cyan: '\x1b[36m', red: '\x1b[31m',
    gray: '\x1b[90m', white: '\x1b[37m',
    bgCyan: '\x1b[46m', bgMagenta: '\x1b[45m',
    bgYellow: '\x1b[43m', bgGreen: '\x1b[42m',
};

const playerColors = [c.cyan, c.magenta, c.yellow, c.green, c.blue];
const playerBg = [c.bgCyan, c.bgMagenta, c.bgYellow, c.bgGreen, '\x1b[44m'];

const STEAM_ID64_BASE = 76561197960265728n;

function steamId64ToMiniprofile(steamId64) {
    try {
        const id64 = BigInt(steamId64);
        const miniprofileId = id64 - STEAM_ID64_BASE;
        if (miniprofileId < 0n) return null;
        return miniprofileId.toString();
    } catch { return null; }
}

function miniprofileToSteamId64(miniprofileId) {
    try {
        const id = BigInt(miniprofileId);
        return (id + STEAM_ID64_BASE).toString();
    } catch { return null; }
}

function extractSteamInfo(input) {
    const trimmed = input.trim();

    if (/^\d+$/.test(trimmed)) {
        const num = BigInt(trimmed);
        if (num > STEAM_ID64_BASE) {
            return { steamId64: trimmed, miniprofileId: steamId64ToMiniprofile(trimmed) };
        }
        return { miniprofileId: trimmed, steamId64: miniprofileToSteamId64(trimmed) };
    }

    const profileMatch = trimmed.match(/\/profiles\/(\d+)/);
    if (profileMatch) {
        return { steamId64: profileMatch[1], miniprofileId: steamId64ToMiniprofile(profileMatch[1]) };
    }

    const miniMatch = trimmed.match(/miniprofile\/(\d+)/);
    if (miniMatch) {
        return { miniprofileId: miniMatch[1], steamId64: miniprofileToSteamId64(miniMatch[1]) };
    }

    const steamId3Match = trimmed.match(/\[U:1:(\d+)\]/);
    if (steamId3Match) {
        return { miniprofileId: steamId3Match[1], steamId64: miniprofileToSteamId64(steamId3Match[1]) };
    }

    const customMatch = trimmed.match(/\/id\/([a-zA-Z0-9_-]+)/);
    if (customMatch) {
        return { customId: customMatch[1], needsResolve: true };
    }

    return null;
}

function resolveCustomUrl(customId) {
    return new Promise((resolve, reject) => {
        const req = https.get(`https://steamcommunity.com/id/${customId}/?xml=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, res => {
            let data = '';
            res.on('data', ch => data += ch);
            res.on('end', () => {
                const match = data.match(/<steamID64>(\d+)<\/steamID64>/);
                if (match) resolve(match[1]);
                else reject(new Error('Не найден'));
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

function playSound() {
    if (!soundEnabled) return;
    exec('rundll32 user32.dll,MessageBeep');
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function clearLine() { process.stdout.write('\r\x1b[K'); }

function prompt() {
    clearLine();
    rl.question(`${c.cyan}> ${c.reset}`, handleInput);
}

function addProfile(id, steamId64) {
    if (profiles.find(p => p.id === id)) {
        console.log(`${c.yellow}  ⚠ Уже добавлен${c.reset}`);
        return false;
    }

    profiles.push({ id, steamId64, name: `Игрок ${profiles.length + 1}`, nick: null });
    state[id] = {
        lastRichPresence: null,
        lastScore: null,
        lastChangeTime: null,
        lastGame: null,
        lastStatus: null,
        nullCount: 0,
        firstCheck: true,
        inMatch: false,
    };

    console.log(`${c.green}  ✓ Добавлен: ${id}${c.reset}`);

    if (!isRunning && profiles.length > 0) {
        isRunning = true;
        console.log(`${c.green}  ▶ Трекинг запущен${c.reset}\n`);
        loop();
    }
    return true;
}

async function addProfileWithResolve(input) {
    const info = extractSteamInfo(input);
    if (!info) {
        console.log(`${c.red}  ✗ Неверный формат${c.reset}`);
        return;
    }

    if (info.needsResolve) {
        console.log(`${c.gray}  Резолвим...${c.reset}`);
        try {
            info.steamId64 = await resolveCustomUrl(info.customId);
            info.miniprofileId = steamId64ToMiniprofile(info.steamId64);
        } catch (err) {
            console.log(`${c.red}  ✗ ${err.message}${c.reset}`);
            return;
        }
    }

    if (info.miniprofileId) addProfile(info.miniprofileId, info.steamId64);
}

function clearAll() {
    isRunning = false;
    if (loopTimeout) clearTimeout(loopTimeout);
    profiles.length = 0;
    Object.keys(state).forEach(k => delete state[k]);
    checkCount = 0;
    console.log(`${c.yellow}  ✓ Очищено${c.reset}\n`);
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    console.log(`${c.green}  🔊 Звук: ${soundEnabled ? 'ВКЛ' : 'ВЫКЛ'}${c.reset}`);
    if (soundEnabled) playSound();
}

function showHelp() {
    console.log(`
${c.cyan}  /add <ссылка>  — добавить профиль
  /list          — список
  /sound         — вкл/выкл звук
  /clear         — очистить
  /exit          — выход${c.reset}
`);
}

function showList() {
    if (!profiles.length) { console.log(`${c.gray}  Пусто${c.reset}`); return; }
    profiles.forEach((p, i) => {
        const s = state[p.id];
        let status;
        if (s?.inMatch) {
            status = `в матче ${s.lastScore || ''}`;
        } else if (s?.lastStatus) {
            status = s.lastStatus;
        } else if (s?.lastGame) {
            status = s.lastGame;
        } else {
            status = 'не в игре';
        }
        console.log(`${playerColors[i % 5]}  ${p.nick || p.name}: ${status}${c.reset}`);
    });
}

async function handleInput(input) {
    const t = input.trim();
    if (!t) { prompt(); return; }

    if (t.startsWith('/')) {
        const [cmd, ...args] = t.split(/\s+/);
        const arg = args.join(' ');

        switch (cmd) {
            case '/add': arg ? await addProfileWithResolve(arg) : console.log(`${c.yellow}  /add <ссылка>${c.reset}`); break;
            case '/list': showList(); break;
            case '/sound': toggleSound(); break;
            case '/clear': clearAll(); break;
            case '/help': showHelp(); break;
            case '/exit': process.exit(0);
            default: console.log(`${c.red}  ✗ /help${c.reset}`);
        }
        prompt(); return;
    }

    await addProfileWithResolve(t);
    prompt();
}

function fetchMiniprofile(id) {
    return new Promise((resolve, reject) => {
        const rand = crypto.randomBytes(16).toString('hex');
        const ts = Date.now();

        const options = {
            hostname: 'steamcommunity.com',
            path: `/miniprofile/${id}?_=${ts}&r=${rand}`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
                'Accept': 'text/html,*/*',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Connection': 'close',
            },
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', ch => data += ch);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

function parseRP(html) {
    if (!html) return null;
    const m = html.match(/<span\s+class="rich_presence"[^>]*>(.*?)<\/span>/i);
    return m ? m[1].trim() : null;
}

function parseScore(t) {
    if (!t) return null;
    const m = t.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
    return m ? `${m[1]}:${m[2]}` : null;
}

function parseName(html) {
    if (!html) return null;
    const m = html.match(/<span\s+class="persona[^"]*"[^>]*>(.*?)<\/span>/i);
    return m ? m[1].trim() : '?';
}

function parseGameInfo(html) {
    if (!html) return null;
    const gameMatch = html.match(/<span\s+class="miniprofile_game_name"[^>]*>(.*?)<\/span>/i);
    const stateMatch = html.match(/<span\s+class="game_state"[^>]*>(.*?)<\/span>/i);
    return {
        game: gameMatch ? gameMatch[1].trim() : null,
        state: stateMatch ? stateMatch[1].trim() : null,
    };
}

const pad = (n, l = 2) => String(n).padStart(l, '0');
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtFull = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${fmtTime(d)}`;
const fmtInt = ms => ms ? `${Math.floor(ms/60000)}м ${Math.floor((ms%60000)/1000)}с` : '-';

async function checkOne(profile, idx) {
    const now = new Date();
    const s = state[profile.id];
    if (!s) return;

    const col = playerColors[idx % 5];

    try {
        const html = await fetchMiniprofile(profile.id);
        const rp = parseRP(html);
        const score = parseScore(rp);
        const gameInfo = parseGameInfo(html);

        if (!profile.nick) profile.nick = parseName(html);
        if (gameInfo.game) s.lastGame = gameInfo.game;

        // Сохраняем полный статус (rich_presence или game_state)
        if (rp) {
            s.lastStatus = rp;
        } else if (gameInfo.state && gameInfo.game) {
            s.lastStatus = `${gameInfo.state} - ${gameInfo.game}`;
        } else if (gameInfo.game) {
            s.lastStatus = gameInfo.game;
        } else {
            s.lastStatus = null;
        }

        // Первая проверка
        if (s.firstCheck) {
            s.firstCheck = false;
            clearLine();

            if (rp && score) {
                console.log(`\n${playerBg[idx % 5]}${c.white} 🎯 ${profile.nick} | ${rp} ${c.reset}\n`);
                s.lastChangeTime = now;
                s.inMatch = true;
                playSound();
            } else if (rp) {
                console.log(`\n${col} 🎮 ${profile.nick} | ${rp} ${c.reset}\n`);
            } else if (gameInfo.game) {
                console.log(`\n${col} 🎮 ${profile.nick} | ${gameInfo.state || 'В игре'} - ${gameInfo.game} ${c.reset}\n`);
            } else {
                console.log(`\n${c.gray} 👤 ${profile.nick} | Не в игре ${c.reset}\n`);
            }

            s.lastRichPresence = rp;
            s.lastScore = score;
            return;
        }

        // Вышел из матча (был в матче со счётом, теперь нет счёта)
        if (s.inMatch && !score) {
            s.nullCount++;
            if (s.nullCount > 5) {
                clearLine();
                if (rp) {
                    console.log(`\n${c.yellow}  ⚠ ${profile.nick} — матч завершён${c.reset}`);
                    console.log(`${col}    Сейчас: ${rp}${c.reset}\n`);
                } else if (gameInfo.game) {
                    console.log(`\n${c.yellow}  ⚠ ${profile.nick} — матч завершён${c.reset}`);
                    console.log(`${col}    Сейчас: ${gameInfo.state || 'В игре'} - ${gameInfo.game}${c.reset}\n`);
                } else {
                    console.log(`\n${c.yellow}  ⚠ ${profile.nick} — вышел из игры${c.reset}\n`);
                }
                s.inMatch = false;
                s.lastScore = null;
                s.lastChangeTime = null;
                s.nullCount = 0;
            }
            s.lastRichPresence = rp;
            return;
        }

        s.nullCount = 0;

        // Зашёл в новый матч (появился счёт)
        if (!s.inMatch && score) {
            playSound();
            clearLine();
            console.log(`\n${playerBg[idx % 5]}${c.white} 🎯 ${profile.nick} | ${rp} ${c.reset}\n`);
            s.lastChangeTime = now;
            s.inMatch = true;
            s.lastRichPresence = rp;
            s.lastScore = score;
            return;
        }

        // Счёт изменился
        if (s.inMatch && s.lastScore && score && score !== s.lastScore) {
            const intMs = s.lastChangeTime ? now - s.lastChangeTime : null;

            playSound();
            clearLine();
            console.log(`\n${playerBg[idx % 5]}${c.white}${c.bright} ▶ ${profile.nick}: ${s.lastScore} → ${score} ${c.reset}`);
            console.log(`${col}  ${fmtFull(now)} | Интервал: ${fmtInt(intMs)}${c.reset}`);
            console.log(`${c.gray}  ${rp}${c.reset}\n`);

            s.lastChangeTime = now;
        }

        s.lastRichPresence = rp;
        s.lastScore = score;

    } catch {}
}

function printStatus() {
    if (!profiles.length) return;

    const lines = profiles.map((p, i) => {
        const s = state[p.id];
        if (!s) return '';

        let status;
        if (s.inMatch && s.lastScore) {
            const elapsed = s.lastChangeTime ? Date.now() - s.lastChangeTime.getTime() : 0;
            status = `${s.lastScore}${elapsed ? ` ${fmtInt(elapsed)}` : ''}`;
        } else if (s.lastStatus) {
            status = s.lastStatus;
        } else {
            status = 'оффлайн';
        }

        return `${playerColors[i % 5]}${p.nick || p.name}:${c.reset} ${status}`;
    }).filter(Boolean);

    process.stdout.write(`\r${c.gray}[${fmtTime(new Date())}] #${checkCount} ${soundEnabled ? '🔊' : '🔇'} | ${lines.join(' | ')}      `);
}

async function loop() {
    if (!isRunning || !profiles.length) { isRunning = false; return; }

    checkCount++;
    await Promise.all(profiles.map((p, i) => checkOne(p, i)));
    printStatus();

    loopTimeout = setTimeout(loop, INTERVAL);
}

process.on('SIGINT', () => {
    console.log('\n');
    process.exit(0);
});

console.log(`${c.cyan}${c.bright}
╔═════════════════════════════════════════╗
║   🎮 STEAM SCORE TRACKER v8.3          ║
║   Интервал: ${INTERVAL/1000}с                        ║
║   Вставьте ссылку или /help            ║
╚═════════════════════════════════════════╝${c.reset}
`);

prompt();