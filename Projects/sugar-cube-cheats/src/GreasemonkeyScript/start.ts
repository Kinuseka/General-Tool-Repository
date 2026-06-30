import {cheatSectionsByTab, getValueByPath, hasPath, resolveFieldTier, resolveFieldTierHelp, setValueByPath, tabOrder, tierColorMap, utilityActions} from "../Cheats/CoreCheats";
import {NpcRosterResolver, NpcStatKey, resolveNpcInfoLabel} from "../Cheats/NpcRelation";
import {getActiveCheatLocalePack} from "../Localized";
import {CheatTabKey} from "../Localized/types";

function createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string): HTMLElementTagNameMap[K] {
    const newElement = document.createElement(tagName);
    if (className) {
        newElement.className = className;
    }
    return newElement;
}

export class InternationalCheatLauncher {
    private panelRoot?: HTMLDivElement;
    private bannerNode?: HTMLDivElement;
    private bootstrapReady = false;
    private sugarCubeWaitCycles = 0;
    private activeTab: CheatTabKey = "npc";
    private panelMessage = "";
    private readonly pendingChanges = new Map<string, {apply: () => boolean; previewValue?: number}>();

    constructor(private readonly gameWindow: SugarCubeWindow) {}

    bootstrap() {
        setTimeout(() => this.waitUntilGameReady(), 100);
    }

