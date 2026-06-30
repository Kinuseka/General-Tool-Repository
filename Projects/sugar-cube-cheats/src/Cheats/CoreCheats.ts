import {CheatTabKey} from "../Localized/types";

export interface CheatFieldDefinition {
    key: string;
    min: number;
    max: number | string;
}

export interface CheatFieldSection {
    id: string;
    title: string;
    fields: CheatFieldDefinition[];
}

export interface UtilityActionDefinition {
    key: string;
    fieldKeys: string[];
    mode: "min" | "max";
}

export type TierColorKey =
    | "muted"
    | "amber"
    | "cyan"
    | "magenta"
    | "danger"
    | "safe"
    | "red"
    | "pink"
    | "purple"
    | "blue"
    | "lblue"
    | "teal"
    | "green"
    | "white"
    | "gold";

interface TierRule {
    min: number;
    labelKey: string;
    colorKey: TierColorKey;
}

interface FieldTierSpec {
    mode: "absolute" | "ratio";
    rules: TierRule[];
}

export const tabOrder: CheatTabKey[] = ["money", "stats", "status", "skills", "reputation", "playerBody", "npc", "utility"];

export const cheatSectionsByTab: Record<Exclude<CheatTabKey, "npc" | "utility">, CheatFieldSection[]> = {
    money: [
        {
            id: "money-main",
            title: "Money",
            fields: [
                {key: "money", min: 0, max: 100000000},
                {key: "feats.allSaves.points", min: 0, max: 1000}
            ]
        }
    ],
    stats: [
        {
            id: "stats-core",
            title: "Core Stats",
            fields: [
                {key: "purity", min: 0, max: 1000},
                {key: "beauty", min: 0, max: "beautymax"},
                {key: "physique", min: 0, max: "physiquemax"},
                {key: "willpower", min: 0, max: "willpowermax"},
                {key: "awareness", min: 0, max: 1000},
                {key: "promiscuity", min: 0, max: 1000},
                {key: "exhibitionism", min: 0, max: 1000},
                {key: "deviancy", min: 0, max: 1000}
            ]
        }
    ],
    status: [
        {
            id: "status-main",
            title: "Status",
            fields: [
                {key: "pain", min: 0, max: 100},
                {key: "arousal", min: 0, max: "arousalmax"},
                {key: "tiredness", min: 0, max: 1000},
                {key: "stress", min: 0, max: "stressmax"},
                {key: "trauma", min: 0, max: "traumamax"},
                {key: "control", min: 0, max: "controlmax"},
                {key: "allure", min: 0, max: 10000},
                {key: "drunk", min: 0, max: 1000},
                {key: "drugged", min: 0, max: 1000},
                {key: "hallucinogen", min: 0, max: 1000}
            ]
        }
    ],
    skills: [
        {
            id: "skills-sex",
            title: "Sex Skills",
            fields: [
                {key: "seductionskill", min: 0, max: 1000},
                {key: "oralskill", min: 0, max: 1000},
                {key: "chestskill", min: 0, max: 1000},
                {key: "handskill", min: 0, max: 1000},
                {key: "bottomskill", min: 0, max: 1000},
                {key: "analskill", min: 0, max: 1000},
                {key: "vaginalskill", min: 0, max: 1000},
                {key: "feetskill", min: 0, max: 1000},
                {key: "thighskill", min: 0, max: 1000},
                {key: "penileskill", min: 0, max: 1000}
            ]
        },
        {
            id: "skills-general",
            title: "General Skills",
            fields: [
                {key: "corruption_slime", min: 0, max: 100},
                {key: "skulduggery", min: 0, max: 1000},
                {key: "danceskill", min: 0, max: 1000},
                {key: "swimmingskill", min: 0, max: 1000},
                {key: "athletics", min: 0, max: 1000},
                {key: "tending", min: 0, max: 1000},
                {key: "housekeeping", min: 0, max: 1000}
            ]
        },
        {
            id: "skills-school",
            title: "School Skills",
            fields: [
                {key: "science", min: 0, max: 1000},
                {key: "sciencetrait", min: 0, max: 4},
                {key: "maths", min: 0, max: 1000},
                {key: "mathstrait", min: 0, max: 4},
                {key: "english", min: 0, max: 1000},
                {key: "englishtrait", min: 0, max: 4},
                {key: "history", min: 0, max: 1000},
                {key: "historytrait", min: 0, max: 4}
            ]
        },
        {
            id: "skills-weapon",
            title: "Weapon Skills",
            fields: [
                {key: "prof.spray", min: 0, max: 1000},
                {key: "prof.net", min: 0, max: 1000}
            ]
        }
    ],
    reputation: [
        {
            id: "reputation-main",
            title: "Reputation",
            fields: [
                {key: "fame.sex", min: 0, max: 1000},
                {key: "fame.prostitution", min: 0, max: 1000},
                {key: "fame.business", min: 0, max: 1000},
                {key: "fame.scrap", min: 0, max: 1000},
                {key: "fame.social", min: 0, max: 1000},
                {key: "fame.good", min: 0, max: 1000},
                {key: "crimehistory", min: 0, max: 30000},
                {key: "crime", min: 0, max: 5000}
            ]
        }
    ],
    playerBody: [
        {
            id: "player-body-main",
            title: "Player Body",
            fields: [
                {key: "player.breastsize", min: 0, max: 20},
                {key: "milk_volume", min: 0, max: 10000},
                {key: "player.penissize", min: 0, max: 10},
                {key: "semen_volume", min: 0, max: 10000},
                {key: "player.bottomsize", min: 0, max: 20},
                {key: "bottomgrowthtimer", min: 0, max: 10},
                {key: "player.pregnancyBelly", min: 0, max: 30},
                {key: "pregnancytimer", min: 0, max: 400},
                {key: "cycleDay", min: 0, max: 40}
            ]
        }
    ]
};

