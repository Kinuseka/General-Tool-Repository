export type NpcStatKey = "love" | "lust" | "dom" | "rage" | "harmony" | "ferocity" | "purity" | "corruption";

export type LocaleKey = "en" | "cn";
export type CheatTabKey = "npc" | "money" | "stats" | "status" | "skills" | "reputation" | "playerBody" | "utility";

export interface NpcProfileSeed {
    localizedName: string;
    description: string;
    statKeys?: NpcStatKey[];
}

export interface CheatLocalePack {
    locale: LocaleKey;
    profileMap: Record<string, NpcProfileSeed>;
    infoLabelMap: Partial<Record<NpcStatKey, string>>;
    specialInfoLabelMap: Record<string, Partial<Record<NpcStatKey, string>>>;
    tabLabelMap: Record<CheatTabKey, string>;
    uiText: {
        panelTitle: string;
        close: string;
        shortcutHint: string;
        noNpcRoster: string;
        set: string;
        min: string;
        max: string;
        value: string;
        utilityDescription: string;
        help: string;
        helpMin: string;
        helpMid: string;
        helpMax: string;
        helpRanges: string;
        helpClose: string;
    };
    fieldLabelMap: Record<string, string>;
    utilityLabelMap: Record<string, string>;
    tierLabelMap: Record<string, string>;
}

export type NpcLocalePack = CheatLocalePack;

