"use strict";
var ChangwanGame = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // minigame/platform.js
  var require_platform = __commonJS({
    "minigame/platform.js"(exports, module) {
      "use strict";
      var KEY = "changwan-minigame";
      function read(key, fallback) {
        try {
          return wx.getStorageSync(KEY + ":" + key) || fallback;
        } catch {
          return fallback;
        }
      }
      function write(key, value) {
        try {
          wx.setStorageSync(KEY + ":" + key, value);
        } catch {
        }
      }
      function request(base, path, method = "GET", data, token) {
        return new Promise((resolve, reject) => wx.request({ url: base.replace(/\/$/, "") + path, method, data, header: { "content-type": "application/json", ...token ? { Authorization: "Bearer " + token } : {} }, success: (r) => r.statusCode >= 200 && r.statusCode < 300 ? resolve(r.data) : reject(Error(r.data?.error || "\u670D\u52A1\u8BF7\u6C42\u5931\u8D25")), fail: (e) => reject(Error(e.errMsg || "\u65E0\u6CD5\u8FDE\u63A5\u670D\u52A1\u5668")) }));
      }
      function input(title, value = "") {
        return new Promise((resolve) => wx.showModal({ title, editable: true, placeholderText: value, content: value, success: (r) => resolve(r.confirm ? (r.content || "").trim() : null), fail: () => resolve(null) }));
      }
      function confirm(title, content) {
        return new Promise((resolve) => wx.showModal({ title, content, success: (r) => resolve(r.confirm), fail: () => resolve(false) }));
      }
      var toast = (text) => wx.showToast({ title: String(text), icon: "none", duration: 2300 });
      module.exports = { read, write, request, input, confirm, toast };
    }
  });

  // artifacts/minigame-build/engine.js
  var require_engine = __commonJS({
    "artifacts/minigame-build/engine.js"(exports, module) {
      "use strict";
      (function(root) {
        "use strict";
        const SUITS = ["S", "H", "C", "D"];
        const symbol = { S: "\u2660", H: "\u2665", C: "\u2663", D: "\u2666", J: "\u2605" };
        const label = (r) => ({ 11: "J", 12: "Q", 13: "K", 14: "A", 15: "\u5C0F\u738B", 16: "\u5927\u738B" })[r] || String(r);
        const key = (c) => c.s + c.r;
        const points = (cards) => cards.reduce((n, c) => n + (c.r === 5 ? 5 : c.r === 10 || c.r === 13 ? 10 : 0), 0);
        function deck(random = Math.random) {
          const cards = [];
          for (let d = 0; d < 2; d++) {
            for (const s of SUITS) for (let r = 2; r <= 14; r++) cards.push({ id: `${d}-${s}-${r}`, s, r });
            for (let r = 15; r <= 16; r++) cards.push({ id: `${d}-J-${r}`, s: "J", r });
          }
          for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
          }
          return cards;
        }
        const category = (c, ctx) => c.s === "J" || c.r === ctx.level || c.s === ctx.trump ? "T" : c.s;
        const stars = (c, ctx) => c.s === "J" || c.r === ctx.level && c.s === ctx.trump ? 2 : category(c, ctx) === "T" ? 1 : 0;
        function rank(c, ctx) {
          if (ctx.trump === "NT") {
            if (c.s === "J") return c.r === 16 ? 14 : 13;
            if (c.r === ctx.level) return 12;
          }
          if (c.s === "J") return c.r === 16 ? 15 : 14;
          if (c.r === ctx.level) return c.s === ctx.trump ? 13 : 12;
          return c.r - 2 - (c.r > ctx.level ? 1 : 0);
        }
        function sort(cards, ctx) {
          const available = SUITS.filter((s) => s !== ctx.trump);
          const black = available.filter((s) => s === "S" || s === "C"), red = available.filter((s) => s === "H" || s === "D");
          let nextBlack = black.length === red.length ? ["H", "D", "NT", null, void 0].includes(ctx.trump) : black.length > red.length;
          const order = ["T"];
          while (black.length || red.length) {
            const preferred = nextBlack ? black : red, other = nextBlack ? red : black;
            order.push((preferred.length ? preferred : other).shift());
            nextBlack = !nextBlack;
          }
          const ordered = [...cards].sort((a, b) => order.indexOf(category(a, ctx)) - order.indexOf(category(b, ctx)) || rank(b, ctx) - rank(a, ctx) || a.s.localeCompare(b.s) || a.id.localeCompare(b.id));
          const pp = pairs(ordered.filter((c) => category(c, ctx) === "T"), ctx);
          const main = pp.find((p) => p[0].s === ctx.trump && p[0].r === ctx.level);
          if (!main) return ordered;
          const chain = [main], base = rank(main[0], ctx);
          for (const direction of [-1, 1]) for (let r = base + direction; ; r += direction) {
            const pair = pp.find((p) => rank(p[0], ctx) === r);
            if (!pair) break;
            chain.push(pair);
          }
          if (chain.length === 1) return ordered;
          const ids = new Set(chain.flat().map((c) => c.id)), start = ordered.findIndex((c) => ids.has(c.id));
          const block = ordered.filter((c) => ids.has(c.id)), rest = ordered.filter((c) => !ids.has(c.id));
          rest.splice(start, 0, ...block);
          return rest;
        }
        function declaration(hand, choice, level) {
          let suit, rankValue, count, strength, trump;
          if (choice === "SJ" || choice === "BJ") {
            suit = "J";
            rankValue = choice === "SJ" ? 15 : 16;
            count = 2;
            strength = choice === "SJ" ? 3 : 4;
            trump = "NT";
          } else if (/^[SHCD][12]$/.test(choice)) {
            suit = choice[0];
            rankValue = level;
            count = Number(choice[1]);
            strength = count;
            trump = suit;
          } else return null;
          const cards = hand.filter((c) => c.s === suit && c.r === rankValue).slice(0, count);
          if (cards.length !== count || new Set(cards.map((c) => c.id)).size !== count) return null;
          return { choice, trump, strength, cards };
        }
        function bidError(hand, choice, level, current, player) {
          const bid = declaration(hand, choice, level);
          if (!bid) return "\u624B\u4E2D\u5C1A\u65E0\u8DB3\u591F\u7684\u4EAE\u4E3B\u724C\u3002";
          if (!current) return "";
          if (bid.strength <= current.strength) return "\u53CD\u4E3B\u5FC5\u987B\u9AD8\u4E8E\u5F53\u524D\u6863\u4F4D\uFF0C\u540C\u6863\u4E0D\u80FD\u4E92\u53CD\u3002";
          if (current.player === player && !(current.strength === 1 && bid.strength === 2 && bid.trump === current.trump)) return "\u4E0D\u80FD\u6362\u82B1\u8272\u53CD\u81EA\u5DF1\uFF0C\u53EA\u80FD\u8865\u540C\u82B1\u8272\u5BF9\u5B50\u81EA\u4FDD\u3002";
          return "";
        }
        function bidOptions(hand, level, current, player) {
          return [...SUITS.flatMap((s) => [s + "1", s + "2"]), "SJ", "BJ"].filter((choice) => !bidError(hand, choice, level, current, player)).map((choice) => declaration(hand, choice, level));
        }
        function pairs(cards, ctx) {
          const map = /* @__PURE__ */ new Map();
          for (const c of cards) {
            const k = key(c);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(c);
          }
          return [...map.values()].filter((a) => a.length === 2).sort((a, b) => rank(a[0], ctx) - rank(b[0], ctx));
        }
        function pattern(cards, ctx) {
          if (!cards.length) return null;
          const cat = category(cards[0], ctx);
          if (cards.some((c) => category(c, ctx) !== cat)) return null;
          if (cards.length === 1) return { type: "single", cat, n: 1, high: rank(cards[0], ctx) };
          const pp = pairs(cards, ctx);
          if (pp.length * 2 !== cards.length) return null;
          if (pp.length === 1) return { type: "pair", cat, n: 2, high: rank(pp[0][0], ctx) };
          for (let i = 1; i < pp.length; i++) if (rank(pp[i][0], ctx) !== rank(pp[i - 1][0], ctx) + 1) return null;
          return { type: "tractor", cat, n: cards.length, high: rank(pp.at(-1)[0], ctx) };
        }
        function combinations(arr, n, fn, start = 0, chosen = []) {
          if (!n) {
            fn(chosen);
            return;
          }
          for (let i = start; i <= arr.length - n; i++) combinations(arr, n - 1, fn, i + 1, [...chosen, arr[i]]);
        }
        function components(cards, ctx) {
          const pp = pairs(cards, ctx), parts = [], used = /* @__PURE__ */ new Set();
          let remaining = [...pp];
          while (remaining.length) {
            const byRank = /* @__PURE__ */ new Map();
            for (const p of remaining) {
              const r = rank(p[0], ctx);
              if (!byRank.has(r)) byRank.set(r, p);
            }
            let best = [], run = [];
            for (const r of [...byRank.keys()].sort((a, b) => a - b)) {
              if (run.length && r !== rank(run.at(-1)[0], ctx) + 1) run = [];
              run.push(byRank.get(r));
              if (run.length > best.length) best = [...run];
            }
            const group = best.flat();
            group.forEach((c) => used.add(c.id));
            parts.push({ ...pattern(group, ctx), cards: group });
            remaining = remaining.filter((p) => !used.has(p[0].id));
          }
          for (const c of cards) if (!used.has(c.id)) parts.push({ ...pattern([c], ctx), cards: [c] });
          return parts.sort((a, b) => b.n - a.n || b.high - a.high);
        }
        function shape(cards, ctx) {
          if (!cards.length || cards.some((c) => category(c, ctx) !== category(cards[0], ctx))) return null;
          const simple = pattern(cards, ctx), parts = components(cards, ctx);
          return { ...simple || { type: "throw", cat: category(cards[0], ctx), n: cards.length, high: Math.max(...cards.map((c) => rank(c, ctx))) }, parts };
        }
        function groupsOfSize(cards, n, ctx) {
          if (n === 1) return cards.map((c) => [c]);
          const result = [];
          combinations(pairs(cards, ctx), n / 2, (set) => {
            const group = set.flat();
            if (pattern(group, ctx)) result.push(group);
          });
          return result;
        }
        function checkThrow(cards, hands, player, ctx) {
          const lead = shape(cards, ctx);
          if (!lead) return { ok: false, cards: [], error: "\u7529\u724C\u5FC5\u987B\u5C5E\u4E8E\u540C\u4E00\u82B1\u8272\uFF0C\u6216\u5168\u90E8\u4E3A\u4E3B\u724C\u3002" };
          if (lead.type !== "throw") return { ok: true, cards };
          const blocked = lead.parts.filter((part) => hands.some((hand, i) => i !== player && groupsOfSize(hand.filter((c) => category(c, ctx) === lead.cat), part.n, ctx).some((group) => pattern(group, ctx).high > part.high)));
          if (!blocked.length) return { ok: true, cards };
          blocked.sort((a, b) => a.n - b.n || a.high - b.high);
          return { ok: false, cards: blocked[0].cards, error: "\u7529\u724C\u5931\u8D25\uFF0C\u81EA\u52A8\u6539\u51FA\u88AB\u538B\u5236\u7684\u6700\u5C0F\u7EC4\u5408\u3002" };
        }
        function publicThrowIds(hand, played, ctx) {
          const known = /* @__PURE__ */ new Map();
          for (const c of [...hand, ...played]) known.set(key(c), (known.get(key(c)) || 0) + 1);
          const unseen = [];
          for (const s of [...SUITS, "J"]) for (let r = s === "J" ? 15 : 2; r <= (s === "J" ? 16 : 14); r++) {
            for (let n = known.get(s + r) || 0; n < 2; n++) unseen.push({ id: "unseen-" + s + r + "-" + n, s, r });
          }
          const marked = /* @__PURE__ */ new Set();
          for (const cat of ["T", ...SUITS]) {
            const own = hand.filter((c) => category(c, ctx) === cat);
            if (own.length < 2) continue;
            const unknown = unseen.filter((c) => category(c, ctx) === cat), pairRanks = [...new Set(pairs(unknown, ctx).map((p) => rank(p[0], ctx)))].sort((a, b) => a - b);
            const candidates = [...components(own, ctx), ...own.map((c) => ({ ...pattern([c], ctx), cards: [c] })), ...pairs(own, ctx).map((p) => ({ ...pattern(p, ctx), cards: p }))];
            const safe = /* @__PURE__ */ new Map();
            for (const part of candidates) {
              let beaten;
              if (part.n === 1) beaten = unknown.some((c) => rank(c, ctx) > part.high);
              else {
                const length = part.n / 2;
                beaten = pairRanks.some((high, i) => high > part.high && i >= length - 1 && high - pairRanks[i - length + 1] === length - 1);
              }
              if (!beaten) for (const c of part.cards) safe.set(c.id, c);
            }
            const cards = [...safe.values()];
            if (shape(cards, ctx)?.type === "throw") for (const c of cards) marked.add(c.id);
          }
          return marked;
        }
        function revealedVoid(lead, cards, ctx) {
          if (!lead?.length) return null;
          const cat = category(lead[0], ctx);
          return cards.some((c) => category(c, ctx) !== cat) ? cat : null;
        }
        function matchingSignature(cards, lead, ctx) {
          if (cards.length !== lead.n || !cards.length || cards.some((c) => category(c, ctx) !== category(cards[0], ctx))) return null;
          const demands = lead.parts.filter((p) => p.n > 1).map((p) => p.n), memo = /* @__PURE__ */ new Map();
          function solve(rest, index) {
            if (index === demands.length) return rest.map((c) => rank(c, ctx)).sort((a, b) => b - a);
            const key2 = index + ":" + rest.map((c) => c.id).sort().join(",");
            if (memo.has(key2)) return memo.get(key2);
            let best = null;
            for (const group of groupsOfSize(rest, demands[index], ctx)) {
              const ids = new Set(group.map((c) => c.id)), tail = solve(rest.filter((c) => !ids.has(c.id)), index + 1);
              if (tail) {
                const signature = [pattern(group, ctx).high, ...tail];
                if (!best || compare(signature, best) > 0) best = signature;
              }
            }
            memo.set(key2, best);
            return best;
          }
          return solve(cards, 0);
        }
        function bottomMultiplier(lead, ctx) {
          const largest = shape(lead, ctx).parts[0].n;
          return largest === 1 ? 2 : 2 ** (largest / 2 + 1);
        }
        function tractorIds(hand, ctx) {
          const ids = /* @__PURE__ */ new Set();
          for (const cat of ["T", ...SUITS]) {
            const pp = pairs(hand.filter((c) => category(c, ctx) === cat), ctx), ranks = new Set(pp.map((p) => rank(p[0], ctx)));
            for (const p of pp) {
              const r = rank(p[0], ctx);
              if (ranks.has(r - 1) || ranks.has(r + 1)) p.forEach((c) => ids.add(c.id));
            }
          }
          return ids;
        }
        function profile(pp, ctx) {
          const counts = /* @__PURE__ */ new Map();
          for (const p of pp) {
            const r = rank(p[0], ctx);
            counts.set(r, (counts.get(r) || 0) + 1);
          }
          const runs = [];
          while (counts.size) {
            const rr = [...counts.keys()].sort((a, b) => a - b);
            let best = [], run = [];
            for (const r of rr) {
              if (run.length && r !== run.at(-1) + 1) run = [];
              run.push(r);
              if (run.length > best.length) best = [...run];
            }
            runs.push(best.length);
            for (const r of best) {
              const count = counts.get(r) - 1;
              if (count) counts.set(r, count);
              else counts.delete(r);
            }
          }
          return runs.sort((a, b) => b - a);
        }
        function compare(a, b) {
          for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const d = (a[i] || 0) - (b[i] || 0);
            if (d) return d;
          }
          return 0;
        }
        function followProfile(pp, lead, ctx) {
          const tractors = lead.parts.filter((p) => p.n > 2).map((p) => p.n / 2), pairCount = lead.parts.filter((p) => p.n === 2).length, memo = /* @__PURE__ */ new Map();
          function solve(rest, index) {
            if (index === tractors.length) return [Math.min(pairCount, rest.length)];
            const key2 = index + ":" + rest.map((p) => p[0].id).sort().join(",");
            if (memo.has(key2)) return memo.get(key2);
            const n = tractors[index], count = Math.min(n, rest.length);
            let best = null;
            combinations(rest, count, (chosen) => {
              const used = new Set(chosen.map((p) => p[0].id)), signature = profile(chosen, ctx);
              while (signature.length < n) signature.push(0);
              const candidate = [...signature, ...solve(rest.filter((p) => !used.has(p[0].id)), index + 1)];
              if (!best || compare(candidate, best) > 0) best = candidate;
            });
            memo.set(key2, best);
            return best;
          }
          return solve(pp, 0);
        }
        function bestPairSets(cards, n, ctx, lead) {
          const pp = pairs(cards, ctx), needed = lead.parts.reduce((sum, p) => sum + (p.n > 1 ? p.n / 2 : 0), 0), count = Math.min(needed, pp.length);
          let best = [], sets = [];
          combinations(pp, count, (set) => {
            const p = followProfile(set, lead, ctx), diff = compare(p, best);
            if (diff > 0) {
              best = p;
              sets = [set];
            } else if (diff === 0) sets.push(set);
          });
          return { best, sets };
        }
        function legal(hand, cards, lead, ctx) {
          if (!cards.length) return "\u8BF7\u5148\u9009\u62E9\u8981\u51FA\u7684\u724C\u3002";
          if (new Set(cards.map((c) => c.id)).size !== cards.length || cards.some((c) => !hand.some((h) => h.id === c.id))) return "\u6240\u9009\u724C\u4E0D\u5728\u624B\u724C\u4E2D\u3002";
          if (!lead) return shape(cards, ctx) ? "" : "\u9996\u51FA\u6216\u7529\u724C\u5FC5\u987B\u540C\u4E00\u82B1\u8272\uFF0C\u6216\u5168\u90E8\u4E3A\u4E3B\u724C\u3002";
          if (cards.length !== lead.length) return `\u672C\u8F6E\u9700\u8981\u8DDF ${lead.length} \u5F20\u724C\u3002`;
          const p = shape(lead, ctx);
          if (!p) return "\u9996\u51FA\u724C\u578B\u65E0\u6548\u3002";
          const available = hand.filter((c) => category(c, ctx) === p.cat), chosen = cards.filter((c) => category(c, ctx) === p.cat);
          if (chosen.length !== Math.min(available.length, lead.length)) return p.cat === "T" ? "\u6709\u4E3B\u724C\u65F6\u5FC5\u987B\u5148\u8DDF\u4E3B\u724C\u3002" : `\u5FC5\u987B\u5148\u8DDF\u8DB3 ${symbol[p.cat]} \u82B1\u8272\u3002`;
          if (available.length >= lead.length && lead.length > 1) {
            const best = bestPairSets(available, lead.length, ctx, p).best;
            if (compare(followProfile(pairs(chosen, ctx), p, ctx), best) !== 0) return p.type === "pair" ? "\u6709\u540C\u82B1\u8272\u5BF9\u5B50\u65F6\u5FC5\u987B\u8DDF\u5BF9\u5B50\u3002" : "\u8BF7\u6309\u9996\u51FA\u7EC4\u5408\uFF0C\u4F18\u5148\u8DDF\u62D6\u62C9\u673A\uFF0C\u518D\u5C3D\u91CF\u8DDF\u8DB3\u5BF9\u5B50\u3002";
          }
          return "";
        }
        function winner(plays, ctx) {
          if (!plays.length) return null;
          const lead = shape(plays[0].cards, ctx);
          let win = plays[0], bestCat = lead.cat, best = matchingSignature(plays[0].cards, lead, ctx);
          for (const play of plays.slice(1)) {
            const signature = matchingSignature(play.cards, lead, ctx), cat = category(play.cards[0], ctx);
            if (!signature || cat !== lead.cat && cat !== "T") continue;
            if (cat === "T" && bestCat !== "T" || cat === bestCat && compare(signature, best) > 0) {
              win = play;
              bestCat = cat;
              best = signature;
            }
          }
          return win.player;
        }
        function forcedCards(hand, lead, ctx) {
          if (!lead?.length || hand.length < lead.length) return [];
          const n = lead.length, cat = category(lead[0], ctx), same = hand.filter((c) => category(c, ctx) === cat);
          if (hand.length === n) return [...hand];
          if (same.length <= n) return same;
          const { sets } = bestPairSets(same, n, ctx, shape(lead, ctx));
          let intersection = null;
          for (const set of sets) {
            const picked = set.flat(), ids = new Set(picked.map((c) => c.id)), rest = same.filter((c) => !ids.has(c.id));
            if (rest.length === n - picked.length) for (const c of rest) ids.add(c.id);
            intersection = intersection === null ? ids : new Set([...intersection].filter((id) => ids.has(id)));
            if (!intersection.size) break;
          }
          return hand.filter((c) => intersection?.has(c.id));
        }
        function suggestions(hand, lead, ctx) {
          const cheap = (a, b) => points([a]) - points([b]) || rank(a, ctx) - rank(b, ctx);
          if (!lead) {
            const result = hand.map((c) => [c]);
            for (const cat2 of ["T", ...SUITS]) {
              const pp = pairs(hand.filter((c) => category(c, ctx) === cat2), ctx);
              result.push(...pp);
              combinations(pp, 2, (set) => {
                const cards = set.flat();
                if (pattern(cards, ctx)) result.push(cards);
              });
            }
            const unknown = [];
            for (const s of [...SUITS, "J"]) for (let r = s === "J" ? 15 : 2; r <= (s === "J" ? 16 : 14); r++) {
              const held = hand.filter((c) => c.s === s && c.r === r).length;
              for (let copy = held; copy < 2; copy++) unknown.push({ s, r, id: "unknown-" + s + "-" + r + "-" + copy });
            }
            for (const cat2 of ["T", ...SUITS]) {
              const cards = hand.filter((c) => category(c, ctx) === cat2);
              if (cards.length > 1 && shape(cards, ctx).type === "throw" && checkThrow(cards, [hand, unknown], 0, ctx).ok) result.push(cards);
            }
            return result;
          }
          const cat = category(lead[0], ctx), same = hand.filter((c) => category(c, ctx) === cat).sort(cheap), n = lead.length;
          if (same.length < n) {
            const off = hand.filter((c) => category(c, ctx) !== cat).sort((a, b) => (category(a, ctx) === "T") - (category(b, ctx) === "T") || cheap(a, b));
            const result = [[...same, ...off.slice(0, n - same.length)]];
            if (!same.length) for (const suit of ["T", ...SUITS].filter((s) => s !== cat)) {
              const suited = hand.filter((c) => category(c, ctx) === suit);
              if (suited.length >= n) result.push(...sameSuitResponses(suited, lead, ctx));
            }
            return result;
          }
          if (n === 1) return same.map((c) => [c]);
          return sameSuitResponses(same, lead, ctx);
        }
        function sameSuitResponses(cards, lead, ctx) {
          const n = lead.length, { sets } = bestPairSets(cards, n, ctx, shape(lead, ctx)), result = [];
          for (const set of sets) {
            const picked = set.flat(), ids = new Set(picked.map((c) => c.id));
            const remaining = cards.filter((c) => !ids.has(c.id)).sort((a, b) => points([a]) - points([b]) || rank(a, ctx) - rank(b, ctx));
            result.push([...picked, ...remaining.slice(0, n - picked.length)]);
            if (n > picked.length) result.push([...picked, ...remaining.slice().sort((a, b) => rank(b, ctx) - rank(a, ctx)).slice(0, n - picked.length)]);
          }
          return result;
        }
        function choose(hand, plays, ctx, player) {
          const candidates = suggestions(hand, plays[0]?.cards, ctx);
          const score = (cards) => {
            const strength = cards.reduce((n, c) => n + rank(c, ctx) + (category(c, ctx) === "T" ? 20 : 0), 0);
            if (!plays.length) return cards.length * 12 - strength * 0.7 - points(cards) * 0.6;
            const before = winner(plays, ctx), after = winner([...plays, { player, cards }], ctx), team = player % 2;
            if (before % 2 === team && after % 2 === team) return points(cards) * 4 - strength * 0.3;
            return (after === player ? 65 + points(plays.flatMap((p) => p.cards)) * 2 : 0) - strength * 0.35 - points(cards) * 2;
          };
          return candidates.sort((a, b) => score(b) - score(a))[0];
        }
        function settle(score) {
          return score === 0 ? { defend: true, steps: 3 } : score < 40 ? { defend: true, steps: 2 } : score < 80 ? { defend: true, steps: 1 } : { defend: false, steps: Math.floor((score - 80) / 40) };
        }
        const api = { SUITS, symbol, label, key, points, deck, category, stars, rank, sort, declaration, bidError, bidOptions, pairs, pattern, shape, checkThrow, publicThrowIds, revealedVoid, bottomMultiplier, tractorIds, forcedCards, legal, winner, suggestions, choose, settle };
        if (typeof module !== "undefined") module.exports = api;
        else root.Tractor = api;
      })(typeof globalThis !== "undefined" ? globalThis : exports);
    }
  });

  // artifacts/minigame-build/authority.js
  var require_authority = __commonJS({
    "artifacts/minigame-build/authority.js"(exports, module) {
      var __defProp = Object.defineProperty;
      var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
      var __getOwnPropNames2 = Object.getOwnPropertyNames;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __export = (target, all) => {
        for (var name in all)
          __defProp(target, name, { get: all[name], enumerable: true });
      };
      var __copyProps = (to, from, except, desc) => {
        if (from && typeof from === "object" || typeof from === "function") {
          for (let key of __getOwnPropNames2(from))
            if (!__hasOwnProp.call(to, key) && key !== except)
              __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
        }
        return to;
      };
      var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
      var stdin_exports = {};
      __export(stdin_exports, {
        E: () => E,
        TURN_MS: () => TURN_MS,
        act: () => act,
        start: () => start,
        tick: () => tick,
        view: () => view
      });
      module.exports = __toCommonJS(stdin_exports);
      var randomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;
      var serial = 0;
      var randomUUID = () => Date.now().toString(36) + "-" + ++serial;
      var E = require_engine();
      var TURN_MS = 3e4;
      function check(ok, message) {
        if (!ok) throw Error(message);
      }
      function remove(g, p, cards) {
        const ids = new Set(cards.map((c) => c.id));
        g.hands[p] = g.hands[p].filter((c) => !ids.has(c.id));
      }
      function deadline(g, now) {
        g.deadline = now + (g.hands[g.turn].length === 1 ? 650 : g.turnMs || TURN_MS);
      }
      function start(room, now) {
        if (room.game?.matchOver) {
          room.levels = [room.settings?.startLevel || 2, room.settings?.startLevel || 2];
          room.dealer = 0;
          room.round = 1;
        } else if (room.game) room.round++;
        const deck = E.deck(() => randomInt(0, 4294967296) / 4294967296);
        room.members.forEach((m) => m.ready = false);
        room.game = { turnMs: (room.settings?.turnSeconds || 30) * 1e3, id: randomUUID(), phase: "dealing", level: room.levels[room.dealer % 2], trump: null, dealer: room.dealer, turn: room.dealer, hands: [[], [], [], []], bottom: deck.slice(100), deck: deck.slice(0, 100), dealIndex: 0, plays: [], lastTrick: [], publicCards: [], voids: [[], [], [], []], currentBid: null, score: 0, trick: 1, deadline: now + 100, message: "\u53D1\u724C\u4E2D\uFF0C\u53EF\u4EE5\u62A2\u4E3B" };
      }
      function finishBid(room, now) {
        const g = room.game;
        g.trump = g.currentBid?.trump || "NT";
        if (room.round === 1 && g.currentBid) g.dealer = g.currentBid.player;
        g.turn = g.dealer;
        g.hands[g.dealer].push(...g.bottom);
        g.phase = "bury";
        g.deadline = now + (g.turnMs || TURN_MS);
        g.message = "\u5E84\u5BB6\u9009\u53D6 8 \u5F20\u5E95\u724C";
      }
      function commit(g, player, cards, now) {
        const missing = E.revealedVoid(g.plays[0]?.cards, cards, g);
        if (missing && !g.voids[player].includes(missing)) g.voids[player].push(missing);
        remove(g, player, cards);
        g.publicCards.push(...cards);
        g.plays.push({ player, cards });
        if (g.plays.length === 4) {
          const winner = E.winner(g.plays, g);
          if (winner % 2 !== g.dealer % 2) g.score += E.points(g.plays.flatMap((p) => p.cards));
          g.phase = "review";
          g.deadline = now + 1900;
          g.message = "\u672C\u8F6E\u7ED3\u675F";
        } else {
          g.turn = (player + 3) % 4;
          deadline(g, now);
          g.message = "\u7B49\u5F85\u51FA\u724C";
        }
      }
      function act(room, player, type, data, now) {
        if (type === "ready") {
          check(!room.game || room.game.phase === "over", "\u724C\u5C40\u5C1A\u672A\u7ED3\u675F");
          room.members[player].ready = true;
          if (room.members.length === 4 && room.members.every((m) => m.ready)) start(room, now);
          return;
        }
        const g = room.game;
        check(g, "\u8BF7\u5148\u51C6\u5907");
        if (type === "pass") {
          check(g.phase === "dealing" || g.phase === "bidding", "\u5DF2\u7ECF\u7ED3\u675F\u5B9A\u4E3B");
          (g.passed || (g.passed = [false, false, false, false]))[player] = true;
          return;
        }
        if (type === "bid") {
          check(g.phase === "dealing" || g.phase === "bidding", "\u5DF2\u7ECF\u7ED3\u675F\u5B9A\u4E3B");
          check(typeof data.choice === "string", "\u4EAE\u4E3B\u683C\u5F0F\u9519\u8BEF");
          check(!g.passed?.[player], "\u672C\u5C40\u5DF2\u9009\u62E9\u4E0D\u53EB\uFF0C\u4E0D\u80FD\u518D\u62A2\u4E3B\u3001\u53CD\u4E3B\u6216\u81EA\u4FDD");
          const error2 = E.bidError(g.hands[player], data.choice, g.level, g.currentBid, player);
          check(!error2, error2);
          (g.declared || (g.declared = [false, false, false, false]))[player] = true;
          g.currentBid = { ...E.declaration(g.hands[player], data.choice, g.level), player };
          g.trump = g.currentBid.trump;
          if (g.phase === "bidding") {
            g.deadline = now + 8e3;
            if (g.currentBid.strength === 4) finishBid(room, now);
          }
          return;
        }
        check(type === "bury" && g.phase === "bury" || type === "play" && g.phase === "playing", "\u5F53\u524D\u9636\u6BB5\u4E0D\u80FD\u6267\u884C\u6B64\u64CD\u4F5C");
        check(g.turn === player, "\u5C1A\u672A\u8F6E\u5230\u4F60");
        check(Array.isArray(data.cards) && data.cards.length > 0 && data.cards.length <= 33 && data.cards.every((x) => typeof x === "string"), "\u9009\u724C\u683C\u5F0F\u9519\u8BEF");
        const ids = new Set(data.cards);
        check(ids.size === data.cards.length, "\u4E0D\u80FD\u91CD\u590D\u9009\u62E9\u540C\u4E00\u5F20\u724C");
        const cards = E.sort(g.hands[player], g).filter((c) => ids.has(c.id));
        check(cards.length === ids.size, "\u4E0D\u80FD\u4F7F\u7528\u4E0D\u5728\u624B\u4E2D\u7684\u724C");
        if (type === "bury") {
          check(cards.length === 8, "\u5FC5\u987B\u57CB 8 \u5F20\u5E95\u724C");
          g.bottom = cards;
          remove(g, player, cards);
          g.phase = "playing";
          deadline(g, now);
          g.message = "\u5E84\u5BB6\u9886\u51FA";
          return;
        }
        const error = E.legal(g.hands[player], cards, g.plays[0]?.cards, g);
        check(!error, error);
        if (!g.plays.length && E.shape(cards, g)?.type === "throw") {
          const attempt = E.checkThrow(cards, g.hands, player, g);
          if (!attempt.ok) {
            g.phase = "throwing";
            g.plays = [{ player, cards }];
            remove(g, player, cards);
            g.pending = { player, cards: attempt.cards };
            g.deadline = now + 1200;
            g.message = "\u7529\u724C\u6838\u9A8C\u4E2D";
            return;
          }
        }
        commit(g, player, cards, now);
      }
      function tick(room, now) {
        const g = room.game;
        if (!g || g.phase === "over" || now < g.deadline) return false;
        if (g.phase === "dealing") {
          const p = (g.dealer + 3 * g.dealIndex) % 4;
          g.hands[p].push(g.deck[g.dealIndex++]);
          g.deadline = now + 100;
          if (g.dealIndex === 100) {
            g.deck = [];
            g.phase = "bidding";
            g.deadline = now + 8e3;
            if (g.currentBid?.strength === 4) finishBid(room, now);
          }
          return true;
        }
        if (g.phase === "bidding") {
          finishBid(room, now);
          return true;
        }
        if (g.phase === "bury") {
          const cards = [...g.hands[g.dealer]].sort((a, b) => E.points([a]) - E.points([b]) || E.rank(a, g) - E.rank(b, g)).slice(0, 8);
          act(room, g.dealer, "bury", { cards: cards.map((c) => c.id) }, now);
          return true;
        }
        if (g.phase === "throwing") {
          const pending = g.pending;
          g.hands[pending.player].push(...g.plays[0].cards);
          g.plays = [];
          g.phase = "playing";
          delete g.pending;
          commit(g, pending.player, pending.cards, now);
          g.message = "\u7529\u724C\u5931\u8D25\uFF0C\u591A\u4F59\u624B\u724C\u5DF2\u9000\u56DE";
          return true;
        }
        if (g.phase === "playing") {
          const cards = E.choose(g.hands[g.turn], g.plays, g, g.turn);
          act(room, g.turn, "play", { cards: cards.map((c) => c.id) }, now);
          return true;
        }
        const winner = E.winner(g.plays, g);
        g.lastTrick = JSON.parse(JSON.stringify(g.plays));
        if (g.hands.every((h) => h.length === 0)) {
          if (winner % 2 !== g.dealer % 2) g.score += E.points(g.bottom) * E.bottomMultiplier(g.plays[0].cards, g);
          const result = E.settle(g.score), team = result.defend ? g.dealer % 2 : 1 - g.dealer % 2;
          room.levels[team] = Math.min(14, room.levels[team] + result.steps);
          room.dealer = (g.dealer + (result.defend ? 2 : 3)) % 4;
          g.matchOver = g.level === 14 || !!(room.settings?.maxRounds && room.round >= room.settings.maxRounds);
          g.phase = "over";
          g.message = g.matchOver ? `\u6574\u573A\u7ED3\u675F\uFF0C\u51C6\u5907\u540E\u53CC\u65B9\u4ECE ${E.label(room.settings?.startLevel || 2)} \u5F00\u59CB` : `\u672C\u5C40\u7ED3\u675F\uFF0C\u83B7\u80DC\u65B9\u5347 ${result.steps} \u7EA7`;
          return true;
        }
        g.trick++;
        g.turn = winner;
        g.plays = [];
        g.phase = "playing";
        deadline(g, now);
        return true;
      }
      function view(room, user, connected) {
        const seat = room.members.findIndex((m) => m.id === user);
        check(seat >= 0, "\u4F60\u4E0D\u5728\u6B64\u623F\u95F4");
        const g = room.game;
        return { settings: room.settings || { startLevel: 2, turnSeconds: 30, maxRounds: 0 }, code: room.code, revision: room.revision, seat, levels: room.levels, round: room.round, members: room.members.map((m) => ({ name: m.name, avatar: m.avatar || 0, ready: m.ready, online: connected.has(m.id) })), game: g ? {
          phase: g.phase,
          level: g.level,
          trump: g.trump,
          dealer: g.dealer,
          turn: g.turn,
          hand: E.sort(g.hands[seat], g),
          counts: g.hands.map((h) => h.length),
          bottom: g.phase === "over" || g.dealer === seat ? g.phase === "dealing" || g.phase === "bidding" ? [] : g.bottom : [],
          declared: g.declared || [false, false, false, false],
          passed: g.passed || [false, false, false, false],
          plays: g.plays,
          lastTrick: g.lastTrick,
          publicCards: g.publicCards,
          voids: g.voids,
          currentBid: g.currentBid,
          score: g.score,
          trick: g.trick,
          deadline: g.deadline,
          message: g.message,
          matchOver: g.matchOver
        } : null };
      }
    }
  });

  // minigame/session.js
  var require_session = __commonJS({
    "minigame/session.js"(exports, module) {
      "use strict";
      var P = require_platform();
      var authority = require_authority();
      var E = authority.E;
      var clone = (x) => JSON.parse(JSON.stringify(x));
      var Session = class {
        constructor(change, error) {
          this.change = change;
          this.error = error;
          this.online = false;
          this.active = true;
          this.pending = /* @__PURE__ */ new Map();
          this.offset = 0;
          this.sequence = 0;
          this.botAt = 0;
          this.timer = setInterval(() => this.update(), 60);
        }
        solo(settings, profile, testDeal) {
          this.disconnect();
          this.online = false;
          this.local = { code: "\u5355\u673A\u7EC3\u4E60", revision: 0, members: ["\u4F60", "\u897F\u5C71", "\u5317\u98CE", "\u4E1C\u7BF1"].map((name, i) => ({ id: String(i), name: i === 0 ? profile.name : name, avatar: i === 0 ? profile.avatar : i, ready: false })), settings, levels: [settings.startLevel, settings.startLevel], dealer: 0, round: 1, game: null, updatedAt: Date.now() };
          this.testDeal = testDeal;
          this.startSolo();
        }
        startSolo() {
          authority.start(this.local, Date.now());
          if (this.testDeal) {
            const g = this.local.game, deck = [...g.deck, ...g.bottom], s = "S", ranks = Array.from({ length: 13 }, (_, i) => i + 2).filter((r) => r !== g.level), wanted = deck.filter((c) => c.s === s && ranks.slice(0, 2).includes(c.r)).concat(deck.find((c) => c.s === "J" && c.r === 16));
            let remaining = deck.filter((c) => !wanted.some((w) => w.id === c.id)), j = 0, k = 0;
            for (let i = 0; i < 100; i++) {
              const p = (g.dealer + 3 * i) % 4;
              g.deck[i] = p === 0 && j < wanted.length ? wanted[j++] : remaining[k++];
            }
            g.bottom = remaining.slice(k);
          }
          this.publish();
        }
        publish() {
          const next = authority.view(this.local, "0", /* @__PURE__ */ new Set(["0", "1", "2", "3"]));
          this.receive(clone(next));
        }
        receive(next) {
          const old = this.room;
          this.room = next;
          this.change(next, old);
        }
        update() {
          if (!this.active || this.online || !this.local) return;
          const g = this.local.game, now = Date.now();
          if (["dealing", "bidding"].includes(g.phase) && now > this.botAt) {
            this.botAt = now + 1800;
            for (const p of [3, 2, 1]) {
              if (g.passed?.[p]) continue;
              const options = E.bidOptions(g.hands[p], g.level, g.currentBid, p);
              if (options.length && Math.random() < 0.45) {
                authority.act(this.local, p, "bid", { choice: options[0].choice }, now);
                this.publish();
                break;
              }
            }
          }
          if (g.phase === "playing" && g.turn !== 0 && g.deadline - now > 800) g.deadline = now + 800;
          if (g.phase === "bury" && g.turn !== 0 && g.deadline - now > 900) g.deadline = now + 900;
          if (this.replayUntil && now < this.replayUntil) {
            g.deadline += 60;
            return;
          }
          if (authority.tick(this.local, now)) this.publish();
        }
        command(type, data = {}) {
          if (!this.online) {
            try {
              if (type === "ready") {
                this.startSolo();
                return;
              }
              authority.act(this.local, 0, type, data, Date.now());
              this.publish();
            } catch (e) {
              this.error(e.message);
            }
            return;
          }
          if (!this.authenticated) {
            this.error("\u6B63\u5728\u6062\u590D\u8FDE\u63A5\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
            return;
          }
          const message = { type, id: Date.now().toString(36) + "-" + (++this.sequence).toString(36), revision: this.room?.revision, ...data };
          this.pending.set(message.id, message);
          this.socket.send({ data: JSON.stringify(message) });
        }
        async connect(base, profile, action) {
          this.disconnect();
          this.online = true;
          this.base = base.replace(/\/$/, "");
          this.action = action;
          this.stopped = false;
          let identities = P.read("identities", {});
          this.identity = identities[this.base];
          if (!this.identity) {
            this.identity = await P.request(this.base, "/api/session", "POST", { name: profile.name });
            identities[this.base] = this.identity;
            P.write("identities", identities);
          }
          this.open();
        }
        open() {
          if (this.stopped) return;
          const socket = this.socket = wx.connectSocket({ url: this.base.replace(/^http/, "ws") + "/ws" });
          socket.onOpen(() => socket.send({ data: JSON.stringify({ type: "auth", token: this.identity.token }) }));
          socket.onMessage(({ data }) => {
            let m;
            try {
              m = JSON.parse(data);
            } catch {
              return;
            }
            if (m.type === "authenticated") {
              this.authenticated = true;
              for (const value of this.pending.values()) socket.send({ data: JSON.stringify(value) });
              if (!m.roomCode && this.action) {
                const action = this.action;
                this.action = null;
                this.command(action.type, action.data);
              }
            }
            if (m.type === "snapshot") {
              this.offset = m.serverTime - Date.now();
              this.receive(m.room);
            }
            if (m.type === "ack") this.pending.delete(m.id);
            if (m.type === "left") {
              this.room = null;
              this.change(null, null);
            }
            if (m.type === "error") {
              this.pending.delete(m.id);
              this.error(m.message);
              if (!this.authenticated) {
                this.stopped = true;
                const all = P.read("identities", {});
                delete all[this.base];
                P.write("identities", all);
                socket.close();
              }
            }
          });
          socket.onError(() => this.error("\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u5730\u5740\u548C\u5F00\u53D1\u5DE5\u5177\u57DF\u540D\u8BBE\u7F6E"));
          socket.onClose((e) => {
            this.authenticated = false;
            if (this.stopped) return;
            if (e.code === 4001) {
              this.stopped = true;
              this.error("\u5F53\u524D\u8D26\u53F7\u5DF2\u5728\u5176\u4ED6\u9875\u9762\u8FDE\u63A5");
              return;
            }
            this.retry = setTimeout(() => this.open(), 1500);
          });
        }
        disconnect() {
          this.stopped = true;
          clearTimeout(this.retry);
          this.socket?.close();
          this.socket = null;
          this.authenticated = false;
          this.pending.clear();
          this.room = null;
          this.local = null;
        }
        pause() {
          this.active = false;
          this.pausedAt = Date.now();
        }
        resume() {
          if (this.local?.game) this.local.game.deadline += Date.now() - (this.pausedAt || Date.now());
          this.active = true;
        }
        destroy() {
          this.disconnect();
          clearInterval(this.timer);
        }
      };
      module.exports = { Session, E };
    }
  });

  // artifacts/minigame-build/voice-map.js
  var require_voice_map = __commonJS({
    "artifacts/minigame-build/voice-map.js"(exports, module) {
      module.exports = { "female": { "\u4EAE\u4E3B": "sound/female/bid.mp3", "\u81EA\u4FDD": "sound/female/reinforce.mp3", "\u53CD\u4E3B": "sound/female/counter.mp3", "\u5927\u738B\u65E0\u4E3B": "sound/female/big-joker-nt.mp3", "\u5C0F\u738B\u65E0\u4E3B": "sound/female/small-joker-nt.mp3", "\u4E8C": "sound/female/single-2.mp3", "\u4E09": "sound/female/single-3.mp3", "\u56DB": "sound/female/single-4.mp3", "\u4E94": "sound/female/single-5.mp3", "\u516D": "sound/female/single-6.mp3", "\u4E03": "sound/female/single-7.mp3", "\u516B": "sound/female/single-8.mp3", "\u4E5D": "sound/female/single-9.mp3", "\u5341": "sound/female/single-10.mp3", "\u52FE": "sound/female/single-11.mp3", "\u5708": "sound/female/single-12.mp3", "K": "sound/female/single-13.mp3", "\u5C16": "sound/female/single-14.mp3", "\u5C0F\u738B": "sound/female/single-15.mp3", "\u5927\u738B": "sound/female/single-16.mp3", "\u5BF9\u4E8C": "sound/female/pair-2.mp3", "\u5BF9\u4E09": "sound/female/pair-3.mp3", "\u5BF9\u56DB": "sound/female/pair-4.mp3", "\u5BF9\u4E94": "sound/female/pair-5.mp3", "\u5BF9\u516D": "sound/female/pair-6.mp3", "\u5BF9\u4E03": "sound/female/pair-7.mp3", "\u5BF9\u516B": "sound/female/pair-8.mp3", "\u5BF9\u4E5D": "sound/female/pair-9.mp3", "\u5BF9\u5341": "sound/female/pair-10.mp3", "\u5BF9\u52FE": "sound/female/pair-11.mp3", "\u5BF9\u5708": "sound/female/pair-12.mp3", "\u5BF9K": "sound/female/pair-13.mp3", "\u5BF9\u5C16": "sound/female/pair-14.mp3", "\u5BF9\u5C0F\u738B": "sound/female/pair-15.mp3", "\u5BF9\u5927\u738B": "sound/female/pair-16.mp3", "\u8C03\u4E3B": "sound/female/trump-lead.mp3", "\u62D6\u62C9\u673A": "sound/female/tractor.mp3", "\u5927\u4F60": "sound/female/beat.mp3", "\u8DDF\u724C": "sound/female/follow.mp3", "\u6BD9\u4E86": "sound/female/cut.mp3", "\u76D6\u6BD9": "sound/female/overcut.mp3", "\u7529\u724C": "sound/female/throw.mp3", "\u8FB9\u4E09\u8F6E": "sound/female/pair-and-single.mp3", "\u7529\u4E09\u5F20": "sound/female/throw-3.mp3", "\u7529\u56DB\u5F20": "sound/female/throw-4.mp3", "\u7529\u4E94\u5F20": "sound/female/throw-5.mp3", "\u7529\u516D\u5F20": "sound/female/throw-6.mp3", "\u7529\u4E03\u5F20": "sound/female/throw-7.mp3", "\u7529\u516B\u5F20": "sound/female/throw-8.mp3", "\u7529\u4E5D\u5F20": "sound/female/throw-9.mp3", "\u7529\u5341\u5F20": "sound/female/throw-10.mp3", "\u8D85\u7EA7\u7529\u724C": "sound/female/super-throw.mp3" }, "male": { "\u4EAE\u4E3B": "sound/male/bid.mp3", "\u81EA\u4FDD": "sound/male/reinforce.mp3", "\u53CD\u4E3B": "sound/male/counter.mp3", "\u5927\u738B\u65E0\u4E3B": "sound/male/big-joker-nt.mp3", "\u5C0F\u738B\u65E0\u4E3B": "sound/male/small-joker-nt.mp3", "\u4E8C": "sound/male/single-2.mp3", "\u4E09": "sound/male/single-3.mp3", "\u56DB": "sound/male/single-4.mp3", "\u4E94": "sound/male/single-5.mp3", "\u516D": "sound/male/single-6.mp3", "\u4E03": "sound/male/single-7.mp3", "\u516B": "sound/male/single-8.mp3", "\u4E5D": "sound/male/single-9.mp3", "\u5341": "sound/male/single-10.mp3", "\u52FE": "sound/male/single-11.mp3", "\u5708": "sound/male/single-12.mp3", "K": "sound/male/single-13.mp3", "\u5C16": "sound/male/single-14.mp3", "\u5C0F\u738B": "sound/male/single-15.mp3", "\u5927\u738B": "sound/male/single-16.mp3", "\u5BF9\u4E8C": "sound/male/pair-2.mp3", "\u5BF9\u4E09": "sound/male/pair-3.mp3", "\u5BF9\u56DB": "sound/male/pair-4.mp3", "\u5BF9\u4E94": "sound/male/pair-5.mp3", "\u5BF9\u516D": "sound/male/pair-6.mp3", "\u5BF9\u4E03": "sound/male/pair-7.mp3", "\u5BF9\u516B": "sound/male/pair-8.mp3", "\u5BF9\u4E5D": "sound/male/pair-9.mp3", "\u5BF9\u5341": "sound/male/pair-10.mp3", "\u5BF9\u52FE": "sound/male/pair-11.mp3", "\u5BF9\u5708": "sound/male/pair-12.mp3", "\u5BF9K": "sound/male/pair-13.mp3", "\u5BF9\u5C16": "sound/male/pair-14.mp3", "\u5BF9\u5C0F\u738B": "sound/male/pair-15.mp3", "\u5BF9\u5927\u738B": "sound/male/pair-16.mp3", "\u8C03\u4E3B": "sound/male/trump-lead.mp3", "\u62D6\u62C9\u673A": "sound/male/tractor.mp3", "\u5927\u4F60": "sound/male/beat.mp3", "\u8DDF\u724C": "sound/male/follow.mp3", "\u6BD9\u4E86": "sound/male/cut.mp3", "\u76D6\u6BD9": "sound/male/overcut.mp3", "\u7529\u724C": "sound/male/throw.mp3", "\u8FB9\u4E09\u8F6E": "sound/male/pair-and-single.mp3", "\u7529\u4E09\u5F20": "sound/male/throw-3.mp3", "\u7529\u56DB\u5F20": "sound/male/throw-4.mp3", "\u7529\u4E94\u5F20": "sound/male/throw-5.mp3", "\u7529\u516D\u5F20": "sound/male/throw-6.mp3", "\u7529\u4E03\u5F20": "sound/male/throw-7.mp3", "\u7529\u516B\u5F20": "sound/male/throw-8.mp3", "\u7529\u4E5D\u5F20": "sound/male/throw-9.mp3", "\u7529\u5341\u5F20": "sound/male/throw-10.mp3", "\u8D85\u7EA7\u7529\u724C": "sound/male/super-throw.mp3" }, "scores": { "\u783480": "sound/score-80.mp3", "\u7834120": "sound/score-120.mp3", "\u7834160": "sound/score-160.mp3" } };
    }
  });

  // minigame/audio.js
  var require_audio = __commonJS({
    "minigame/audio.js"(exports, module) {
      "use strict";
      var P = require_platform();
      var voice = require_voice_map();
      var Sound = class {
        constructor(settings) {
          this.settings = settings;
          this.queue = [];
          this.loaded = false;
          this.generation = 0;
        }
        unlock() {
          if (this.loaded) {
            this.music();
            return;
          }
          if (this.loading) return;
          this.loading = true;
          wx.loadSubpackage({ name: "sound", success: () => {
            this.loaded = true;
            this.loading = false;
            this.music();
          }, fail: () => {
            this.loading = false;
          } });
        }
        music() {
          if (!this.loaded) return;
          if (!this.bgm) {
            this.bgm = wx.createInnerAudioContext();
            this.bgm.src = "sound/music.mp3";
            this.bgm.loop = true;
          }
          this.bgm.volume = this.settings.volume || 0.22;
          if (this.settings.music) this.bgm.play();
          else this.bgm.pause();
        }
        effect(name) {
          if (!this.loaded || !this.settings.effects) return;
          const a = wx.createInnerAudioContext();
          a.src = "sound/" + name + ".wav";
          const stop = () => a.destroy();
          a.onEnded(stop);
          a.onError(stop);
          a.play();
        }
        say(text) {
          if (!this.loaded || !this.settings.speech) return;
          const key = text.replace(/[！!。～~\s]/g, ""), file = voice[this.settings.voice || "female"][key] || voice.scores[key];
          if (!file) return;
          if (this.queue.length > 4) this.queue.shift();
          this.queue.push(file);
          this.next();
        }
        next() {
          if (this.current || !this.queue.length) return;
          const a = this.current = wx.createInnerAudioContext();
          a.src = this.queue.shift();
          a.volume = 0.9;
          const done = () => {
            if (this.current !== a) return;
            a.destroy();
            this.current = null;
            this.next();
          };
          a.onEnded(done);
          a.onError(done);
          a.play();
        }
        reset() {
          this.queue = [];
          if (this.current) {
            this.current.destroy();
            this.current = null;
          }
          this.bgm?.pause();
        }
      };
      module.exports = Sound;
    }
  });

  // artifacts/minigame-build/callouts.js
  var require_callouts = __commonJS({
    "artifacts/minigame-build/callouts.js"(exports, module) {
      var Tractor = require_engine();
      var number = (n) => n < 10 ? ["\u96F6", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"][n] : n === 10 ? "\u5341" : n < 20 ? "\u5341" + number(n % 10) : number(Math.floor(n / 10)) + "\u5341" + (n % 10 ? number(n % 10) : "");
      var rank = (r) => ({ 11: "\u52FE", 12: "\u5708", 13: "K", 14: "\u5C16", 15: "\u5C0F\u738B", 16: "\u5927\u738B" })[r] || number(r);
      function announcement(cards, plays, state, player) {
        const shape = Tractor.shape(cards, state);
        if (shape?.type === "tractor") return "\u62D6\u62C9\u673A";
        if (!plays.length && shape?.type === "throw") {
          if (cards.length > 10) return "\u8D85\u7EA7\u7529\u724C";
          if (cards.length === 3 && Tractor.pairs(cards, state).length === 1) return "\u8FB9\u4E09\u8F6E";
          return cards.length >= 3 ? "\u7529" + number(cards.length) + "\u5F20" : "\u7529\u724C";
        }
        if (!plays.length && shape?.cat === "T") return "\u8C03\u4E3B";
        if (plays.length && Tractor.category(plays[0].cards[0], state) === "T" && cards.every((c) => Tractor.category(c, state) !== "T")) return "\u8DDF\u724C";
        if (plays.length && Tractor.category(plays[0].cards[0], state) !== "T" && shape?.cat === "T" && Tractor.winner([...plays, { player, cards }], state) === player) {
          const previous = plays.find((p) => p.player === Tractor.winner(plays, state));
          return Tractor.category(previous.cards[0], state) === "T" ? "\u76D6\u6BD9\uFF01" : "\u6BD9\u4E86\uFF01";
        }
        if (plays.length && Tractor.category(plays[0].cards[0], state) === "T") return Tractor.winner([...plays, { player, cards }], state) === player ? "\u5927\u4F60" : "\u8DDF\u724C";
        if (shape?.type === "pair") return "\u5BF9" + rank(cards[0].r);
        if (cards.length === 1) return rank(cards[0].r);
        if (plays.length) return Tractor.winner([...plays, { player, cards }], state) === player ? "\u5927\u4F60" : "\u8DDF\u724C";
        return "\u7529" + number(cards.length) + "\u5F20";
      }
      function bidAnnouncement(bid, previous) {
        if (bid.trump === "NT") return bid.strength === 4 ? "\u5927\u738B\u65E0\u4E3B" : "\u5C0F\u738B\u65E0\u4E3B";
        if (previous && previous.player === bid.player && previous.strength === 1 && bid.strength === 2 && previous.trump === bid.trump) return "\u81EA\u4FDD";
        return previous && previous.player !== bid.player ? "\u53CD\u4E3B\uFF5E" : "\u4EAE\u4E3B\uFF01";
      }
      module.exports = { announcement, bidAnnouncement };
    }
  });

  // minigame/config.json
  var require_config = __commonJS({
    "minigame/config.json"(exports, module) {
      module.exports = {
        server: "http://127.0.0.1:4173"
      };
    }
  });

  // minigame/main.js
  var require_main = __commonJS({
    "minigame/main.js"(exports, module) {
      var P = require_platform();
      var { Session, E } = require_session();
      var Sound = require_audio();
      var callouts = require_callouts();
      var config = require_config();
      var defaults = { pair: true, throw: true, void: true, test: true, music: true, effects: true, speech: true, voice: "female", volume: 0.22 };
      var Game = class {
        constructor() {
          this.canvas = wx.createCanvas();
          this.ctx = this.canvas.getContext("2d");
          this.images = {};
          this.hits = [];
          this.cards = [];
          this.selected = /* @__PURE__ */ new Set();
          this.screen = "lobby";
          this.settings = { ...defaults, ...P.read("settings", {}) };
          this.profile = P.read("profile", { name: "\u65B0\u724C\u53CB", avatar: 0, bio: "" });
          this.rules = P.read("rules", { startLevel: 2, turnSeconds: 30, maxRounds: 0 });
          this.base = P.read("server", config.server);
          this.sound = new Sound(this.settings);
          this.session = new Session((r, o) => this.receive(r, o), P.toast);
          this.resize();
          wx.onWindowResize(() => this.resize());
          wx.onTouchStart((e) => this.down(e));
          wx.onTouchMove((e) => this.move(e));
          wx.onTouchEnd((e) => this.up(e));
          wx.onTouchCancel(() => this.gesture = null);
          wx.onHide(() => {
            this.sound.reset();
            this.session.pause();
            this.hidden = true;
          });
          wx.onShow(() => {
            this.session.resume();
            this.hidden = false;
            this.sound.music();
          });
          this.loop = setInterval(() => {
            if (!this.hidden) this.draw();
          }, 33);
          this.draw();
        }
        resize() {
          const s = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          this.pw = s.windowWidth;
          this.ph = s.windowHeight;
          const ratio = Math.min(2, s.pixelRatio || 1);
          this.canvas.width = this.pw * ratio;
          this.canvas.height = this.ph * ratio;
          const safe = s.safeArea;
          this.insetX = safe ? Math.max(0, safe.left, this.pw - safe.right) : 0;
          this.insetY = safe ? Math.max(0, safe.top) : 0;
          this.insetBottom = safe ? Math.max(0, this.ph - safe.bottom) : 0;
          const vw = Math.max(1, this.pw - 2 * this.insetX), vh = Math.max(1, this.ph - this.insetY - this.insetBottom);
          this.w = Math.max(1440, 840 * vw / vh);
          this.h = this.w * vh / vw;
          this.scale = vw / this.w;
          this.pixel = ratio;
        }
        image(path) {
          if (!this.images[path]) {
            const im = wx.createImage();
            im.ready = false;
            im.onload = () => im.ready = true;
            im.src = path;
            this.images[path] = im;
          }
          return this.images[path];
        }
        text(t, x, y, size = 22, color = "#f4edce", align = "left") {
          const c = this.ctx;
          c.font = `${size}px sans-serif`;
          c.fillStyle = color;
          c.textAlign = align;
          c.textBaseline = "middle";
          c.fillText(String(t), x, y);
        }
        rect(x, y, w, h, color = "#204b38", radius = 12) {
          const c = this.ctx;
          c.fillStyle = color;
          c.beginPath();
          c.moveTo(x + radius, y);
          c.arcTo(x + w, y, x + w, y + h, radius);
          c.arcTo(x + w, y + h, x, y + h, radius);
          c.arcTo(x, y + h, x, y, radius);
          c.arcTo(x, y, x + w, y, radius);
          c.fill();
        }
        button(text, x, y, w, h, fn, gold = false, disabled = false) {
          this.rect(x, y, w, h, disabled ? "#526b57" : gold ? "#e8c977" : "#285d43");
          this.text(text, x + w / 2, y + h / 2, 22, disabled ? "#b8c5b1" : gold ? "#345033" : "#f8ebbd", "center");
          if (!disabled) this.hits.push({ x, y, w, h, fn });
        }
        avatar(index, x, y, size = 76) {
          this.rect(x - 3, y - 3, size + 6, size + 6, "#d1d9a7", 15);
          const im = this.image("assets/avatars.jpg");
          if (im.ready) this.ctx.drawImage(im, index % 2 * im.width / 2, Math.floor(index / 2) * im.height / 2, im.width / 2, im.height / 2, x, y, size, size);
        }
        card(card, x, y, width = 88, options = {}) {
          const c = this.ctx, height = width * 1.5;
          c.save();
          if (options.reveal != null) {
            const p = Math.min(1, Math.max(0, options.reveal));
            c.globalAlpha = p;
            x += (1 - p) * width / 2;
            y += (1 - p) * 20;
            width *= Math.max(0.03, p);
          }
          this.rect(x, y, width, height, "#fffdf7", Math.min(6, width / 2));
          c.save();
          c.clip();
          const im = this.image("assets/cards/" + card.s + card.r + ".jpg");
          if (im.ready) c.drawImage(im, x, y, width, height);
          else {
            this.text(E.label(card.r), x + 5, y + 23, 27, ["H", "D"].includes(card.s) ? "#b93432" : "#21372a");
            this.text(E.symbol[card.s], x + 5, y + 49, 25, ["H", "D"].includes(card.s) ? "#b93432" : "#21372a");
          }
          c.restore();
          if (options.dim) {
            this.rect(x, y, width, height, "rgba(95,95,95,.7)", Math.min(6, width / 2));
          }
          c.strokeStyle = options.winner ? "#eec85b" : "#a6b49e";
          c.lineWidth = options.winner ? 3 : 1;
          c.stroke();
          if (options.stars) this.text("\u2605".repeat(options.stars), x + 4, y + height - 13, 14, "#d9a326");
          if (options.mark) this.text(options.mark, x + 4, y + height - 32, 14, options.mark === "\u7529" ? "#287ed0" : "#3a8461");
          if (options.bottom) {
            this.rect(x + 2, y + height - 57, 24, 22, "#f4ce68", 4);
            this.text("\u5E95", x + 14, y + height - 46, 17, "#69431b", "center");
          }
          if (options.selected) {
            c.strokeStyle = "#ffda71";
            c.lineWidth = 2;
            c.strokeRect(x + 1, y + 1, width - 2, height - 2);
          }
          c.restore();
        }
        cardsRow(cards, cx, y, maxWidth = 460, options = {}) {
          if (!cards.length) return;
          const width = options.width || 104, step = options.spread ? width + 12 : Math.min(34, (maxWidth - width) / Math.max(1, cards.length - 1)), start = cx - (width + step * (cards.length - 1)) / 2;
          cards.forEach((card, i) => this.card(card, start + i * step, y, width, { ...options, stars: options.stars ?? (this.room?.game ? E.stars(card, this.room.game) : 0), reveal: options.revealAt == null ? void 0 : (Date.now() - options.revealAt - i * 65) / 420 }));
          if (options.winner) {
            const label = options.winnerLabel || "\u5F53\u524D\u6700\u5927", right = start + width + step * (cards.length - 1);
            this.ctx.font = "20px sans-serif";
            if (options.winnerBelow) {
              const letters = [...label], badgeHeight = letters.length * 23 + 10, badgeY = y + width * 1.5 - badgeHeight;
              this.rect(right - 2, badgeY, 32, badgeHeight, "#eec85b", 6);
              letters.forEach((letter, i) => this.text(letter, right + 14, badgeY + 17 + i * 23, 20, "#fff", "center"));
            } else {
              const badgeWidth = this.ctx.measureText(label).width + 20;
              this.rect(right - badgeWidth, y - 28, badgeWidth, 30, "#eec85b", 6);
              this.text(label, right - 10, y - 13, 20, "#fff", "right");
            }
          }
        }
        header(title, back) {
          const left = -this.insetX / this.scale, top = -this.insetY / this.scale, right = this.w + this.insetX / this.scale;
          this.button("", left + 12, top + 8, 68, 60, back);
          this.text("\u2039", left + 46, top + 35, 49, "#fff0bb", "center");
          this.text(title, left + 94, top + 36, 23, "#fff0bb");
          let y = top + 12;
          try {
            const capsule = wx.getMenuButtonBoundingClientRect?.();
            if (capsule && capsule.width > 0 && capsule.bottom > 0) y = (capsule.bottom + 8 - this.insetY) / this.scale;
            else y = top + 88;
          } catch {
            y = top + 88;
          }
          this.button("", right - 78, y, 56, 50, () => this.popup = "settings");
          this.text("\u2699", right - 50, y + 25, 34, "#fff0bb", "center");
        }
        receive(room, old) {
          this.room = room;
          if (!room) {
            this.screen = "lobby";
            return;
          }
          this.screen = "table";
          const g = room.game, prev = old?.game;
          if (!old || old.round !== room.round || prev?.phase === "over" && g?.phase === "dealing") {
            this.selected.clear();
            this.replayUntil = 0;
            this.showBottom = false;
          }
          if (g && prev) {
            if (JSON.stringify(g.currentBid) !== JSON.stringify(prev.currentBid) && g.currentBid) this.sound.say(callouts.bidAnnouncement(g.currentBid, prev.currentBid));
            if (g.plays.length > prev.plays.length) {
              const play = g.plays[g.plays.length - 1];
              this.sound.effect("play");
              this.sound.say(callouts.announcement(play.cards, g.plays.slice(0, -1), g, play.player));
            }
            for (const n of [80, 120, 160]) if (prev.score < n && g.score >= n) {
              this.sound.say("\u7834" + n);
              if (n === 80) this.scoreAt = Date.now();
            }
          }
          if (g?.phase === "over" && prev?.phase !== "over") this.resultAt = Date.now();
          if (g) {
            const ids = new Set(g.hand.map((c) => c.id));
            this.selected = new Set([...this.selected].filter((id) => ids.has(id)));
            this.forced = new Set(E.forcedCards(g.hand, this.lead(), g).map((c) => c.id));
            for (const id of this.forced) this.selected.add(id);
          }
        }
        lead() {
          const g = this.room?.game;
          return g?.phase === "playing" && !g.plays.some((p) => p.player === this.room.seat) ? g.plays[0]?.cards : null;
        }
        draw() {
          const c = this.ctx;
          c.setTransform(this.pixel, 0, 0, this.pixel, 0, 0);
          c.fillStyle = "#224f37";
          c.fillRect(0, 0, this.pw, this.ph);
          const bg = this.image("assets/garden.jpg");
          if (bg.ready) c.drawImage(bg, 0, 0, this.pw, this.ph);
          c.setTransform(this.pixel * this.scale, 0, 0, this.pixel * this.scale, this.pixel * this.insetX, this.pixel * this.insetY);
          this.hits = [];
          this.cards = [];
          if (this.screen === "table" && this.room) this.table();
          else if (this.screen === "friends") this.friends();
          else if (this.screen === "profile") this.profileView();
          else this.lobby();
          if (this.popup) this.modal();
          if (this.ph > this.pw) {
            this.rect(0, 0, this.w, this.h, "#173c30", 0);
            this.text("\u8BF7\u5C06\u8BBE\u5907\u8F6C\u4E3A\u6A2A\u5C4F", this.w / 2, this.h / 2, 38, "#ffe39c", "center");
            this.hits = [];
            this.cards = [];
          }
        }
        lobby() {
          this.avatar(this.profile.avatar, 12, 8, 122);
          this.text(this.profile.name, 154, 62, 28);
          this.hits.push({ x: 8, y: 4, w: 360, h: 132, fn: () => this.screen = "profile" });
          this.text("\u7545\u73A9\u5347\u7EA7", this.w - 320, 58, 34, "#f5dfa1");
          this.text("\u597D\u724C\uFF0C", 80, 280, 64);
          this.text("\u4E00\u8D77\u6253\u3002", 80, 362, 64);
          this.text("\u7ECF\u5178\u53CC\u5347 \xB7 \u5BF9\u5BB6\u540C\u5FC3", 80, 437, 25, "#c8d9b6");
          this.cardsRow([{ s: "S", r: 14 }, { s: "H", r: 14 }, { s: "J", r: 16 }], 235, 505, 260, { width: 110 });
          const x = this.w * 0.39, y = 210, cw = (this.w - x - 70) / 2;
          this.button("\u5355\u673A\u7EC3\u4E60", x, y, cw - 20, 250, () => this.solo(), true);
          this.button("\u597D\u53CB\u540C\u73A9", x + cw, y, cw - 20, 250, () => this.screen = "friends");
          this.button("\u52A0\u5165\u597D\u53CB\u623F", x, y + 280, cw * 2 - 20, 92, () => this.join());
          this.button("\u4E2A\u4EBA\u8D44\u6599", 45, this.h - 78, 150, 48, () => this.screen = "profile");
          this.button("\u5BF9\u5C40\u6218\u7EE9", 215, this.h - 78, 150, 48, () => this.history());
          this.button("\u6E38\u620F\u89C4\u5219", 385, this.h - 78, 150, 48, () => this.popup = "rules");
          this.button("\u5FEB\u901F\u5F00\u59CB", this.w - 280, this.h - 83, 235, 60, () => this.solo(), true);
        }
        solo() {
          this.selected.clear();
          this.session.solo({ ...this.rules, maxRounds: 0 }, this.profile, this.settings.test);
          this.popup = null;
        }
        friends() {
          this.header("\u597D\u53CB\u540C\u73A9", () => this.screen = "lobby");
          this.rect(40, 108, 220, this.h - 160, "#204b38bb");
          this.text("\u7ECF\u5178\u53CC\u5347", 150, 162, 30, "#ffdf92", "center");
          this.text("\u56DB\u4EBA \xB7 \u4E24\u526F\u724C", 150, 220, 22, "#d1dfb9", "center");
          const x = 300, w = this.w - 345;
          this.rect(x, 108, w, this.h - 160, "#f4efd8");
          this.text("\u597D\u53CB\u623F\u8BBE\u7F6E", x + 35, 157, 32, "#30533a");
          this.option("\u6E38\u620F\u5C40\u6570", [["\u6253\u5230A", 0], ["4\u5C40", 4], ["8\u5C40", 8], ["20\u5C40", 20]], "maxRounds", x + 35, 223);
          this.text("\u8D77\u59CB\u7EA7\u724C", x + 35, 330, 25, "#35563b");
          this.button("\u2039", x + 210, 306, 65, 48, () => this.rule("startLevel", this.rules.startLevel === 2 ? 14 : this.rules.startLevel - 1));
          this.text(E.label(this.rules.startLevel), x + 322, 331, 28, "#35563b", "center");
          this.button("\u203A", x + 368, 306, 65, 48, () => this.rule("startLevel", this.rules.startLevel === 14 ? 2 : this.rules.startLevel + 1));
          this.option("\u51FA\u724C\u65F6\u9650", [["15\u79D2", 15], ["30\u79D2", 30], ["60\u79D2", 60]], "turnSeconds", x + 35, 404);
          this.text("\u9996\u5C40\u62A2\u4E3B\u5750\u5E84 \xB7 80\u5206\u4E0A\u53F0 \xB7 \u9006\u65F6\u9488\u51FA\u724C \xB7 8\u5F20\u5E95\u724C", x + 35, 528, 22, "#607752");
          this.button("\u521B\u5EFA\u623F\u95F4", x + 90, this.h - 202, 220, 64, () => this.connect({ type: "create", data: { settings: this.rules } }), true);
          this.button("\u52A0\u5165\u623F\u95F4", x + 355, this.h - 202, 220, 64, () => this.join());
        }
        option(label, items, key, x, y) {
          this.text(label, x, y + 25, 25, "#35563b");
          items.forEach(([title, val], i) => this.button(title, x + 175 + i * 125, y, 112, 50, () => this.rule(key, val), this.rules[key] === val));
        }
        rule(key, value) {
          this.rules[key] = value;
          P.write("rules", this.rules);
        }
        async connect(action) {
          try {
            await this.session.connect(this.base, this.profile, action);
          } catch (e) {
            P.toast(e.message);
          }
        }
        async join() {
          const code = await P.input("\u8F93\u5165\u516D\u4F4D\u623F\u95F4\u53F7");
          if (code == null) return;
          if (!/^\d{6}$/.test(code)) return P.toast("\u8BF7\u8F93\u5165\u516D\u4F4D\u6570\u5B57\u623F\u95F4\u53F7");
          this.connect({ type: "join", data: { code } });
        }
        async home() {
          if (this.session.online) {
            if (this.room?.game && this.room.game.phase !== "over") {
              if (!await P.confirm("\u8FD4\u56DE\u5927\u5385", "\u724C\u5C40\u7EE7\u7EED\u8FDB\u884C\uFF0C\u8D85\u65F6\u5C06\u7531\u7CFB\u7EDF\u51FA\u724C\u3002\u53EF\u4ECE\u597D\u53CB\u540C\u73A9\u91CD\u65B0\u8FDE\u63A5\u3002")) return;
              this.session.disconnect();
            } else {
              this.session.command("leave");
              return;
            }
          } else if (this.room?.game?.phase !== "over" && !await P.confirm("\u8FD4\u56DE\u5927\u5385", "\u672C\u5C40\u5355\u673A\u8FDB\u5EA6\u5C06\u7ED3\u675F\u3002")) return;
          this.session.disconnect();
          this.room = null;
          this.screen = "lobby";
        }
        table() {
          const r = this.room, g = r.game, seat = r.seat;
          this.header("\u7545\u73A9\u5347\u7EA7 \xB7 " + (this.session.online ? "\u597D\u53CB\u623F " + r.code : "\u5355\u673A\u7EC3\u4E60"), () => this.home());
          this.ctx.save();
          this.ctx.translate(-12 - this.insetX / (2 * this.scale), 0);
          this.rect(24, 82, 280, 108, "rgba(18,63,49,.4)");
          this.text("\u6211\u65B9 " + E.label(r.levels[seat % 2]), 38, 106, 24);
          this.text("\u5BF9\u65B9 " + E.label(r.levels[1 - seat % 2]), 38, 141, 24);
          this.text("\u95F2\u5BB6\u6293\u5206", 246, 101, 17, "#e8edc9", "center");
          this.text(g?.score || 0, 246, 140, 33, "#ffe195", "center");
          const trump = g?.trump || g?.currentBid?.trump;
          if (trump) {
            const dealer = r.round === 1 && g.currentBid && ["dealing", "bidding"].includes(g.phase) ? g.currentBid.player : g.dealer, ty = dealer % 2 === seat % 2 ? 106 : 141;
            this.text(trump === "NT" ? "\u65E0\u4E3B" : E.symbol[trump], 166, ty, trump === "NT" ? 19 : 30, ["H", "D"].includes(trump) ? "#f36b65" : "#ffe195", "center");
          }
          this.text("\u7B2C " + r.round + " \u5C40  " + (g ? "\u7B2C " + g.trick + " \u8F6E" : ""), 38, 174, 17);
          this.text("\u684C\u9762 " + (g && g.phase !== "over" ? E.points(g.plays.flatMap((p) => p.cards)) : 0), 285, 174, 17, "#ffe195", "right");
          if (Date.now() - (this.scoreAt || 0) < 2200) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.min(1, (2200 - Date.now() + this.scoreAt) / 500);
            this.text("\u783480", 320, 119, 24, "#ffe095");
            this.ctx.restore();
          }
          this.ctx.restore();
          const pos = [[8, this.h - 170], [12, this.h * 0.29], [this.w / 2 - 61, 3 - this.insetY / this.scale], [this.w - 134, this.h * 0.29]];
          r.members.forEach((m, p) => {
            const rel = (p - seat + 4) % 4, [x, y] = pos[rel];
            this.avatar(m.avatar || 0, x, y, 122);
            this.text(m.name + (g?.dealer === p ? " \xB7 \u5E84" : ""), x + 61, y + 141, 20, "#fff0c5", "center");
            if (!g) this.text(m.ready ? "\u5DF2\u51C6\u5907" : "\u672A\u51C6\u5907", x + 61, y + 165, 18, "#e0e9c9", "center");
            if (g?.currentBid?.player === p && g.phase !== "over") {
              const bidding = ["dealing", "bidding"].includes(g.phase), bx = bidding ? rel === 2 ? x + 61 : rel === 0 ? this.w / 2 : rel === 3 ? x - 90 : x + 205 : x + 5 + (32 + Math.min(34, 32) * (g.currentBid.cards.length - 1)) / 2, by = bidding ? rel === 2 ? y + 158 : rel === 0 ? this.h - 495 : y + 4 : y + 69;
              this.cardsRow(g.currentBid.cards, bx, by, bidding ? 160 : 110, { width: bidding ? 104 : 32, stars: bidding ? void 0 : 0 });
            }
            if (g && p !== seat && this.settings.void && g.voids[p].length) {
              this.rect(rel === 3 ? x - 36 : x + 126, y - 2, 32, g.voids[p].length * 25 + 5, "rgba(255,248,220,.2)", 6);
              g.voids[p].forEach((s, i) => this.text(s === "T" ? "\u4E3B" : E.symbol[s], rel === 3 ? x - 8 : x + 130, y + 13 + i * 25, 22, s === "S" || s === "C" ? "#101613" : "#e52d35", rel === 3 ? "right" : "left"));
            }
          });
          if (!g) {
            this.text("\u9080\u8BF7\u597D\u53CB\u52A0\u5165\uFF0C\u56DB\u4EBA\u51C6\u5907\u540E\u5F00\u5C40", this.w / 2, this.h / 2, 30, "#ffe2a0", "center");
            this.button(r.members[seat]?.ready ? "\u5DF2\u51C6\u5907" : "\u51C6\u5907", this.w / 2 - 90, this.h / 2 + 55, 180, 58, () => this.session.command("ready"), true, r.members[seat]?.ready);
            this.button("\u590D\u5236\u623F\u95F4\u53F7", this.w - 210, 95, 180, 46, () => wx.setClipboardData({ data: r.code }));
            return;
          }
          if (g.phase === "over") {
            if (Date.now() - (this.resultAt || 0) < 2900) this.revealBottom();
            else this.settlement();
            return;
          }
          if (g.phase === "bury" && g.dealer === seat) {
            this.buryView();
            return;
          }
          const replay = Date.now() < (this.replayUntil || 0), plays = replay ? g.lastTrick : g.plays, winner = plays.length ? E.winner(plays, g) : null;
          for (const p of plays) {
            const rel = (p.player - seat + 4) % 4, width = rel % 2 ? 320 : 460, cx = rel === 1 ? 320 : rel === 3 ? this.w - 320 : this.w / 2, y = rel === 2 ? 210 : rel === 0 ? this.h - 450 : this.h * 0.33;
            this.cardsRow(p.cards, cx, y, width, { winner: p.player === winner, winnerBelow: rel === 0, winnerLabel: replay ? "\u4E0A\u8F6E\u6700\u5927" : "\u5F53\u524D\u6700\u5927" });
          }
          const auction = ["dealing", "bidding"].includes(g.phase);
          if (auction) {
            if (g.currentBid) {
              this.text(r.members[g.currentBid.player].name + " \xB7 " + (g.currentBid.trump === "NT" ? "\u65E0\u4E3B" : E.symbol[g.currentBid.trump] + "\u4E3B"), this.w / 2, this.h - 322, 22, "#ffe39e", "center");
            } else this.text("\u53D1\u724C\u4E2D \xB7 \u7EA7\u724C\u5230\u624B\u5373\u53EF\u4EAE\u4E3B", this.w / 2, this.h - 340, 25, "#ffe39e", "center");
            const options = g.passed?.[seat] ? [] : E.bidOptions(g.hand, g.level, g.currentBid, seat), groups = [...E.SUITS, "SJ", "BJ"], showPass = !g.declared?.[seat] && g.currentBid?.player !== seat, total = showPass ? 7 : 6;
            groups.forEach((s, i) => {
              const choice = options.find((o) => o.choice === (s.length === 1 ? s + "1" : s)) || options.find((o) => o.choice === s + "2"), count = g.hand.filter((c) => s.length === 1 ? c.s === s && c.r !== g.level : c.s === "J" && c.r === (s === "SJ" ? 15 : 16)).length;
              this.button((E.symbol[s] || (s === "SJ" ? "\u5C0F\u738B" : "\u5927\u738B")) + " " + count, this.w / 2 - (total * 90 - 10) / 2 + i * 90, this.h - 295, 80, 54, () => this.session.command("bid", { choice: choice.choice }), true, !choice);
            });
            if (showPass) this.button(g.passed?.[seat] ? "\u5DF2\u4E0D\u53EB" : "\u4E0D\u53EB", this.w / 2 - (total * 90 - 10) / 2 + 540, this.h - 295, 80, 54, () => this.session.command("pass"), false, g.passed?.[seat]);
          }
          const myTurn = g.turn === seat && !replay && ["playing", "bury"].includes(g.phase);
          if (myTurn) {
            this.button("\u63D0\u793A", this.w / 2 - 130, this.h - 290, 100, 48, () => this.hint());
            this.button(g.phase === "bury" ? "\u57CB\u5E95" : "\u51FA\u724C", this.w / 2 + 30, this.h - 290, 100, 48, () => this.play(), true);
          }
          if (!replay && (g.phase === "bidding" || ["playing", "bury"].includes(g.phase))) {
            const seconds = Math.max(0, Math.ceil((g.deadline - Date.now() - this.session.offset) / 1e3)), rel = (g.turn - seat + 4) % 4;
            let tx = this.w / 2, ty = g.phase === "bidding" ? this.h / 2 : this.h - 264;
            if (g.phase !== "bidding" && rel !== 0) {
              const [ax, ay] = pos[rel];
              tx = rel === 2 ? ax + 61 : rel === 3 ? ax - 72 : ax + 194;
              ty = rel === 2 ? ay + 183 : ay + 61;
            }
            this.rect(tx - 25, ty - 25, 50, 50, "#204b38cc", 25);
            this.text(seconds, tx, ty, 24, "#ffe19b", "center");
          }
          const chosen = g.hand.filter((c) => this.selected.has(c.id));
          if (g.phase === "bury" && g.dealer === seat) this.text("\u5DF2\u9009 " + chosen.length + " / 8 \u5F20\u5E95\u724C", this.w / 2, this.h - 215, 21, "#ffe39b", "center");
          else if (myTurn && g.plays.length && chosen.length && !E.legal(g.hand, chosen, this.lead(), g) && E.winner([...g.plays, { player: seat, cards: chosen }], g) === seat) this.text("\u60A8\u9009\u53D6\u7684\u724C\u5927\u4E8E\u5176\u4ED6\u73A9\u5BB6", this.w / 2, this.h - 315, 20, "#ffe39b", "center");
          this.hand();
          this.button(replay ? "\u8FD4\u56DE" : "\u4E0A\u8F6E", this.w - 125, this.h - 103, 96, 42, () => {
            this.replayUntil = replay ? 0 : Date.now() + 1500;
            this.session.replayUntil = this.replayUntil;
          }, false, !g.lastTrick.length);
          this.button("\u5E95\u724C", this.w - 125, this.h - 53, 96, 42, () => {
            if (g.bottom.length) {
              this.showBottom = true;
              this.bottomUntil = Date.now() + 1500;
            } else P.toast("\u5E95\u724C\u6682\u4E0D\u516C\u5F00");
          });
          if (this.showBottom && Date.now() >= this.bottomUntil) this.showBottom = false;
          if (this.showBottom && g.bottom.length) {
            this.rect(this.w / 2 - 360, 260, 720, 184, "rgba(21,60,48,.3)");
            this.text("\u5E95\u724C " + E.points(g.bottom) + " \u5206", this.w / 2, 280, 22, "#f6dda0", "center");
            this.cardsRow(g.bottom, this.w / 2, 302, 640, { width: 64 });
          }
        }
        hand() {
          const g = this.room.game, hand = g.hand, width = 104, step = Math.min(46, (this.w - 320 - width) / Math.max(1, hand.length - 1)), start = this.w / 2 - (width + step * (hand.length - 1)) / 2, lead = this.lead(), cat = lead ? E.category(lead[0], g) : null, same = cat ? hand.filter((c) => E.category(c, g) === cat).length : 0, safe = this.settings.throw ? E.publicThrowIds(hand, g.publicCards, g) : /* @__PURE__ */ new Set(), tractors = E.tractorIds(hand, g);
          hand.forEach((card, i) => {
            const selected = this.selected.has(card.id), x = start + i * step, y = this.h - 180 - (selected ? 28 : 0);
            this.card(card, x, y, width, { selected, stars: E.stars(card, g), dim: !!lead && same >= lead.length && E.category(card, g) !== cat, mark: this.forced?.has(card.id) ? "\u5FC5" : safe.has(card.id) ? "\u7529" : tractors.has(card.id) ? "\u8FDE\u5BF9" : "", bottom: g.phase === "bury" && g.bottom.some((c) => c.id === card.id) });
            this.cards.push({ x, y, w: width, h: 156, id: card.id, index: i });
          });
        }
        hint() {
          const g = this.room.game;
          const cards = g.phase === "bury" ? [...g.hand].sort((a, b) => E.points([a]) - E.points([b]) || E.rank(a, g) - E.rank(b, g)).slice(0, 8) : E.suggestions(g.hand, this.lead(), g)[0] || [];
          this.selected = new Set(cards.map((c) => c.id));
          this.enforce();
        }
        enforce() {
          for (const id of this.forced || []) this.selected.add(id);
        }
        play() {
          const g = this.room.game;
          if (!this.selected.size) return P.toast("\u8BF7\u5148\u9009\u724C");
          this.session.command(g.phase === "bury" ? "bury" : "play", { cards: [...this.selected] });
        }
        buryView() {
          const g = this.room.game, hand = g.hand, c = this.ctx, split = Math.ceil(hand.length / 2), width = 120, height = 180, startY = this.h * 0.38;
          c.save();
          c.setTransform(this.pixel, 0, 0, this.pixel, 0, 0);
          c.fillStyle = "rgba(42,42,42,.72)";
          c.fillRect(0, 0, this.pw, this.ph);
          c.restore();
          const actionY = startY - 100;
          this.text("\u624B\u724C " + E.points(hand) + " \u5206   \xB7   \u4E3B\u724C " + hand.filter((card) => E.category(card, g) === "T").length + " \u5F20", 110, actionY + 26, 27, "#f3e5b6");
          this.text(Math.max(0, Math.ceil((g.deadline - Date.now() - this.session.offset) / 1e3)), this.w * 0.52, actionY + 26, 27, "#ffe195", "center");
          this.button("\u63D0\u793A", this.w * 0.61, actionY, 145, 54, () => this.hint());
          this.button("\u6263\u5E95 (" + this.selected.size + "/8)", this.w - 310, actionY, 210, 54, () => this.play(), true, this.selected.size !== 8);
          this.cards = [];
          for (let row = 0; row < 2; row++) {
            const list = hand.slice(row * split, (row + 1) * split), step = Math.min(90, (this.w - 220 - width) / Math.max(1, list.length - 1)), start = this.w / 2 - (width + step * (list.length - 1)) / 2;
            list.forEach((card, i) => {
              const selected = this.selected.has(card.id), x = start + i * step, y = startY + row * (height + 38) - (selected ? 22 : 0);
              this.card(card, x, y, width, { selected, stars: E.stars(card, g), bottom: g.bottom.some((b) => b.id === card.id), mark: E.tractorIds(hand, g).has(card.id) ? "\u8FDE\u5BF9" : "" });
              this.cards.push({ x, y, w: width, h: height, id: card.id, index: row * split + i });
            });
          }
          this.text("\u91D1\u8272\u300C\u5E95\u300D\u4E3A\u521A\u83B7\u5F97\u7684\u5E95\u724C \xB7 \u9009\u62E9 8 \u5F20\u6263\u5E95", this.w / 2, startY + 2 * (height + 38) - 8, 20, "#e9d6a0", "center");
        }
        dimTable() {
          const c = this.ctx;
          c.save();
          c.setTransform(this.pixel, 0, 0, this.pixel, 0, 0);
          c.fillStyle = "rgba(30,30,30,.78)";
          c.fillRect(0, 0, this.pw, this.ph);
          c.restore();
        }
        revealBottom() {
          const g = this.room.game, cx = this.w / 2, cy = this.h / 2, last = g.lastTrick.length ? g.lastTrick : g.plays, points = E.points(g.bottom), captured = last.length && E.winner(last, g) % 2 !== g.dealer % 2, multiplier = captured ? E.bottomMultiplier(last[0].cards, g) : 0, bonus = points * multiplier, elapsed = Date.now() - this.resultAt;
          this.dimTable();
          this.text("\u4EAE\u5E95\u724C", cx, cy - 160, 38, "#ffe3a0", "center");
          this.cardsRow(g.bottom, cx, cy - 110, 850, { width: 104, spread: true, revealAt: this.resultAt });
          if (elapsed >= 900) {
            this.text(captured ? "\u5E95\u724C " + points + " \u5206 \xD7 " + multiplier + " = " + bonus + " \u5206" : "\u5E95\u724C " + points + " \u5206 \xB7 \u5E84\u5BB6\u4FDD\u5E95\uFF0C\u4E0D\u8BA1\u5165\u95F2\u5BB6\u6293\u5206", cx, cy + 100, 26, "#ffe3a0", "center");
            this.text("\u95F2\u5BB6\u603B\u5206\uFF1A" + (g.score - bonus) + " + " + bonus + " = " + g.score + " \u5206", cx, cy + 148, 28, "#fff0ca", "center");
          }
        }
        settlement() {
          const r = this.room, g = r.game, won = (g.score < 80 ? g.dealer % 2 : 1 - g.dealer % 2) === r.seat % 2, detail = g.score === 0 ? "\u5927\u5149" : g.score < 40 ? "\u5C0F\u5149" : g.score + " \u5206", cx = this.w / 2, cy = this.h / 2, c = this.ctx;
          this.dimTable();
          c.save();
          c.shadowColor = "#edc35a";
          c.shadowBlur = 24;
          this.text(won ? "\u80DC \u5229" : "\u60DC \u8D25", cx, cy - 240, 70, won ? "#ffe698" : "#d9e5da", "center");
          c.restore();
          this.text(detail, cx, cy - 170, 32, "#ffe7a5", "center");
          this.text("\u2605", cx - 430, cy - 20, 145, "#eac367", "center");
          this.text("\u7545\u73A9\u5347\u7EA7", cx - 430, cy + 98, 30, "#ffe9af", "center");
          this.text("\u7B2C " + r.round + " \u5C40", cx - 430, cy + 139, 21, "#e7c899", "center");
          for (const [side, team] of [[-1, r.seat % 2], [1, 1 - r.seat % 2]]) {
            const x = cx + 105 + side * 200;
            this.text(side === -1 ? "\u6211\u65B9" : "\u5BF9\u65B9", x, cy - 90, 22, "#ffe7ba", "center");
            r.members.filter((m, p) => p % 2 === team).forEach((m, i) => this.text(m.name, x, cy - 52 + i * 32, 23, "#fff1d3", "center"));
          }
          this.text("VS", cx + 105, cy - 53, 28, "#ffd580", "center");
          this.button(r.members[r.seat].ready ? "\u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6" : "\u518D\u6765\u4E00\u5C40", cx, cy + 200, 210, 58, () => this.session.command("ready"), true, r.members[r.seat].ready);
        }
        async history() {
          this.popup = "history";
          this.historyText = "\u6B63\u5728\u52A0\u8F7D\u2026";
          try {
            const all = P.read("identities", {}), identity = all[this.base];
            if (!identity) {
              this.historyText = "\u8FD8\u6CA1\u6709\u5B8C\u6210\u7684\u8054\u7F51\u724C\u5C40";
              this.historyData = null;
              return;
            }
            this.historyData = await P.request(this.base, "/api/profile", "GET", void 0, identity.token);
            this.historyText = "";
            this.recordOffset = 0;
          } catch {
            this.historyText = "\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\u6218\u7EE9\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u8FDE\u63A5";
          }
        }
        profileView() {
          this.header("\u4E2A\u4EBA\u8D44\u6599", () => this.screen = "lobby");
          this.rect(60, 115, this.w - 120, this.h - 180, "#204b38dd");
          this.avatar(this.profile.avatar, 110, 160, 110);
          this.text(this.profile.name, 250, 195, 34);
          this.button("\u4FEE\u6539\u6635\u79F0", 250, 238, 160, 48, async () => {
            const name = await P.input("\u6635\u79F0\uFF081\u201316\u5B57\uFF09", this.profile.name);
            if (name && name.length <= 16) {
              this.profile.name = name;
              this.saveProfile();
            } else if (name) P.toast("\u6635\u79F0\u4E0D\u80FD\u8D85\u8FC716\u5B57");
          });
          this.text("\u9009\u62E9\u5934\u50CF", 110, 343, 25);
          [0, 1, 2, 3].forEach((a, i) => {
            this.avatar(a, 110 + i * 125, 385, 84);
            this.hits.push({ x: 110 + i * 125, y: 385, w: 84, h: 84, fn: () => {
              this.profile.avatar = a;
              this.saveProfile();
            } });
          });
          this.text(this.profile.bio || "\u5199\u4E00\u53E5\u4E2A\u6027\u7B7E\u540D", 110, 540, 24);
          this.button("\u4FEE\u6539\u7B7E\u540D", 110, 590, 160, 48, async () => {
            const bio = await P.input("\u4E2A\u6027\u7B7E\u540D\uFF08\u6700\u591A80\u5B57\uFF09", this.profile.bio);
            if (bio !== null) {
              this.profile.bio = bio.slice(0, 80);
              this.saveProfile();
            }
          });
          this.button("\u5BF9\u5C40\u6218\u7EE9", this.w - 340, 180, 220, 60, () => this.history(), true);
        }
        async saveProfile() {
          P.write("profile", this.profile);
          const identity = P.read("identities", {})[this.base];
          if (identity) try {
            await P.request(this.base, "/api/profile", "PATCH", this.profile, identity.token);
          } catch {
            P.toast("\u8D44\u6599\u5DF2\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u8054\u7F51\u540C\u6B65\u6682\u672A\u6210\u529F");
          }
        }
        modal() {
          this.rect(0, 0, this.w, this.h, "#092a20cc", 0);
          this.hits = [];
          this.cards = [];
          const x = this.w / 2 - 440, y = this.h / 2 - 330;
          this.rect(x, y, 880, 660, "#214d39");
          this.button("\xD7", x + 810, y + 12, 48, 42, () => this.popup = null);
          this.text(this.popup === "settings" ? "\u6E38\u620F\u8BBE\u7F6E" : this.popup === "rules" ? "\u6E38\u620F\u89C4\u5219" : "\u5BF9\u5C40\u6218\u7EE9", x + 35, y + 42, 30, "#ffe3a0");
          if (this.popup === "settings") {
            const keys = [["pair", "\u5BF9\u5B50\u8FDE\u9009"], ["throw", "\u7529\u724C\u63D0\u793A"], ["void", "\u7F3A\u95E8\u63D0\u793A"], ["test", "\u6D4B\u8BD5\u53D1\u724C\uFF08\u5355\u673A\u4E0B\u4E00\u5C40\uFF09"], ["music", "\u80CC\u666F\u97F3\u4E50"], ["effects", "\u6E38\u620F\u97F3\u6548"], ["speech", "\u8BED\u97F3\u62A5\u724C"]];
            keys.forEach(([key, label], i) => this.button(label + " " + (this.settings[key] ? "\u2713" : "\u5173"), x + 35 + i % 2 * 400, y + 95 + Math.floor(i / 2) * 73, 375, 52, () => {
              this.settings[key] = !this.settings[key];
              P.write("settings", this.settings);
              if (key === "speech" && !this.settings.speech) this.sound.reset();
              this.sound.music();
            }));
            this.button("\u97F3\u6E90\uFF1A" + (this.settings.voice === "male" ? "\u7537\u58F0" : "\u5973\u58F0"), x + 435, y + 314, 375, 52, () => {
              this.sound.reset();
              this.settings.voice = this.settings.voice === "male" ? "female" : "male";
              P.write("settings", this.settings);
              this.sound.music();
              this.sound.say("\u4EAE\u4E3B");
            });
            this.button("\u97F3\u4E50\u97F3\u91CF " + Math.round(this.settings.volume * 100) + "%", x + 35, y + 390, 375, 52, () => {
              this.settings.volume = this.settings.volume >= 0.6 ? 0.1 : Math.round((this.settings.volume + 0.1) * 10) / 10;
              P.write("settings", this.settings);
              this.sound.music();
            });
            this.button("\u8BBE\u7F6E\u8054\u7F51\u670D\u52A1\u5668", x + 435, y + 390, 375, 52, async () => {
              const url = await P.input("\u670D\u52A1\u5668\u5730\u5740", this.base);
              if (url && /^https?:\/\//.test(url)) {
                this.base = url.replace(/\/$/, "");
                P.write("server", this.base);
              } else if (url) P.toast("\u5730\u5740\u9700\u4EE5 http:// \u6216 https:// \u5F00\u5934");
            });
            this.text(this.base, x + 35, y + 477, 18, "#c5d9b6");
            this.button("\u5355\u673A\u7EA7\u724C\uFF1A" + E.label(this.rules.startLevel), x + 35, y + 517, 375, 52, () => this.rule("startLevel", this.rules.startLevel === 14 ? 2 : this.rules.startLevel + 1));
            this.button("\u91CD\u65B0\u5F00\u59CB\u5355\u673A", x + 435, y + 517, 375, 52, async () => {
              if (await P.confirm("\u91CD\u65B0\u5F00\u59CB", "\u7ED3\u675F\u5F53\u524D\u5355\u673A\u724C\u5C40\uFF0C\u6309\u6240\u9009\u7EA7\u724C\u5F00\u573A\uFF1F")) {
                if (this.session.online && this.room?.game && this.room.game.phase !== "over") return P.toast("\u8BF7\u5148\u5B8C\u6210\u8054\u7F51\u724C\u5C40");
                this.solo();
              }
            }, true);
          } else if (this.popup === "rules") {
            ["\u56DB\u4EBA\u4E24\u526F\u724C\uFF0C\u5BF9\u5750\u4E3A\u961F\u53CB\uFF0C\u6BCF\u4EBA25\u5F20\uFF0C\u5E95\u724C8\u5F20\u3002", "\u53D1\u724C\u65F6\u4EAE\u7EA7\u724C\u62A2\u4E3B\uFF0C\u7EA7\u724C\u5BF9\u5B50\u4E0E\u6210\u5BF9\u738B\u724C\u53EF\u4EE5\u53CD\u4E3B\u3002", "\u7B2C\u4E00\u5C40\u7531\u6700\u7EC8\u4EAE\u4E3B\u8005\u5750\u5E84\uFF0C\u4E4B\u540E\u6309\u7ED3\u7B97\u8F6E\u5E84\u3002", "\u9006\u65F6\u9488\u51FA\u724C\uFF0C\u8DDF\u540C\u95E8\uFF1B\u6709\u5BF9\u5B50\u3001\u62D6\u62C9\u673A\u987B\u6309\u89C4\u5219\u8DDF\u724C\u3002", "5\u300110\u3001K\u5206\u522B\u8BA15\u300110\u300110\u5206\uFF0C\u95F2\u5BB6\u6293\u6EE180\u5206\u4E0A\u53F0\u3002", "\u652F\u6301\u7529\u724C\uFF1B\u5931\u8D25\u65F6\u9000\u56DE\u591A\u4F59\u724C\uFF0C\u4EC5\u51FA\u88AB\u538B\u5236\u7684\u7EC4\u5408\u3002", "\u5B8C\u6210A\u7EA7\u724C\u6216\u8FBE\u5230\u597D\u53CB\u623F\u5C40\u6570\u4E0A\u9650\u540E\u6574\u573A\u7ED3\u675F\u3002", "\u70B9\u51FB\u9009\u724C\uFF0C\u518D\u6B21\u70B9\u51FB\u53D6\u6D88\uFF1B\u6309\u4F4F\u62D6\u52A8\u53EF\u4EE5\u8FDE\u7EED\u9009\u724C\u3002"].forEach((t, i) => this.text(t, x + 35, y + 110 + i * 57, 23));
          } else {
            if (this.historyText) this.text(this.historyText, x + 40, y + 150, 24);
            else if (this.historyData) {
              this.text("\u5B8C\u6210 " + this.historyData.stats.games + " \u5C40 \xB7 \u83B7\u80DC " + this.historyData.stats.wins + " \u5C40", x + 35, y + 95, 24, "#ffe095");
              this.historyData.history.slice(this.recordOffset, this.recordOffset + 7).forEach((r, i) => {
                const yy = y + 153 + i * 55;
                this.text(r.won ? "\u83B7\u80DC" : "\u5931\u8D25", x + 35, yy, 23);
                this.text("\u6253 " + E.label(r.level) + " \xB7 \u95F2\u5BB6 " + r.score + " \u5206", x + 150, yy, 22);
                this.text(new Date(Number(r.date)).toLocaleDateString(), x + 600, yy, 20);
              });
              this.button("\u4E0A\u4E00\u9875", x + 150, y + 585, 170, 45, () => this.recordOffset = Math.max(0, this.recordOffset - 7));
              this.button("\u4E0B\u4E00\u9875", x + 480, y + 585, 170, 45, () => this.recordOffset = Math.min(Math.max(0, this.historyData.history.length - 7), this.recordOffset + 7));
            }
          }
        }
        point(e) {
          const t = e.changedTouches?.[0] || e.touches?.[0];
          return t ? { x: (t.clientX - this.insetX) / this.scale, y: (t.clientY - this.insetY) / this.scale } : null;
        }
        hitCard(p) {
          return [...this.cards].reverse().find((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
        }
        down(e) {
          this.showBottom = false;
          this.replayUntil = 0;
          this.session.replayUntil = 0;
          this.sound.unlock();
          const p = this.point(e);
          if (!p) return;
          const card = this.hitCard(p);
          if (card && this.room?.game?.phase !== "over") {
            this.gesture = { start: card.index, end: card.index, snapshot: new Set(this.selected), remove: this.selected.has(card.id) };
            this.selectRange(card.index);
            return;
          }
          this.pressed = [...this.hits].reverse().find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
        }
        move(e) {
          if (!this.gesture) return;
          const p = this.point(e);
          if (!p) return;
          const card = this.hitCard(p);
          if (card && card.index !== this.gesture.end) {
            this.gesture.end = card.index;
            this.selectRange(card.index);
          }
        }
        up(e) {
          if (this.gesture) {
            this.gesture = null;
            return;
          }
          const p = this.point(e), b = this.pressed;
          this.pressed = null;
          if (b && p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) b.fn();
        }
        selectRange(end) {
          const g = this.room.game, gesture = this.gesture, lo = Math.min(gesture.start, end), hi = Math.max(gesture.start, end), lead = this.lead(), shape = lead ? E.shape(lead, g) : null, limit = shape?.type === "single" ? 1 : shape?.type === "pair" ? 2 : Infinity;
          let chosen = g.hand.slice(lo, hi + 1);
          if (lo === hi && this.settings.pair && limit !== 1) {
            const pair = g.hand.filter((c) => E.key(c) === E.key(chosen[0]));
            if (pair.length === 2) chosen = pair;
          }
          this.selected = new Set(gesture.snapshot);
          if (gesture.remove) {
            for (const c of chosen) if (!this.forced?.has(c.id)) this.selected.delete(c.id);
          } else {
            if ((/* @__PURE__ */ new Set([...this.selected, ...chosen.map((c) => c.id)])).size > limit) this.selected = new Set(this.forced);
            for (const c of chosen.slice(0, limit)) this.selected.add(c.id);
          }
          this.enforce();
          this.sound.effect("select");
        }
      };
      module.exports = Game;
    }
  });
  return require_main();
})();
GameGlobal.changwanGame = new ChangwanGame();
