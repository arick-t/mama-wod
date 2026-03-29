/**
 * Extracts all exercise lines from workouts.json + special_cache.json,
 * categorizes by Find Workout EQ keywords, and reports per-source WOD separation.
 * Run: node scripts/extract-exercises.js
 * Output: updates EXERCISES_AND_SOURCES.md with "חולצו מהנתונים" section.
 */

const fs = require('fs');
const path = require('path');

const EQ = {
  "RUN":         ["run","running","meter","mile","km"],
  "BARBELL":     ["barbell","clean","snatch","deadlift","squat","press","jerk"],
  "PULL-UP":     ["pull-up","pullup","pull up","chest-to-bar","chest to bar","c2b","muscle-up","muscle up","mu","bar muscle up","bmu","toes to bar","toes-to-bar","ttb","t2b"],
  "PUSH-UP":     ["push-up","pushup","push up"],
  "ROW":         ["row","rowing","rower","cal row"],
  "BIKE":        ["bike","assault bike","echo bike","cal bike"],
  "DUMBBELL":    ["dumbbell","db "],
  "KETTLEBELL":  ["kettlebell","kb "],
  "ROPE CLIMB":  ["rope climb"],
  "DOUBLE UNDERS":["double under"," du "],
  "WALL BALL":   ["wall ball","wallball"],
  "HANDSTAND":   ["handstand","hspu"],
  "WALL WALK":   ["wall walk","wallwalk"],
  "LUNGE":       ["lunge","lunges"],
  "RINGS":       ["ring","rings","muscle-up","muscle up"],
  "SKI":         ["ski","ski erg","skierg"],
  "SLED":        ["sled","sled push","sled pull"],
  "TOES TO BAR": ["toes to bar","toes-to-bar","ttb","t2b"],
  "BOX":         ["box","box jump","box step","bjo","box jump over","burpee box jump over"]
};

const WOD_SECTION_RE = /wod|metcon|conditioning|amrap|emom|for\s*time|workout/i;

function categorizeLine(line) {
  if (!line || typeof line !== 'string') return [];
  const low = line.toLowerCase();
  const cats = [];
  for (const [cat, kws] of Object.entries(EQ)) {
    for (const kw of kws) {
      if (low.includes(kw)) { cats.push(cat); break; }
    }
  }
  return cats;
}

function normalizeLine(line) {
  return String(line).trim().slice(0, 120);
}

function collectFromWorkouts(workoutsByDate) {
  const byCategory = {};
  for (const k of Object.keys(EQ)) byCategory[k] = new Set();
  const uncategorized = new Set();
  const sourceSectionTitles = {}; // source -> Set of section titles

  for (const date of Object.keys(workoutsByDate)) {
    const list = workoutsByDate[date];
    if (!Array.isArray(list)) continue;
    for (const w of list) {
      const src = w.source || 'unknown';
      if (!sourceSectionTitles[src]) sourceSectionTitles[src] = new Set();
      const secs = w.sections || [];
      for (const s of secs) {
        if (s && s.title) sourceSectionTitles[src].add(s.title.trim());
        const lines = s.lines || [];
        for (const line of lines) {
          const norm = normalizeLine(line);
          if (!norm) continue;
          const cats = categorizeLine(norm);
          if (cats.length) {
            for (const c of cats) byCategory[c].add(norm);
          } else {
            uncategorized.add(norm);
          }
        }
      }
    }
  }
  return { byCategory, uncategorized, sourceSectionTitles };
}

function collectFromSpecial(special) {
  const byCategory = {};
  for (const k of Object.keys(EQ)) byCategory[k] = new Set();
  const uncategorized = new Set();

  for (const listName of ['heroes', 'benchmarks', 'open']) {
    const list = special[listName];
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      const lines = it.lines || [];
      const name = it.name || '';
      for (const line of lines) {
        const norm = normalizeLine(line);
        if (!norm) continue;
        const cats = categorizeLine(norm);
        if (cats.length) {
          for (const c of cats) byCategory[c].add(norm);
        } else {
          uncategorized.add(norm);
        }
      }
    }
  }
  return { byCategory, uncategorized };
}

function mergeMaps(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = new Set([...(a[k] || []), ...(b[k] || [])]);
  }
  return out;
}

function canSeparateWOD(titlesSet) {
  for (const t of titlesSet) {
    if (WOD_SECTION_RE.test(t)) return true;
  }
  return false;
}

const root = path.join(__dirname, '..');
const workoutsPath = path.join(root, 'data', 'workouts.json');
const specialPath = path.join(root, 'data', 'special_cache.json');

