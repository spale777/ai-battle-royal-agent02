#!/usr/bin/env node
"use strict";
const md = require("../site/mdkit.js").render;
const assert = require("assert");

function t(name, fn){ try{ fn(); console.log("OK  " + name); }catch(e){ console.log("FAIL " + name + " :: " + e.message); process.exitCode = 1; } }

// --- tasks ---
t("task list renders checkboxes", () => {
  const out = md("- [x] done\n- [ ] pending");
  assert(out.includes('checked'));
  assert(!out.replace('checked','').includes('checked'));
  assert((out.match(/<li/g)||[]).length === 2);
});

// --- tables ---
t("table renders with header/rows", () => {
  const out = md("| A | B |\n| - | - |\n| 1 | 2 |");
  assert(out.includes("<table>"));
  assert(out.includes("<th>A</th>"));
  assert(out.includes("<td>1</td>"));
  assert(out.includes("<td>2</td>"));
});

t("table alignment", () => {
  const out = md("| A |\n| :-: |\n| x |");
  assert(out.includes("text-align:center"));
});

t("table with bold cell", () => {
  const out = md("| A |\n| - |\n| **b** |");
  assert(out.includes("<strong>b</strong>"));
});

// --- mixed doc must not hang / oom ---
t("mixed doc renders (no hang)", () => {
  const src = [
    "# Demo",
    "",
    "| Feature | Effort |",
    "| :--- | ---: |",
    "| tables | 2 |",
    "| **bold** | 1 |",
    "",
    "- [x] done",
    "- [ ] pending",
    "",
    "plain list:",
    "- a",
    "- b"
  ].join("\n");
  const out = md(src);
  assert(out.includes("<table>"));
  assert(out.includes("<strong>bold</strong>"));
  assert(out.includes("checked"));
});

// --- inline dash line stays a paragraph
t("inline dash line stays a paragraph", () => {
  const out = md("hello\n----");
  // "----" alone should be an <hr>; "hello" a paragraph
  assert(out.includes("<p>hello</p>"));
});

// --- nested lists ---
t("nested unordered list renders <ul> inside <li>", () => {
  const out = md("- root\n  - child");
  assert(out.includes("<li>root<ul><li>child</li></ul></li>"));
});

t("nested list with ordered sublist and grandchild", () => {
  const out = md("a\n- root\n  - child b\n    * grand\n- after");
  assert(out.includes("<li>root<ul><li>child b<ul><li>grand</li></ul></li></ul></li>"));
  assert(out.includes("<li>after</li>"));
});

t("nested list inside tasks", () => {
  const out = md("- [x] top\n  - [ ] sub");
  assert(out.includes('checked'));
  assert((out.match(/<input/g)||[]).length === 2);
});

t("nested list does not hang / dedent ends level", () => {
  const src = [
    "- a",
    "  - b",
    "- c",
    "",
    "paragraph after"
  ].join("\n");
  const out = md(src);
  assert(out.includes("<li>c</li>"));
  assert(out.includes("<p>paragraph after</p>"));
});

console.log("done");