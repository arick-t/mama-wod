# GYM EQUIPMENT REFERENCE — GENERIC COMMERCIAL GYM

## What this document is

This is a curated inventory of the physical equipment found in a standard commercial
gym, built for one purpose: to let a training program be generated **without the athlete
ever having to photograph or list their gym**.

It was produced by taking a raw, unverified equipment list and refining it against three
criteria that the original list failed:

1. **Availability honesty.** The original mixed "exists in every gym" with "exists in a
   well-equipped gym." Items were re-graded into availability tiers so that a program
   generator knows exactly what it is safe to assume.
2. **De-duplication.** Redundant entries were merged (flat bench + adjustable bench,
   power rack + half rack, 45-degree leg press + horizontal leg press, lying leg curl +
   seated leg curl). Items that are not equipment at all — e.g. "triceps pushdown
   station," which is just a cable column plus an attachment — were removed and replaced
   with the thing that actually matters: the list of **cable attachments**.
3. **Usable structure.** A flat list of machine names does not help anyone build a
   program. The inventory is therefore cross-classified three ways — by muscle group, by
   Push/Pull/Legs, and by Upper/Lower — so that any split can be checked for coverage
   before a single exercise is prescribed.

## What you are being asked to build with it

Use this inventory as the **hard equipment constraint** when designing training programs —
primarily **AB splits** (Upper/Lower or Push/Pull) and **Full-Body** programs.

Every exercise you prescribe must map to equipment that exists in this document. If a
desired exercise has no equipment match, substitute it rather than prescribing it and
hoping.

## Rules of use — read before prescribing anything

- **Tier 1 may be assumed present. Tier 2 may not.** If a program depends on a Tier 2
  item, either confirm it with the athlete first or supply a Tier 1 fallback alongside it.
  Never build a program whose backbone rests on Tier 2.
- **Tier percentages are expert estimates, not measured data.** Treat them as confidence
  levels, not facts.
- **"Commercial gym" is the assumption.** This document does NOT describe a hotel gym or
  an apartment-building gym — those hold roughly only dumbbells, a bench, cardio machines,
  and perhaps a single multi-station. If the athlete trains somewhere like that, this
  inventory does not apply.
- **Multi-purpose tools repeat across categories on purpose.** Dumbbells, the Olympic
  barbell, the cable pulley, and the adjustable bench appear under nearly every heading.
  That is correct — they are tools, not single-purpose machines. It is not duplication.
- **Push/Pull/Legs has no native slot for core.** Core work attaches to the Pull day or
  the Legs day, or stands alone. It is marked as a floating category; do not invent a
  home for it.
- **Lower-body programming is robust; upper-body programming is fragile.** In all three
  classification schemes, the Legs/Lower day is almost entirely Tier 1, while the upper
  body leans on Tier 2 (shoulder press machine, rear delt fly, lateral raise machine,
  preacher bench). Substitution logic is needed for the upper body far more than the lower.
- **Even within Tier 1 there is a safest core.** These are effectively 100%: dumbbells,
  Olympic barbell + plates, adjustable bench, flat bench press station, squat rack or
  Smith machine, lat pulldown, at least one cable column, leg press, leg extension, leg
  curl, treadmill, mats. The weakest Tier 1 members — closer to 85% than 97% — are the
  abductor/adductor machine, the assisted dip/chin machine, and having *two separate*
  cable columns (a small gym will have one, not a crossover).

---

# SECTION A — MASTER INVENTORY BY AVAILABILITY TIER

