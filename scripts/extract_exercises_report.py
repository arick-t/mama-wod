# -*- coding: utf-8 -*-
"""
Extract exercises from all workouts and map to Find Workout (EQ) categories.
Produces: EXERCISES_AND_SOURCES.md with categories, unknowns, and per-source WOD separation.
"""
import json
import re
import os
from collections import defaultdict

EQ = {
    "RUN": ["run", "running", "meter", "mile", "km"],
    "BARBELL": ["barbell", "clean", "snatch", "deadlift", "squat", "press", "jerk", "thruster", "overhead squat", "power clean", "squat clean", "shoulder to overhead", "s2oh"],
    "PULL-UP": ["pull-up", "pullup", "pull up", "chest-to-bar", "chest to bar", "c2b", "muscle-up", "muscle up", "mu", "bar muscle up", "bmu", "toes to bar", "toes-to-bar", "ttb", "t2b", "chin up", "chin-up", "ring row"],
    "PUSH-UP": ["push-up", "pushup", "push up", "handstand push", "hspu", "push press", "strict press"],
    "ROW": ["row", "rowing", "rower", "cal row", "calorie row"],
    "BIKE": ["bike", "assault bike", "echo bike", "cal bike", "biking", "c2 bike"],
    "DUMBBELL": ["dumbbell", "db ", "db.", "dumbbell", "step-up", "step up", "s-db", "gorilla row", "turkish get-up", "get-up"],
    "KETTLEBELL": ["kettlebell", "kb ", "kb.", "kettlebell swing", "kb swing"],
    "ROPE CLIMB": ["rope climb"],
    "DOUBLE UNDERS": ["double under", " du ", "double-under", "double under"],
    "WALL BALL": ["wall ball", "wallball", "wall-ball", "medicine ball", "med ball"],
    "HANDSTAND": ["handstand", "hspu", "handstand push", "freestanding handstand", "wall walk"],
    "WALL WALK": ["wall walk", "wallwalk", "wall-walk"],
    "LUNGE": ["lunge", "lunges"],
    "RINGS": ["ring", "rings", "ring dip", "ring row", "ring muscle up", "ring dip", "l-sit", "l sit"],
    "SKI": ["ski", "ski erg", "skierg", "ski/"],
    "SLED": ["sled", "sled push", "sled pull"],
    "TOES TO BAR": ["toes to bar", "toes-to-bar", "ttb", "t2b", "toes to bar"],
    "BOX": ["box", "box jump", "box step", "bjo", "box jump over", "burpee box jump", "bbjo", "step up", "step-up"],
}

# Section title patterns: WOD vs warm-up vs strength (same logic as index.html WOD_SECTION_RE + extras)
WOD_RE = re.compile(r"wod|metcon|conditioning|amrap|emom|for\s*time|workout|for time", re.I)
WARMUP_RE = re.compile(r"warm\s*up|warm-up|mobility|general warm", re.I)
STRENGTH_RE = re.compile(r"^strength|^skill|^oly|^weightlifting|squat\s*$|press\s*$|deadlift\s*$", re.I)
# Open/Hero/Benchmark often have workout name as title - treat as WOD
OPEN_HERO_BENCH_RE = re.compile(r"open\s*\d|hero|benchmark|nancy|diane|fran|grace|angie|barbara|chelsea|dallas|murph|hotshots|morrison", re.I)


def normalize_line(line):
    if not line or not isinstance(line, str):
        return ""
    return " " + line.lower().strip() + " "


def line_matches_eq(line, eq_keywords):
    n = normalize_line(line)
    for kw in eq_keywords:
        if kw in n:
            return True
    return False


def categorize_line(line):
    """Return list of EQ categories this line matches."""
    n = normalize_line(line)
    matched = []
    for cat, kws in EQ.items():
        for kw in kws:
            if kw in n:
                matched.append(cat)
                break
    return matched