    private waitUntilGameReady() {
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

    private initOnce() {
        if (this.bootstrapReady) {
            return;
        }
        this.bootstrapReady = true;
        this.attachKeyboardShortcut();
        this.attachFloatingBanner();
    }

    private attachKeyboardShortcut() {
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

    private attachFloatingBanner() {
        const localePack = getActiveCheatLocalePack();
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

    private ensurePanel() {
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

    private togglePanel() {
        const panelNode = this.ensurePanel();
        if (panelNode.style.display === "none") {
            this.renderPanelContent(panelNode);
            panelNode.style.display = "block";
            return;
        }
        panelNode.style.display = "none";
    }

    private closePanel() {
        if (!this.panelRoot) {
            return;
        }
        this.panelRoot.style.display = "none";
    }

    private renderPanelContent(panelNode: HTMLDivElement) {
        const localePack = getActiveCheatLocalePack();
        panelNode.innerHTML = "";

        const headingRow = createElement("div");
        headingRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;";
        const headingTitle = createElement("strong");
        headingTitle.innerText = localePack.uiText.panelTitle;
        const closeButton = createElement("button") as HTMLButtonElement;
        closeButton.innerText = localePack.uiText.close;
        closeButton.style.cssText = "border:1px solid #666;background:#303030;color:#eee;padding:3px 8px;border-radius:3px;";
        closeButton.addEventListener("click", () => this.closePanel());
        headingRow.appendChild(headingTitle);
        headingRow.appendChild(closeButton);
        panelNode.appendChild(headingRow);

        const actionRow = createElement("div");
        actionRow.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;";
        const saveButton = createElement("button") as HTMLButtonElement;
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
        tabOrder.forEach((tabKey) => {
            const tabButton = createElement("button") as HTMLButtonElement;
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
        } else if (this.activeTab === "utility") {
            this.renderUtilityTab(tabContent);
        } else {
            this.renderFieldTab(tabContent, this.activeTab);
        }

        const messageBar = createElement("div");
        messageBar.style.cssText = "min-height:18px;margin-top:8px;color:#c2c2c2;opacity:0.9;";
        messageBar.innerText = this.panelMessage;
        panelNode.appendChild(messageBar);
    }

    private get activeVariables(): Record<string, any> {
        return this.gameWindow.SugarCube?.State?.active?.variables ?? {};
    }

    private getLabelForField(pathKey: string): string {
        const localePack = getActiveCheatLocalePack();
        return localePack.fieldLabelMap[pathKey] ?? pathKey;
    }

    private getTierLabel(labelKey: string): string {
        const localePack = getActiveCheatLocalePack();
        return localePack.tierLabelMap[labelKey] ?? labelKey;
    }

    private formatHelpValue(value: number): string {
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

    private stagePendingChange(changeKey: string, applyFn: () => boolean, previewValue?: number) {
        this.pendingChanges.set(changeKey, {apply: applyFn, previewValue});
    }

    private getPendingPreviewValue(changeKey: string, fallbackValue: number): number {
        const pending = this.pendingChanges.get(changeKey);
        return (typeof pending?.previewValue === "number" ? pending.previewValue : fallbackValue);
    }

    private applyPendingChanges() {
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

    private resolveMaxValue(fieldKey: string, maxSeed: number | string): number {
        if (typeof maxSeed === "number") {
            return maxSeed;
        }
        const dynamicValue = getValueByPath(this.activeVariables, maxSeed);
        if (typeof dynamicValue === "number" && Number.isFinite(dynamicValue)) {
            return dynamicValue;
        }
        const fallbackValue = getValueByPath(this.activeVariables, fieldKey);
        if (typeof fallbackValue === "number" && Number.isFinite(fallbackValue)) {
            return fallbackValue;
        }
        return 0;
    }

    private renderFieldTab(targetNode: HTMLDivElement, tabKey: Exclude<CheatTabKey, "npc" | "utility">) {
        const localePack = getActiveCheatLocalePack();
        const sectionList = cheatSectionsByTab[tabKey];
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

                const valueInput = createElement("input") as HTMLInputElement;
                valueInput.type = "number";
                valueInput.style.cssText = "width:120px;";
                const fieldCurrentValue = getValueByPath(this.activeVariables, fieldItem.key);
                const sourceFieldValue = (typeof fieldCurrentValue === "number" && Number.isFinite(fieldCurrentValue) ? fieldCurrentValue : 0);
                const pendingFieldKey = `field:${fieldItem.key}`;
                const safeFieldValue = this.getPendingPreviewValue(pendingFieldKey, sourceFieldValue);
                const resolvedMaxValue = this.resolveMaxValue(fieldItem.key, fieldItem.max);
                valueInput.value = safeFieldValue.toString();
                row.appendChild(valueInput);

                const setButton = createElement("button") as HTMLButtonElement;
                setButton.innerText = localePack.uiText.set;
                setButton.style.cssText = "border:1px solid #666;background:#303030;color:#eee;padding:2px 7px;border-radius:3px;";
                setButton.addEventListener("click", () => {
                    const nextValue = Number.parseInt(valueInput.value, 10);
                    if (!Number.isSafeInteger(nextValue)) {
                        this.panelMessage = `${this.getLabelForField(fieldItem.key)}: invalid number`;
                        this.renderPanelContent(this.ensurePanel());
                        return;
                    }
                    if (!hasPath(this.activeVariables, fieldItem.key)) {
                        this.panelMessage = `${this.getLabelForField(fieldItem.key)}: unavailable in current save`;
                        this.renderPanelContent(this.ensurePanel());
                        return;
                    }
                    this.stagePendingChange(
                        pendingFieldKey,
                        () => setValueByPath(this.activeVariables, fieldItem.key, nextValue),
                        nextValue
                    );
                    this.panelMessage = `${this.getLabelForField(fieldItem.key)} queued: ${nextValue}. Click Save to apply.`;
                    this.renderPanelContent(this.ensurePanel());
                });
                row.appendChild(setButton);

                const minButton = createElement("button") as HTMLButtonElement;
                minButton.innerText = localePack.uiText.min;
                minButton.style.cssText = "border:1px solid #666;background:#2b2b2b;color:#ddd;padding:2px 7px;border-radius:3px;";
                minButton.addEventListener("click", () => {
                    valueInput.value = fieldItem.min.toString();
                });
                row.appendChild(minButton);

                const maxButton = createElement("button") as HTMLButtonElement;
                maxButton.innerText = localePack.uiText.max;
                maxButton.style.cssText = "border:1px solid #666;background:#2b2b2b;color:#ddd;padding:2px 7px;border-radius:3px;";
                maxButton.addEventListener("click", () => {
                    valueInput.value = resolvedMaxValue.toString();
                });
                row.appendChild(maxButton);

                const hasField = hasPath(this.activeVariables, fieldItem.key);
                if (!hasField) {
                    const unavailable = createElement("span");
                    unavailable.style.cssText = "opacity:.75;";
                    unavailable.innerText = "(unavailable)";
                    row.appendChild(unavailable);
                }

                const tierInfo = resolveFieldTier(fieldItem.key, safeFieldValue, resolvedMaxValue);
                const tierHelp = resolveFieldTierHelp(fieldItem.key, fieldItem.min, resolvedMaxValue);
                if (tierInfo) {
                    const tierMeta = createElement("div");
                    tierMeta.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:6px;";

                    const tierLabel = createElement("span");
                    tierLabel.style.cssText = `padding-left:8px;font-weight:600;color:${tierColorMap[tierInfo.colorKey]};`;
                    tierLabel.innerText = this.getTierLabel(tierInfo.labelKey);
                    tierMeta.appendChild(tierLabel);

                    if (tierHelp) {
                        const helpButton = createElement("button") as HTMLButtonElement;
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
                            rangeLine.style.cssText = `color:${tierColorMap[rangeItem.colorKey]};`;
                            const rangeEnd = typeof rangeItem.maxExclusive === "number"
                                ? `< ${this.formatHelpValue(rangeItem.maxExclusive)}`
                                : `<= ${this.formatHelpValue(tierHelp.max)}`;
                            rangeLine.innerText = `${this.getTierLabel(rangeItem.labelKey)}: >= ${this.formatHelpValue(rangeItem.min)} and ${rangeEnd}`;
                            helpPanel.appendChild(rangeLine);
                        });

                        const closeHelpButton = createElement("button") as HTMLButtonElement;
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
                    } else {
                        row.appendChild(tierMeta);
                    }
                }

                section.appendChild(row);
            });

            targetNode.appendChild(section);
        });
    }

    private renderUtilityTab(targetNode: HTMLDivElement) {
        const localePack = getActiveCheatLocalePack();
        const summaryText = createElement("div");
        summaryText.style.cssText = "margin-bottom:8px;opacity:.9;";
        summaryText.innerText = localePack.uiText.utilityDescription;
        targetNode.appendChild(summaryText);

        const actionGrid = createElement("div");
        actionGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";

        utilityActions.forEach((actionItem) => {
            const actionButton = createElement("button") as HTMLButtonElement;
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

    private applyUtilityAction(actionKey: string) {
        const allFields = Object.values(cheatSectionsByTab)
            .flatMap((sectionItems) => sectionItems)
            .flatMap((sectionItem) => sectionItem.fields);
        const fieldIndex = new Map(allFields.map((fieldItem) => [fieldItem.key, fieldItem] as const));
        const actionInfo = utilityActions.find((item) => item.key === actionKey);
        if (!actionInfo) {
            return;
        }
        let queuedCount = 0;
        actionInfo.fieldKeys.forEach((fieldKey) => {
            const fieldInfo = fieldIndex.get(fieldKey);
            if (!fieldInfo || !hasPath(this.activeVariables, fieldKey)) {
                return;
            }
            const targetValue = actionInfo.mode === "min"
                ? fieldInfo.min
                : this.resolveMaxValue(fieldKey, fieldInfo.max);
            this.stagePendingChange(
                `field:${fieldKey}`,
                () => setValueByPath(this.activeVariables, fieldKey, targetValue),
                targetValue
            );
            queuedCount += 1;
        });
        const localePack = getActiveCheatLocalePack();
        const actionLabel = localePack.utilityLabelMap[actionKey] ?? actionKey;
        this.panelMessage = `${actionLabel}: ${queuedCount} fields queued. Click Save to apply.`;
    }

    private renderNpcTab(targetNode: HTMLDivElement, emptyHintText: string) {
        const rosterResolver = new NpcRosterResolver(this.gameWindow);
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

    private renderStatControl(
        targetCard: HTMLDivElement,
        npcRosterKey: string,
        npcStateRef: Record<string, any>,
        npcName: string,
        statKey: NpcStatKey
    ) {
        const row = createElement("div");
        row.style.cssText = "display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap;";

        const visibleLabel = createElement("label");
        visibleLabel.style.cssText = "min-width:210px;";
        const localizedLabel = resolveNpcInfoLabel(npcName, statKey);
        visibleLabel.innerText = (localizedLabel !== statKey)
            ? `${statKey} (${localizedLabel})`
            : statKey;

        const numericInput = createElement("input") as HTMLInputElement;
        numericInput.type = "number";
        numericInput.style.cssText = "width:120px;";
        const pendingNpcKey = `npc:${npcRosterKey}:${statKey}`;
        const currentValue = npcStateRef[statKey];
        const safeCurrentValue = (typeof currentValue === "number" ? currentValue : 0);
        numericInput.value = this.getPendingPreviewValue(pendingNpcKey, safeCurrentValue).toString();

        const applyButton = createElement("button") as HTMLButtonElement;
        applyButton.innerText = getActiveCheatLocalePack().uiText.set;
        applyButton.style.cssText = "border:1px solid #666;background:#303030;color:#eee;padding:2px 7px;border-radius:3px;";
        applyButton.addEventListener("click", () => {
            const nextValue = Number.parseInt(numericInput.value, 10);
            if (!Number.isSafeInteger(nextValue)) {
                this.panelMessage = `${visibleLabel.innerText}: invalid number`;
                return;
            }
            this.stagePendingChange(
                pendingNpcKey,
                () => {
                    npcStateRef[statKey] = nextValue;
                    return true;
                },
                nextValue
            );
            this.panelMessage = `${visibleLabel.innerText}: queued ${nextValue}. Click Save to apply.`;
            this.renderPanelContent(this.ensurePanel());
        });

        row.appendChild(visibleLabel);
        row.appendChild(numericInput);
        row.appendChild(applyButton);
        targetCard.appendChild(row);
    }
}