```json
{
  "meta": {
    "purpose": "Generic equipment profile for building AB split and Full-Body programs",
    "tiers": {
      "tier_1": "~90-100% of commercial gyms — safe to assume present",
      "tier_2": "~50-80% — confirm with the athlete, always carry a fallback",
      "tier_3": "do not assume — CrossFit / specialist facilities only"
    },
    "note": "Availability percentages are expert estimates, not measured data"
  },

  "tier_1_assume_present": {
    "free_weights": [
      "Dumbbells (full rack, ~2-40kg)",
      "Olympic Barbell 20kg + Weight Plates + Collars",
      "EZ / Curl Bar",
      "Adjustable Bench (flat / incline / decline)",
      "Flat Bench (multiple units)"
    ],
    "racks": [
      "Squat Rack or Power Rack (J-hooks + safety bars)",
      "Flat Bench Press Station (bench with uprights)",
      "Smith Machine",
      "Pull-up Bar (usually mounted on the rack)"
    ],
    "cables": [
      "Lat Pulldown Machine",
      "Seated Cable Row Machine",
      "Dual Adjustable Pulley / Cable Crossover",
      "Cable Attachments: rope, straight bar, V-handle, single D-handle, wide lat bar, ankle strap"
    ],
    "machines_upper": [
      "Chest Press Machine (seated)",
      "Pec Deck / Butterfly",
      "Assisted Dip / Chin-up Machine"
    ],
    "machines_lower": [
      "Leg Press (45-degree or horizontal — one of them)",
      "Leg Extension Machine",
      "Leg Curl Machine (lying or seated — one of them)",
      "Abductor / Adductor Machine"
    ],
    "bodyweight_core": [
      "Dip Station / Parallel Bars",
      "Exercise Mats"
    ],
    "cardio": [
      "Treadmill",
      "Stationary Bike",
      "Elliptical or Stair Climber"
    ]
  },

  "tier_2_confirm_with_athlete": {
    "free_weights": [
      "Kettlebells",
      "Fixed-weight Barbells (10-45kg straight bars)",
      "Preacher Curl Bench",
      "Landmine Attachment / T-Bar Row",
      "Resistance Bands (loop + tube)",
      "Medicine Balls / Slam Balls",
      "Plyo Box / Step",
      "Ab Wheel",
      "Dip Belt",
      "Lifting Straps"
    ],
    "machines": [
      "Shoulder Press Machine",
      "Hack Squat Machine",
      "Rear Delt Fly Machine",
      "Lateral Raise Machine",
      "Standing or Seated Calf Raise Machine",
      "Plate-Loaded Row (Hammer Strength style)",
      "Incline Chest Press Machine",
      "Hip Thrust Machine",
      "Second Leg Curl variant (the one the gym does not already have)"
    ],
    "core_stations": [
      "45-degree Hyperextension / Back Extension Bench",
      "Roman Chair / Captain's Chair (vertical knee raise)",
      "Decline Ab Bench",
      "Ab Slings / Hanging Leg Raise Station"
    ],
    "cardio": [
      "Rower (Concept2 style)"
    ]
  },

  "tier_3_do_not_assume": [
    "Glute Ham Developer (GHD)",
    "Gymnastic Rings",
    "TRX / Suspension Trainer",
    "Bumper Plates",
    "Trap / Hex Bar",
    "Safety Squat Bar",
    "Sled / Prowler",
    "SkiErg / Assault Bike",
    "Reverse Hyper",
    "Belt Squat / Pendulum Squat",
    "Jump Rope"
  ],

  "movement_pattern_map": {
    "horizontal_push": ["Barbell Bench Press", "Dumbbell Bench Press", "Chest Press Machine", "Cable Press", "Smith Bench Press"],
    "vertical_push": ["Barbell Overhead Press", "Dumbbell Shoulder Press", "Smith Overhead Press", "Shoulder Press Machine"],
    "horizontal_pull": ["Seated Cable Row", "Barbell Bent-Over Row", "Dumbbell Row", "Chest-Supported Row on Incline Bench", "T-Bar Row"],
    "vertical_pull": ["Pull-up / Chin-up", "Lat Pulldown", "Assisted Pull-up Machine", "Single-Arm Cable Pulldown"],
    "knee_dominant": ["Back Squat", "Front Squat", "Leg Press", "Hack Squat", "Goblet Squat", "Smith Squat", "Leg Extension"],
    "hip_dominant": ["Romanian Deadlift (barbell/dumbbell)", "Conventional Deadlift", "Hip Thrust (barbell on bench)", "Leg Curl", "45-degree Back Extension", "Cable Pull-Through"],
    "single_leg": ["Walking / Reverse Lunge", "Bulgarian Split Squat", "Step-up on Bench/Box", "Single-Leg Press"],
    "elbow_flexion": ["EZ Bar Curl", "Dumbbell Curl", "Cable Curl", "Preacher Curl", "Hammer Curl"],
    "elbow_extension": ["Cable Pushdown (rope/bar)", "Overhead Dumbbell Extension", "Skull Crusher (EZ)", "Dips", "Close-Grip Bench"],
    "lateral_delt": ["Dumbbell Lateral Raise", "Cable Lateral Raise", "Machine Lateral Raise"],
    "rear_delt_upper_back": ["Reverse Pec Deck", "Cable Face Pull", "Dumbbell Rear Delt Fly"],
    "calves": ["Standing Calf Raise Machine", "Seated Calf Raise", "Smith Machine Calf Raise", "Leg Press Calf Press"],
    "core_anti_extension": ["Plank", "Ab Wheel", "Hanging Leg Raise", "Dead Bug"],
    "core_anti_rotation": ["Pallof Press (cable)", "Suitcase Carry (dumbbell)"],
    "core_flexion": ["Cable Crunch", "Decline Sit-up", "Captain's Chair Knee Raise"]
  },

  "minimum_viable_gym": {
    "note": "Any valid AB or Full-Body program can be built from these items alone",
    "items": [
      "Dumbbells",
      "Olympic Barbell + Plates",
      "Adjustable Bench",
      "Squat Rack with Pull-up Bar",
      "Lat Pulldown",
      "Seated Cable Row or Adjustable Pulley",
      "Leg Press",
      "Leg Curl",
      "Mat"
    ]
  }
}
```

