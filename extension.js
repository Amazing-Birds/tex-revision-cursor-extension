"use strict";

const vscode = require("vscode");
const {
  countRevisionMarkup,
  findNextRevisionMarkup,
  findPreviousRevisionMarkup,
  transformRevisionMarkup
} = require("./lib/latexMarkup");

const AGENT_RULE_PATH = [".cursor", "rules", "tex-revision-agent.mdc"];
const DISABLED_AGENT_RULE_PATH = [".cursor", "rules-disabled", "tex-revision-agent.mdc"];
const AGENT_RULE_TEMPLATE_PATH = ["agent", "tex-revision-agent.mdc"];

function activate(context) {
  const actionsProvider = new RevisionActionsProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("texRevision.actionsView", actionsProvider),
    vscode.commands.registerCommand("texRevision.acceptAll", () => applyToDocument("accept")),
    vscode.commands.registerCommand("texRevision.rejectAll", () => applyToDocument("reject")),
    vscode.commands.registerCommand("texRevision.acceptSelection", () => applyToSelections("accept")),
    vscode.commands.registerCommand("texRevision.rejectSelection", () => applyToSelections("reject")),
    vscode.commands.registerCommand("texRevision.showChangeCount", showChangeCount),
    vscode.commands.registerCommand("texRevision.goToNextChange", goToNextChange),
    vscode.commands.registerCommand("texRevision.goToPreviousChange", goToPreviousChange),
    vscode.commands.registerCommand("texRevision.openSettings", openSettings),
    vscode.commands.registerCommand("texRevision.enableAgentInstructions", () => enableAgentInstructions(context, actionsProvider)),
    vscode.commands.registerCommand("texRevision.disableAgentInstructions", () => disableAgentInstructions(actionsProvider)),
    vscode.commands.registerCommand("texRevision.editAgentInstructions", () => editAgentInstructions(context, actionsProvider)),
    vscode.commands.registerCommand("texRevision.restoreDefaultAgentInstructions", () => restoreDefaultAgentInstructions(context, actionsProvider)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("texRevision")) {
        actionsProvider.refresh();
      }
    })
  );
}

function deactivate() {}

async function applyToDocument(mode) {
  const editor = vscode.window.activeTextEditor;
  if (!isTexEditor(editor)) {
    noOp("TeX Revision: current editor is not a TeX document.");
    return;
  }

  const document = editor.document;
  const original = document.getText();
  const result = transformRevisionMarkup(original, mode, getRevisionMacros());

  if (!result.changed) {
    noOp("TeX Revision: no revision markup found.");
    return;
  }

  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(original.length));
  const ok = await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, result.text);
  });

  if (ok) {
    reportApplied(mode, result.stats);
  }
}

async function applyToSelections(mode) {
  const editor = vscode.window.activeTextEditor;
  if (!isTexEditor(editor)) {
    noOp("TeX Revision: current editor is not a TeX document.");
    return;
  }

  const selections = editor.selections.filter((selection) => !selection.isEmpty);
  if (selections.length === 0) {
    noOp("TeX Revision: no selected TeX text to process.");
    return;
  }

  const replacements = [];
  const totalStats = createEmptyStats();

  for (const selection of selections) {
    const selectedText = editor.document.getText(selection);
    const result = transformRevisionMarkup(selectedText, mode, getRevisionMacros());
    if (!result.changed) {
      continue;
    }
    mergeStats(totalStats, result.stats);
    replacements.push({ selection, text: result.text });
  }

  if (replacements.length === 0) {
    noOp("TeX Revision: no complete revision markup found in the selection.");
    return;
  }

  const ok = await editor.edit((editBuilder) => {
    for (const replacement of replacements) {
      editBuilder.replace(replacement.selection, replacement.text);
    }
  });

  if (ok) {
    reportApplied(mode, totalStats);
  }
}

function showChangeCount() {
  const editor = vscode.window.activeTextEditor;
  if (!isTexEditor(editor)) {
    noOp("TeX Revision: current editor is not a TeX document.");
    return;
  }

  const macros = getRevisionMacros();
  const counts = countRevisionMarkup(editor.document.getText(), macros);
  const discardText = macros.discard.length > 0 ? ` and ${counts.discard} discard command(s)` : "";
  vscode.window.showInformationMessage(
    `TeX Revision: found ${counts.add} addition, ${counts.reduce} removal${discardText}.`
  );
}

