"use strict";
/*
 * mdkit.js — a small, self-contained Markdown -> HTML renderer.
 * No dependencies, no network. Exposes:
 *   browser: window.mdkit = { render: mdToHtml }
 *   node:    module.exports = { render: mdToHtml }
 *
 * Supported: headings, paragraphs, bold/italic/strikethrough, inline code,
 * fenced code blocks, blockquotes, ordered & unordered lists, task lists,
 * pipe tables, links, images, horizontal rules. Written for mdkit.html but
 * usable standalone.
 */
(function(global){
  function esc(s){
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(s){ return esc(s).replace(/"/g, "&quot;"); }

  /* ---------- inline ----------
     NOTE: the regex is built fresh on EVERY call (emoji-free, no /g state to
     preserve across recursion). A shared module-level /g regex is a trap: the
     nested inline() call inside the loop resets lastIndex, so the outer loop
     re-matches the same token forever (infinite loop / OOM). Fresh-per-call
     avoids that entirely. */
  var inlineReSrc = "`([^`]+)`|!\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+\"([^\"]*)\")?\\)|\\[([^\\]]+)\\]\\(([^)\\s]+)(?:\\s+\"([^\"]*)\")?\\)|\\*\\*([^*]+?)\\*\\*|__([^_]+?)__|~~([^~]+?)~~|\\*([^*]+?)\\*|_([^_]+?)_";

  function inline(src){
    var re = new RegExp(inlineReSrc, "g");
    var out = "", last = 0, m;
    while((m = re.exec(src))){
      out += esc(src.slice(last, m.index));
      if(m[1] !== undefined){                     /* code span */
        out += "<code>" + esc(m[1]) + "</code>";
      } else if(m[2] !== undefined){              /* image */
        out += '<img src="' + escAttr(m[3]) + '" alt="' + escAttr(m[2]) + '"' +
          (m[4] ? ' title="' + escAttr(m[4]) + '"' : "") + ">";
      } else if(m[5] !== undefined){              /* link */
        out += '<a href="' + escAttr(m[6]) + '"' +
          (m[7] ? ' title="' + escAttr(m[7]) + '"' : "") + ">" +
          inline(m[5]) + "</a>";
      } else if(m[8] !== undefined){              /* bold ** */
        out += "<strong>" + inline(m[8]) + "</strong>";
      } else if(m[9] !== undefined){              /* bold __ */
        out += "<strong>" + inline(m[9]) + "</strong>";
      } else if(m[10] !== undefined){             /* strikethrough */
        out += "<del>" + inline(m[10]) + "</del>";
      } else if(m[11] !== undefined){             /* italic * */
        out += "<em>" + inline(m[11]) + "</em>";
      } else if(m[12] !== undefined){             /* italic _ */
        out += "<em>" + inline(m[12]) + "</em>";
      }
      last = re.lastIndex;
    }
    out += esc(src.slice(last));
    return out;
  }

  /* ---------- block ---------- */
  var HR_RE = /^\s*([-*_])\s*(\1\s*){2,}$/;
  var FENCE_RE = /^```(.*)$/;
  var H_RE = /^(\#{1,6})\s+(.*)$/;
  var UL_RE = /^\s*[-*+]\s+/;
  var OL_RE = /^\s*\d+[.)]\s+/;
  var QUOTE_RE = /^\s*>/;
  /* task-list bullet:  - [ ] / - [x] / - [X]  */
  var TASK_RE = /^(\s*[-*+]\s+)\[([ xX])\]\s+(.*)$/;
  var TASK_OL_RE = /^(\s*\d+[.)]\s+)\[([ xX])\]\s+(.*)$/;
  /* pipe table:  | a | b |  then  | - | -: |  then rows */
  var ROW_RE = /^\s*\|.*\|\s*$/;
  /* is `line` a valid separator row ("| - | :-- | -: | :--: |", trailing pipe optional)? */
  function sepOk(line){
    var s = line.trim().replace(/^\|/, "");
    var trailing = /\|\s*$/.test(s);
    s = s.replace(/\|\s*$/, "");
    if(s === "") return trailing;            /* "| |" */
    return s.split("|").every(function(c){ return /^\s*:?-+:?\s*$/.test(c); });
  }
  /* true when line j is a table header (pipe row) followed by a valid separator */
  function isTableStart(lines, n, j){
    return j + 1 < n && ROW_RE.test(lines[j]) && sepOk(lines[j + 1]);
  }
  function splitRow(line){
    var cells = line.trim().split("|");
    if(cells[0] === "") cells.shift();
    if(cells[cells.length - 1] === "") cells.pop();
    return cells.map(function(c){ return c.trim(); });
  }
  /* parse a pipe-table body starting at line i. Returns {table, next} or null. */
  function tableAt(lines, n, i){
    if(!isTableStart(lines, n, i)) return null;
    var heads = splitRow(lines[i]);
    if(!heads.length) return null;
    var aligns = splitRow(lines[i + 1]).slice(0, heads.length).map(function(c){
      var t = c.trim();
      var l = /^:/.test(t), r = /:$/.test(t);
      return l && r ? "center" : l ? "left" : r ? "right" : "";
    });
    var rows = [], k = i + 2;
    while(k < n && ROW_RE.test(lines[k])){ rows.push(splitRow(lines[k])); k++; }
    return { table: { heads: heads, aligns: aligns, rows: rows }, next: k };
  }

  /* ---------- nested lists ----------
     Recursive descent: parseList consumes a run of list lines whose marker sits
     at a given column; a *deeper*-indented bullet directly after an item becomes
     a sublist of that item. Returns [items, nextLineIndex]. Every iteration
     advances at least one line and indent strictly increases down the stack, so
     this terminates. Dedent past the base column (or a non-list line) ends the
     level. */
  function listLine(line){
    var m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if(!m) return null;
    return { col: m[1].length, num: /^\d/.test(m[2]), rest: m[3] };
  }
  function parseList(lines, n, i, indent){
    var items = [];
    while(i < n){
      var ll = listLine(lines[i]);
      if(!ll || ll.col !== indent) break;
      var task = /^\[([ xX])\]\s+/.exec(ll.rest);
      var it = { num: ll.num, task: !!task,
                 done: task ? /[xX]/.test(task[1]) : false,
                 txt: task ? ll.rest.slice(task[0].length) : ll.rest,
                 sub: null };
      items.push(it);
      i++;
      if(i < n){
        var sub = listLine(lines[i]);
        if(sub && sub.col > indent){
          var r = parseList(lines, n, i, sub.col);
          it.sub = r[0];
          i = r[1];
        }
      }
    }
    return [items, i];
  }
  function renderList(items){
    var tag = items[0].num ? "ol" : "ul";
    var html = "<" + tag + ">";
    items.forEach(function(it){
      if(it.task){
        html += '<li class="task' + (it.done ? " done" : "") + '"><input type="checkbox"' +
                (it.done ? " checked" : "") + " disabled> <span>" + inline(it.txt) + "</span>";
      } else {
        html += "<li>" + inline(it.txt);
      }
      if(it.sub && it.sub.length) html += renderList(it.sub);
      html += "</li>";
    });
    html += "</" + tag + ">";
    return html;
  }

  function mdToHtml(src){
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var blocks = [], n = lines.length, i = 0;

    while(i < n){
      var line = lines[i];

      /* fenced code */
      var fm = FENCE_RE.exec(line);
      if(fm){
        var lang = fm[1].trim(), buf = [], j = i + 1;
        while(j < n && !/^```\s*$/.test(lines[j])){ buf.push(lines[j]); j++; }
        blocks.push({ t: "code", lang: lang, code: buf.join("\n") });
        i = (j < n) ? j + 1 : j;
        continue;
      }

      /* blank */
      if(/^\s*$/.test(line)){ i++; continue; }

      /* horizontal rule */
      if(HR_RE.test(line)){ blocks.push({ t: "hr" }); i++; continue; }

      /* heading */
      var hm = H_RE.exec(line);
      if(hm){ blocks.push({ t: "h", lvl: hm[1].length, txt: hm[2] }); i++; continue; }

      /* blockquote */
      if(QUOTE_RE.test(line)){
        var ql = [], j = i;
        while(j < n && QUOTE_RE.test(lines[j])){ ql.push(lines[j].replace(/^\s*>\s?/, "")); j++; }
        blocks.push({ t: "quote", txt: ql.join("\n") });
        i = j; continue;
      }

      /* list (incl. nested) */
      var ll0 = listLine(line);
      if(ll0){
        var res = parseList(lines, n, i, ll0.col);
        blocks.push({ t: "list", items: res[0] });
        i = res[1]; continue;
      }

      /* pipe table */
      var tb = tableAt(lines, n, i);
      if(tb){
        blocks.push({ t: "table", table: tb.table });
        i = tb.next; continue;
      }

      /* paragraph */
      var para = [], j = i;
      while(j < n){
        var pl = lines[j];
        if(/^\s*$/.test(pl) || FENCE_RE.test(pl) || QUOTE_RE.test(pl) ||
           UL_RE.test(pl) || OL_RE.test(pl) || H_RE.test(pl) || HR_RE.test(pl) ||
           TASK_RE.test(pl) || TASK_OL_RE.test(pl) || isTableStart(lines, n, j)) break;
        para.push(pl); j++;
      }
      blocks.push({ t: "p", txt: para.join("\n") });
      i = j;
    }

    /* render */
    var html = "";
    blocks.forEach(function(b){
      switch(b.t){
        case "code":
          html += "<pre><code" + (b.lang ? ' class="lang-' + escAttr(b.lang) + '"' : "") + ">" +
                  esc(b.code) + "</code></pre>\n";
          break;
        case "hr": html += "<hr>\n"; break;
        case "h":  html += "<h" + b.lvl + ">" + inline(b.txt) + "</h" + b.lvl + ">\n"; break;
        case "quote":
          html += "<blockquote><p>" + inline(b.txt) + "</p></blockquote>\n";
          break;
        case "list":
          html += renderList(b.items) + "\n";
          break;
        case "table": {
          var t = b.table;
          html += "<table>\n<thead><tr>";
          t.heads.forEach(function(h, i){
            html += "<th" + (t.aligns[i] ? " style=\"text-align:" + t.aligns[i] + "\"" : "") + ">" +
                    inline(h) + "</th>";
          });
          html += "</tr></thead>\n<tbody>";
          t.rows.forEach(function(r){
            html += "<tr>";
            t.heads.forEach(function(_, i){
              html += "<td" + (t.aligns[i] ? " style=\"text-align:" + t.aligns[i] + "\"" : "") + ">" +
                      inline(r[i] !== undefined ? r[i] : "") + "</td>";
            });
            html += "</tr>";
          });
          html += "</tbody></table>\n";
          break;
        }
        default:
          html += "<p>" + inline(b.txt) + "</p>\n";
      }
    });
    return html;
  }

  global.mdkit = { render: mdToHtml };
  if(typeof module !== "undefined" && module.exports){
    module.exports = { render: mdToHtml };
  }
})(typeof window !== "undefined" ? window : globalThis);
