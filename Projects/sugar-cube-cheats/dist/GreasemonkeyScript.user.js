// ==UserScript==
// @name                Sugar Cube Cheats
// @namespace           kinuseka.local
// @version             1.0.0
// @description         User-friendly cheat panel for Degrees of Lewdity.
// @author              Kinuseka
// @match               https://eltirosto.github.io/Degrees-of-Lewdity-Chinese-Localization/*
// @match               *://*/*Degrees*Lewdity*.html*
// @match               file:///*Degrees*Lewdity*.html*
// @grant               unsafeWindow
// @run-at              document-idle
// @sandbox             raw
// ==/UserScript==


/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/Cheats/CoreCheats.ts"
/*!**********************************!*\
  !*** ./src/Cheats/CoreCheats.ts ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cheatSectionsByTab: () => (/* binding */ cheatSectionsByTab),
/* harmony export */   getValueByPath: () => (/* binding */ getValueByPath),
/* harmony export */   hasPath: () => (/* binding */ hasPath),
/* harmony export */   resolveFieldTier: () => (/* binding */ resolveFieldTier),
/* harmony export */   resolveFieldTierHelp: () => (/* binding */ resolveFieldTierHelp),
/* harmony export */   setValueByPath: () => (/* binding */ setValueByPath),
/* harmony export */   tabOrder: () => (/* binding */ tabOrder),
/* harmony export */   tierColorMap: () => (/* binding */ tierColorMap),
/* harmony export */   utilityActions: () => (/* binding */ utilityActions)
/* harmony export */ });
const tabOrder = ["money", "stats", "status", "skills", "reputation", "playerBody", "npc", "utility"];
const cheatSectionsByTab = {
    money: [
        {
            id: "money-main",
            title: "Money",
            fields: [
                { key: "money", min: 0, max: 100000000 },
                { key: "feats.allSaves.points", min: 0, max: 1000 }
            ]
        }
    ],
    stats: [
        {
            id: "stats-core",
            title: "Core Stats",
            fields: [
                { key: "purity", min: 0, max: 1000 },
                { key: "beauty", min: 0, max: "beautymax" },
                { key: "physique", min: 0, max: "physiquemax" },
                { key: "willpower", min: 0, max: "willpowermax" },
                { key: "awareness", min: 0, max: 1000 },
                { key: "promiscuity", min: 0, max: 1000 },
                { key: "exhibitionism", min: 0, max: 1000 },
                { key: "deviancy", min: 0, max: 1000 }
            ]
        }
    ],
    status: [
        {
            id: "status-main",
            title: "Status",
            fields: [
                { key: "pain", min: 0, max: 100 },
                { key: "arousal", min: 0, max: "arousalmax" },
                { key: "tiredness", min: 0, max: 1000 },
                { key: "stress", min: 0, max: "stressmax" },
                { key: "trauma", min: 0, max: "traumamax" },
                { key: "control", min: 0, max: "controlmax" },
                { key: "allure", min: 0, max: 10000 },
                { key: "drunk", min: 0, max: 1000 },
                { key: "drugged", min: 0, max: 1000 },
                { key: "hallucinogen", min: 0, max: 1000 }
            ]
        }
    ],
    skills: [
        {
            id: "skills-sex",
            title: "Sex Skills",
            fields: [
                { key: "seductionskill", min: 0, max: 1000 },
                { key: "oralskill", min: 0, max: 1000 },
                { key: "chestskill", min: 0, max: 1000 },
                { key: "handskill", min: 0, max: 1000 },
                { key: "bottomskill", min: 0, max: 1000 },
                { key: "analskill", min: 0, max: 1000 },
                { key: "vaginalskill", min: 0, max: 1000 },
                { key: "feetskill", min: 0, max: 1000 },
                { key: "thighskill", min: 0, max: 1000 },
                { key: "penileskill", min: 0, max: 1000 }
            ]
        },
        {
            id: "skills-general",
            title: "General Skills",
            fields: [
                { key: "corruption_slime", min: 0, max: 100 },
                { key: "skulduggery", min: 0, max: 1000 },
                { key: "danceskill", min: 0, max: 1000 },
                { key: "swimmingskill", min: 0, max: 1000 },
                { key: "athletics", min: 0, max: 1000 },
                { key: "tending", min: 0, max: 1000 },
                { key: "housekeeping", min: 0, max: 1000 }
            ]
        },
        {
            id: "skills-school",
            title: "School Skills",
            fields: [
                { key: "science", min: 0, max: 1000 },
                { key: "sciencetrait", min: 0, max: 4 },
                { key: "maths", min: 0, max: 1000 },
                { key: "mathstrait", min: 0, max: 4 },
                { key: "english", min: 0, max: 1000 },
                { key: "englishtrait", min: 0, max: 4 },
                { key: "history", min: 0, max: 1000 },
                { key: "historytrait", min: 0, max: 4 }
            ]
        },
        {
            id: "skills-weapon",
            title: "Weapon Skills",
            fields: [
                { key: "prof.spray", min: 0, max: 1000 },
                { key: "prof.net", min: 0, max: 1000 }
            ]
        }
    ],
    reputation: [
        {
            id: "reputation-main",
            title: "Reputation",
            fields: [
                { key: "fame.sex", min: 0, max: 1000 },
                { key: "fame.prostitution", min: 0, max: 1000 },
                { key: "fame.business", min: 0, max: 1000 },
                { key: "fame.scrap", min: 0, max: 1000 },
                { key: "fame.social", min: 0, max: 1000 },
                { key: "fame.good", min: 0, max: 1000 },
                { key: "crimehistory", min: 0, max: 30000 },
                { key: "crime", min: 0, max: 5000 }
            ]
        }
    ],
    playerBody: [
        {
            id: "player-body-main",
            title: "Player Body",
            fields: [
                { key: "player.breastsize", min: 0, max: 20 },
                { key: "milk_volume", min: 0, max: 10000 },
                { key: "player.penissize", min: 0, max: 10 },
                { key: "semen_volume", min: 0, max: 10000 },
                { key: "player.bottomsize", min: 0, max: 20 },
                { key: "bottomgrowthtimer", min: 0, max: 10 },
                { key: "player.pregnancyBelly", min: 0, max: 30 },
                { key: "pregnancytimer", min: 0, max: 400 },
                { key: "cycleDay", min: 0, max: 40 }
            ]
        }
    ]
};
const utilityActions = [
    { key: "setMaxMoney", mode: "max", fieldKeys: ["money", "feats.allSaves.points"] },
    { key: "setMinCrime", mode: "min", fieldKeys: ["crimehistory", "crime"] },
    {
        key: "maxCoreStats",
        mode: "max",
        fieldKeys: ["purity", "beauty", "physique", "willpower", "awareness", "promiscuity", "exhibitionism", "deviancy"]
    },
    {
        key: "maxSkills",
        mode: "max",
        fieldKeys: [
            "seductionskill", "oralskill", "chestskill", "handskill", "bottomskill", "analskill", "vaginalskill", "feetskill", "thighskill", "penileskill",
            "skulduggery", "danceskill", "swimmingskill", "athletics", "tending", "housekeeping",
            "science", "sciencetrait", "maths", "mathstrait", "english", "englishtrait", "history", "historytrait",
            "prof.spray", "prof.net"
        ]
    },
    { key: "resetNegativeStatus", mode: "min", fieldKeys: ["pain", "arousal", "tiredness", "stress", "trauma", "drunk", "drugged", "hallucinogen"] },
    { key: "maxPlayerBody", mode: "max", fieldKeys: ["player.breastsize", "milk_volume", "player.penissize", "semen_volume", "player.bottomsize"] }
];
const fameTierRules = [
    { min: 1000, labelKey: "tier.fame.notorious", colorKey: "magenta" },
    { min: 600, labelKey: "tier.fame.famous", colorKey: "cyan" },
    { min: 400, labelKey: "tier.fame.recognised", colorKey: "cyan" },
    { min: 200, labelKey: "tier.fame.known", colorKey: "amber" },
    { min: 100, labelKey: "tier.fame.lowkey", colorKey: "amber" },
    { min: 30, labelKey: "tier.fame.obscure", colorKey: "muted" },
    { min: Number.NEGATIVE_INFINITY, labelKey: "tier.fame.unknown", colorKey: "muted" }
];
const ratioSevenTierRules = [
    { min: 1, labelKey: "tier.common.7", colorKey: "safe" },
    { min: 0.85, labelKey: "tier.common.6", colorKey: "cyan" },
    { min: 0.7, labelKey: "tier.common.5", colorKey: "cyan" },
    { min: 0.55, labelKey: "tier.common.4", colorKey: "amber" },
    { min: 0.4, labelKey: "tier.common.3", colorKey: "amber" },
    { min: 0.2, labelKey: "tier.common.2", colorKey: "muted" },
    { min: Number.NEGATIVE_INFINITY, labelKey: "tier.common.1", colorKey: "muted" }
];
const ratioSevenGameColorRules = [
    { min: 1, labelKey: "tier.common.7", colorKey: "green" },
    { min: 0.85, labelKey: "tier.common.6", colorKey: "teal" },
    { min: 0.7, labelKey: "tier.common.5", colorKey: "lblue" },
    { min: 0.55, labelKey: "tier.common.4", colorKey: "blue" },
    { min: 0.4, labelKey: "tier.common.3", colorKey: "purple" },
    { min: 0.2, labelKey: "tier.common.2", colorKey: "pink" },
    { min: Number.NEGATIVE_INFINITY, labelKey: "tier.common.1", colorKey: "red" }
];
const skillGradeRules = [
    { min: 1000, labelKey: "tier.grade.s", colorKey: "green" },
    { min: 800, labelKey: "tier.grade.a", colorKey: "teal" },
    { min: 600, labelKey: "tier.grade.b", colorKey: "lblue" },
    { min: 400, labelKey: "tier.grade.c", colorKey: "blue" },
    { min: 200, labelKey: "tier.grade.d", colorKey: "purple" },
    { min: 1, labelKey: "tier.grade.f", colorKey: "pink" },
    { min: Number.NEGATIVE_INFINITY, labelKey: "tier.grade.none", colorKey: "red" }
];
const schoolTraitRules = [
    { min: 4, labelKey: "tier.grade.a", colorKey: "teal" },
    { min: 3, labelKey: "tier.grade.b", colorKey: "lblue" },
    { min: 2, labelKey: "tier.grade.c", colorKey: "blue" },
    { min: 1, labelKey: "tier.grade.d", colorKey: "purple" },
    { min: Number.NEGATIVE_INFINITY, labelKey: "tier.grade.f", colorKey: "pink" }
];
const threeBandRules = [
    { min: 0.67, labelKey: "tier.range.high", colorKey: "green" },
    { min: 0.34, labelKey: "tier.range.medium", colorKey: "teal" },
    { min: Number.NEGATIVE_INFINITY, labelKey: "tier.range.low", colorKey: "pink" }
];
const tierSpecByField = {
    purity: {
        mode: "absolute",
        rules: [
            { min: 1000, labelKey: "tier.stat.purity.angelic", colorKey: "safe" },
            { min: 900, labelKey: "tier.stat.purity.nearly_pure", colorKey: "cyan" },
            { min: 800, labelKey: "tier.stat.purity.slightly_soiled", colorKey: "cyan" },
            { min: 700, labelKey: "tier.stat.purity.soiled", colorKey: "amber" },
            { min: 600, labelKey: "tier.stat.purity.somewhat_defiled", colorKey: "amber" },
            { min: 500, labelKey: "tier.stat.purity.defiled", colorKey: "amber" },
            { min: 1, labelKey: "tier.stat.purity.utterly_defiled", colorKey: "danger" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.purity.beyond_defiled", colorKey: "danger" }
        ]
    },
    awareness: {
        mode: "absolute",
        rules: [
            { min: 1000, labelKey: "tier.stat.awareness.transcendental", colorKey: "magenta" },
            { min: 500, labelKey: "tier.stat.awareness.depths", colorKey: "cyan" },
            { min: 400, labelKey: "tier.stat.awareness.rare_knowledge", colorKey: "cyan" },
            { min: 300, labelKey: "tier.stat.awareness.above_normal", colorKey: "amber" },
            { min: 200, labelKey: "tier.stat.awareness.normal", colorKey: "amber" },
            { min: 100, labelKey: "tier.stat.awareness.limited", colorKey: "muted" },
            { min: 1, labelKey: "tier.stat.awareness.almost_innocent", colorKey: "muted" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.awareness.innocent", colorKey: "safe" }
        ]
    },
    promiscuity: {
        mode: "absolute",
        rules: [
            { min: 95, labelKey: "tier.stat.promiscuity.insatiable", colorKey: "magenta" },
            { min: 75, labelKey: "tier.stat.promiscuity.slut", colorKey: "cyan" },
            { min: 55, labelKey: "tier.stat.promiscuity.craving", colorKey: "cyan" },
            { min: 35, labelKey: "tier.stat.promiscuity.excited", colorKey: "amber" },
            { min: 15, labelKey: "tier.stat.promiscuity.curious", colorKey: "amber" },
            { min: 1, labelKey: "tier.stat.promiscuity.prudish", colorKey: "muted" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.promiscuity.chaste", colorKey: "safe" }
        ]
    },
    exhibitionism: {
        mode: "absolute",
        rules: [
            { min: 95, labelKey: "tier.stat.exhibitionism.wild_abandon", colorKey: "magenta" },
            { min: 75, labelKey: "tier.stat.exhibitionism.shameless", colorKey: "cyan" },
            { min: 55, labelKey: "tier.stat.exhibitionism.exposed_excites", colorKey: "cyan" },
            { min: 35, labelKey: "tier.stat.exhibitionism.enjoys_attention", colorKey: "amber" },
            { min: 15, labelKey: "tier.stat.exhibitionism.likes_being_seen", colorKey: "amber" },
            { min: 1, labelKey: "tier.stat.exhibitionism.shy", colorKey: "muted" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.exhibitionism.coy", colorKey: "safe" }
        ]
    },
    deviancy: {
        mode: "absolute",
        rules: [
            { min: 95, labelKey: "tier.stat.deviancy.unspeakable", colorKey: "magenta" },
            { min: 75, labelKey: "tier.stat.deviancy.craving", colorKey: "cyan" },
            { min: 55, labelKey: "tier.stat.deviancy.scandalous", colorKey: "cyan" },
            { min: 35, labelKey: "tier.stat.deviancy.shocking", colorKey: "amber" },
            { min: 15, labelKey: "tier.stat.deviancy.strange", colorKey: "amber" },
            { min: 1, labelKey: "tier.stat.deviancy.conventional", colorKey: "muted" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.deviancy.squeamish", colorKey: "safe" }
        ]
    },
    beauty: { mode: "ratio", rules: ratioSevenTierRules.map((item, index) => ({ ...item, labelKey: `tier.stat.beauty.${7 - index}` })) },
    physique: { mode: "ratio", rules: ratioSevenTierRules.map((item, index) => ({ ...item, labelKey: `tier.stat.physique.${7 - index}` })) },
    willpower: { mode: "ratio", rules: ratioSevenTierRules.map((item, index) => ({ ...item, labelKey: `tier.stat.willpower.${7 - index}` })) },
    "fame.sex": { mode: "absolute", rules: fameTierRules },
    "fame.prostitution": { mode: "absolute", rules: fameTierRules },
    "fame.business": { mode: "absolute", rules: fameTierRules },
    "fame.scrap": { mode: "absolute", rules: fameTierRules },
    "fame.social": { mode: "absolute", rules: fameTierRules },
    "fame.good": { mode: "absolute", rules: fameTierRules },
    crime: {
        mode: "absolute",
        rules: [
            { min: 5000, labelKey: "tier.reputation.crime.arrest_certain", colorKey: "magenta" },
            { min: 1000, labelKey: "tier.reputation.crime.arrest_possible", colorKey: "amber" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.reputation.crime.insufficient_evidence", colorKey: "muted" }
        ]
    },
    crimehistory: {
        mode: "absolute",
        rules: [
            { min: 30000, labelKey: "tier.reputation.crimehistory.cabinet", colorKey: "magenta" },
            { min: 10000, labelKey: "tier.reputation.crimehistory.criminal", colorKey: "cyan" },
            { min: 5000, labelKey: "tier.reputation.crimehistory.troublemaker", colorKey: "cyan" },
            { min: 3000, labelKey: "tier.reputation.crimehistory.person_of_interest", colorKey: "amber" },
            { min: 2000, labelKey: "tier.reputation.crimehistory.records", colorKey: "amber" },
            { min: 1000, labelKey: "tier.reputation.crimehistory.not_concerned", colorKey: "muted" },
            { min: Number.NEGATIVE_INFINITY, labelKey: "tier.reputation.crimehistory.not_concerned", colorKey: "muted" }
        ]
    },
    money: { mode: "ratio", rules: ratioSevenGameColorRules },
    "feats.allSaves.points": { mode: "ratio", rules: ratioSevenGameColorRules },
    pain: { mode: "ratio", rules: threeBandRules },
    arousal: { mode: "ratio", rules: ratioSevenGameColorRules },
    tiredness: { mode: "ratio", rules: threeBandRules },
    stress: { mode: "ratio", rules: threeBandRules },
    trauma: { mode: "ratio", rules: threeBandRules },
    control: { mode: "ratio", rules: ratioSevenGameColorRules },
    allure: { mode: "ratio", rules: ratioSevenGameColorRules },
    drunk: { mode: "ratio", rules: threeBandRules },
    drugged: { mode: "ratio", rules: threeBandRules },
    hallucinogen: { mode: "ratio", rules: threeBandRules },
    seductionskill: { mode: "absolute", rules: skillGradeRules },
    oralskill: { mode: "absolute", rules: skillGradeRules },
    chestskill: { mode: "absolute", rules: skillGradeRules },
    handskill: { mode: "absolute", rules: skillGradeRules },
    bottomskill: { mode: "absolute", rules: skillGradeRules },
    analskill: { mode: "absolute", rules: skillGradeRules },
    vaginalskill: { mode: "absolute", rules: skillGradeRules },
    feetskill: { mode: "absolute", rules: skillGradeRules },
    thighskill: { mode: "absolute", rules: skillGradeRules },
    penileskill: { mode: "absolute", rules: skillGradeRules },
    corruption_slime: { mode: "ratio", rules: ratioSevenGameColorRules },
    skulduggery: { mode: "absolute", rules: skillGradeRules },
    danceskill: { mode: "absolute", rules: skillGradeRules },
    swimmingskill: { mode: "absolute", rules: skillGradeRules },
    athletics: { mode: "absolute", rules: skillGradeRules },
    tending: { mode: "absolute", rules: skillGradeRules },
    housekeeping: { mode: "absolute", rules: skillGradeRules },
    science: { mode: "absolute", rules: skillGradeRules },
    sciencetrait: { mode: "absolute", rules: schoolTraitRules },
    maths: { mode: "absolute", rules: skillGradeRules },
    mathstrait: { mode: "absolute", rules: schoolTraitRules },
    english: { mode: "absolute", rules: skillGradeRules },
    englishtrait: { mode: "absolute", rules: schoolTraitRules },
    history: { mode: "absolute", rules: skillGradeRules },
    historytrait: { mode: "absolute", rules: schoolTraitRules },
    "prof.spray": { mode: "absolute", rules: skillGradeRules },
    "prof.net": { mode: "absolute", rules: skillGradeRules },
    "player.breastsize": { mode: "ratio", rules: ratioSevenGameColorRules },
    milk_volume: { mode: "ratio", rules: ratioSevenGameColorRules },
    "player.penissize": { mode: "ratio", rules: ratioSevenGameColorRules },
    semen_volume: { mode: "ratio", rules: ratioSevenGameColorRules },
    "player.bottomsize": { mode: "ratio", rules: ratioSevenGameColorRules },
    bottomgrowthtimer: { mode: "ratio", rules: ratioSevenGameColorRules },
    "player.pregnancyBelly": { mode: "ratio", rules: ratioSevenGameColorRules },
    pregnancytimer: { mode: "ratio", rules: ratioSevenGameColorRules },
    cycleDay: { mode: "ratio", rules: ratioSevenGameColorRules }
};
const tierColorMap = {
    muted: "#9aa0a6",
    amber: "#d3a847",
    cyan: "#62b7e6",
    magenta: "#b582ff",
    danger: "#d46a6a",
    safe: "#7fca8b",
    red: "#d46a6a",
    pink: "#d78bb9",
    purple: "#b582ff",
    blue: "#62b7e6",
    lblue: "#8bd3ff",
    teal: "#59c4ad",
    green: "#7fca8b",
    white: "#e9e9e9",
    gold: "#d3a847"
};
function resolveFieldTier(fieldKey, value, maxValue) {
    const fieldSpec = tierSpecByField[fieldKey];
    if (!fieldSpec || !Number.isFinite(value)) {
        return undefined;
    }
    const comparableValue = fieldSpec.mode === "ratio"
        ? ((maxValue && maxValue > 0) ? (value / maxValue) : 0)
        : value;
    const matchedRule = fieldSpec.rules.find((ruleItem) => comparableValue >= ruleItem.min);
    if (!matchedRule) {
        return undefined;
    }
    return {
        labelKey: matchedRule.labelKey,
        colorKey: matchedRule.colorKey
    };
}
function resolveFieldTierHelp(fieldKey, minValue, maxValue) {
    const fieldSpec = tierSpecByField[fieldKey];
    if (!fieldSpec || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return undefined;
    }
    const safeMax = Math.max(maxValue, minValue);
    const ranges = [];
    fieldSpec.rules.forEach((ruleItem, index) => {
        const previousRule = index > 0 ? fieldSpec.rules[index - 1] : undefined;
        const ruleMin = fieldSpec.mode === "ratio"
            ? (Number.isFinite(ruleItem.min) ? (ruleItem.min * safeMax) : minValue)
            : (Number.isFinite(ruleItem.min) ? ruleItem.min : minValue);
        const rangeMin = Math.max(minValue, ruleMin);
        const maxExclusive = previousRule
            ? (fieldSpec.mode === "ratio"
                ? (Number.isFinite(previousRule.min) ? (previousRule.min * safeMax) : undefined)
                : (Number.isFinite(previousRule.min) ? previousRule.min : undefined))
            : undefined;
        if (typeof maxExclusive === "number" && rangeMin >= maxExclusive) {
            return;
        }
        ranges.push({
            labelKey: ruleItem.labelKey,
            colorKey: ruleItem.colorKey,
            min: rangeMin,
            maxExclusive
        });
    });
    return {
        min: minValue,
        mid: minValue + ((safeMax - minValue) / 2),
        max: safeMax,
        ranges
    };
}
function getValueByPath(root, path) {
    return path.split(".").reduce((current, segment) => {
        if (!current || typeof current !== "object") {
            return undefined;
        }
        return current[segment];
    }, root);
}
function hasPath(root, path) {
    if (path.length === 0) {
        return false;
    }
    const segments = path.split(".");
    let pointer = root;
    for (let index = 0; index < segments.length; index += 1) {
        if (!pointer || typeof pointer !== "object" || !(segments[index] in pointer)) {
            return false;
        }
        pointer = pointer[segments[index]];
    }
    return true;
}
function setValueByPath(root, path, value) {
    const segments = path.split(".");
    if (segments.length === 0) {
        return false;
    }
    let pointer = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];
        if (!pointer || typeof pointer !== "object" || !(segment in pointer)) {
            return false;
        }
        pointer = pointer[segment];
    }
    if (!pointer || typeof pointer !== "object") {
        return false;
    }
    pointer[segments[segments.length - 1]] = value;
    return true;
}


/***/ },

/***/ "./src/Cheats/NpcRelation.ts"
/*!***********************************!*\
  !*** ./src/Cheats/NpcRelation.ts ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NpcRosterResolver: () => (/* binding */ NpcRosterResolver),
/* harmony export */   resolveNpcDisplayProfile: () => (/* binding */ resolveNpcDisplayProfile),
/* harmony export */   resolveNpcInfoLabel: () => (/* binding */ resolveNpcInfoLabel)
/* harmony export */ });
/* harmony import */ var _Localized__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Localized */ "./src/Localized/index.ts");