function goToNextChange() {
  revealRevisionChange(
    findNextRevisionMarkup,
    (selection, document) => document.offsetAt(selection.end),
    "TeX Revision: no later revision markup found."
  );
}

function goToPreviousChange() {
  revealRevisionChange(
    findPreviousRevisionMarkup,
    (selection, document) => document.offsetAt(selection.start),
    "TeX Revision: no earlier revision markup found."
  );
}

function revealRevisionChange(findChange, getStartOffset, emptyMessage) {
  const editor = vscode.window.activeTextEditor;
  if (!isTexEditor(editor)) {
    noOp("TeX Revision: current editor is not a TeX document.");
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const startOffset = getStartOffset(editor.selection, document);
  const match = findChange(text, startOffset, getRevisionMacros());

  if (!match) {
    noOp(emptyMessage);
    return;
  }

  const range = new vscode.Range(document.positionAt(match.start), document.positionAt(match.end));
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function openSettings() {
  vscode.commands.executeCommand("workbench.action.openSettings", "texRevision");
}

async function enableAgentInstructions(context, actionsProvider) {
  const workspaceFolder = getTargetWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }

  const activeUri = getWorkspaceUri(workspaceFolder, AGENT_RULE_PATH);
  const disabledUri = getWorkspaceUri(workspaceFolder, DISABLED_AGENT_RULE_PATH);

  if (await uriExists(activeUri)) {
    vscode.window.showInformationMessage("TeX Revision: agent instructions are already enabled.");
    actionsProvider.refresh();
    return;
  }

  await ensureDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules"));
  if (await uriExists(disabledUri)) {
    await vscode.workspace.fs.rename(disabledUri, activeUri, { overwrite: false });
  } else {
    await vscode.workspace.fs.writeFile(activeUri, await readAgentRuleTemplate(context));
  }

  vscode.window.showInformationMessage("TeX Revision: agent instructions enabled for this workspace.");
  actionsProvider.refresh();
}

async function disableAgentInstructions(actionsProvider) {
  const workspaceFolder = getTargetWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }

  const activeUri = getWorkspaceUri(workspaceFolder, AGENT_RULE_PATH);
  const disabledUri = getWorkspaceUri(workspaceFolder, DISABLED_AGENT_RULE_PATH);

  if (!(await uriExists(activeUri))) {
    vscode.window.showInformationMessage("TeX Revision: agent instructions are already disabled.");
    actionsProvider.refresh();
    return;
  }

  await ensureDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules-disabled"));
  if (await uriExists(disabledUri)) {
    const choice = await vscode.window.showWarningMessage(
      "TeX Revision: a disabled agent instruction file already exists. Replace it with the currently enabled file?",
      { modal: true },
      "Replace"
    );
    if (choice !== "Replace") {
      return;
    }
    await vscode.workspace.fs.delete(disabledUri);
  }

  await vscode.workspace.fs.rename(activeUri, disabledUri, { overwrite: false });
  vscode.window.showInformationMessage("TeX Revision: agent instructions disabled for this workspace.");
  actionsProvider.refresh();
}

async function editAgentInstructions(context, actionsProvider) {
  const workspaceFolder = getTargetWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }

  const activeUri = getWorkspaceUri(workspaceFolder, AGENT_RULE_PATH);
  const disabledUri = getWorkspaceUri(workspaceFolder, DISABLED_AGENT_RULE_PATH);
  let targetUri = activeUri;

  if (!(await uriExists(activeUri))) {
    if (await uriExists(disabledUri)) {
      targetUri = disabledUri;
    } else {
      await ensureDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules"));
      await vscode.workspace.fs.writeFile(activeUri, await readAgentRuleTemplate(context));
      vscode.window.showInformationMessage("TeX Revision: created editable agent instructions.");
    }
  }

  const document = await vscode.workspace.openTextDocument(targetUri);
  await vscode.window.showTextDocument(document);
  actionsProvider.refresh();
}

