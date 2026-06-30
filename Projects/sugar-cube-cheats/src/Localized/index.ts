import {cnNpcLocalePack} from "./CN/npcLocale";
import {enNpcLocalePack} from "./EN/npcLocale";
import {CheatLocalePack, LocaleKey} from "./types";

const localeRegistry: Record<LocaleKey, CheatLocalePack> = {
    en: enNpcLocalePack,
    cn: cnNpcLocalePack
};

function detectDefaultLocale(): LocaleKey {
    const normalizedLanguage = (navigator.language || "").toLowerCase();
    if (normalizedLanguage.startsWith("zh")) {
        return "cn";
    }
    return "en";
}

export function getActiveNpcLocalePack(): CheatLocalePack {
    const storedLocale = (localStorage.getItem("dolCheatLocale") || "").toLowerCase();
    if (storedLocale === "cn") {
        return localeRegistry.cn;
    }
    if (storedLocale === "en") {
        return localeRegistry.en;
    }
    return localeRegistry[detectDefaultLocale()];
}

export function getActiveCheatLocalePack(): CheatLocalePack {
    return getActiveNpcLocalePack();
}