export const utilityActions: UtilityActionDefinition[] = [
    {key: "setMaxMoney", mode: "max", fieldKeys: ["money", "feats.allSaves.points"]},
    {key: "setMinCrime", mode: "min", fieldKeys: ["crimehistory", "crime"]},
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
    {key: "resetNegativeStatus", mode: "min", fieldKeys: ["pain", "arousal", "tiredness", "stress", "trauma", "drunk", "drugged", "hallucinogen"]},
    {key: "maxPlayerBody", mode: "max", fieldKeys: ["player.breastsize", "milk_volume", "player.penissize", "semen_volume", "player.bottomsize"]}
];

const fameTierRules: TierRule[] = [
    {min: 1000, labelKey: "tier.fame.notorious", colorKey: "magenta"},
    {min: 600, labelKey: "tier.fame.famous", colorKey: "cyan"},
    {min: 400, labelKey: "tier.fame.recognised", colorKey: "cyan"},
    {min: 200, labelKey: "tier.fame.known", colorKey: "amber"},
    {min: 100, labelKey: "tier.fame.lowkey", colorKey: "amber"},
    {min: 30, labelKey: "tier.fame.obscure", colorKey: "muted"},
    {min: Number.NEGATIVE_INFINITY, labelKey: "tier.fame.unknown", colorKey: "muted"}
];

const ratioSevenTierRules: TierRule[] = [
    {min: 1, labelKey: "tier.common.7", colorKey: "safe"},
    {min: 0.85, labelKey: "tier.common.6", colorKey: "cyan"},
    {min: 0.7, labelKey: "tier.common.5", colorKey: "cyan"},
    {min: 0.55, labelKey: "tier.common.4", colorKey: "amber"},
    {min: 0.4, labelKey: "tier.common.3", colorKey: "amber"},
    {min: 0.2, labelKey: "tier.common.2", colorKey: "muted"},
    {min: Number.NEGATIVE_INFINITY, labelKey: "tier.common.1", colorKey: "muted"}
];

const ratioSevenGameColorRules: TierRule[] = [
    {min: 1, labelKey: "tier.common.7", colorKey: "green"},
    {min: 0.85, labelKey: "tier.common.6", colorKey: "teal"},
    {min: 0.7, labelKey: "tier.common.5", colorKey: "lblue"},
    {min: 0.55, labelKey: "tier.common.4", colorKey: "blue"},
    {min: 0.4, labelKey: "tier.common.3", colorKey: "purple"},
    {min: 0.2, labelKey: "tier.common.2", colorKey: "pink"},
    {min: Number.NEGATIVE_INFINITY, labelKey: "tier.common.1", colorKey: "red"}
];

