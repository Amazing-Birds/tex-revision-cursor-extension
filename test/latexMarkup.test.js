"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  countRevisionMarkup,
  findNextRevisionMarkup,
  findPreviousRevisionMarkup,
  transformRevisionMarkup
} = require("../lib/latexMarkup");

test("accepts all changes by keeping additions and removing reductions", () => {
  const input = "A \\add{new text} and \\reduce{old text}.";
  const result = transformRevisionMarkup(input, "accept");
  assert.equal(result.text, "A new text and .");
  assert.equal(result.stats.addUnwrapped, 1);
  assert.equal(result.stats.reduceRemoved, 1);
});

test("rejects all changes by removing additions and keeping reductions", () => {
  const input = "A \\add{new text} and \\reduce{old text}.";
  const result = transformRevisionMarkup(input, "reject");
  assert.equal(result.text, "A  and old text.");
  assert.equal(result.stats.addRemoved, 1);
  assert.equal(result.stats.reduceUnwrapped, 1);
});

test("handles nested braces and nested revision commands", () => {
  const input = "\\add{outer {group} \\reduce{old}}";
  assert.equal(transformRevisionMarkup(input, "accept").text, "outer {group} ");
  assert.equal(transformRevisionMarkup(input, "reject").text, "");
});

test("ignores incomplete commands", () => {
  const input = "\\add{unfinished";
  const result = transformRevisionMarkup(input, "accept");
  assert.equal(result.text, input);
  assert.equal(result.changed, false);
});

test("does not confuse similarly named commands", () => {
  const input = "\\address{abc} \\add{x}";
  const result = transformRevisionMarkup(input, "accept");
  assert.equal(result.text, "\\address{abc} x");
});

test("counts complete revision commands", () => {
  const counts = countRevisionMarkup("\\add{a} \\reduce{b} \\reduce{c}");
  assert.deepEqual(counts, { add: 1, reduce: 2, discard: 0 });
});

test("supports custom addition and removal command names", () => {
  const input = "\\DIFadd{new} and \\DIFdel{old}";
  const macros = { add: ["DIFadd"], reduce: ["DIFdel"] };
  assert.equal(transformRevisionMarkup(input, "accept", macros).text, "new and ");
  assert.equal(transformRevisionMarkup(input, "reject", macros).text, " and old");
  assert.deepEqual(countRevisionMarkup(input, macros), { add: 1, reduce: 1, discard: 0 });
});

test("supports multiple addition and removal command names", () => {
  const input = "\\add{a} \\DIFadd{b} \\reduce{x} \\DIFdel{y}";
  const macros = { add: ["add", "DIFadd"], reduce: ["reduce", "DIFdel"] };
  assert.equal(transformRevisionMarkup(input, "accept", macros).text, "a b  ");
  assert.equal(transformRevisionMarkup(input, "reject", macros).text, "  x y");
  assert.deepEqual(countRevisionMarkup(input, macros), { add: 2, reduce: 2, discard: 0 });
});

test("supports grouped xcolor color markup for additions and removals", () => {
  const input = "A {\\color{red}old text} B {\\color{blue}new text} C";
  assert.equal(transformRevisionMarkup(input, "accept").text, "A  B new text C");
  assert.equal(transformRevisionMarkup(input, "reject").text, "A old text B  C");
  assert.deepEqual(countRevisionMarkup(input), { add: 1, reduce: 1, discard: 0 });
});

test("supports multiline grouped color markup", () => {
  const input = "{\\color{red}\nold\n}\n{\\color{blue}\nnew\n}";
  assert.equal(transformRevisionMarkup(input, "accept").text, "new\n");
  assert.equal(transformRevisionMarkup(input, "reject").text, "old\n");
});

test("removes standalone deleted color block lines without leaving blank lines", () => {
  const input = "before\n{\\color{red}\nold\n}\nafter";
  assert.equal(transformRevisionMarkup(input, "accept").text, "before\nafter");
  assert.equal(transformRevisionMarkup(input, "reject").text, "before\nold\nafter");
});

test("removes standalone deleted command lines without leaving blank lines", () => {
  const input = "before\n\\reduce{old}\nafter";
  assert.equal(transformRevisionMarkup(input, "accept").text, "before\nafter");
  assert.equal(transformRevisionMarkup(input, "reject").text, "before\nold\nafter");
});

test("supports custom grouped color names", () => {
  const input = "{\\color{cyan}new} {\\color{magenta}old}";
  const macros = {
    add: ["add"],
    reduce: ["reduce"],
    discard: [],
    addColors: ["cyan"],
    reduceColors: ["magenta"]
  };
  assert.equal(transformRevisionMarkup(input, "accept", macros).text, "new ");
  assert.equal(transformRevisionMarkup(input, "reject", macros).text, " old");
});

test("removes discard commands in both accept and reject modes", () => {
  const input = "A \\comment{note {with braces}} B \\add{new} C \\reduce{old}.";
  assert.equal(transformRevisionMarkup(input, "accept").text, "A  B new C .");
  assert.equal(transformRevisionMarkup(input, "reject").text, "A  B  C old.");
  assert.equal(transformRevisionMarkup(input, "accept").stats.discardRemoved, 1);
  assert.deepEqual(countRevisionMarkup(input), { add: 1, reduce: 1, discard: 1 });
});

test("supports custom discard command names", () => {
  const input = "\\todo{remove me} text";
  const macros = { add: ["add"], reduce: ["reduce"], discard: ["todo"] };
  assert.equal(transformRevisionMarkup(input, "accept", macros).text, " text");
  assert.equal(transformRevisionMarkup(input, "reject", macros).text, " text");
});

test("finds the next complete revision command and wraps around", () => {
  const input = "abc \\add{x} def";
  assert.deepEqual(findNextRevisionMarkup(input, 0), {
    kind: "add",
    syntax: "command",
    start: 4,
    end: 11,
    content: "x"
  });
  assert.deepEqual(findNextRevisionMarkup(input, 12), {
    kind: "add",
    syntax: "command",
    start: 4,
    end: 11,
    content: "x"
  });
});

test("finds the previous complete revision command and wraps around", () => {
  const input = "\\add{a} middle \\reduce{b} end";
  assert.deepEqual(findPreviousRevisionMarkup(input, input.length), {
    kind: "reduce",
    syntax: "command",
    start: 15,
    end: 25,
    content: "b"
  });
  assert.deepEqual(findPreviousRevisionMarkup(input, 14), {
    kind: "add",
    syntax: "command",
    start: 0,
    end: 7,
    content: "a"
  });
  assert.deepEqual(findPreviousRevisionMarkup(input, 0), {
    kind: "reduce",
    syntax: "command",
    start: 15,
    end: 25,
    content: "b"
  });
});