def section_type(source, section_title):
    title = (section_title or "").strip().lower()
    if OPEN_HERO_BENCH_RE.search(title) or (source in ("hero", "benchmark", "open") and title):
        return "wod"
    if WOD_RE.search(title):
        return "wod"
    if WARMUP_RE.search(title):
        return "warmup"
    if STRENGTH_RE.search(title):
        return "strength"
    if title in ("rest day", "rest"):
        return "rest"
    return "other"


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base, "data")
    workouts_path = os.path.join(data_dir, "workouts.json")
    special_path = os.path.join(data_dir, "special_cache.json")

    with open(workouts_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    workouts_by_date = data.get("workouts") or {}

    try:
        with open(special_path, "r", encoding="utf-8") as f:
            special = json.load(f)
    except Exception:
        special = {"heroes": [], "benchmarks": [], "open": []}

    # Collect: by category -> set of line snippets; unknown list; by source -> section types
    by_category = defaultdict(set)
    unknown_lines = []
    source_section_types = defaultdict(lambda: defaultdict(int))
    source_has_wod_separate = {}
    all_sources = set()

    def process_lines(source, section_title, lines, source_name):
        stype = section_type(source, section_title)
        source_section_types[source][stype] += 1
        all_sources.add(source)
        for line in (lines or []):
            if not line or not isinstance(line, str) or len(line.strip()) < 2:
                continue
            line_stripped = line.strip()[:120]
            cats = categorize_line(line)
            if cats:
                for c in cats:
                    by_category[c].add(line_stripped)
            else:
                # Only count as unknown if it looks like an exercise (has numbers or rep-like words)
                if re.search(r"\d+|\b(reps?|rounds?|cal|meter|minute|lb|kg)\b", line, re.I):
                    unknown_lines.append((source, section_title or "", line_stripped))

    for date_key, wlist in workouts_by_date.items():
        for w in wlist or []:
            source = w.get("source") or "unknown"
            for sec in w.get("sections") or []:
                title = sec.get("title") or ""
                process_lines(source, title, sec.get("lines"), w.get("source_name"))

    for key in ("heroes", "benchmarks", "open"):
        source_id = "hero" if key == "heroes" else ("benchmark" if key == "benchmarks" else "open")
        for it in special.get(key) or []:
            name = it.get("name") or "WORKOUT"
            process_lines(source_id, name, it.get("lines"), None)

    # Can we separate WOD from rest per source?
    for src in sorted(all_sources):
        counts = source_section_types[src]
        has_wod = (counts.get("wod", 0) + counts.get("other", 0)) > 0
        has_warmup = counts.get("warmup", 0) > 0
        has_strength = counts.get("strength", 0) > 0
        source_has_wod_separate[src] = {
            "has_wod_sections": has_wod,
            "has_warmup": has_warmup,
            "has_strength": has_strength,
            "can_separate": has_warmup or has_strength or (counts.get("other", 0) > 0 and counts.get("wod", 0) > 0),
            "counts": dict(counts),
        }

    # Build markdown
    out_path = os.path.join(base, "EXERCISES_AND_SOURCES.md")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# תרגילים ממאגר האימונים – מיפוי לקטגוריות איתור אימון\n\n")
        f.write("דוח אוטומטי: חילוץ תרגילים מכל האימונים שמופיעים באפליקציה (workouts.json + special_cache.json) ומיפוי לקטגוריות הציוד בסעיף איתור אימון.\n\n")
        f.write("---\n\n")

        f.write("## 1. תרגילים לפי קטגוריה (סעיף איתור אימון)\n\n")
        for cat in sorted(EQ.keys()):
            items = sorted(by_category.get(cat, []))
            f.write(f"### {cat}\n\n")
            if items:
                for line in items[:80]:  # cap per category
                    f.write(f"- {line}\n")
                if len(items) > 80:
                    f.write(f"- *... ועוד {len(items) - 80}*\n")
            else:
                f.write("- *(אין תרגילים שזוהו בקטגוריה זו במאגר הנוכחי)*\n")
            f.write("\n")

        f.write("---\n\n## 2. תרגילים שלא שויכו לקטגוריה\n\n")
        f.write("שורות שנראות כמו תרגיל (מכילות מספרים/reps/rounds וכו') אך לא התאמו למילות המפתח של הקטגוריות הקיימות.\n\n")
        # Dedupe by line text
        seen_unknown = set()
        for src, title, line in unknown_lines:
            key = (src, line)
            if key in seen_unknown:
                continue
            seen_unknown.add(key)
            f.write(f"- `[{src}]` {line}\n")
        f.write("\n---\n\n")

        f.write("## 3. מקורות – האם ניתן להפריד WOD מחימום/כוח\n\n")
        f.write("| מקור | יש סקשן WOD | יש חימום | יש כוח/סקיל | ניתן להפריד? |\n")
        f.write("|------|-------------|----------|-------------|-------------|\n")
        for src in sorted(all_sources):
            info = source_has_wod_separate[src]
            c = info["counts"]
            wod_ok = "כן" if info["has_wod_sections"] else "לא"
            warm_ok = "כן" if info["has_warmup"] else "לא"
            str_ok = "כן" if info["has_strength"] else "לא"
            sep_ok = "כן" if info["can_separate"] else "לא"
            f.write(f"| {src} | {wod_ok} | {warm_ok} | {str_ok} | {sep_ok} |\n")
        f.write("\nהערות:\n")
        f.write("- **WOD** = לב האימון (METCON, AMRAP, For Time, וכו').\n")
        f.write("- **הפרדה** = יש במבנה המקור כותרות שמבחינות בין חימום/כוח ל־WOD (למשל Warm-up, Strength, Conditioning).\n")
        f.write("- באפליקציה משתמשים ב־`WOD_SECTION_RE` ו־`getWodOnlyText()` כדי לחשב ניקוד התאמה רק מטקסט ה־WOD.\n")

    print("Wrote", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
