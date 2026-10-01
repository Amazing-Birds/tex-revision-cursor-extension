"use strict";

const DEFAULT_MACROS = {
  add: ["add"],
  reduce: ["reduce"],
  discard: ["comment"],
  addColors: ["blue"],
  reduceColors: ["red"]
};

function transformRevisionMarkup(input, mode, macros = DEFAULT_MACROS) {
  if (mode !== "accept" && mode !== "reject") {
    throw new Error(`Unsupported revision mode: ${mode}`);
  }

  const state = {
    stats: createEmptyStats()
  };
  const text = transformChunk(String(input), mode, macros, state);

  return {
    text,
    changed: text !== input,
    stats: state.stats
  };
}

function countRevisionMarkup(input, macros = DEFAULT_MACROS) {
  const counts = { add: 0, reduce: 0, discard: 0 };
  let index = 0;
  const text = String(input);

  while (index < text.length) {
    const match = readRevisionCommand(text, index, macros);
    if (!match) {
      index += 1;
      continue;
    }

    counts[match.kind] += 1;
    index = match.end;
  }

  return counts;
}

function findNextRevisionMarkup(input, startOffset = 0, macros = DEFAULT_MACROS) {
  const text = String(input);
  const first = findFrom(text, Math.max(0, startOffset), macros);
  if (first) {
    return first;
  }
  if (startOffset > 0) {
    return findFrom(text, 0, macros);
  }
  return null;
}

function findPreviousRevisionMarkup(input, startOffset = 0, macros = DEFAULT_MACROS) {
  const text = String(input);
  const normalizedStart = Math.min(Math.max(0, startOffset), text.length);
  const beforeCursor = findLastBefore(text, normalizedStart, macros);
  if (beforeCursor) {
    return beforeCursor;
  }
  if (normalizedStart < text.length) {
    return findLastBefore(text, text.length, macros);
  }
  return null;
}

function findFrom(text, startOffset, macros) {
  for (let index = startOffset; index < text.length; index += 1) {
    const match = readRevisionCommand(text, index, macros);
    if (match) {
      return match;
    }
  }
  return null;
}

function findLastBefore(text, endOffset, macros) {
  let last = null;
  let index = 0;

  while (index < endOffset) {
    const match = readRevisionCommand(text, index, macros);
    if (!match) {
      index += 1;
      continue;
    }
    if (match.start < endOffset) {
      last = match;
    }
    index = Math.max(match.end, index + 1);
  }

  return last;
}

function transformChunk(text, mode, macros, state) {
  let output = "";
  let index = 0;

  while (index < text.length) {
    const match = readRevisionCommand(text, index, macros);
    if (!match) {
      output += text[index];
      index += 1;
      continue;
    }

    const keepMacro = (mode === "accept" && match.kind === "add") || (mode === "reject" && match.kind === "reduce");
    if (keepMacro) {
      const keepCleanup = getStandaloneGroupCleanup(text, match, output);
      if (match.syntax === "colorGroup" && keepCleanup.isStandalone) {
        output = keepCleanup.output;
        output += normalizeStandaloneColorContent(transformChunk(match.content, mode, macros, state));
        index = keepCleanup.nextIndex;
      } else {
        output += transformChunk(match.content, mode, macros, state);
        index = match.end;
      }
      if (match.kind === "add") {
        state.stats.addUnwrapped += 1;
      } else {
        state.stats.reduceUnwrapped += 1;
      }
    } else if (match.kind === "discard") {
      state.stats.discardRemoved += 1;
      const deleteCleanup = getStandaloneGroupCleanup(text, match, output);
      output = deleteCleanup.output;
      index = deleteCleanup.nextIndex;
    } else if (match.kind === "add") {
      state.stats.addRemoved += 1;
      const deleteCleanup = getStandaloneGroupCleanup(text, match, output);
      output = deleteCleanup.output;
      index = deleteCleanup.nextIndex;
    } else {
      state.stats.reduceRemoved += 1;
      const deleteCleanup = getStandaloneGroupCleanup(text, match, output);
      output = deleteCleanup.output;
      index = deleteCleanup.nextIndex;
    }
  }

  return output;
}

function getStandaloneGroupCleanup(text, match, output) {
  const lineStart = output.lastIndexOf("\n") + 1;
  const prefix = output.slice(lineStart);
  const sourceLineStart = text.lastIndexOf("\n", match.start - 1) + 1;
  const sourcePrefix = text.slice(sourceLineStart, match.start);
  const trailing = readHorizontalWhitespaceAndLineBreak(text, match.end);

  if (/^[ \t]*$/.test(prefix) && /^[ \t]*$/.test(sourcePrefix) && (trailing.hasLineBreak || match.end === text.length)) {
    return {
      isStandalone: true,
      output: output.slice(0, lineStart),
      nextIndex: trailing.nextIndex
    };
  }

  return {
    isStandalone: false,
    output,
    nextIndex: match.end
  };
}

