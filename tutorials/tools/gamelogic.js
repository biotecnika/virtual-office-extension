/* Pure game logic for the game zone: no DOM, no network. Shared by games.js and testable on its own. */
var GameLogic = (function () {
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuf(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- 6x6 sudoku (boxes are 2 rows by 3 columns) ----------
  function sudokuOk(g, i, v) {
    var r = Math.floor(i / 6), c = i % 6, br = r - r % 2, bc = c - c % 3;
    for (var k = 0; k < 6; k++) { if (g[r * 6 + k] === v || g[k * 6 + c] === v) return false; }
    for (var y = 0; y < 2; y++) for (var x = 0; x < 3; x++) if (g[(br + y) * 6 + bc + x] === v) return false;
    return true;
  }
  function sudokuCount(g, limit) {
    var i = g.indexOf(0); if (i < 0) return 1;
    var n = 0;
    for (var v = 1; v <= 6 && n < limit; v++) if (sudokuOk(g, i, v)) { g[i] = v; n += sudokuCount(g, limit - n); g[i] = 0; }
    return n;
  }
  function sudoku(seed) {
    var r = rng(seed), digits = shuf([1, 2, 3, 4, 5, 6], r);
    var bands = shuf([0, 1, 2], r), rows = [];
    bands.forEach(function (b) { shuf([0, 1], r).forEach(function (x) { rows.push(b * 2 + x); }); });
    var stacks = shuf([0, 1], r), cols = [];
    stacks.forEach(function (s) { shuf([0, 1, 2], r).forEach(function (x) { cols.push(s * 3 + x); }); });
    var sol = [];
    for (var i = 0; i < 6; i++) for (var j = 0; j < 6; j++) { var rr = rows[i], cc = cols[j]; sol.push(digits[(3 * (rr % 2) + Math.floor(rr / 2) + cc) % 6]); }
    var puz = sol.slice(), order = shuf(Array.from({ length: 36 }, function (_, k) { return k; }), r), left = 36;
    for (var k = 0; k < order.length && left > 14; k++) {
      var keep = puz[order[k]]; puz[order[k]] = 0;
      if (sudokuCount(puz.slice(), 2) !== 1) puz[order[k]] = keep; else left--;
    }
    return { puzzle: puz, solution: sol };
  }

  // ---------- crossword ----------
  function crossword(list, seed, want) {
    var N = 13, r = rng(seed), best = null;
    for (var attempt = 0; attempt < 30; attempt++) {
      var words = shuf(list, r), grid = {}, dirAt = {}, placed = [];
      var key = function (y, x) { return y + ',' + x; };
      var can = function (w, y, x, d, first) {
        var dy = d === 'D' ? 1 : 0, dx = d === 'A' ? 1 : 0, cross = 0;
        if (y < 0 || x < 0 || y + dy * (w.length - 1) >= N || x + dx * (w.length - 1) >= N) return false;
        if (grid[key(y - dy, x - dx)] || grid[key(y + dy * w.length, x + dx * w.length)]) return false;
        for (var i = 0; i < w.length; i++) {
          var yy = y + dy * i, xx = x + dx * i, c = grid[key(yy, xx)];
          if (c) { if (c !== w[i] || dirAt[key(yy, xx)].indexOf(d) >= 0) return false; cross++; }
          else if (grid[key(yy + dx, xx + dy)] || grid[key(yy - dx, xx - dy)]) return false;
        }
        return first || (cross >= 1 && cross < w.length);
      };
      var put = function (e, y, x, d) {
        var w = e[0], dy = d === 'D' ? 1 : 0, dx = d === 'A' ? 1 : 0;
        for (var i = 0; i < w.length; i++) { var k = key(y + dy * i, x + dx * i); grid[k] = w[i]; dirAt[k] = (dirAt[k] || '') + d; }
        placed.push({ word: w, clue: e[1], r: y, c: x, dir: d });
      };
      var fi = 0; for (var q = 0; q < words.length; q++) if (words[q][0].length >= 6) { fi = q; break; }
      var first = words.splice(fi, 1)[0];
      put(first, Math.floor(N / 2), Math.floor((N - first[0].length) / 2), 'A');
      for (var wi = 0; wi < words.length && placed.length < want; wi++) {
        var w = words[wi][0], done = false;
        for (var pi = 0; pi < placed.length && !done; pi++) {
          var p = placed[pi], d = p.dir === 'A' ? 'D' : 'A';
          for (var a = 0; a < p.word.length && !done; a++) for (var b = 0; b < w.length && !done; b++) {
            if (p.word[a] !== w[b]) continue;
            var cy = p.r + (p.dir === 'D' ? a : 0), cx = p.c + (p.dir === 'A' ? a : 0);
            var y = cy - (d === 'D' ? b : 0), x = cx - (d === 'A' ? b : 0);
            if (can(w, y, x, d, false)) { put(words[wi], y, x, d); done = true; }
          }
        }
      }
      if (!best || placed.length > best.length) best = placed;
      if (best.length >= want) break;
    }
    var minR = 99, minC = 99, maxR = 0, maxC = 0;
    best.forEach(function (p) { minR = Math.min(minR, p.r); minC = Math.min(minC, p.c); maxR = Math.max(maxR, p.r + (p.dir === 'D' ? p.word.length - 1 : 0)); maxC = Math.max(maxC, p.c + (p.dir === 'A' ? p.word.length - 1 : 0)); });
    var entries = best.map(function (p) { return { word: p.word, clue: p.clue, r: p.r - minR, c: p.c - minC, dir: p.dir }; });
    var starts = {}; entries.forEach(function (e) { starts[e.r + ',' + e.c] = true; });
    var n = 0, nums = {};
    for (var yy = 0; yy <= maxR - minR; yy++) for (var xx = 0; xx <= maxC - minC; xx++) if (starts[yy + ',' + xx]) nums[yy + ',' + xx] = ++n;
    entries.forEach(function (e) { e.num = nums[e.r + ',' + e.c]; });
    entries.sort(function (a, b) { return a.num - b.num; });
    var cells = {};
    entries.forEach(function (e) { for (var i = 0; i < e.word.length; i++) cells[(e.r + (e.dir === 'D' ? i : 0)) + ',' + (e.c + (e.dir === 'A' ? i : 0))] = e.word[i]; });
    return { rows: maxR - minR + 1, cols: maxC - minC + 1, entries: entries, cells: cells, nums: nums };
  }

  // ---------- tic-tac-toe and connect four ----------
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttWin(b) {
    for (var i = 0; i < LINES.length; i++) { var l = LINES[i]; if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return b[l[0]]; }
    return b.every(Boolean) ? 'draw' : null;
  }
  function c4Drop(g, col) { for (var row = 5; row >= 0; row--) if (!g[row * 7 + col]) return row * 7 + col; return -1; }
  function c4Win(g) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < 6; r++) for (var c = 0; c < 7; c++) {
      var v = g[r * 7 + c]; if (!v) continue;
      for (var d = 0; d < 4; d++) {
        var k = 1;
        while (k < 4) { var rr = r + dirs[d][0] * k, cc = c + dirs[d][1] * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || g[rr * 7 + cc] !== v) break; k++; }
        if (k === 4) return v;
      }
    }
    return g.every(Boolean) ? 'draw' : null;
  }


  // ---------- tambola ticket: 3 rows x 9 columns, 5 numbers a row, every column used ----------
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function tambolaTicket(seedStr) {
    var r = rng(hash(seedStr)), rows, counts, ok = false;
    while (!ok) {
      rows = [0, 1, 2].map(function () { return shuf([0, 1, 2, 3, 4, 5, 6, 7, 8], r).slice(0, 5); });
      counts = [0, 0, 0, 0, 0, 0, 0, 0, 0]; rows.forEach(function (cs) { cs.forEach(function (c) { counts[c]++; }); });
      ok = counts.every(function (n) { return n >= 1; });
    }
    var t = [0, 1, 2].map(function () { return [0, 0, 0, 0, 0, 0, 0, 0, 0]; });
    for (var c = 0; c < 9; c++) {
      var lo = c === 0 ? 1 : c * 10, hi = c === 8 ? 90 : c * 10 + 9, pool = [];
      for (var n = lo; n <= hi; n++) pool.push(n);
      var pick = shuf(pool, r).slice(0, counts[c]).sort(function (a, b) { return a - b; }), k = 0;
      for (var row = 0; row < 3; row++) if (rows[row].indexOf(c) >= 0) t[row][c] = pick[k++];
    }
    return t;
  }
  var CROSS_BIO = [['ENZYME', 'Protein that speeds up a reaction'], ['PLASMID', 'Small circular DNA in bacteria'], ['GENOME', 'All the DNA of an organism'], ['VACCINE', 'Trains the immune system'], ['PROTEIN', 'Chain of amino acids'],
    ['PIPETTE', 'Tool for moving small volumes'], ['CODON', 'Three bases that code one amino acid'], ['HELIX', 'Shape of the DNA molecule'], ['CLONE', 'Genetically identical copy'], ['VIRUS', 'Needs a host cell to multiply'],
    ['ASSAY', 'A lab test that measures something'], ['PRIMER', 'Short DNA that starts PCR'], ['LIGASE', 'Enzyme that joins DNA ends'], ['BUFFER', 'Keeps pH steady'], ['AGAR', 'Jelly used to grow microbes'],
    ['GENE', 'Unit of heredity'], ['CELL', 'Basic unit of life'], ['RNA', 'Single-stranded nucleic acid'], ['DNA', 'Carries genetic information'], ['ANTIGEN', 'Triggers an immune response'],
    ['MITOSIS', 'Cell division for growth'], ['NUCLEUS', 'Holds the chromosomes'], ['RIBOSOME', 'Where proteins are made'], ['PLACEBO', 'Inactive treatment used for comparison'], ['DOSAGE', 'How much of a drug to give'],
    ['TRIAL', 'Clinical study of a treatment'], ['SERUM', 'Blood fluid without cells or clotting factors'], ['LIPID', 'Fat molecule'], ['SPORE', 'Tough resting form of a microbe'], ['YEAST', 'Single-celled fungus used in baking'],
    ['GLUCOSE', 'Simple sugar used for energy'], ['INSULIN', 'Hormone that lowers blood sugar'], ['MUTANT', 'Organism with a changed gene'], ['VECTOR', 'Carrier of DNA into a cell'], ['OPERON', 'Group of genes switched on together'],
    ['PEPTIDE', 'Short chain of amino acids'], ['TOXIN', 'Poison made by a living thing'], ['STERILE', 'Free of all microbes'], ['CULTURE', 'Cells grown in the lab'], ['EXON', 'Coding part of a gene']];
  var CROSS_EN = [['OFFICE', 'Place of work'], ['COFFEE', 'Morning drink for many'], ['LAPTOP', 'Portable computer'], ['MEETING', 'People gather to discuss'], ['HOLIDAY', 'A day off'],
    ['MONSOON', 'Rainy season in India'], ['CRICKET', 'Bat-and-ball sport'], ['MANGO', 'King of fruits'], ['TIGER', 'National animal of India'], ['RIVER', 'Flows to the sea'],
    ['BRIDGE', 'Crosses a river'], ['GARDEN', 'Where flowers grow'], ['WINDOW', 'Lets in light'], ['PLANET', 'Earth is one'], ['SILVER', 'Second-place medal'],
    ['ORANGE', 'A fruit and a colour'], ['PENCIL', 'Writes and can be erased'], ['MARKET', 'Place to buy and sell'], ['TICKET', 'Needed to board a train'], ['WINTER', 'Coldest season'],
    ['SUMMER', 'Hottest season'], ['FRIEND', 'A close companion'], ['TEAM', 'Group working together'], ['GOAL', 'What you aim for'], ['IDEA', 'A thought or plan'],
    ['LUNCH', 'Midday meal'], ['MUSIC', 'Art of sound'], ['SMILE', 'Happy expression'], ['TRAIN', 'Runs on rails'], ['CLOUD', 'White and floats in the sky'],
    ['OCEAN', 'Very large sea'], ['BREAD', 'Baked from flour'], ['CHAIR', 'You sit on it'], ['EMAIL', 'Electronic message'], ['SALARY', 'Monthly pay'],
    ['FESTIVAL', 'Diwali is one'], ['LIBRARY', 'Full of books'], ['KITCHEN', 'Where food is cooked'], ['JOURNEY', 'A long trip'], ['ANSWER', 'Reply to a question']];

  // ---------- Zones: one flask per row, column and coloured zone; flasks never touch ----------
  function zonesCount(n, reg, limit) {
    var cols = [], regs = [], count = 0;
    (function row(r, prev) {
      if (count >= limit) return;
      if (r === n) { count++; return; }
      for (var c = 0; c < n; c++) {
        var g = reg[r * n + c];
        if (cols[c] || regs[g] || (prev >= 0 && Math.abs(prev - c) <= 1)) continue;
        cols[c] = regs[g] = true; row(r + 1, c); cols[c] = regs[g] = false;
      }
    })(0, -1);
    return count;
  }
  function zones(seed, n) {
    n = n || 7;
    var r = rng(seed);
    for (var attempt = 0; attempt < 3000; attempt++) {
      var perm = [], used = [];
      var ok = (function place(row) {
        if (row === n) return true;
        var cs = shuf(Array.from({ length: n }, function (_, k) { return k; }), r);
        for (var i = 0; i < n; i++) { var c = cs[i]; if (used[c] || (row && Math.abs(perm[row - 1] - c) <= 1)) continue; used[c] = true; perm[row] = c; if (place(row + 1)) return true; used[c] = false; }
        return false;
      })(0);
      if (!ok) continue;
      var reg = new Array(n * n).fill(-1), filled = n;
      for (var q = 0; q < n; q++) reg[q * n + perm[q]] = q;
      var nb = function (i) { var y = Math.floor(i / n), x = i % n, o = []; if (y) o.push(i - n); if (y < n - 1) o.push(i + n); if (x) o.push(i - 1); if (x < n - 1) o.push(i + 1); return o; };
      while (filled < n * n) {
        var cand = [];
        for (var i = 0; i < n * n; i++) if (reg[i] < 0) nb(i).forEach(function (j) { if (reg[j] >= 0) cand.push([i, reg[j]]); });
        var pick = cand[Math.floor(r() * cand.length)];
        if (reg[pick[0]] < 0) { reg[pick[0]] = pick[1]; filled++; }
      }
      if (zonesCount(n, reg, 2) === 1) return { n: n, regions: reg, solution: perm };
    }
    return null;
  }

  // ---------- Balance: 6 by 6 circles (1) and diamonds (0), three of each per line, never three alike in a row ----------
  function balanceOk(g, i, v) {
    var y = Math.floor(i / 6), x = i % 6, rc = 0, cc = 0;
    for (var k = 0; k < 6; k++) { if (g[y * 6 + k] === v) rc++; if (g[k * 6 + x] === v) cc++; }
    if (rc >= 3 || cc >= 3) return false;
    var at = function (yy, xx) { return yy < 0 || yy > 5 || xx < 0 || xx > 5 ? -1 : (yy * 6 + xx === i ? v : g[yy * 6 + xx]); };
    for (var d = -2; d <= 0; d++) {
      if (at(y, x + d) === v && at(y, x + d + 1) === v && at(y, x + d + 2) === v) return false;
      if (at(y + d, x) === v && at(y + d + 1, x) === v && at(y + d + 2, x) === v) return false;
    }
    return true;
  }
  function balanceCount(g, limit) {
    var i = g.indexOf(-1); if (i < 0) return 1;
    var n = 0;
    for (var v = 0; v <= 1 && n < limit; v++) if (balanceOk(g, i, v)) { g[i] = v; n += balanceCount(g, limit - n); g[i] = -1; }
    return n;
  }
  function balance(seed) {
    var r = rng(seed), g = new Array(36).fill(-1);
    (function fill(i) {
      if (i === 36) return true;
      var vs = r() < 0.5 ? [0, 1] : [1, 0];
      for (var k = 0; k < 2; k++) { if (balanceOk(g, i, vs[k])) { g[i] = vs[k]; if (fill(i + 1)) return true; g[i] = -1; } }
      return false;
    })(0);
    var sol = g.slice(), puz = g.slice(), order = shuf(Array.from({ length: 36 }, function (_, k) { return k; }), r);
    order.forEach(function (i) { var keep = puz[i]; puz[i] = -1; if (balanceCount(puz.slice(), 2) !== 1) puz[i] = keep; });
    return { puzzle: puz, solution: sol };
  }
  function balanceDone(g) { for (var i = 0; i < 36; i++) { if (g[i] < 0) return false; var v = g[i]; g[i] = -1; var ok = balanceOk(g, i, v); g[i] = v; if (!ok) return false; } return true; }

  // ---------- Trail: one path through every square, visiting the numbers in order ----------
  function trail(seed, n, marks) {
    n = n || 6; marks = marks || 8;
    var r = rng(seed), N = n * n;
    var nb = function (i) { var y = Math.floor(i / n), x = i % n, o = []; if (y) o.push(i - n); if (y < n - 1) o.push(i + n); if (x) o.push(i - 1); if (x < n - 1) o.push(i + 1); return o; };
    for (var attempt = 0; attempt < 200; attempt++) {
      var path = [Math.floor(r() * N)], seen = {}, steps = 0; seen[path[0]] = true;
      var ok = (function go() {
        if (path.length === N) return true;
        if (++steps > 20000) return false;
        var cur = path[path.length - 1];
        var opts = shuf(nb(cur).filter(function (j) { return !seen[j]; }), r);
        opts.sort(function (a, b) { return nb(a).filter(function (j) { return !seen[j]; }).length - nb(b).filter(function (j) { return !seen[j]; }).length; });
        for (var k = 0; k < opts.length; k++) { seen[opts[k]] = true; path.push(opts[k]); if (go()) return true; path.pop(); seen[opts[k]] = false; }
        return false;
      })();
      if (!ok) continue;
      var idx = [0, N - 1], gap = (N - 1) / (marks - 1);
      for (var m = 1; m < marks - 1; m++) idx.push(Math.max(1, Math.min(N - 2, Math.round(m * gap + (r() - 0.5) * gap * 0.6))));
      idx = idx.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      var nums = {}; idx.forEach(function (pi, k) { nums[path[pi]] = k + 1; });
      return { n: n, path: path, nums: nums, last: idx.length };
    }
    return null;
  }

  // ---------- Link: five clues share one answer (easiest clue last) ----------
  var LINKS = [
    [['PCR', 'POLYMERASE CHAIN REACTION'], ['Primers', 'Thermal cycler', 'Taq polymerase', 'Denaturation, annealing, extension', 'Copies DNA millions of times']],
    [['CRISPR', 'CRISPR CAS9', 'GENE EDITING'], ['Guide RNA', 'Doudna and Charpentier', 'Cas9', 'Bacterial immune system', 'Cut and edit genes']],
    [['VACCINE', 'VACCINES', 'VACCINATION'], ['Adjuvant', 'Booster dose', 'Edward Jenner', 'Covaxin', 'Shots that train immunity']],
    [['ANTIBODY', 'ANTIBODIES', 'IMMUNOGLOBULIN'], ['Fab and Fc regions', 'Plasma cells', 'IgG and IgM', 'Y-shaped protein', 'Binds to an antigen']],
    [['CLINICAL TRIAL', 'CLINICAL TRIALS', 'TRIAL'], ['Informed consent', 'Placebo arm', 'Phase I to IV', 'Ethics committee', 'Testing a drug on people']],
    [['MITOCHONDRIA', 'MITOCHONDRION'], ['Cristae', 'Its own circular DNA', 'Inherited from the mother', 'Makes ATP', 'Powerhouse of the cell']],
    [['ENZYME', 'ENZYMES'], ['Michaelis-Menten', 'Active site', 'Lock and key', 'Amylase and lipase', 'Biological catalyst']],
    [['INSULIN'], ['Banting and Best', 'Beta cells', 'Recombinant in E. coli', 'Pancreas hormone', 'Treats diabetes']],
    [['STEM CELL', 'STEM CELLS'], ['Pluripotent', 'Yamanaka factors', 'Bone marrow niche', 'Umbilical cord banking', 'Can become any cell type']],
    [['PHARMACOVIGILANCE', 'DRUG SAFETY'], ['ICSR', 'MedDRA coding', 'Signal detection', 'Adverse drug reactions', 'Monitoring medicine safety']],
    [['ELECTROPHORESIS', 'GEL ELECTROPHORESIS'], ['Agarose', 'Ethidium bromide', 'DNA ladder', 'Bands on a gel', 'Separates molecules by size']],
    [['MICROSCOPE', 'MICROSCOPY'], ['Objective lens', 'Antonie van Leeuwenhoek', 'Oil immersion', 'Electron or light', 'Makes tiny things look big']],
    [['RIBOSOME', 'RIBOSOMES'], ['70S and 80S', 'rRNA', 'Large and small subunit', 'Reads mRNA', 'Makes proteins']],
    [['BACTERIA', 'BACTERIUM'], ['Gram staining', 'Peptidoglycan wall', 'Binary fission', 'E. coli', 'Treated with antibiotics']],
    [['GENOME', 'GENOMES'], ['Human Genome Project', 'Next-generation sequencing', 'About 3 billion base pairs', 'All of an organism\'s DNA', 'Your complete genetic code']],
    [['FERMENTATION'], ['Bioreactor', 'Anaerobic', 'Yeast', 'Idli batter', 'How curd and beer are made']],
    [['CHROMATOGRAPHY', 'HPLC'], ['Mobile phase', 'Retention time', 'Stationary phase', 'Column', 'Separates a mixture']],
    [['PIPETTE', 'PIPETTES', 'MICROPIPETTE'], ['Calibration', 'Reverse mode', 'Tip ejector', 'Measures microlitres', 'Lab tool for exact volumes']],
    [['CENTRIFUGE'], ['RCF', 'Rotor balance', 'Pellet and supernatant', 'Spins very fast', 'Separates by density']],
    [['HAEMOGLOBIN', 'HEMOGLOBIN'], ['Heme group', 'Iron', 'Four subunits', 'Sickle cell', 'Carries oxygen in blood']],
    [['GMP', 'GOOD MANUFACTURING PRACTICE', 'GOOD MANUFACTURING PRACTICES'], ['Batch records', 'Schedule M', 'Deviation and CAPA', 'Cleanroom', 'Quality rules for making medicines']],
    [['VIRUS', 'VIRUSES'], ['Capsid', 'Bacteriophage', 'Reverse transcriptase', 'Needs a host cell', 'Causes flu and COVID']],
    [['DNA', 'DEOXYRIBONUCLEIC ACID'], ['Rosalind Franklin', 'Phosphodiester bond', 'A, T, G and C', 'Double helix', 'Carries genetic information']],
    [['PHOTOSYNTHESIS'], ['Calvin cycle', 'Stomata', 'Chlorophyll', 'Light and carbon dioxide', 'How plants make food']],
    [['NEURON', 'NEURONS', 'NERVE CELL'], ['Node of Ranvier', 'Synapse', 'Axon', 'Dendrites', 'Brain cell']],
    [['CRICKET'], ['Duckworth-Lewis', 'Silly point', 'Ranji Trophy', 'Googly', 'Played by Kohli and Dhoni']],
    [['DIWALI', 'DEEPAVALI'], ['Lakshmi puja', 'Rangoli', 'Narak Chaturdashi', 'Diyas and crackers', 'Festival of lights']],
    [['TAJ MAHAL'], ['Ustad Ahmad Lahauri', 'Makrana marble', 'Yamuna bank', 'Shah Jahan', 'White marble wonder in Agra']],
    [['MONSOON', 'MONSOONS'], ['IMD forecast', 'Kerala onset', 'June to September', 'Umbrellas everywhere', 'India\'s rainy season']],
    [['CHESS'], ['Sicilian Defence', 'Castling', 'Viswanathan Anand', 'Checkmate', '64 squares']],
    [['ISRO'], ['PSLV', 'Sriharikota', 'Mangalyaan', 'Chandrayaan', 'India\'s space agency']],
    [['BENGALURU', 'BANGALORE'], ['Lalbagh', 'Namma Metro', 'Garden City', 'Silicon Valley of India', 'Capital of Karnataka']],
    [['CHAI', 'TEA'], ['Assam and Darjeeling', 'Cutting', 'Masala', 'Kulhad', 'India\'s favourite hot drink']],
    [['RAINBOW', 'RAINBOWS'], ['Dispersion', 'VIBGYOR', 'Sun behind you', 'After the rain', 'Seven colours in the sky']],
    [['PIANO'], ['Hammers and strings', 'Sustain pedal', 'Grand or upright', '88 keys', 'Black and white keys']],
    [['OLYMPICS', 'OLYMPIC GAMES'], ['Pierre de Coubertin', 'Neeraj Chopra gold', 'Torch relay', 'Five rings', 'Held every four years']],
    [['VOLCANO', 'VOLCANOES'], ['Pyroclastic flow', 'Barren Island', 'Magma chamber', 'Lava', 'Mountain that erupts']],
    [['MOON'], ['Mare Tranquillitatis', 'Tides', 'Craters', 'Chandrayaan landed here', 'Earth\'s natural satellite']],
    [['HONEY'], ['Nectar', 'Never spoils', 'Hive', 'Bees make it', 'Sweet and golden']],
    [['ELEPHANT', 'ELEPHANTS'], ['Musth', 'Ivory', 'Trunk', 'Ganesha', 'Largest land animal']],
    [['MANGO', 'MANGOES'], ['Totapuri', 'Langra', 'Alphonso', 'Aam panna', 'King of fruits']],
    [['YOGA'], ['Patanjali', 'Pranayama', 'Surya namaskar', 'June 21', 'Asanas and breathing']],
    [['PASSWORD', 'PASSWORDS'], ['Salted hash', 'Two-factor', 'Never share it', 'Forgot it?', 'Secret word to log in']],
    [['BIRTHDAY', 'BIRTHDAYS'], ['Candles', 'Surprise party', 'Gifts', 'Cake', 'Happy ___ to you']],
    [['TRAFFIC', 'TRAFFIC JAM'], ['Silk Board', 'Signal', 'Honking', 'Rush hour', 'Bengaluru roads at 6 pm']]
  ];
  function linkNorm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function linkLev(a, b) { var d = []; for (var i = 0; i <= a.length; i++) { d[i] = [i]; for (var j = 1; j <= b.length; j++) d[i][j] = i ? Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; } return d[a.length][b.length]; }
  function linkMatch(set, guess) {
    var g = linkNorm(guess); if (!g) return false;
    return set[0].some(function (ans) { var a = linkNorm(ans); return g === a || g === a.replace(/S$/, '') || (a.length > 5 && linkLev(g, a) <= (a.length > 10 ? 2 : 1)); });
  }
  function link(day) { return LINKS[((day % LINKS.length) + LINKS.length) % LINKS.length]; }

  return { rng: rng, shuffle: shuf, sudoku: sudoku, sudokuCount: sudokuCount, crossword: crossword, tambolaTicket: tambolaTicket, hash: hash, tttWin: tttWin, c4Drop: c4Drop, c4Win: c4Win, CROSS_BIO: CROSS_BIO, CROSS_EN: CROSS_EN,
    zones: zones, zonesCount: zonesCount, balance: balance, balanceOk: balanceOk, balanceDone: balanceDone, balanceCount: balanceCount, trail: trail, link: link, linkMatch: linkMatch, LINKS: LINKS };
})();
if (typeof module !== 'undefined') module.exports = GameLogic;
