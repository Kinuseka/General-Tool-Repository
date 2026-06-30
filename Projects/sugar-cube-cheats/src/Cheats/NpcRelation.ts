import {getActiveNpcLocalePack} from "../Localized";
import {NpcStatKey} from "../Localized/types";
export type {NpcStatKey} from "../Localized/types";

export interface NpcDisplayProfile {
    baseName: string;
    localizedName: string;
    description: string;
    statKeys: NpcStatKey[];
}

export interface NpcRosterEntry {
    rosterKey: string;
    stateRef: Record<string, any>;
    displayProfile: NpcDisplayProfile;
}

const importantNpcSortOrder = ["Robin", "Whitney", "Eden", "Kylar", "Sydney", "Avery", "Great Hawk", "Black Wolf", "Alex"];
const specialNpcSortOrder = ["Ivory Wraith"];

const baseNpcProfileTable = new Map<string, NpcDisplayProfile>([
    ["Avery", {baseName: "Avery", localizedName: "Avery", description: "Merchant", statKeys: ["love", "lust", "dom", "rage"]}],
    ["Black Wolf", {baseName: "Black Wolf", localizedName: "Black Wolf", description: "Pack leader", statKeys: ["love", "lust", "dom", "harmony", "ferocity"]}],
    ["Eden", {baseName: "Eden", localizedName: "Eden", description: "Hunter", statKeys: ["love", "lust", "dom"]}],
    ["Ivory Wraith", {baseName: "Ivory Wraith", localizedName: "Ivory Wraith", description: "Blood moon spirit", statKeys: ["love", "lust", "dom"]}],
    ["Kylar", {baseName: "Kylar", localizedName: "Kylar", description: "Outcast", statKeys: ["love", "lust", "dom", "rage"]}],
    ["Robin", {baseName: "Robin", localizedName: "Robin", description: "Orphan", statKeys: ["love", "lust", "dom"]}],
    ["Sydney", {baseName: "Sydney", localizedName: "Sydney", description: "Believer", statKeys: ["love", "lust", "dom", "purity", "corruption"]}],
    ["Whitney", {baseName: "Whitney", localizedName: "Whitney", description: "Bully", statKeys: ["love", "lust", "dom"]}]
]);

function uniqueStringsInOrder(inputNames: string[]): string[] {
    const seenNameSet = new Set<string>();
    const orderedNames: string[] = [];
    inputNames.forEach((nameItem) => {
        if (!seenNameSet.has(nameItem)) {
            seenNameSet.add(nameItem);
            orderedNames.push(nameItem);
        }
    });
    return orderedNames;
}

export function resolveNpcDisplayProfile(npcName: string): NpcDisplayProfile {
    const localePack = getActiveNpcLocalePack();
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

export function resolveNpcInfoLabel(npcName: string, statKey: NpcStatKey): string {
    const localePack = getActiveNpcLocalePack();
    const localizedSpecialLabel = localePack.specialInfoLabelMap[npcName]?.[statKey];
    if (localizedSpecialLabel) {
        return localizedSpecialLabel;
    }
    return localePack.infoLabelMap[statKey] ?? statKey;
}

export class NpcRosterResolver {
    constructor(private readonly gameWindow: SugarCubeWindow) {}

    private get activeVariables(): Record<string, any> {
        return this.gameWindow.SugarCube?.State?.active?.variables ?? {};
    }

    private get npcNameKeys(): string[] {
        const incomingList = this.activeVariables.NPCNameList;
        return Array.isArray(incomingList) ? incomingList : [];
    }

    private get npcStates(): Record<string, any>[] {
        const incomingStates = this.activeVariables.NPCName;
        return Array.isArray(incomingStates) ? incomingStates : [];
    }

    private getStateByNpcKey(npcKey: string): Record<string, any> | undefined {
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

    buildNpcRoster(): NpcRosterEntry[] {
        const rawSortOrder = uniqueStringsInOrder([
            ...specialNpcSortOrder,
            ...importantNpcSortOrder,
            ...this.npcNameKeys
        ]);

        const finalRoster: NpcRosterEntry[] = [];
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

