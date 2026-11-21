// Renders the Zones tutorial: one JPEG per state, then one MP4 per scene (same size/fps/encoder), then concat.
const puppeteer = require('puppeteer-core'); const fs = require('fs'); const { execFileSync } = require('child_process');
const D = [3.76, 4.51, 4.64, 4.27, 6.13, 5.34, 5.85, 8.96].map(x => x + 0.6); D[0] += 0.4;
const CAP = ['Welcome to Zones, one of the daily puzzles in the Virtual Office Game zone.',
 'The grid is split into seven coloured zones, and your job is to place seven flasks.',
 'Every row, every column, and every coloured zone must hold exactly one flask.',
 'And two flasks can never touch each other, not even diagonally, at a corner.',
 'Click a square once to mark it with a cross, when you know a flask cannot go there. Click it again to place a flask.',
 'If two flasks break a rule, they turn red, so you can spot the mistake and fix it straight away.',
 'Stuck? Press Hint to reveal one correct flask. Each hint adds fifteen seconds to your time.',
 "Place all seven flasks correctly, and your time goes on your team's board. Everyone gets the same puzzle, and a new one arrives every day. Good luck!"];
const M = (o) => o; // marks helper
function scenes() {
  const S = [];
  S.push([[{ cap: CAP[0], rules: 0 }, 1]]);
  const z = []; for (let k = 0; k < 7; k++) z.push([{ cap: CAP[1], zone: k, rules: 0 }, 0.6]); z.push([{ cap: CAP[1], rules: 0 }, 0.0001]); S.push(z);
  S.push([[{ cap: CAP[2], marks: { 0: 2 }, row: 0, rules: 1, ruleNow: 0 }, 0.33], [{ cap: CAP[2], marks: { 0: 2 }, col: 0, rules: 1, ruleNow: 0 }, 0.33], [{ cap: CAP[2], marks: { 0: 2 }, zone: 0, rules: 1, ruleNow: 0 }, 0.34]]);
  S.push([[{ cap: CAP[3], marks: { 0: 2, 8: 2 }, rules: 2, ruleNow: 1 }, 0.22], [{ cap: CAP[3], marks: { 0: 2, 8: 2 }, red: [0, 8], tags: [[8, 'Touching']], rules: 2, ruleNow: 1 }, 0.78]]);
  const b = { 0: 2 };
  S.push([
    [{ cap: CAP[4], marks: { ...b }, rules: 3, ruleNow: 2, cursor: 1 }, 0.1],
    [{ cap: CAP[4], marks: { ...b, 1: 1 }, rules: 3, ruleNow: 2, cursor: 1, click: true }, 0.12],
    [{ cap: CAP[4], marks: { ...b, 1: 1 }, rules: 3, ruleNow: 2, cursor: 7 }, 0.08],
    [{ cap: CAP[4], marks: { ...b, 1: 1, 7: 1 }, rules: 3, ruleNow: 2, cursor: 7, click: true }, 0.14],
    [{ cap: CAP[4], marks: { ...b, 1: 1, 7: 1 }, rules: 3, ruleNow: 2, cursor: 9 }, 0.1],
    [{ cap: CAP[4], marks: { ...b, 1: 1, 7: 1, 9: 1 }, rules: 3, ruleNow: 2, cursor: 9, click: true }, 0.16],
    [{ cap: CAP[4], marks: { ...b, 1: 1, 7: 1, 9: 2 }, rules: 3, ruleNow: 2, cursor: 9, click: true }, 0.3]]);
  const c = { 0: 2, 1: 1, 7: 1, 9: 2 };
  S.push([
    [{ cap: CAP[5], marks: { ...c, 13: 2 }, rules: 3, cursor: 13, click: true }, 0.2],
    [{ cap: CAP[5], marks: { ...c, 13: 2 }, red: [9, 13], tags: [[13, 'Same row']], rules: 3 }, 0.5],
    [{ cap: CAP[5], marks: { ...c }, rules: 3, cursor: 13, click: true }, 0.3]]);
  S.push([
    [{ cap: CAP[6], marks: { ...c }, rules: 3, cursor: 'hint' }, 0.35],
    [{ cap: CAP[6], marks: { ...c }, rules: 3, cursor: 'hint', click: true }, 0.15],
    [{ cap: CAP[6], marks: { ...c, 19: 2 }, rules: 3, penalty: true }, 0.5]]);
  const d = { 0: 2, 9: 2, 19: 2 }; const rest = [24, 34, 39, 43]; const st = [];
  let m = { ...d }; for (const i of rest) { m = { ...m, [i]: 2 }; st.push([{ cap: CAP[7], marks: { ...m }, rules: 3, cursor: i, click: true }, 0.07]); }
  st.push([{ cap: CAP[7], marks: { ...m }, side: 'win' }, 0.72]); S.push(st);
  return S;
}
(async () => {
  const br = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const pg = await br.newPage(); await pg.setViewport({ width: 1280, height: 720 });
  await pg.goto('file://' + __dirname + '/zones-page.html'); await pg.evaluate(() => document.fonts.ready);
  const S = scenes(); fs.mkdirSync('zones', { recursive: true });
  for (let k = 0; k < S.length; k++) {
    const list = []; const tot = S[k].reduce((a, x) => a + x[1], 0);
    for (let j = 0; j < S[k].length; j++) {
      await pg.evaluate((s) => window.render(s), S[k][j][0]);
      const f = `zones/s${k}_${j}.jpg`; await pg.screenshot({ path: f, type: 'jpeg', quality: 92 });
      list.push(`file 's${k}_${j}.jpg'\nduration ${(S[k][j][1] / tot * D[k]).toFixed(3)}`);
    }
    list.push(`file 's${k}_${S[k].length - 1}.jpg'`);
    fs.writeFileSync(`zones/s${k}.txt`, list.join('\n') + '\n');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `zones/s${k}.txt`, '-vf', `fps=30,format=yuv420p,trim=duration=${D[k].toFixed(3)}`, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', `zones/tmp_s${k}.mp4`]);
    fs.renameSync(`zones/tmp_s${k}.mp4`, `zones/s${k}.mp4`);
  }
  await br.close();
  fs.writeFileSync('zones/scenes.txt', S.map((_, k) => `file 's${k}.mp4'`).join('\n') + '\n');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'zones/scenes.txt', '-c', 'copy', 'zones/video_silent.mp4']);
  console.log('scene seconds', D.map(x => x.toFixed(2)).join(' '), 'total', D.reduce((a, b) => a + b, 0).toFixed(2));
})();