async function restoreDefaultAgentInstructions(context, actionsProvider) {
  const workspaceFolder = getTargetWorkspaceFolder();
  if (!workspaceFolder) {
    return;
  }

  const activeUri = getWorkspaceUri(workspaceFolder, AGENT_RULE_PATH);
  const disabledUri = getWorkspaceUri(workspaceFolder, DISABLED_AGENT_RULE_PATH);
  const targetUri = (await uriExists(activeUri)) || !(await uriExists(disabledUri)) ? activeUri : disabledUri;
  const choice = await vscode.window.showWarningMessage(
    "TeX Revision: restore bundled default agent instructions and overwrite the current editable copy?",
    { modal: true },
    "Restore"
  );
  if (choice !== "Restore") {
    return;
  }

  if (targetUri.toString() === activeUri.toString()) {
    await ensureDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules"));
  } else {
    await ensureDirectory(vscode.Uri.joinPath(workspaceFolder.uri, ".cursor", "rules-disabled"));
  }
  await vscode.workspace.fs.writeFile(targetUri, await readAgentRuleTemplate(context));
  vscode.window.showInformationMessage("TeX Revision: default agent instructions restored.");
  actionsProvider.refresh();
}

function getTargetWorkspaceFolder(showWarning = true) {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (folder) {
      return folder;
    }
  }

  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length > 0) {
    return folders[0];
  }

  if (showWarning) {
    vscode.window.showWarningMessage("TeX Revision: open a workspace folder before managing agent instructions.");
  }
  return null;
}

function getWorkspaceUri(workspaceFolder, segments) {
  return vscode.Uri.joinPath(workspaceFolder.uri, ...segments);
}

async function readAgentRuleTemplate(context) {
  return vscode.workspace.fs.readFile(vscode.Uri.joinPath(context.extensionUri, ...AGENT_RULE_TEMPLATE_PATH));
}

async function ensureDirectory(uri) {
  await vscode.workspace.fs.createDirectory(uri);
}

async function uriExists(uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (error) {
    return false;
  }
}

function getRevisionMacros() {
  const config = vscode.workspace.getConfiguration("texRevision");
  return {
    add: normalizeCommandSettings(config.get("addCommands"), config.get("addCommand"), ["add"]),
    reduce: normalizeCommandSettings(config.get("reduceCommands"), config.get("reduceCommand"), ["reduce"]),
    discard: normalizeMacroNameList(config.get("discardCommands"), ["comment"]),
    addColors: normalizeColorNameList(config.get("addColors"), ["blue"]),
    reduceColors: normalizeColorNameList(config.get("reduceColors"), ["red"])
  };
}

