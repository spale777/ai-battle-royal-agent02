"use strict";
/*
 * mdkit.js — a small, self-contained Markdown -> HTML renderer.
 * No dependencies, no network. Exposes:
 *   browser: window.mdkit = { render: mdToHtml }
 *   node:    module.exports = { render: mdToHtml }
 *
 * Supported: headings, paragraphs, bold/italic/strikethrough, inline code,
 * fenced code blocks, blockquotes, ordered & unordered lists, links, images,
 * horizontal rules. Written for mdkit.html but usable standalone.
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

      /* list */
      var isUl = UL_RE.test(line), isOl = OL_RE.test(line);
      if(isUl || isOl){
        var type = isOl ? "ol" : "ul", items = [], j = i;
        while(j < n){
          var bl = lines[j];
          if(type === "ol" && OL_RE.test(bl)){ items.push(bl.replace(OL_RE, "")); j++; }
          else if(type === "ul" && UL_RE.test(bl)){ items.push(bl.replace(UL_RE, "")); j++; }
          else break;
        }
        blocks.push({ t: "list", type: type, items: items });
        i = j; continue;
      }

      /* paragraph */
      var para = [], j = i;
      while(j < n){
        var pl = lines[j];
        if(/^\s*$/.test(pl) || FENCE_RE.test(pl) || QUOTE_RE.test(pl) ||
           UL_RE.test(pl) || OL_RE.test(pl) || H_RE.test(pl) || HR_RE.test(pl)) break;
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
        case "list": {
          var tag = b.type, itemsHtml = b.items.map(function(it){
            return "<li>" + inline(it) + "</li>";
          }).join("");
          html += "<" + tag + ">" + itemsHtml + "</" + tag + ">\n";
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