const skillGradeRules: TierRule[] = [
    {min: 1000, labelKey: "tier.grade.s", colorKey: "green"},
    {min: 800, labelKey: "tier.grade.a", colorKey: "teal"},
    {min: 600, labelKey: "tier.grade.b", colorKey: "lblue"},
    {min: 400, labelKey: "tier.grade.c", colorKey: "blue"},
    {min: 200, labelKey: "tier.grade.d", colorKey: "purple"},
    {min: 1, labelKey: "tier.grade.f", colorKey: "pink"},
    {min: Number.NEGATIVE_INFINITY, labelKey: "tier.grade.none", colorKey: "red"}
];

const schoolTraitRules: TierRule[] = [
    {min: 4, labelKey: "tier.grade.a", colorKey: "teal"},
    {min: 3, labelKey: "tier.grade.b", colorKey: "lblue"},
    {min: 2, labelKey: "tier.grade.c", colorKey: "blue"},
    {min: 1, labelKey: "tier.grade.d", colorKey: "purple"},
    {min: Number.NEGATIVE_INFINITY, labelKey: "tier.grade.f", colorKey: "pink"}
];

const threeBandRules: TierRule[] = [
    {min: 0.67, labelKey: "tier.range.high", colorKey: "green"},
    {min: 0.34, labelKey: "tier.range.medium", colorKey: "teal"},
    {min: Number.NEGATIVE_INFINITY, labelKey: "tier.range.low", colorKey: "pink"}
];