const importantNpcSortOrder = ["Robin", "Whitney", "Eden", "Kylar", "Sydney", "Avery", "Great Hawk", "Black Wolf", "Alex"];
const specialNpcSortOrder = ["Ivory Wraith"];
const baseNpcProfileTable = new Map([
    ["Avery", { baseName: "Avery", localizedName: "Avery", description: "Merchant", statKeys: ["love", "lust", "dom", "rage"] }],
    ["Black Wolf", { baseName: "Black Wolf", localizedName: "Black Wolf", description: "Pack leader", statKeys: ["love", "lust", "dom", "harmony", "ferocity"] }],
    ["Eden", { baseName: "Eden", localizedName: "Eden", description: "Hunter", statKeys: ["love", "lust", "dom"] }],
    ["Ivory Wraith", { baseName: "Ivory Wraith", localizedName: "Ivory Wraith", description: "Blood moon spirit", statKeys: ["love", "lust", "dom"] }],
    ["Kylar", { baseName: "Kylar", localizedName: "Kylar", description: "Outcast", statKeys: ["love", "lust", "dom", "rage"] }],
    ["Robin", { baseName: "Robin", localizedName: "Robin", description: "Orphan", statKeys: ["love", "lust", "dom"] }],
    ["Sydney", { baseName: "Sydney", localizedName: "Sydney", description: "Believer", statKeys: ["love", "lust", "dom", "purity", "corruption"] }],
    ["Whitney", { baseName: "Whitney", localizedName: "Whitney", description: "Bully", statKeys: ["love", "lust", "dom"] }]
]);
function uniqueStringsInOrder(inputNames) {
    const seenNameSet = new Set();
    const orderedNames = [];
    inputNames.forEach((nameItem) => {
        if (!seenNameSet.has(nameItem)) {
            seenNameSet.add(nameItem);
            orderedNames.push(nameItem);
        }
    });
    return orderedNames;
}
function resolveNpcDisplayProfile(npcName) {
    const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_0__.getActiveNpcLocalePack)();
    const baseProfile = baseNpcProfileTable.get(npcName);
    const localizedSeed = localePack.profileMap[npcName];
    if (baseProfile) {
        return {
            ...baseProfile,
            localizedName: localizedSeed?.localizedName ?? baseProfile.localizedName,
            description: localizedSeed?.description ?? baseProfile.description,
            statKeys: localizedSeed?.statKeys ?? baseProfile.statKeys
        };
    }
    return {
        baseName: npcName,
        localizedName: localizedSeed?.localizedName ?? npcName,
        description: localizedSeed?.description ?? "Unknown",
        statKeys: localizedSeed?.statKeys ?? ["love", "lust", "dom"]
    };
}
function resolveNpcInfoLabel(npcName, statKey) {
    const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_0__.getActiveNpcLocalePack)();
    const localizedSpecialLabel = localePack.specialInfoLabelMap[npcName]?.[statKey];
    if (localizedSpecialLabel) {
        return localizedSpecialLabel;
    }
    return localePack.infoLabelMap[statKey] ?? statKey;
}
class NpcRosterResolver {
    constructor(gameWindow) {
        this.gameWindow = gameWindow;
    }
    get activeVariables() {
        return this.gameWindow.SugarCube?.State?.active?.variables ?? {};
    }
    get npcNameKeys() {
        const incomingList = this.activeVariables.NPCNameList;
        return Array.isArray(incomingList) ? incomingList : [];
    }
    get npcStates() {
        const incomingStates = this.activeVariables.NPCName;
        return Array.isArray(incomingStates) ? incomingStates : [];
    }
    getStateByNpcKey(npcKey) {
        const keyIndex = this.npcNameKeys.indexOf(npcKey);
        if (keyIndex < 0) {
            return undefined;
        }
        const matchedState = this.npcStates[keyIndex];
        if (!matchedState || typeof matchedState !== "object") {
            return undefined;
        }
        return matchedState;
    }
    buildNpcRoster() {
        const rawSortOrder = uniqueStringsInOrder([
            ...specialNpcSortOrder,
            ...importantNpcSortOrder,
            ...this.npcNameKeys
        ]);
        const finalRoster = [];
        rawSortOrder.forEach((rosterKey) => {
            const stateRef = this.getStateByNpcKey(rosterKey);
            if (!stateRef) {
                return;
            }
            const readableName = (typeof stateRef.nam === "string" && stateRef.nam.length > 0)
                ? stateRef.nam
                : rosterKey;
            finalRoster.push({
                rosterKey,
                stateRef,
                displayProfile: resolveNpcDisplayProfile(readableName)
            });
        });
        return finalRoster;
    }
}