let workoutsData = { workouts: {} };
let specialData = { heroes: [], benchmarks: [], open: [] };
try {
  workoutsData = JSON.parse(fs.readFileSync(workoutsPath, 'utf8'));
} catch (e) {
  console.error('Could not read workouts.json', e.message);
}
try {
  specialData = JSON.parse(fs.readFileSync(specialPath, 'utf8'));
} catch (e) {
  console.error('Could not read special_cache.json', e.message);
}

const w = collectFromWorkouts(workoutsData.workouts || {});
const s = collectFromSpecial(specialData);

const byCategory = mergeMaps(w.byCategory, s.byCategory);
const uncategorized = new Set([...w.uncategorized, ...s.uncategorized]);

// Sort each set to array
const catArrays = {};
for (const k of Object.keys(EQ)) {
  catArrays[k] = [...(byCategory[k] || [])].sort();
}
const uncatArray = [...uncategorized].sort();

const sourceWod = {};
for (const src of Object.keys(w.sourceSectionTitles || {})) {
  sourceWod[src] = canSeparateWOD(w.sourceSectionTitles[src]);
}

// Build markdown section
const lines = [
  '# תרגילים לפי קטגוריות איתור אימון + מקורות והפרדת WOD',
  '',
  '## איך איתור האימון מזהה ציוד/תרגילים',
  '',
  'האפליקציה מתבססת על **מילות מפתח (keywords)** בתוך טקסט האימון. לכל קטגוריה ב־"Available Equipment" יש מערך מילות מפתח ב־`EQ`.',
  '',
  '---',
  '',
  '## קטגוריות איתור אימון – מילות מפתח (EQ)',
  '',
  '| קטגוריה | מילות מפתח |',
  '|----------|------------|'
];

for (const [cat, kws] of Object.entries(EQ)) {
  lines.push('| **' + cat + '** | ' + kws.join(', ') + ' |');
}

lines.push('');
lines.push('---');
lines.push('');
lines.push('## תרגילים שחולצו מהאימונים (לפי קטגוריה)');
lines.push('');
lines.push('הרשימה הבאה נוצרה מריצת `node scripts/extract-exercises.js` על `data/workouts.json` ו־`data/special_cache.json`. כל שורה היא טקסט שמופיע באימון ומתאים למילות המפתח של הקטגוריה.');
lines.push('');

for (const cat of Object.keys(EQ)) {
  const arr = catArrays[cat] || [];
  lines.push('### ' + cat + ' (' + arr.length + ')');
  lines.push('');
  if (arr.length) {
    for (const x of arr.slice(0, 150)) lines.push('- ' + x.replace(/\|/g, '\\|'));
    if (arr.length > 150) lines.push('- _... ועוד ' + (arr.length - 150) + '_');
  } else {
    lines.push('(אין תרגילים שזוהו)');
  }
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('## תרגילים שלא שויכו לקטגוריה');
lines.push('');
lines.push('תרגילים/שורות שמופיעים באימונים ולא התאימו לאף מילת מפתח ב־EQ.');
lines.push('');
for (const x of uncatArray.slice(0, 250)) {
  lines.push('- ' + x.replace(/\|/g, '\\|'));
}
if (uncatArray.length > 250) {
  lines.push('- _... ועוד ' + (uncatArray.length - 250) + '_');
}

lines.push('');
lines.push('---');
lines.push('');
lines.push('## מקורות והפרדת WOD');
lines.push('');
lines.push('האם אנחנו מפרידים בין WOD (לב האימון) לחימום/כוח? **כן, כשכותרת סקשן מתאימה ל־** `wod|metcon|conditioning|amrap|emom|for time|workout`.');
lines.push('');
lines.push('| מקור | הפרדת WOD אפשרית? (לפי כותרות סקשנים בנתונים) |');
lines.push('|------|-----------------------------------------------|');

for (const src of Object.keys(sourceWod).sort()) {
  lines.push('| ' + src + ' | ' + (sourceWod[src] ? 'כן' : 'לא') + ' |');
}

lines.push('');
lines.push('_מקורות heroes, benchmarks, open מגיעים מ־special_cache (ללא פירוק סקשנים לפי מקור ב־workouts.json)._');
lines.push('');

fs.writeFileSync(path.join(root, 'EXERCISES_AND_SOURCES.md'), lines.join('\n'), 'utf8');
console.log('Wrote EXERCISES_AND_SOURCES.md');
console.log('Categories:', Object.keys(EQ).length);
console.log('Uncategorized lines:', uncatArray.length);
