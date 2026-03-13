// ==UserScript==
// @name         Steam Miniprofile Button
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  miniprofile button
// @author       LunWy
// @match        https://steamcommunity.com/profiles/*
// @match        https://steamcommunity.com/id/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STEAM_ID64_BASE = 76561197960265728n;

    function getSteamId64() {
        const elements = document.querySelectorAll('[data-steamid]');
        for (const el of elements) {
            const id = el.getAttribute('data-steamid');
            if (id && /^\d{17}$/.test(id)) return id;
        }

        const profileMatch = window.location.pathname.match(/\/profiles\/(\d{17})/);
        if (profileMatch) return profileMatch[1];

        if (typeof g_rgProfileData !== 'undefined' && g_rgProfileData.steamid) {
            return g_rgProfileData.steamid;
        }

        const steamidMatch = document.body.innerHTML.match(/"steamid":"(\d{17})"/);
        if (steamidMatch) return steamidMatch[1];

        return null;
    }

    function steamId64ToMiniprofile(steamId64) {
        try {
            const id64 = BigInt(steamId64);
            const miniprofileId = id64 - STEAM_ID64_BASE;
            if (miniprofileId < 0n) return null;
            return miniprofileId.toString();
        } catch {
            return null;
        }
    }

    function createButton() {
        const steamId64 = getSteamId64();
        if (!steamId64) return;

        const miniprofileId = steamId64ToMiniprofile(steamId64);
        if (!miniprofileId) return;

        const miniprofileUrl = `https://steamcommunity.com/miniprofile/${miniprofileId}`;

        const btn = document.createElement('a');
        btn.href = miniprofileUrl;
        btn.target = '_blank';
        btn.textContent = '🔗 Miniprofile';
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 8px 15px;
            margin: 10px 5px;
            background: linear-gradient(to bottom, #67c1f5 0%, #417a9b 100%);
            color: white;
            text-decoration: none;
            border-radius: 3px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: all 0.2s;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(to bottom, #7ed1ff 0%, #4a8aab 100%)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'linear-gradient(to bottom, #67c1f5 0%, #417a9b 100%)';
        });

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Copy ID';
        copyBtn.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 8px 15px;
            margin: 10px 5px;
            background: linear-gradient(to bottom, #4a4a4a 0%, #2a2a2a 100%);
            color: white;
            border: none;
            border-radius: 3px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: all 0.2s;
        `;

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(miniprofileId).then(() => {
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => { copyBtn.textContent = '📋 Copy ID'; }, 1500);
            });
        });

        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.background = 'linear-gradient(to bottom, #5a5a5a 0%, #3a3a3a 100%)';
        });

        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.background = 'linear-gradient(to bottom, #4a4a4a 0%, #2a2a2a 100%)';
        });

        const container = document.createElement('div');
        container.style.cssText = 'display: flex; align-items: center; flex-wrap: wrap;';
        container.appendChild(btn);
        container.appendChild(copyBtn);

        const idText = document.createElement('span');
        idText.textContent = miniprofileId;
        idText.style.cssText = 'color: #8f98a0; font-size: 11px; margin-left: 10px; font-family: monospace;';
        container.appendChild(idText);

        const targets = ['.profile_header_actions', '.profile_header_summary', '.profile_header', '.persona_name'];
        for (const selector of targets) {
            const target = document.querySelector(selector);
            if (target) {
                target.appendChild(container);
                return;
            }
        }

        document.body.insertBefore(container, document.body.firstChild);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButton);
    } else {
        createButton();
    }
})();