/***/ },

/***/ "./src/GreasemonkeyScript/start.ts"
/*!*****************************************!*\
  !*** ./src/GreasemonkeyScript/start.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InternationalCheatLauncher: () => (/* binding */ InternationalCheatLauncher)
/* harmony export */ });
/* harmony import */ var _Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Cheats/CoreCheats */ "./src/Cheats/CoreCheats.ts");
/* harmony import */ var _Cheats_NpcRelation__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Cheats/NpcRelation */ "./src/Cheats/NpcRelation.ts");
/* harmony import */ var _Localized__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../Localized */ "./src/Localized/index.ts");



function createElement(tagName, className) {
    const newElement = document.createElement(tagName);
    if (className) {
        newElement.className = className;
    }
    return newElement;
}
class InternationalCheatLauncher {
    constructor(gameWindow) {
        this.gameWindow = gameWindow;
        this.bootstrapReady = false;
        this.sugarCubeWaitCycles = 0;
        this.activeTab = "npc";
        this.panelMessage = "";
        this.pendingChanges = new Map();
    }
    bootstrap() {
        setTimeout(() => this.waitUntilGameReady(), 100);
    }
    waitUntilGameReady() {
        if (this.sugarCubeWaitCycles > 100) {
            return;
        }
        if (!this.gameWindow.SugarCube?.State?.active?.variables) {
            this.sugarCubeWaitCycles += 1;
            setTimeout(() => this.waitUntilGameReady(), 500);
            return;
        }
        this.initOnce();
    }
    initOnce() {
        if (this.bootstrapReady) {
            return;
        }
        this.bootstrapReady = true;
        this.attachKeyboardShortcut();
        this.attachFloatingBanner();
    }
    attachKeyboardShortcut() {
        window.addEventListener("keydown", (keyboardEvent) => {
            if (!keyboardEvent.altKey || (keyboardEvent.key !== "q" && keyboardEvent.key !== "Q")) {
                return;
            }
            if (keyboardEvent.shiftKey) {
                this.closePanel();
                keyboardEvent.preventDefault();
                return;
            }
            this.togglePanel();
            keyboardEvent.preventDefault();
        });
    }
    attachFloatingBanner() {
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        const shortcutBanner = createElement("div");
        shortcutBanner.innerText = localePack.uiText.panelTitle;
        shortcutBanner.style.cssText = [
            "position: fixed",
            "right: 8px",
            "bottom: 8px",
            "z-index: 2147483646",
            "padding: 6px 10px",
            "border: 1px dashed #888",
            "color: #aaa",
            "background: rgba(20,20,20,0.65)",
            "cursor: pointer",
            "user-select: none",
            "font-size: 12px"
        ].join(";");
        shortcutBanner.addEventListener("click", () => this.togglePanel());
        document.body.appendChild(shortcutBanner);
        this.bannerNode = shortcutBanner;
    }
    ensurePanel() {
        if (this.panelRoot) {
            return this.panelRoot;
        }
        const panelContainer = createElement("div");
        panelContainer.style.cssText = [
            "position: fixed",
            "right: 12px",
            "top: 10px",
            "z-index: 2147483647",
            "width: min(96vw, 980px)",
            "max-height: 94vh",
            "overflow: hidden",
            "border: 1px solid #666",
            "background: rgba(22,22,22,0.96)",
            "color: #ddd",
            "padding: 10px 10px 8px 10px",
            "font-family: Arial, sans-serif",
            "font-size: 13px",
            "line-height: 1.4",
            "display: none"
        ].join(";");
        document.body.appendChild(panelContainer);
        this.panelRoot = panelContainer;
        return panelContainer;
    }
    togglePanel() {
        const panelNode = this.ensurePanel();
        if (panelNode.style.display === "none") {
            this.renderPanelContent(panelNode);
            panelNode.style.display = "block";
            return;
        }
        panelNode.style.display = "none";
    }
    closePanel() {
        if (!this.panelRoot) {
            return;
        }
        this.panelRoot.style.display = "none";
    }
    renderPanelContent(panelNode) {
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        panelNode.innerHTML = "";
        const headingRow = createElement("div");
        headingRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;";
        const headingTitle = createElement("strong");
        headingTitle.innerText = localePack.uiText.panelTitle;
        const closeButton = createElement("button");
        closeButton.innerText = localePack.uiText.close;
        closeButton.style.cssText = "border:1px solid #666;background:#303030;color:#eee;padding:3px 8px;border-radius:3px;";
        closeButton.addEventListener("click", () => this.closePanel());
        headingRow.appendChild(headingTitle);
        headingRow.appendChild(closeButton);
        panelNode.appendChild(headingRow);
        const actionRow = createElement("div");
        actionRow.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;";
        const saveButton = createElement("button");
        saveButton.innerText = "Save";
        saveButton.style.cssText = "border:1px solid #666;background:#3a3a3a;color:#eee;padding:3px 10px;border-radius:3px;";
        saveButton.disabled = this.pendingChanges.size === 0;
        saveButton.addEventListener("click", () => this.applyPendingChanges());
        const pendingLabel = createElement("span");
        pendingLabel.style.cssText = "opacity:.85;";
        pendingLabel.innerText = `Pending changes: ${this.pendingChanges.size}`;
        actionRow.appendChild(saveButton);
        actionRow.appendChild(pendingLabel);
        panelNode.appendChild(actionRow);
        const hintText = createElement("div");
        hintText.style.cssText = "opacity:.8;margin-bottom:8px;";
        hintText.innerText = localePack.uiText.shortcutHint;
        panelNode.appendChild(hintText);
        const tabRow = createElement("div");
        tabRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;";
        _Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.tabOrder.forEach((tabKey) => {
            const tabButton = createElement("button");
            tabButton.innerText = localePack.tabLabelMap[tabKey];
            tabButton.style.cssText = [
                "border:1px solid #5b5b5b",
                "background:#2f2f2f",
                "color:#ddd",
                "padding:4px 8px",
                "border-radius:3px",
                "cursor:pointer",
                this.activeTab === tabKey ? "background:#464646;color:#fff" : ""
            ].join(";");
            tabButton.addEventListener("click", () => {
                this.activeTab = tabKey;
                this.panelMessage = "";
                this.renderPanelContent(panelNode);
            });
            tabRow.appendChild(tabButton);
        });
        panelNode.appendChild(tabRow);
        const tabContent = createElement("div");
        tabContent.style.cssText = "max-height:74vh;overflow:auto;padding-right:2px;";
        panelNode.appendChild(tabContent);
        if (this.activeTab === "npc") {
            this.renderNpcTab(tabContent, localePack.uiText.noNpcRoster);
        }
        else if (this.activeTab === "utility") {
            this.renderUtilityTab(tabContent);
        }
        else {
            this.renderFieldTab(tabContent, this.activeTab);
        }
        const messageBar = createElement("div");
        messageBar.style.cssText = "min-height:18px;margin-top:8px;color:#c2c2c2;opacity:0.9;";
        messageBar.innerText = this.panelMessage;
        panelNode.appendChild(messageBar);
    }
    get activeVariables() {
        return this.gameWindow.SugarCube?.State?.active?.variables ?? {};
    }
    getLabelForField(pathKey) {
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        return localePack.fieldLabelMap[pathKey] ?? pathKey;
    }
    getTierLabel(labelKey) {
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        return localePack.tierLabelMap[labelKey] ?? labelKey;
    }
    formatHelpValue(value) {
        if (!Number.isFinite(value)) {
            return "0";
        }
        if (Math.abs(value) >= 100) {
            return Math.round(value).toString();
        }
        const roundedValue = Math.round(value * 100) / 100;
        return Number.isInteger(roundedValue)
            ? roundedValue.toString()
            : roundedValue.toFixed(2).replace(/\.?0+$/, "");
    }
    stagePendingChange(changeKey, applyFn, previewValue) {
        this.pendingChanges.set(changeKey, { apply: applyFn, previewValue });
    }
    getPendingPreviewValue(changeKey, fallbackValue) {
        const pending = this.pendingChanges.get(changeKey);
        return (typeof pending?.previewValue === "number" ? pending.previewValue : fallbackValue);
    }
    applyPendingChanges() {
        if (this.pendingChanges.size === 0) {
            this.panelMessage = "No pending changes.";
            this.renderPanelContent(this.ensurePanel());
            return;
        }
        let appliedCount = 0;
        this.pendingChanges.forEach((changeItem) => {
            if (changeItem.apply()) {
                appliedCount += 1;
            }
        });
        const totalCount = this.pendingChanges.size;
        this.pendingChanges.clear();
        this.panelMessage = `Saved ${appliedCount}/${totalCount} changes.`;
        this.renderPanelContent(this.ensurePanel());
    }
    resolveMaxValue(fieldKey, maxSeed) {
        if (typeof maxSeed === "number") {
            return maxSeed;
        }
        const dynamicValue = (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.getValueByPath)(this.activeVariables, maxSeed);
        if (typeof dynamicValue === "number" && Number.isFinite(dynamicValue)) {
            return dynamicValue;
        }
        const fallbackValue = (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.getValueByPath)(this.activeVariables, fieldKey);
        if (typeof fallbackValue === "number" && Number.isFinite(fallbackValue)) {
            return fallbackValue;
        }
        return 0;
    }
    renderFieldTab(targetNode, tabKey) {
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        const sectionList = _Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.cheatSectionsByTab[tabKey];
        sectionList.forEach((sectionItem) => {
            const section = createElement("div");
            section.style.cssText = "border:1px solid #444;padding:8px;margin-bottom:8px;";
            const sectionTitle = createElement("div");
            sectionTitle.style.cssText = "font-weight:bold;margin-bottom:6px;";
            sectionTitle.innerText = sectionItem.title;
            section.appendChild(sectionTitle);
            sectionItem.fields.forEach((fieldItem) => {
                const row = createElement("div");
                row.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0;";
                const label = createElement("label");
                label.style.cssText = "min-width:210px;";
                label.innerText = this.getLabelForField(fieldItem.key);
                row.appendChild(label);
                const valueInput = createElement("input");
                valueInput.type = "number";
                valueInput.style.cssText = "width:120px;";
                const fieldCurrentValue = (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.getValueByPath)(this.activeVariables, fieldItem.key);
                const sourceFieldValue = (typeof fieldCurrentValue === "number" && Number.isFinite(fieldCurrentValue) ? fieldCurrentValue : 0);
                const pendingFieldKey = `field:${fieldItem.key}`;
                const safeFieldValue = this.getPendingPreviewValue(pendingFieldKey, sourceFieldValue);
                const resolvedMaxValue = this.resolveMaxValue(fieldItem.key, fieldItem.max);
                valueInput.value = safeFieldValue.toString();
                row.appendChild(valueInput);
                const setButton = createElement("button");
                setButton.innerText = localePack.uiText.set;
                setButton.style.cssText = "border:1px solid #666;background:#303030;color:#eee;padding:2px 7px;border-radius:3px;";
                setButton.addEventListener("click", () => {
                    const nextValue = Number.parseInt(valueInput.value, 10);
                    if (!Number.isSafeInteger(nextValue)) {
                        this.panelMessage = `${this.getLabelForField(fieldItem.key)}: invalid number`;
                        this.renderPanelContent(this.ensurePanel());
                        return;
                    }
                    if (!(0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.hasPath)(this.activeVariables, fieldItem.key)) {
                        this.panelMessage = `${this.getLabelForField(fieldItem.key)}: unavailable in current save`;
                        this.renderPanelContent(this.ensurePanel());
                        return;
                    }
                    this.stagePendingChange(pendingFieldKey, () => (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.setValueByPath)(this.activeVariables, fieldItem.key, nextValue), nextValue);
                    this.panelMessage = `${this.getLabelForField(fieldItem.key)} queued: ${nextValue}. Click Save to apply.`;
                    this.renderPanelContent(this.ensurePanel());
                });
                row.appendChild(setButton);
                const minButton = createElement("button");
                minButton.innerText = localePack.uiText.min;
                minButton.style.cssText = "border:1px solid #666;background:#2b2b2b;color:#ddd;padding:2px 7px;border-radius:3px;";
                minButton.addEventListener("click", () => {
                    valueInput.value = fieldItem.min.toString();
                });
                row.appendChild(minButton);
                const maxButton = createElement("button");
                maxButton.innerText = localePack.uiText.max;
                maxButton.style.cssText = "border:1px solid #666;background:#2b2b2b;color:#ddd;padding:2px 7px;border-radius:3px;";
                maxButton.addEventListener("click", () => {
                    valueInput.value = resolvedMaxValue.toString();
                });
                row.appendChild(maxButton);
                const hasField = (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.hasPath)(this.activeVariables, fieldItem.key);
                if (!hasField) {
                    const unavailable = createElement("span");
                    unavailable.style.cssText = "opacity:.75;";
                    unavailable.innerText = "(unavailable)";
                    row.appendChild(unavailable);
                }
                const tierInfo = (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.resolveFieldTier)(fieldItem.key, safeFieldValue, resolvedMaxValue);
                const tierHelp = (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.resolveFieldTierHelp)(fieldItem.key, fieldItem.min, resolvedMaxValue);
                if (tierInfo) {
                    const tierMeta = createElement("div");
                    tierMeta.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:6px;";
                    const tierLabel = createElement("span");
                    tierLabel.style.cssText = `padding-left:8px;font-weight:600;color:${_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.tierColorMap[tierInfo.colorKey]};`;
                    tierLabel.innerText = this.getTierLabel(tierInfo.labelKey);
                    tierMeta.appendChild(tierLabel);
                    if (tierHelp) {
                        const helpButton = createElement("button");
                        helpButton.type = "button";
                        helpButton.innerText = "?";
                        helpButton.title = localePack.uiText.help;
                        helpButton.style.cssText = "border:1px solid #666;background:#2b2b2b;color:#ddd;padding:1px 6px;border-radius:50%;cursor:pointer;font-weight:700;";
                        const helpPanel = createElement("div");
                        helpPanel.style.cssText = "display:none;flex-basis:100%;margin-left:210px;margin-top:4px;padding:6px 8px;border:1px dashed #595959;background:#262626;line-height:1.3;";
                        const boundsLine = createElement("div");
                        boundsLine.style.cssText = "margin-bottom:4px;";
                        boundsLine.innerText = `${localePack.uiText.helpMin}: ${this.formatHelpValue(tierHelp.min)} | ${localePack.uiText.helpMid}: ${this.formatHelpValue(tierHelp.mid)} | ${localePack.uiText.helpMax}: ${this.formatHelpValue(tierHelp.max)}`;
                        helpPanel.appendChild(boundsLine);
                        const rangesTitle = createElement("div");
                        rangesTitle.style.cssText = "margin-bottom:3px;opacity:.9;";
                        rangesTitle.innerText = `${localePack.uiText.helpRanges}:`;
                        helpPanel.appendChild(rangesTitle);
                        tierHelp.ranges.forEach((rangeItem) => {
                            const rangeLine = createElement("div");
                            rangeLine.style.cssText = `color:${_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.tierColorMap[rangeItem.colorKey]};`;
                            const rangeEnd = typeof rangeItem.maxExclusive === "number"
                                ? `< ${this.formatHelpValue(rangeItem.maxExclusive)}`
                                : `<= ${this.formatHelpValue(tierHelp.max)}`;
                            rangeLine.innerText = `${this.getTierLabel(rangeItem.labelKey)}: >= ${this.formatHelpValue(rangeItem.min)} and ${rangeEnd}`;
                            helpPanel.appendChild(rangeLine);
                        });
                        const closeHelpButton = createElement("button");
                        closeHelpButton.type = "button";
                        closeHelpButton.innerText = localePack.uiText.helpClose;
                        closeHelpButton.style.cssText = "margin-top:6px;border:1px solid #666;background:#2b2b2b;color:#ddd;padding:2px 7px;border-radius:3px;cursor:pointer;";
                        closeHelpButton.addEventListener("click", () => {
                            helpPanel.style.display = "none";
                        });
                        helpPanel.appendChild(closeHelpButton);
                        helpButton.addEventListener("click", () => {
                            helpPanel.style.display = helpPanel.style.display === "none" ? "block" : "none";
                        });
                        tierMeta.appendChild(helpButton);
                        row.appendChild(tierMeta);
                        row.appendChild(helpPanel);
                    }
                    else {
                        row.appendChild(tierMeta);
                    }
                }
                section.appendChild(row);
            });
            targetNode.appendChild(section);
        });
    }
    renderUtilityTab(targetNode) {
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        const summaryText = createElement("div");
        summaryText.style.cssText = "margin-bottom:8px;opacity:.9;";
        summaryText.innerText = localePack.uiText.utilityDescription;
        targetNode.appendChild(summaryText);
        const actionGrid = createElement("div");
        actionGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
        _Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.utilityActions.forEach((actionItem) => {
            const actionButton = createElement("button");
            actionButton.innerText = localePack.utilityLabelMap[actionItem.key] ?? actionItem.key;
            actionButton.style.cssText = "border:1px solid #666;background:#313131;color:#eee;padding:5px 9px;border-radius:3px;cursor:pointer;";
            actionButton.addEventListener("click", () => {
                this.applyUtilityAction(actionItem.key);
                this.renderPanelContent(this.ensurePanel());
            });
            actionGrid.appendChild(actionButton);
        });
        targetNode.appendChild(actionGrid);
    }
    applyUtilityAction(actionKey) {
        const allFields = Object.values(_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.cheatSectionsByTab)
            .flatMap((sectionItems) => sectionItems)
            .flatMap((sectionItem) => sectionItem.fields);
        const fieldIndex = new Map(allFields.map((fieldItem) => [fieldItem.key, fieldItem]));
        const actionInfo = _Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.utilityActions.find((item) => item.key === actionKey);
        if (!actionInfo) {
            return;
        }
        let queuedCount = 0;
        actionInfo.fieldKeys.forEach((fieldKey) => {
            const fieldInfo = fieldIndex.get(fieldKey);
            if (!fieldInfo || !(0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.hasPath)(this.activeVariables, fieldKey)) {
                return;
            }
            const targetValue = actionInfo.mode === "min"
                ? fieldInfo.min
                : this.resolveMaxValue(fieldKey, fieldInfo.max);
            this.stagePendingChange(`field:${fieldKey}`, () => (0,_Cheats_CoreCheats__WEBPACK_IMPORTED_MODULE_0__.setValueByPath)(this.activeVariables, fieldKey, targetValue), targetValue);
            queuedCount += 1;
        });
        const localePack = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)();
        const actionLabel = localePack.utilityLabelMap[actionKey] ?? actionKey;
        this.panelMessage = `${actionLabel}: ${queuedCount} fields queued. Click Save to apply.`;
    }
    renderNpcTab(targetNode, emptyHintText) {
        const rosterResolver = new _Cheats_NpcRelation__WEBPACK_IMPORTED_MODULE_1__.NpcRosterResolver(this.gameWindow);
        const npcRoster = rosterResolver.buildNpcRoster();
        if (npcRoster.length === 0) {
            const emptyNotice = createElement("div");
            emptyNotice.innerText = emptyHintText;
            targetNode.appendChild(emptyNotice);
            return;
        }
        npcRoster.forEach((npcEntry, rosterIndex) => {
            const card = createElement("div");
            card.style.cssText = "border:1px solid #444;padding:8px;margin-bottom:8px;";
            const localizedSuffix = npcEntry.displayProfile.localizedName !== npcEntry.displayProfile.baseName
                ? ` (${npcEntry.displayProfile.localizedName})`
                : "";
            const cardTitle = createElement("div");
            cardTitle.style.cssText = "font-weight:bold;margin-bottom:6px;";
            cardTitle.innerText = `#${rosterIndex + 1} ${npcEntry.displayProfile.baseName}${localizedSuffix} - ${npcEntry.displayProfile.description}`;
            card.appendChild(cardTitle);
            npcEntry.displayProfile.statKeys.forEach((statKey) => {
                this.renderStatControl(card, npcEntry.rosterKey, npcEntry.stateRef, npcEntry.displayProfile.baseName, statKey);
            });
            targetNode.appendChild(card);
        });
    }
    renderStatControl(targetCard, npcRosterKey, npcStateRef, npcName, statKey) {
        const row = createElement("div");
        row.style.cssText = "display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap;";
        const visibleLabel = createElement("label");
        visibleLabel.style.cssText = "min-width:210px;";
        const localizedLabel = (0,_Cheats_NpcRelation__WEBPACK_IMPORTED_MODULE_1__.resolveNpcInfoLabel)(npcName, statKey);
        visibleLabel.innerText = (localizedLabel !== statKey)
            ? `${statKey} (${localizedLabel})`
            : statKey;
        const numericInput = createElement("input");
        numericInput.type = "number";
        numericInput.style.cssText = "width:120px;";
        const pendingNpcKey = `npc:${npcRosterKey}:${statKey}`;
        const currentValue = npcStateRef[statKey];
        const safeCurrentValue = (typeof currentValue === "number" ? currentValue : 0);
        numericInput.value = this.getPendingPreviewValue(pendingNpcKey, safeCurrentValue).toString();
        const applyButton = createElement("button");
        applyButton.innerText = (0,_Localized__WEBPACK_IMPORTED_MODULE_2__.getActiveCheatLocalePack)().uiText.set;
        applyButton.style.cssText = "border:1px solid #666;background:#303030;color:#eee;padding:2px 7px;border-radius:3px;";
        applyButton.addEventListener("click", () => {
            const nextValue = Number.parseInt(numericInput.value, 10);
            if (!Number.isSafeInteger(nextValue)) {
                this.panelMessage = `${visibleLabel.innerText}: invalid number`;
                return;
            }
            this.stagePendingChange(pendingNpcKey, () => {
                npcStateRef[statKey] = nextValue;
                return true;
            }, nextValue);
            this.panelMessage = `${visibleLabel.innerText}: queued ${nextValue}. Click Save to apply.`;
            this.renderPanelContent(this.ensurePanel());
        });
        row.appendChild(visibleLabel);
        row.appendChild(numericInput);
        row.appendChild(applyButton);
        targetCard.appendChild(row);
    }
}