function readHorizontalWhitespaceAndLineBreak(text, start) {
  let index = start;
  while (index < text.length && /[ \t]/.test(text[index])) {
    index += 1;
  }

  if (text[index] === "\r" && text[index + 1] === "\n") {
    return { hasLineBreak: true, nextIndex: index + 2 };
  }
  if (text[index] === "\n" || text[index] === "\r") {
    return { hasLineBreak: true, nextIndex: index + 1 };
  }

  return { hasLineBreak: false, nextIndex: start };
}

function normalizeStandaloneColorContent(content) {
  return content.replace(/^[ \t]*(?:\r\n|\n|\r)/, "");
}

function readRevisionCommand(text, start, macros) {
  const colorGroupMatch = readColorGroup(text, start, macros);
  if (colorGroupMatch) {
    return colorGroupMatch;
  }

  if (text[start] !== "\\") {
    return null;
  }

  for (const commandName of getCommandList(macros.add)) {
    const addMatch = readNamedCommand(text, start, commandName, "add");
    if (addMatch) {
      return addMatch;
    }
  }

  for (const commandName of getCommandList(macros.reduce)) {
    const reduceMatch = readNamedCommand(text, start, commandName, "reduce");
    if (reduceMatch) {
      return reduceMatch;
    }
  }

  for (const commandName of getCommandList(macros.discard)) {
    const discardMatch = readNamedCommand(text, start, commandName, "discard");
    if (discardMatch) {
      return discardMatch;
    }
  }

  return null;
}

function readColorGroup(text, start, macros) {
  if (text[start] !== "{") {
    return null;
  }

  let commandStart = start + 1;
  while (commandStart < text.length && /\s/.test(text[commandStart])) {
    commandStart += 1;
  }

  const declaration = readColorDeclaration(text, commandStart);
  if (!declaration) {
    return null;
  }

  const kind = getColorKind(declaration.color, macros);
  if (!kind) {
    return null;
  }

  const group = readBalancedGroup(text, start);
  if (!group || declaration.end > group.end) {
    return null;
  }

  return {
    kind,
    syntax: "colorGroup",
    start,
    end: group.end,
    content: text.slice(declaration.end, group.end - 1)
  };
}

function readColorDeclaration(text, start) {
  if (text[start] !== "\\") {
    return null;
  }

  const commandName = "color";
  const commandStart = start + 1;
  const commandEnd = commandStart + commandName.length;
  if (text.slice(commandStart, commandEnd) !== commandName) {
    return null;
  }

  const next = text[commandEnd];
  if (next && /[A-Za-z]/.test(next)) {
    return null;
  }

  let colorGroupStart = commandEnd;
  while (colorGroupStart < text.length && /\s/.test(text[colorGroupStart])) {
    colorGroupStart += 1;
  }
  if (text[colorGroupStart] !== "{") {
    return null;
  }

  const colorGroup = readBalancedGroup(text, colorGroupStart);
  if (!colorGroup) {
    return null;
  }

  return {
    color: normalizeColorName(colorGroup.content),
    end: colorGroup.end
  };
}

function getColorKind(colorName, macros) {
  if (getColorList(macros.addColors).includes(colorName)) {
    return "add";
  }
  if (getColorList(macros.reduceColors).includes(colorName)) {
    return "reduce";
  }
  return null;
}

function getColorList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeColorName).filter(Boolean);
}

function normalizeColorName(value) {
  return String(value || "").trim().toLowerCase();
}

function getCommandList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

function readNamedCommand(text, start, commandName, kind) {
  const commandStart = start + 1;
  const commandEnd = commandStart + commandName.length;

  if (text.slice(commandStart, commandEnd) !== commandName) {
    return null;
  }

  const next = text[commandEnd];
  if (next && /[A-Za-z]/.test(next)) {
    return null;
  }

  let openBrace = commandEnd;
  while (openBrace < text.length && /\s/.test(text[openBrace])) {
    openBrace += 1;
  }

  if (text[openBrace] !== "{") {
    return null;
  }

  const group = readBalancedGroup(text, openBrace);
  if (!group) {
    return null;
  }

  return {
    kind,
    syntax: "command",
    start,
    end: group.end,
    content: group.content
  };
}

function readBalancedGroup(text, openBrace) {
  let depth = 0;
  let index = openBrace;

  while (index < text.length) {
    const char = text[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: text.slice(openBrace + 1, index),
          end: index + 1
        };
      }
    }

    index += 1;
  }

  return null;
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

module.exports = {
  countRevisionMarkup,
  findNextRevisionMarkup,
  findPreviousRevisionMarkup,
  transformRevisionMarkup
};