function normalizeCommandSettings(listValue, legacyValue, fallback) {
  const normalized = normalizeMacroNameList(listValue, []);
  const legacyCommand = normalizeMacroName(legacyValue, "");
  if (legacyCommand && !normalized.includes(legacyCommand)) {
    normalized.unshift(legacyCommand);
  }
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeMacroName(value, fallback) {
  const text = String(value || "").trim().replace(/^\\+/, "");
  if (/^[A-Za-z@]+$/.test(text)) {
    return text;
  }
  return fallback;
}

function normalizeMacroNameList(value, fallback) {
  const source = Array.isArray(value) ? value : [];
  const normalized = [];
  for (const item of source) {
    const commandName = normalizeMacroName(item, "");
    if (commandName && !normalized.includes(commandName)) {
      normalized.push(commandName);
    }
  }
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeColorNameList(value, fallback) {
  const source = Array.isArray(value) ? value : [];
  const normalized = [];
  for (const item of source) {
    const colorName = String(item || "").trim().toLowerCase();
    if (/^[A-Za-z][A-Za-z0-9_!.-]*$/.test(colorName) && !normalized.includes(colorName)) {
      normalized.push(colorName);
    }
  }
  return normalized.length > 0 ? normalized : fallback;
}

function isTexEditor(editor) {
  if (!editor || !editor.document) {
    return false;
  }

  const document = editor.document;
  const fileName = document.fileName || "";
  return (
    document.languageId === "latex" ||
    document.languageId === "tex" ||
    /\.tex$/i.test(fileName) ||
    /\.ltx$/i.test(fileName)
  );
}

function noOp(message) {
  vscode.window.setStatusBarMessage(message, 3000);
}

function reportApplied(mode, stats) {
  const action = mode === "accept" ? "accepted" : "rejected";
  const changed = stats.addRemoved + stats.addUnwrapped + stats.reduceRemoved + stats.reduceUnwrapped + stats.discardRemoved;
  vscode.window.setStatusBarMessage(`TeX Revision: ${action} ${changed} change command(s).`, 4000);
}

function createEmptyStats() {
  return {
    addRemoved: 0,
    addUnwrapped: 0,
    reduceRemoved: 0,
    reduceUnwrapped: 0,
    discardRemoved: 0
  };
}

function mergeStats(target, source) {
  target.addRemoved += source.addRemoved;
  target.addUnwrapped += source.addUnwrapped;
  target.reduceRemoved += source.reduceRemoved;
  target.reduceUnwrapped += source.reduceUnwrapped;
  target.discardRemoved += source.discardRemoved;
}

class RevisionActionsProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item) {
    return item;
  }

  async getChildren(item) {
    if (item) {
      return [];
    }

    const macros = getRevisionMacros();
    const agentStatus = await getAgentInstructionStatus();
    return [
      createCommandItem("Accept All Changes", "texRevision.acceptAll", "check", "keep additions, remove removals"),
      createCommandItem("Reject All Changes", "texRevision.rejectAll", "close", "remove additions, keep removals"),
      createCommandItem("Accept Selected Changes", "texRevision.acceptSelection", "list-selection", "selected TeX text"),
      createCommandItem("Reject Selected Changes", "texRevision.rejectSelection", "list-selection", "selected TeX text"),
      createCommandItem("Show Change Count", "texRevision.showChangeCount", "search", "active TeX document"),
      createCommandItem("Go to Previous Change", "texRevision.goToPreviousChange", "arrow-up", "wraps to bottom"),
      createCommandItem("Go to Next Change", "texRevision.goToNextChange", "arrow-down", "wraps to top"),
      createInfoItem(`Addition macros: ${formatCommandGroups(macros.add)}`, "symbol-string"),
      createInfoItem(`Removal macros: ${formatCommandGroups(macros.reduce)}`, "symbol-string"),
      createInfoItem(`Discard macros: ${formatCommandGroups(macros.discard)}`, "trash"),
      createInfoItem(`Addition colors: ${formatColorGroups(macros.addColors)}`, "symbol-color"),
      createInfoItem(`Removal colors: ${formatColorGroups(macros.reduceColors)}`, "symbol-color"),
      createCommandItem("Open Settings", "texRevision.openSettings", "gear", "custom macro names"),
      createInfoItem(`Agent Instructions: ${agentStatus}`, agentStatus === "Enabled" ? "pass" : "circle-slash"),
      createCommandItem("Enable Agent Instructions", "texRevision.enableAgentInstructions", "play", ".cursor/rules"),
      createCommandItem("Disable Agent Instructions", "texRevision.disableAgentInstructions", "debug-pause", ".cursor/rules-disabled"),
      createCommandItem("Edit Agent Instructions", "texRevision.editAgentInstructions", "edit", "workspace rule"),
      createCommandItem("Restore Default Agent Instructions", "texRevision.restoreDefaultAgentInstructions", "discard", "bundled template")
    ];
  }
}

function formatCommandGroups(commandNames) {
  if (!commandNames.length) {
    return "none";
  }
  return commandNames.map((commandName) => `\\${commandName}{...}`).join(", ");
}

function formatColorGroups(colorNames) {
  if (!colorNames.length) {
    return "none";
  }
  return colorNames.map((colorName) => `{\\color{${colorName}} ...}`).join(", ");
}

async function getAgentInstructionStatus() {
  const workspaceFolder = getTargetWorkspaceFolder(false);
  if (!workspaceFolder) {
    return "No Workspace";
  }

  if (await uriExists(getWorkspaceUri(workspaceFolder, AGENT_RULE_PATH))) {
    return "Enabled";
  }
  if (await uriExists(getWorkspaceUri(workspaceFolder, DISABLED_AGENT_RULE_PATH))) {
    return "Disabled";
  }
  return "Not Created";
}

function createCommandItem(label, command, iconId, description) {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.command = { command, title: label };
  item.iconPath = new vscode.ThemeIcon(iconId);
  item.description = description;
  return item;
}

function createInfoItem(label, iconId) {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.iconPath = new vscode.ThemeIcon(iconId);
  return item;
}

module.exports = {
  activate,
  deactivate
};