/***/ },

/***/ "./src/Localized/CN/npcLocale.ts"
/*!***************************************!*\
  !*** ./src/Localized/CN/npcLocale.ts ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cnNpcLocalePack: () => (/* binding */ cnNpcLocalePack)
/* harmony export */ });
const cnNpcLocalePack = {
    locale: "cn",
    profileMap: {
        "Avery": { localizedName: "艾弗里", description: "商人" },
        "Black Wolf": { localizedName: "黑狼", description: "头狼" },
        "Eden": { localizedName: "伊甸", description: "猎人" },
        "Ivory Wraith": { localizedName: "象牙幽灵", description: "血月邪神" },
        "Kylar": { localizedName: "凯拉尔", description: "不合群者" },
        "Robin": { localizedName: "罗宾", description: "孤儿" },
        "Sydney": { localizedName: "悉尼", description: "信徒" },
        "Whitney": { localizedName: "惠特尼", description: "霸凌者" }
    },
    infoLabelMap: {
        love: "爱意",
        lust: "性欲",
        dom: "支配",
        rage: "嫉妒",
        harmony: "善",
        ferocity: "恶",
        purity: "纯洁",
        corruption: "堕落"
    },
    specialInfoLabelMap: {
        "Ivory Wraith": { lust: "痴迷" },
        "Robin": { dom: "自信" }
    },
    tabLabelMap: {
        npc: "NPC",
        money: "金钱",
        stats: "属性",
        status: "状态",
        skills: "技能",
        reputation: "名声",
        playerBody: "身体",
        utility: "快捷"
    },
    uiText: {
        panelTitle: "DoL Sugar Cube Cheats",
        close: "关闭",
        shortcutHint: "Alt+Q 开关面板，Alt+Shift+Q 强制关闭。",
        noNpcRoster: "当前存档还没有可用 NPC 列表。",
        set: "设置",
        min: "最小",
        max: "最大",
        value: "数值",
        utilityDescription: "常用场景快捷按钮。",
        help: "帮助",
        helpMin: "最小值",
        helpMid: "中间值",
        helpMax: "最大值",
        helpRanges: "档位范围",
        helpClose: "关闭帮助"
    },
    fieldLabelMap: {
        "money": "金钱",
        "feats.allSaves.points": "Vrel 硬币",
        "purity": "纯洁",
        "beauty": "容貌",
        "physique": "体能",
        "willpower": "意志",
        "awareness": "性知识",
        "promiscuity": "淫乱度",
        "exhibitionism": "露出癖",
        "deviancy": "异种癖",
        "pain": "疼痛",
        "arousal": "性奋",
        "tiredness": "疲劳",
        "stress": "压力",
        "trauma": "创伤",
        "control": "自控",
        "allure": "诱惑",
        "drunk": "醉酒",
        "drugged": "春药",
        "hallucinogen": "幻觉",
        "seductionskill": "魅惑技能",
        "oralskill": "口部技能",
        "chestskill": "胸部技能",
        "handskill": "手部技能",
        "bottomskill": "臀部技能",
        "analskill": "后庭技能",
        "vaginalskill": "小穴技能",
        "feetskill": "足部技能",
        "thighskill": "腿部技能",
        "penileskill": "阴茎技能",
        "corruption_slime": "堕落 Slime",
        "skulduggery": "诡术",
        "danceskill": "舞蹈技能",
        "swimmingskill": "游泳技能",
        "athletics": "田径技能",
        "tending": "护理技能",
        "housekeeping": "家务技能",
        "science": "科学经验",
        "sciencetrait": "科学等级",
        "maths": "数学经验",
        "mathstrait": "数学等级",
        "english": "英语经验",
        "englishtrait": "英语等级",
        "history": "历史经验",
        "historytrait": "历史等级",
        "prof.spray": "防狼喷雾技能",
        "prof.net": "网技能",
        "fame.sex": "名声：性",
        "fame.prostitution": "名声：卖淫",
        "fame.business": "名声：商业",
        "fame.scrap": "名声：废品",
        "fame.social": "名声：社交",
        "fame.good": "名声：善行",
        "crimehistory": "犯罪历史",
        "crime": "逮捕实施",
        "player.breastsize": "胸部尺寸",
        "milk_volume": "乳汁容量",
        "player.penissize": "阴茎尺寸",
        "semen_volume": "精液容量",
        "player.bottomsize": "臀部尺寸",
        "bottomgrowthtimer": "臀部成长计时",
        "player.pregnancyBelly": "怀孕肚子",
        "pregnancytimer": "怀孕计时",
        "cycleDay": "生理周期天数"
    },
    utilityLabelMap: {
        "setMaxMoney": "金钱最大",
        "setMinCrime": "清除犯罪",
        "maxCoreStats": "核心属性拉满",
        "maxSkills": "技能拉满",
        "resetNegativeStatus": "清空负面状态",
        "maxPlayerBody": "身体属性拉满"
    },
    tierLabelMap: {
        "tier.fame.unknown": "未知",
        "tier.fame.obscure": "隐晦",
        "tier.fame.lowkey": "小有名气",
        "tier.fame.known": "知名",
        "tier.fame.recognised": "广为认知",
        "tier.fame.famous": "著名",
        "tier.fame.notorious": "恶名昭彰",
        "tier.common.1": "第1档",
        "tier.common.2": "第2档",
        "tier.common.3": "第3档",
        "tier.common.4": "第4档",
        "tier.common.5": "第5档",
        "tier.common.6": "第6档",
        "tier.common.7": "第7档",
        "tier.stat.purity.angelic": "圣洁如天使",
        "tier.stat.purity.nearly_pure": "接近纯洁",
        "tier.stat.purity.slightly_soiled": "略有污浊",
        "tier.stat.purity.soiled": "已被玷污",
        "tier.stat.purity.somewhat_defiled": "有些亵渎",
        "tier.stat.purity.defiled": "堕落",
        "tier.stat.purity.utterly_defiled": "极度堕落",
        "tier.stat.purity.beyond_defiled": "无可救药",
        "tier.stat.awareness.transcendental": "超然认知",
        "tier.stat.awareness.depths": "洞悉深渊",
        "tier.stat.awareness.rare_knowledge": "见识罕见",
        "tier.stat.awareness.above_normal": "高于常人",
        "tier.stat.awareness.normal": "普通认知",
        "tier.stat.awareness.limited": "认知有限",
        "tier.stat.awareness.almost_innocent": "近乎无知",
        "tier.stat.awareness.innocent": "纯真",
        "tier.stat.promiscuity.insatiable": "欲求无度",
        "tier.stat.promiscuity.slut": "放荡",
        "tier.stat.promiscuity.craving": "渴求接触",
        "tier.stat.promiscuity.excited": "性念强烈",
        "tier.stat.promiscuity.curious": "性好奇",
        "tier.stat.promiscuity.prudish": "拘谨",
        "tier.stat.promiscuity.chaste": "贞洁",
        "tier.stat.exhibitionism.wild_abandon": "暴露狂热",
        "tier.stat.exhibitionism.shameless": "毫不羞耻",
        "tier.stat.exhibitionism.exposed_excites": "暴露兴奋",
        "tier.stat.exhibitionism.enjoys_attention": "享受注目",
        "tier.stat.exhibitionism.likes_being_seen": "喜欢被看见",
        "tier.stat.exhibitionism.shy": "害羞",
        "tier.stat.exhibitionism.coy": "羞怯",
        "tier.stat.deviancy.unspeakable": "不可言说",
        "tier.stat.deviancy.craving": "渴求禁忌",
        "tier.stat.deviancy.scandalous": "欲望骇人",
        "tier.stat.deviancy.shocking": "癖好惊人",
        "tier.stat.deviancy.strange": "口味古怪",
        "tier.stat.deviancy.conventional": "常规",
        "tier.stat.deviancy.squeamish": "排斥",
        "tier.stat.beauty.7": "容貌神圣",
        "tier.stat.beauty.6": "摄人心魄",
        "tier.stat.beauty.5": "美丽",
        "tier.stat.beauty.4": "迷人",
        "tier.stat.beauty.3": "姣好",
        "tier.stat.beauty.2": "可爱",
        "tier.stat.beauty.1": "平凡",
        "tier.stat.physique.7": "强健有力",
        "tier.stat.physique.6": "结实紧致",
        "tier.stat.physique.5": "匀称健美",
        "tier.stat.physique.4": "苗条",
        "tier.stat.physique.3": "纤细修长",
        "tier.stat.physique.2": "瘦弱",
        "tier.stat.physique.1": "枯瘦",
        "tier.stat.willpower.7": "钢铁意志",
        "tier.stat.willpower.6": "坚韧",
        "tier.stat.willpower.5": "坚定",
        "tier.stat.willpower.4": "果决",
        "tier.stat.willpower.3": "沉着",
        "tier.stat.willpower.2": "怯弱",
        "tier.stat.willpower.1": "胆怯",
        "tier.reputation.crime.arrest_certain": "逮捕证据充分",
        "tier.reputation.crime.arrest_possible": "可实施逮捕",
        "tier.reputation.crime.insufficient_evidence": "证据不足",
        "tier.reputation.crimehistory.cabinet": "卷宗成柜",
        "tier.reputation.crimehistory.criminal": "认定罪犯",
        "tier.reputation.crimehistory.troublemaker": "麻烦人物",
        "tier.reputation.crimehistory.person_of_interest": "重点关注",
        "tier.reputation.crimehistory.records": "已有记录",
        "tier.reputation.crimehistory.not_concerned": "警方不关注",
        "tier.grade.none": "无",
        "tier.grade.f": "F",
        "tier.grade.d": "D",
        "tier.grade.c": "C",
        "tier.grade.b": "B",
        "tier.grade.a": "A",
        "tier.grade.s": "S",
        "tier.range.low": "低",
        "tier.range.medium": "中",
        "tier.range.high": "高"
    }
};