const tierSpecByField: Record<string, FieldTierSpec> = {
    purity: {
        mode: "absolute",
        rules: [
            {min: 1000, labelKey: "tier.stat.purity.angelic", colorKey: "safe"},
            {min: 900, labelKey: "tier.stat.purity.nearly_pure", colorKey: "cyan"},
            {min: 800, labelKey: "tier.stat.purity.slightly_soiled", colorKey: "cyan"},
            {min: 700, labelKey: "tier.stat.purity.soiled", colorKey: "amber"},
            {min: 600, labelKey: "tier.stat.purity.somewhat_defiled", colorKey: "amber"},
            {min: 500, labelKey: "tier.stat.purity.defiled", colorKey: "amber"},
            {min: 1, labelKey: "tier.stat.purity.utterly_defiled", colorKey: "danger"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.purity.beyond_defiled", colorKey: "danger"}
        ]
    },
    awareness: {
        mode: "absolute",
        rules: [
            {min: 1000, labelKey: "tier.stat.awareness.transcendental", colorKey: "magenta"},
            {min: 500, labelKey: "tier.stat.awareness.depths", colorKey: "cyan"},
            {min: 400, labelKey: "tier.stat.awareness.rare_knowledge", colorKey: "cyan"},
            {min: 300, labelKey: "tier.stat.awareness.above_normal", colorKey: "amber"},
            {min: 200, labelKey: "tier.stat.awareness.normal", colorKey: "amber"},
            {min: 100, labelKey: "tier.stat.awareness.limited", colorKey: "muted"},
            {min: 1, labelKey: "tier.stat.awareness.almost_innocent", colorKey: "muted"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.awareness.innocent", colorKey: "safe"}
        ]
    },
    promiscuity: {
        mode: "absolute",
        rules: [
            {min: 95, labelKey: "tier.stat.promiscuity.insatiable", colorKey: "magenta"},
            {min: 75, labelKey: "tier.stat.promiscuity.slut", colorKey: "cyan"},
            {min: 55, labelKey: "tier.stat.promiscuity.craving", colorKey: "cyan"},
            {min: 35, labelKey: "tier.stat.promiscuity.excited", colorKey: "amber"},
            {min: 15, labelKey: "tier.stat.promiscuity.curious", colorKey: "amber"},
            {min: 1, labelKey: "tier.stat.promiscuity.prudish", colorKey: "muted"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.promiscuity.chaste", colorKey: "safe"}
        ]
    },
    exhibitionism: {
        mode: "absolute",
        rules: [
            {min: 95, labelKey: "tier.stat.exhibitionism.wild_abandon", colorKey: "magenta"},
            {min: 75, labelKey: "tier.stat.exhibitionism.shameless", colorKey: "cyan"},
            {min: 55, labelKey: "tier.stat.exhibitionism.exposed_excites", colorKey: "cyan"},
            {min: 35, labelKey: "tier.stat.exhibitionism.enjoys_attention", colorKey: "amber"},
            {min: 15, labelKey: "tier.stat.exhibitionism.likes_being_seen", colorKey: "amber"},
            {min: 1, labelKey: "tier.stat.exhibitionism.shy", colorKey: "muted"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.exhibitionism.coy", colorKey: "safe"}
        ]
    },
    deviancy: {
        mode: "absolute",
        rules: [
            {min: 95, labelKey: "tier.stat.deviancy.unspeakable", colorKey: "magenta"},
            {min: 75, labelKey: "tier.stat.deviancy.craving", colorKey: "cyan"},
            {min: 55, labelKey: "tier.stat.deviancy.scandalous", colorKey: "cyan"},
            {min: 35, labelKey: "tier.stat.deviancy.shocking", colorKey: "amber"},
            {min: 15, labelKey: "tier.stat.deviancy.strange", colorKey: "amber"},
            {min: 1, labelKey: "tier.stat.deviancy.conventional", colorKey: "muted"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.stat.deviancy.squeamish", colorKey: "safe"}
        ]
    },
    beauty: {mode: "ratio", rules: ratioSevenTierRules.map((item, index) => ({...item, labelKey: `tier.stat.beauty.${7 - index}`}))},
    physique: {mode: "ratio", rules: ratioSevenTierRules.map((item, index) => ({...item, labelKey: `tier.stat.physique.${7 - index}`}))},
    willpower: {mode: "ratio", rules: ratioSevenTierRules.map((item, index) => ({...item, labelKey: `tier.stat.willpower.${7 - index}`}))},
    "fame.sex": {mode: "absolute", rules: fameTierRules},
    "fame.prostitution": {mode: "absolute", rules: fameTierRules},
    "fame.business": {mode: "absolute", rules: fameTierRules},
    "fame.scrap": {mode: "absolute", rules: fameTierRules},
    "fame.social": {mode: "absolute", rules: fameTierRules},
    "fame.good": {mode: "absolute", rules: fameTierRules},
    crime: {
        mode: "absolute",
        rules: [
            {min: 5000, labelKey: "tier.reputation.crime.arrest_certain", colorKey: "magenta"},
            {min: 1000, labelKey: "tier.reputation.crime.arrest_possible", colorKey: "amber"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.reputation.crime.insufficient_evidence", colorKey: "muted"}
        ]
    },
    crimehistory: {
        mode: "absolute",
        rules: [
            {min: 30000, labelKey: "tier.reputation.crimehistory.cabinet", colorKey: "magenta"},
            {min: 10000, labelKey: "tier.reputation.crimehistory.criminal", colorKey: "cyan"},
            {min: 5000, labelKey: "tier.reputation.crimehistory.troublemaker", colorKey: "cyan"},
            {min: 3000, labelKey: "tier.reputation.crimehistory.person_of_interest", colorKey: "amber"},
            {min: 2000, labelKey: "tier.reputation.crimehistory.records", colorKey: "amber"},
            {min: 1000, labelKey: "tier.reputation.crimehistory.not_concerned", colorKey: "muted"},
            {min: Number.NEGATIVE_INFINITY, labelKey: "tier.reputation.crimehistory.not_concerned", colorKey: "muted"}
        ]
    },
    money: {mode: "ratio", rules: ratioSevenGameColorRules},
    "feats.allSaves.points": {mode: "ratio", rules: ratioSevenGameColorRules},
    pain: {mode: "ratio", rules: threeBandRules},
    arousal: {mode: "ratio", rules: ratioSevenGameColorRules},
    tiredness: {mode: "ratio", rules: threeBandRules},
    stress: {mode: "ratio", rules: threeBandRules},
    trauma: {mode: "ratio", rules: threeBandRules},
    control: {mode: "ratio", rules: ratioSevenGameColorRules},
    allure: {mode: "ratio", rules: ratioSevenGameColorRules},
    drunk: {mode: "ratio", rules: threeBandRules},
    drugged: {mode: "ratio", rules: threeBandRules},
    hallucinogen: {mode: "ratio", rules: threeBandRules},
    seductionskill: {mode: "absolute", rules: skillGradeRules},
    oralskill: {mode: "absolute", rules: skillGradeRules},
    chestskill: {mode: "absolute", rules: skillGradeRules},
    handskill: {mode: "absolute", rules: skillGradeRules},
    bottomskill: {mode: "absolute", rules: skillGradeRules},
    analskill: {mode: "absolute", rules: skillGradeRules},
    vaginalskill: {mode: "absolute", rules: skillGradeRules},
    feetskill: {mode: "absolute", rules: skillGradeRules},
    thighskill: {mode: "absolute", rules: skillGradeRules},
    penileskill: {mode: "absolute", rules: skillGradeRules},
    corruption_slime: {mode: "ratio", rules: ratioSevenGameColorRules},
    skulduggery: {mode: "absolute", rules: skillGradeRules},
    danceskill: {mode: "absolute", rules: skillGradeRules},
    swimmingskill: {mode: "absolute", rules: skillGradeRules},
    athletics: {mode: "absolute", rules: skillGradeRules},
    tending: {mode: "absolute", rules: skillGradeRules},
    housekeeping: {mode: "absolute", rules: skillGradeRules},
    science: {mode: "absolute", rules: skillGradeRules},
    sciencetrait: {mode: "absolute", rules: schoolTraitRules},
    maths: {mode: "absolute", rules: skillGradeRules},
    mathstrait: {mode: "absolute", rules: schoolTraitRules},
    english: {mode: "absolute", rules: skillGradeRules},
    englishtrait: {mode: "absolute", rules: schoolTraitRules},
    history: {mode: "absolute", rules: skillGradeRules},
    historytrait: {mode: "absolute", rules: schoolTraitRules},
    "prof.spray": {mode: "absolute", rules: skillGradeRules},
    "prof.net": {mode: "absolute", rules: skillGradeRules},
    "player.breastsize": {mode: "ratio", rules: ratioSevenGameColorRules},
    milk_volume: {mode: "ratio", rules: ratioSevenGameColorRules},
    "player.penissize": {mode: "ratio", rules: ratioSevenGameColorRules},
    semen_volume: {mode: "ratio", rules: ratioSevenGameColorRules},
    "player.bottomsize": {mode: "ratio", rules: ratioSevenGameColorRules},
    bottomgrowthtimer: {mode: "ratio", rules: ratioSevenGameColorRules},
    "player.pregnancyBelly": {mode: "ratio", rules: ratioSevenGameColorRules},
    pregnancytimer: {mode: "ratio", rules: ratioSevenGameColorRules},
    cycleDay: {mode: "ratio", rules: ratioSevenGameColorRules}
};

export const tierColorMap: Record<TierColorKey, string> = {
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

export interface TierDisplay {
    labelKey: string;
    colorKey: TierColorKey;
}

export interface TierRangeDisplay {
    labelKey: string;
    colorKey: TierColorKey;
    min: number;
    maxExclusive?: number;
}

export interface TierRangeHelp {
    min: number;
    mid: number;
    max: number;
    ranges: TierRangeDisplay[];
}

export function resolveFieldTier(fieldKey: string, value: number, maxValue?: number): TierDisplay | undefined {
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

export function resolveFieldTierHelp(fieldKey: string, minValue: number, maxValue: number): TierRangeHelp | undefined {
    const fieldSpec = tierSpecByField[fieldKey];
    if (!fieldSpec || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return undefined;
    }
    const safeMax = Math.max(maxValue, minValue);
    const ranges: TierRangeDisplay[] = [];
    fieldSpec.rules.forEach((ruleItem, index) => {
        const previousRule = index > 0 ? fieldSpec.rules[index - 1] : undefined;
        const ruleMin = fieldSpec.mode === "ratio"
            ? (Number.isFinite(ruleItem.min) ? (ruleItem.min * safeMax) : minValue)
            : (Number.isFinite(ruleItem.min) ? ruleItem.min : minValue);
        const rangeMin = Math.max(minValue, ruleMin);
        const maxExclusive = previousRule
            ? (
                fieldSpec.mode === "ratio"
                    ? (Number.isFinite(previousRule.min) ? (previousRule.min * safeMax) : undefined)
                    : (Number.isFinite(previousRule.min) ? previousRule.min : undefined)
            )
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

export function getValueByPath(root: Record<string, any>, path: string): any {
    return path.split(".").reduce<any>((current, segment) => {
        if (!current || typeof current !== "object") {
            return undefined;
        }
        return current[segment];
    }, root);
}

export function hasPath(root: Record<string, any>, path: string): boolean {
    if (path.length === 0) {
        return false;
    }
    const segments = path.split(".");
    let pointer: any = root;
    for (let index = 0; index < segments.length; index += 1) {
        if (!pointer || typeof pointer !== "object" || !(segments[index] in pointer)) {
            return false;
        }
        pointer = pointer[segments[index]];
    }
    return true;
}

export function setValueByPath(root: Record<string, any>, path: string, value: number): boolean {
    const segments = path.split(".");
    if (segments.length === 0) {
        return false;
    }
    let pointer: any = root;
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