---

# SECTION B — THE SAME INVENTORY, CROSS-CLASSIFIED THREE WAYS

Tier 3 is intentionally excluded from this section: it is never programmed against.

```json
{
  "scheme_1_muscle_groups": {
    "back": {
      "tier_1": ["Lat Pulldown Machine", "Seated Cable Row Machine", "Pull-up Bar", "Assisted Dip / Chin-up Machine", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments", "Olympic Barbell + Plates", "Dumbbells", "Adjustable Bench (chest-supported row)", "Smith Machine", "Squat Rack (deadlift / rack pull)"],
      "tier_2": ["Plate-Loaded Row (Hammer Strength)", "Landmine Attachment / T-Bar Row", "45-degree Hyperextension Bench", "Fixed-weight Barbells", "Dip Belt (weighted pull-ups)", "Lifting Straps", "Resistance Bands", "Kettlebells"]
    },
    "shoulders": {
      "tier_1": ["Dumbbells", "Olympic Barbell + Plates", "Smith Machine", "Squat Rack (overhead press)", "Adjustable Bench (seated press)", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments (rope face pull, single handle)", "Pec Deck (reverse setting)"],
      "tier_2": ["Shoulder Press Machine", "Lateral Raise Machine", "Rear Delt Fly Machine", "Landmine Attachment (landmine press)", "Kettlebells", "Fixed-weight Barbells", "Resistance Bands"]
    },
    "triceps": {
      "tier_1": ["Dual Adjustable Pulley / Cable Crossover", "Cable Attachments (rope, straight bar, V-handle)", "EZ / Curl Bar", "Dumbbells", "Olympic Barbell + Plates (close-grip bench)", "Flat Bench Press Station", "Adjustable Bench", "Flat Bench", "Dip Station / Parallel Bars", "Assisted Dip / Chin-up Machine", "Smith Machine"],
      "tier_2": ["Dip Belt", "Fixed-weight Barbells", "Resistance Bands", "Kettlebells"]
    },
    "chest": {
      "tier_1": ["Flat Bench Press Station", "Olympic Barbell + Plates", "Dumbbells", "Adjustable Bench", "Flat Bench", "Chest Press Machine", "Pec Deck / Butterfly", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments", "Smith Machine", "Dip Station / Parallel Bars", "Assisted Dip / Chin-up Machine"],
      "tier_2": ["Incline Chest Press Machine", "Landmine Attachment (landmine press)", "Medicine Balls (plyo push-up / throws)", "Resistance Bands"]
    },
    "biceps": {
      "tier_1": ["EZ / Curl Bar", "Dumbbells", "Olympic Barbell + Plates", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments (straight bar, rope, single handle)", "Adjustable Bench (incline curl)", "Lat Pulldown Machine (underhand close grip)"],
      "tier_2": ["Preacher Curl Bench", "Fixed-weight Barbells", "Landmine Attachment", "Resistance Bands", "Kettlebells"]
    },
    "legs": {
      "tier_1": ["Squat Rack / Power Rack", "Olympic Barbell + Plates", "Smith Machine", "Leg Press", "Leg Extension Machine", "Leg Curl Machine", "Abductor / Adductor Machine", "Dumbbells", "Flat Bench (hip thrust / step-up)", "Adjustable Bench"],
      "tier_2": ["Hack Squat Machine", "Hip Thrust Machine", "Standing or Seated Calf Raise Machine", "Second Leg Curl variant", "45-degree Hyperextension Bench", "Kettlebells", "Plyo Box / Step", "Landmine Attachment", "Fixed-weight Barbells", "Resistance Bands"]
    },
    "core_and_abs": {
      "tier_1": ["Exercise Mats", "Pull-up Bar (hanging leg raise)", "Dual Adjustable Pulley / Cable Crossover (cable crunch, Pallof press)", "Cable Attachments (rope, single handle)", "Dumbbells (suitcase carry)", "Adjustable Bench (decline sit-up)"],
      "tier_2": ["Ab Wheel", "Roman Chair / Captain's Chair", "Decline Ab Bench", "Ab Slings / Hanging Leg Raise Station", "45-degree Hyperextension Bench", "Medicine Balls", "Landmine Attachment (rotations)", "Kettlebells", "Resistance Bands"]
    },
    "not_muscle_specific": {
      "tier_1": ["Treadmill", "Stationary Bike", "Elliptical or Stair Climber"],
      "tier_2": ["Rower (Concept2 style)"]
    }
  },

  "scheme_2_push_pull_legs": {
    "push": {
      "tier_1": ["Flat Bench Press Station", "Olympic Barbell + Plates", "Dumbbells", "EZ / Curl Bar", "Adjustable Bench", "Flat Bench", "Smith Machine", "Squat Rack (overhead press)", "Chest Press Machine", "Pec Deck / Butterfly", "Dip Station / Parallel Bars", "Assisted Dip / Chin-up Machine", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments"],
      "tier_2": ["Shoulder Press Machine", "Incline Chest Press Machine", "Lateral Raise Machine", "Landmine Attachment", "Dip Belt", "Fixed-weight Barbells", "Medicine Balls", "Kettlebells", "Resistance Bands"]
    },
    "pull": {
      "tier_1": ["Pull-up Bar", "Lat Pulldown Machine", "Seated Cable Row Machine", "Assisted Dip / Chin-up Machine", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments", "Olympic Barbell + Plates", "Dumbbells", "EZ / Curl Bar", "Adjustable Bench", "Squat Rack (deadlift / rack pull)", "Pec Deck (reverse setting)"],
      "tier_2": ["Plate-Loaded Row (Hammer Strength)", "Landmine Attachment / T-Bar Row", "Rear Delt Fly Machine", "Preacher Curl Bench", "45-degree Hyperextension Bench", "Fixed-weight Barbells", "Dip Belt", "Lifting Straps", "Kettlebells", "Resistance Bands"]
    },
    "legs": {
      "tier_1": ["Squat Rack / Power Rack", "Olympic Barbell + Plates", "Smith Machine", "Leg Press", "Leg Extension Machine", "Leg Curl Machine", "Abductor / Adductor Machine", "Dumbbells", "Flat Bench", "Adjustable Bench"],
      "tier_2": ["Hack Squat Machine", "Hip Thrust Machine", "Standing or Seated Calf Raise Machine", "Second Leg Curl variant", "45-degree Hyperextension Bench", "Kettlebells", "Plyo Box / Step", "Landmine Attachment", "Fixed-weight Barbells", "Resistance Bands"]
    },
    "core_floating": {
      "note": "PPL has no native core slot — attach to Pull day or Legs day",
      "tier_1": ["Exercise Mats", "Pull-up Bar", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments", "Dumbbells", "Adjustable Bench"],
      "tier_2": ["Ab Wheel", "Roman Chair / Captain's Chair", "Decline Ab Bench", "Ab Slings / Hanging Leg Raise Station", "45-degree Hyperextension Bench", "Medicine Balls", "Landmine Attachment", "Kettlebells"]
    }
  },

  "scheme_3_upper_lower": {
    "upper": {
      "tier_1": ["Flat Bench Press Station", "Olympic Barbell + Plates", "EZ / Curl Bar", "Dumbbells", "Adjustable Bench", "Flat Bench", "Smith Machine", "Pull-up Bar", "Lat Pulldown Machine", "Seated Cable Row Machine", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments", "Chest Press Machine", "Pec Deck / Butterfly", "Dip Station / Parallel Bars", "Assisted Dip / Chin-up Machine"],
      "tier_2": ["Shoulder Press Machine", "Incline Chest Press Machine", "Rear Delt Fly Machine", "Lateral Raise Machine", "Plate-Loaded Row (Hammer Strength)", "Preacher Curl Bench", "Landmine Attachment / T-Bar Row", "Fixed-weight Barbells", "Dip Belt", "Lifting Straps", "Medicine Balls", "Kettlebells", "Resistance Bands"]
    },
    "lower": {
      "tier_1": ["Squat Rack / Power Rack", "Olympic Barbell + Plates", "Smith Machine", "Leg Press", "Leg Extension Machine", "Leg Curl Machine", "Abductor / Adductor Machine", "Dumbbells", "Flat Bench", "Adjustable Bench"],
      "tier_2": ["Hack Squat Machine", "Hip Thrust Machine", "Standing or Seated Calf Raise Machine", "Second Leg Curl variant", "45-degree Hyperextension Bench", "Kettlebells", "Plyo Box / Step", "Landmine Attachment", "Fixed-weight Barbells", "Resistance Bands"]
    },
    "core_attaches_to_either": {
      "note": "usually placed at the end of the Lower day, or split across both",
      "tier_1": ["Exercise Mats", "Pull-up Bar", "Dual Adjustable Pulley / Cable Crossover", "Cable Attachments", "Dumbbells", "Adjustable Bench"],
      "tier_2": ["Ab Wheel", "Roman Chair / Captain's Chair", "Decline Ab Bench", "Ab Slings / Hanging Leg Raise Station", "45-degree Hyperextension Bench", "Medicine Balls", "Landmine Attachment"]
    }
  }
}
```

---

# HOW TO WORK WITH THIS

1. Pick the classification scheme that matches the requested split — muscle groups, PPL,
   or Upper/Lower.
2. Before writing any exercise, confirm every movement pattern the split requires has at
   least one Tier 1 option available. If a pattern has no Tier 1 option, the program is
   structurally broken — say so instead of generating it.
3. Build the program's backbone entirely from Tier 1.
4. Use Tier 2 only for accessory and isolation work, and pair every Tier 2 exercise with
   a named Tier 1 substitute.
5. Never prescribe Tier 3.