/***/ },

/***/ "./src/Localized/EN/npcLocale.ts"
/*!***************************************!*\
  !*** ./src/Localized/EN/npcLocale.ts ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   enNpcLocalePack: () => (/* binding */ enNpcLocalePack)
/* harmony export */ });
const enNpcLocalePack = {
    locale: "en",
    profileMap: {
        "Avery": { localizedName: "Avery", description: "Merchant" },
        "Black Wolf": { localizedName: "Black Wolf", description: "Pack leader" },
        "Eden": { localizedName: "Eden", description: "Hunter" },
        "Ivory Wraith": { localizedName: "Ivory Wraith", description: "Blood moon spirit" },
        "Kylar": { localizedName: "Kylar", description: "Outcast" },
        "Robin": { localizedName: "Robin", description: "Orphan" },
        "Sydney": { localizedName: "Sydney", description: "Believer" },
        "Whitney": { localizedName: "Whitney", description: "Bully" }
    },
    infoLabelMap: {
        love: "Affection",
        lust: "Lust",
        dom: "Dominance",
        rage: "Rage",
        harmony: "Harmony",
        ferocity: "Ferocity",
        purity: "Purity",
        corruption: "Corruption"
    },
    specialInfoLabelMap: {
        "Ivory Wraith": { lust: "Obsession" },
        "Robin": { dom: "Confidence" }
    },
    tabLabelMap: {
        npc: "NPC",
        money: "Money",
        stats: "Stats",
        status: "Status",
        skills: "Skills",
        reputation: "Reputation",
        playerBody: "Player Body",
        utility: "Utility"
    },
    uiText: {
        panelTitle: "DoL Sugar Cube Cheats",
        close: "Close",
        shortcutHint: "Alt+Q to toggle. Alt+Shift+Q to force close.",
        noNpcRoster: "No NPC roster found in current game state yet.",
        set: "Set",
        min: "Min",
        max: "Max",
        value: "Value",
        utilityDescription: "Quick actions for common scenarios.",
        help: "Help",
        helpMin: "Min",
        helpMid: "Mid",
        helpMax: "Max",
        helpRanges: "Tier ranges",
        helpClose: "Close help"
    },
    fieldLabelMap: {
        "money": "Money",
        "feats.allSaves.points": "Vrel Coins",
        "purity": "Purity",
        "beauty": "Beauty",
        "physique": "Physique",
        "willpower": "Willpower",
        "awareness": "Awareness",
        "promiscuity": "Promiscuity",
        "exhibitionism": "Exhibitionism",
        "deviancy": "Deviancy",
        "pain": "Pain",
        "arousal": "Arousal",
        "tiredness": "Tiredness",
        "stress": "Stress",
        "trauma": "Trauma",
        "control": "Control",
        "allure": "Allure",
        "drunk": "Drunk",
        "drugged": "Drugged",
        "hallucinogen": "Hallucinogen",
        "seductionskill": "Seduction Skill",
        "oralskill": "Oral Skill",
        "chestskill": "Chest Skill",
        "handskill": "Hand Skill",
        "bottomskill": "Bottom Skill",
        "analskill": "Anal Skill",
        "vaginalskill": "Vaginal Skill",
        "feetskill": "Feet Skill",
        "thighskill": "Thigh Skill",
        "penileskill": "Penile Skill",
        "corruption_slime": "Slime Corruption",
        "skulduggery": "Skulduggery",
        "danceskill": "Dance Skill",
        "swimmingskill": "Swimming Skill",
        "athletics": "Athletics",
        "tending": "Tending",
        "housekeeping": "Housekeeping",
        "science": "Science XP",
        "sciencetrait": "Science Grade",
        "maths": "Math XP",
        "mathstrait": "Math Grade",
        "english": "English XP",
        "englishtrait": "English Grade",
        "history": "History XP",
        "historytrait": "History Grade",
        "prof.spray": "Spray Skill",
        "prof.net": "Net Skill",
        "fame.sex": "Fame: Sex",
        "fame.prostitution": "Fame: Prostitution",
        "fame.business": "Fame: Business",
        "fame.scrap": "Fame: Scrap",
        "fame.social": "Fame: Social",
        "fame.good": "Fame: Good",
        "crimehistory": "Crime History",
        "crime": "Arrest Risk",
        "player.breastsize": "Breast Size",
        "milk_volume": "Milk Volume",
        "player.penissize": "Penis Size",
        "semen_volume": "Semen Volume",
        "player.bottomsize": "Bottom Size",
        "bottomgrowthtimer": "Bottom Growth Timer",
        "player.pregnancyBelly": "Pregnancy Belly",
        "pregnancytimer": "Pregnancy Timer",
        "cycleDay": "Cycle Day"
    },
    utilityLabelMap: {
        "setMaxMoney": "Set Money Max",
        "setMinCrime": "Clear Crime",
        "maxCoreStats": "Max Core Stats",
        "maxSkills": "Max Skills",
        "resetNegativeStatus": "Reset Negative Status",
        "maxPlayerBody": "Max Player Body"
    },
    tierLabelMap: {
        "tier.fame.unknown": "Unknown",
        "tier.fame.obscure": "Obscure",
        "tier.fame.lowkey": "Low-key",
        "tier.fame.known": "Known",
        "tier.fame.recognised": "Recognised",
        "tier.fame.famous": "Famous",
        "tier.fame.notorious": "Notorious",
        "tier.common.1": "Tier 1",
        "tier.common.2": "Tier 2",
        "tier.common.3": "Tier 3",
        "tier.common.4": "Tier 4",
        "tier.common.5": "Tier 5",
        "tier.common.6": "Tier 6",
        "tier.common.7": "Tier 7",
        "tier.stat.purity.angelic": "Angelic",
        "tier.stat.purity.nearly_pure": "Nearly Pure",
        "tier.stat.purity.slightly_soiled": "Slightly Soiled",
        "tier.stat.purity.soiled": "Soiled",
        "tier.stat.purity.somewhat_defiled": "Somewhat Defiled",
        "tier.stat.purity.defiled": "Defiled",
        "tier.stat.purity.utterly_defiled": "Utterly Defiled",
        "tier.stat.purity.beyond_defiled": "Beyond Defiled",
        "tier.stat.awareness.transcendental": "Transcendental",
        "tier.stat.awareness.depths": "Depths of Depravity",
        "tier.stat.awareness.rare_knowledge": "Rare Knowledge",
        "tier.stat.awareness.above_normal": "Above Normal",
        "tier.stat.awareness.normal": "Normal Understanding",
        "tier.stat.awareness.limited": "Limited Understanding",
        "tier.stat.awareness.almost_innocent": "Almost Innocent",
        "tier.stat.awareness.innocent": "Innocent",
        "tier.stat.promiscuity.insatiable": "Insatiable",
        "tier.stat.promiscuity.slut": "Slut",
        "tier.stat.promiscuity.craving": "Craving Contact",
        "tier.stat.promiscuity.excited": "Sexually Excited",
        "tier.stat.promiscuity.curious": "Sexually Curious",
        "tier.stat.promiscuity.prudish": "Prudish",
        "tier.stat.promiscuity.chaste": "Chaste",
        "tier.stat.exhibitionism.wild_abandon": "Wild Abandon",
        "tier.stat.exhibitionism.shameless": "Shameless",
        "tier.stat.exhibitionism.exposed_excites": "Exposed Excites",
        "tier.stat.exhibitionism.enjoys_attention": "Enjoys Attention",
        "tier.stat.exhibitionism.likes_being_seen": "Likes Being Seen",
        "tier.stat.exhibitionism.shy": "Shy",
        "tier.stat.exhibitionism.coy": "Coy",
        "tier.stat.deviancy.unspeakable": "Unspeakable",
        "tier.stat.deviancy.craving": "Craves the Taboo",
        "tier.stat.deviancy.scandalous": "Scandalous Desires",
        "tier.stat.deviancy.shocking": "Shocking Tastes",
        "tier.stat.deviancy.strange": "Strange Tastes",
        "tier.stat.deviancy.conventional": "Conventional",
        "tier.stat.deviancy.squeamish": "Squeamish",
        "tier.stat.beauty.7": "Divine Beauty",
        "tier.stat.beauty.6": "Ravishing",
        "tier.stat.beauty.5": "Beautiful",
        "tier.stat.beauty.4": "Charming",
        "tier.stat.beauty.3": "Pretty",
        "tier.stat.beauty.2": "Cute",
        "tier.stat.beauty.1": "Plain",
        "tier.stat.physique.7": "Toned and Powerful",
        "tier.stat.physique.6": "Toned and Firm",
        "tier.stat.physique.5": "Slim and Athletic",
        "tier.stat.physique.4": "Slim",
        "tier.stat.physique.3": "Lithe and Slender",
        "tier.stat.physique.2": "Skinny",
        "tier.stat.physique.1": "Emaciated",
        "tier.stat.willpower.7": "Iron Will",
        "tier.stat.willpower.6": "Tenacious",
        "tier.stat.willpower.5": "Determined",
        "tier.stat.willpower.4": "Resolved",
        "tier.stat.willpower.3": "Mindful",
        "tier.stat.willpower.2": "Fainthearted",
        "tier.stat.willpower.1": "Timid",
        "tier.reputation.crime.arrest_certain": "Arrest Certain",
        "tier.reputation.crime.arrest_possible": "Arrest Possible",
        "tier.reputation.crime.insufficient_evidence": "Insufficient Evidence",
        "tier.reputation.crimehistory.cabinet": "Filing Cabinet",
        "tier.reputation.crimehistory.criminal": "Criminal Profile",
        "tier.reputation.crimehistory.troublemaker": "Troublemaker",
        "tier.reputation.crimehistory.person_of_interest": "Person of Interest",
        "tier.reputation.crimehistory.records": "On Record",
        "tier.reputation.crimehistory.not_concerned": "Not Concerned",
        "tier.grade.none": "None",
        "tier.grade.f": "F",
        "tier.grade.d": "D",
        "tier.grade.c": "C",
        "tier.grade.b": "B",
        "tier.grade.a": "A",
        "tier.grade.s": "S",
        "tier.range.low": "Low",
        "tier.range.medium": "Medium",
        "tier.range.high": "High"
    }
};


