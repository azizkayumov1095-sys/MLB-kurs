/* ==========================================================
   Trenajyorlar hisob-kitob yadrosi (sayt va Apps Script uchun umumiy)
   Ядро расчётов тренажёров. Этот же код вставлен в конец Code.gs:
   сервер пересчитывает задание и выставляет балл сам.
   ========================================================== */
var MLB_CORE = (function () {
  "use strict";

  function r2(x) { return Math.round(x * 100) / 100; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function num(x) { var v = typeof x === "string" ? Number(x.replace(",", ".").replace(/\s/g, "")) : Number(x); return isFinite(v) ? v : NaN; }
  function near(a, b, tolAbs, tolRel) { a = num(a); if (isNaN(a)) return false; var t = Math.max(tolAbs || 0, Math.abs(b) * (tolRel || 0)); return Math.abs(a - b) <= t + 1e-9; }
  function isInt(v, lo, hi) { return typeof v === "number" && Math.floor(v) === v && v >= lo && v <= hi; }
  function inRange(v, lo, hi) { return typeof v === "number" && isFinite(v) && v >= lo && v <= hi; }

  /* ---------------- 10: EVM ---------------- */
  var EVM_STATES = [
    { k: "a", t: "Byudjet tejalmoqda, ishlar grafikdan oldinda" },
    { k: "b", t: "Ortiqcha sarf, lekin ishlar grafikdan oldinda" },
    { k: "c", t: "Byudjet tejalmoqda, lekin ishlar grafikdan ortda" },
    { k: "d", t: "Ortiqcha sarf va grafikdan ortda qolish" }
  ];
  function evmSolve(d) {
    var pv = d.pv[d.m - 1];
    var ev = r1(d.bac * d.evPct / 100);
    var ac = d.ac;
    var cpi = ev / ac, spi = ev / pv;
    var eac = d.bac / cpi;
    var cv = r1(ev - ac), sv = r1(ev - pv);
    var state = cv >= 0 ? (sv >= 0 ? "a" : "c") : (sv >= 0 ? "b" : "d");
    return { pv: pv, ev: ev, cv: cv, sv: sv, cpi: cpi, spi: spi, eac: eac, etc: eac - ac, vac: d.bac - eac, state: state };
  }
  function evmValid(d) {
    if (!d || !Array.isArray(d.pv)) return false;
    if (!isInt(d.bac, 20, 1000) || !isInt(d.n, 6, 14) || d.pv.length !== d.n || !isInt(d.m, 2, d.n - 1)) return false;
    for (var i = 0; i < d.n; i++) if (!inRange(d.pv[i], 0.1, d.bac) || (i && d.pv[i] < d.pv[i - 1])) return false;
    if (Math.abs(d.pv[d.n - 1] - d.bac) > 0.01) return false;
    return inRange(d.evPct, 1, 99) && inRange(d.ac, 0.1, d.bac * 2);
  }
  function evmGrade(d, a) {
    var s = evmSolve(d); a = a || {};
    var items = [
      ["PV", near(a.pv, s.pv, 0.15)],
      ["EV", near(a.ev, s.ev, 0.15)],
      ["CV", near(a.cv, s.cv, 0.25)],
      ["SV", near(a.sv, s.sv, 0.25)],
      ["CPI", near(a.cpi, s.cpi, 0.011)],
      ["SPI", near(a.spi, s.spi, 0.011)],
      ["EAC", near(a.eac, s.eac, 0.5, 0.02)],
      ["VAC", near(a.vac, s.vac, Math.max(0.5, d.bac * 0.02))],
      ["Holat", a.state === s.state]
    ];
    return pack(items, s);
  }

  /* ---------------- 5–6: yer ishlari ---------------- */
  function earthSolve(d) {
    var n = d.hl.length, h = [], F = [], seg = [], cut = 0, fill = 0;
    for (var i = 0; i < n; i++) {
      var hh = r2(d.hl[i] - d.hm[i]);
      h.push(hh);
      F.push(d.b * Math.abs(hh) + d.k * hh * hh);
    }
    for (var j = 0; j < n - 1; j++) {
      var v = (F[j] + F[j + 1]) / 2 * d.L, c = 0, f = 0;
      if (h[j] < 0 && h[j + 1] < 0) c = v;
      else if (h[j] > 0 && h[j + 1] > 0) f = v;
      else { c = v / 2; f = v / 2; }
      seg.push({ v: v, cut: c, fill: f }); cut += c; fill += f;
    }
    return { h: h, F: F, seg: seg, cut: cut, fill: fill, bal: fill - cut };
  }
  function earthValid(d) {
    if (!d || !Array.isArray(d.hl) || !Array.isArray(d.hm)) return false;
    if (d.hl.length !== d.hm.length || d.hl.length < 3 || d.hl.length > 8) return false;
    if ([25, 50, 100].indexOf(d.L) < 0 || !isInt(d.b, 6, 15) || [1.5, 1.75, 2].indexOf(d.k) < 0) return false;
    for (var i = 0; i < d.hl.length; i++) {
      if (!inRange(d.hl[i], 50, 1000) || !inRange(d.hm[i], 50, 1000)) return false;
      var h = Math.abs(d.hl[i] - d.hm[i]); if (h < 0.1 || h > 4) return false;
    }
    return true;
  }
  function earthGrade(d, a) {
    var s = earthSolve(d); a = a || {};
    var items = [];
    for (var i = 0; i < s.h.length; i++) {
      var okH = a.h && near(a.h[i], s.h[i], 0.005);
      var okF = a.F && near(a.F[i], s.F[i], 0.03, 0.01);
      items.push([(i + 1) + "-kesim", !!(okH && okF)]);
    }
    items.push(["Oʻyma", near(a.cut, s.cut, 1, 0.01)]);
    items.push(["Koʻtarma", near(a.fill, s.fill, 1, 0.01)]);
    items.push(["Balans", near(a.bal, s.bal, 2, 0.015)]);
    return pack(items, s);
  }

  /* ---------------- 7: Gantt ---------------- */
  var GANTT = [
    { id: 1, name: "Tayyorgarlik ishlari va safarbarlik", dep: [], r: [3, 6] },
    { id: 2, name: "Eski qoplamani demontaj qilish", dep: [[1, "FS", 0]], r: [4, 8] },
    { id: 3, name: "Yer ishlari", dep: [[2, "FS", 0]], r: [7, 12] },
    { id: 4, name: "Drenaj tizimini oʻrnatish", dep: [[3, "SS", "lag4"]], r: [6, 11] },
    { id: 5, name: "Yoʻl toʻshamasi asosini qurish", dep: [[3, "FS", 0], [4, "FS", 0]], r: [6, 10] },
    { id: 6, name: "Asfaltbeton qoplamani yotqizish", dep: [[5, "FS", 0]], r: [5, 9] },
    { id: 7, name: "Yoʻl chetlarini mustahkamlash", dep: [[6, "SS", "lag7"]], r: [3, 7] },
    { id: 8, name: "Yoʻl chiziqlari va belgilarni oʻrnatish", dep: [[6, "FS", 0], [7, "FS", 0]], r: [2, 4] }
  ];
  function lagOf(d, l) { return typeof l === "number" ? l : d[l]; }
  function addDays(iso, n) {
    var p = iso.split("-"), t = Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000, x = new Date(t);
    return x.getUTCFullYear() + "-" + ("0" + (x.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + x.getUTCDate()).slice(-2);
  }
  function ganttSolve(d) {
    var s = {}, f = {}, T = 0;
    GANTT.forEach(function (t) {
      var st = 1;
      t.dep.forEach(function (x) {
        var lag = lagOf(d, x[2]);
        var c = x[1] === "FS" ? f[x[0]] + 1 + lag : s[x[0]] + lag;
        if (c > st) st = c;
      });
      s[t.id] = st; f[t.id] = st + d.dur[t.id] - 1; if (f[t.id] > T) T = f[t.id];
    });
    // kritik ishlar: oxiridan orqaga
    var crit = {}, late = {};
    GANTT.slice().reverse().forEach(function (t) {
      var lf = T;
      GANTT.forEach(function (u) { u.dep.forEach(function (x) {
        if (x[0] !== t.id) return;
        var lag = lagOf(d, x[2]);
        var lim = x[1] === "FS" ? late[u.id] - 1 - lag : late[u.id] + d.dur[t.id] - 1 - lag;
        if (lim < lf) lf = lim;
      }); });
      late[t.id] = lf - d.dur[t.id] + 1;
      crit[t.id] = late[t.id] === s[t.id];
    });
    return { s: s, f: f, T: T, end: addDays(d.start, T - 1), crit: crit };
  }
  function ganttValid(d) {
    if (!d || !d.dur || typeof d.start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.start)) return false;
    for (var i = 0; i < GANTT.length; i++) { var t = GANTT[i]; if (!isInt(d.dur[t.id], t.r[0], t.r[1])) return false; }
    return isInt(d.lag4, 1, 5) && isInt(d.lag7, 1, 4);
  }
  function ganttGrade(d, a) {
    var s = ganttSolve(d); a = a || {};
    var items = GANTT.map(function (t) {
      return [t.id + "-ish", !!(a.s && a.f && num(a.s[t.id]) === s.s[t.id] && num(a.f[t.id]) === s.f[t.id])];
    });
    items.push(["Davomiylik", num(a.T) === s.T]);
    items.push(["Tugash sanasi", a.end === s.end]);
    return pack(items, s);
  }

  /* ---------------- 11: risk matritsasi ---------------- */
  var RISKS = [
    { id: 1, name: "Bitum va yoqilgʻi narxining oshishi", cat: "Moliyaviy", resp: "Oʻtkazish / kamaytirish: qatʼiy narxli shartnomalar, byudjetda zaxira" },
    { id: 2, name: "Inert materiallar yetkazib berilishining kechikishi", cat: "Tashkiliy", resp: "Kamaytirish: zaxira taʼminotchi, omborda zaxira" },
    { id: 3, name: "Uchastkadagi gruntning beqarorligi", cat: "Texnik", resp: "Chetlab oʻtish / kamaytirish: qoʻshimcha geologik qidiruv" },
    { id: 4, name: "Noqulay ob-havo sharoiti", cat: "Tashqi", resp: "Qabul qilish: mavsumiy rejalashtirish, muddat zaxirasi" },
    { id: 5, name: "Loyiha hujjatlaridagi xatolar", cat: "Texnik", resp: "Kamaytirish: qoʻshimcha ekspertiza va audit" },
    { id: 6, name: "Pudratchilar oʻrtasidagi kelishmovchilik", cat: "Tashkiliy", resp: "Kamaytirish: haftalik yigʻilishlar, yagona axborot platformasi" },
    { id: 7, name: "Ekologik xizmatlarning daʼvolari", cat: "Ekologik", resp: "Kamaytirish: ekologik reja, xodimlarni oʻqitish" },
    { id: 8, name: "Qurilish maydonchasidagi travmatizm", cat: "Xavfsizlik", resp: "Kamaytirish: yoʻriqnoma, himoya vositalari, nazorat" },
    { id: 9, name: "Moliyalashtirishning kechikishi", cat: "Moliyaviy", resp: "Kamaytirish: toʻlov grafigini kelishish, bosqichli moliyalashtirish" },
    { id: 10, name: "Yer uchastkalarini ajratishning kechikishi", cat: "Tashqi", resp: "Kamaytirish: yer ajratishni qurilishdan oldin yakunlash" },
    { id: 11, name: "Yer osti kommunikatsiyalarini koʻchirish zarurati", cat: "Texnik", resp: "Kamaytirish: kommunikatsiyalar egalari bilan oldindan kelishish" },
    { id: 12, name: "Asosiy texnikaning ishdan chiqishi", cat: "Texnik", resp: "Oʻtkazish / kamaytirish: sugʻurta, zaxira texnika ijarasi" }
  ];
  function riskP(pct) { return pct <= 30 ? 1 : pct <= 60 ? 2 : 3; }
  function riskI(cost, budget) { var x = cost / budget * 100; return x <= 2 ? 1 : x <= 5 ? 2 : 3; }
  function riskZone(R) { return R >= 9 ? "q" : R >= 4 ? "s" : "y"; }
  function riskSolve(d) {
    return { rows: d.items.map(function (it) {
      var P = riskP(it.p), I = riskI(it.c, d.budget), R = P * I;
      return { id: it.id, P: P, I: I, R: R, z: riskZone(R) };
    }) };
  }
  function riskValid(d) {
    if (!d || !Array.isArray(d.items) || d.items.length < 4 || d.items.length > 8 || !inRange(d.budget, 20, 1000)) return false;
    var seen = {};
    for (var i = 0; i < d.items.length; i++) {
      var it = d.items[i];
      if (!isInt(it.id, 1, RISKS.length) || seen[it.id] || !isInt(it.p, 5, 95) || !inRange(it.c, 0.1, d.budget)) return false;
      seen[it.id] = 1;
    }
    return true;
  }
  function riskGrade(d, a) {
    var s = riskSolve(d); a = a || {};
    var items = s.rows.map(function (r, i) {
      var x = (a.rows || [])[i] || {};
      return ["Risk " + (i + 1), num(x.P) === r.P && num(x.I) === r.I && num(x.R) === r.R && x.z === r.z];
    });
    return pack(items, s);
  }

  function pack(items, sol) {
    var score = items.filter(function (x) { return x[1]; }).length;
    return { score: score, max: items.length, items: items, sol: sol,
      detail: items.map(function (x) { return x[0] + (x[1] ? "+" : "-"); }).join(" ") };
  }

  return {
    r1: r1, r2: r2, num: num, near: near, addDays: addDays,
    evm: { solve: evmSolve, valid: evmValid, grade: evmGrade, STATES: EVM_STATES },
    earth: { solve: earthSolve, valid: earthValid, grade: earthGrade },
    gantt: { solve: ganttSolve, valid: ganttValid, grade: ganttGrade, TASKS: GANTT },
    risk: { solve: riskSolve, valid: riskValid, grade: riskGrade, LIST: RISKS, P: riskP, I: riskI, zone: riskZone }
  };
})();
if (typeof module !== "undefined") module.exports = MLB_CORE;