/***/ },

/***/ "./src/Localized/index.ts"
/*!********************************!*\
  !*** ./src/Localized/index.ts ***!
  \********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getActiveCheatLocalePack: () => (/* binding */ getActiveCheatLocalePack),
/* harmony export */   getActiveNpcLocalePack: () => (/* binding */ getActiveNpcLocalePack)
/* harmony export */ });
/* harmony import */ var _CN_npcLocale__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./CN/npcLocale */ "./src/Localized/CN/npcLocale.ts");
/* harmony import */ var _EN_npcLocale__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./EN/npcLocale */ "./src/Localized/EN/npcLocale.ts");


const localeRegistry = {
    en: _EN_npcLocale__WEBPACK_IMPORTED_MODULE_1__.enNpcLocalePack,
    cn: _CN_npcLocale__WEBPACK_IMPORTED_MODULE_0__.cnNpcLocalePack
};
function detectDefaultLocale() {
    const normalizedLanguage = (navigator.language || "").toLowerCase();
    if (normalizedLanguage.startsWith("zh")) {
        return "cn";
    }
    return "en";
}
function getActiveNpcLocalePack() {
    const storedLocale = (localStorage.getItem("dolCheatLocale") || "").toLowerCase();
    if (storedLocale === "cn") {
        return localeRegistry.cn;
    }
    if (storedLocale === "en") {
        return localeRegistry.en;
    }
    return localeRegistry[detectDefaultLocale()];
}
function getActiveCheatLocalePack() {
    return getActiveNpcLocalePack();
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!****************************************!*\
  !*** ./src/GreasemonkeyScript/init.ts ***!
  \****************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _start__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./start */ "./src/GreasemonkeyScript/start.ts");

const runtimeWindow = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
(() => {
    const launcher = new _start__WEBPACK_IMPORTED_MODULE_0__.InternationalCheatLauncher(runtimeWindow);
    launcher.bootstrap();
})();

})();

/******/ })()
;
//# sourceMappingURL=GreasemonkeyScript.user.js.map