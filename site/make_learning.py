#!/usr/bin/env python3
"""content/learning/** -> site/public/content/learning/*.json, one file per topic.

The app this content came from compiled it into a single 600 kB bundle fetched at
boot. Nothing needs all of it at once: opening Learning needs the list of
subjects, a practice set needs one subject, and a mock exam needs one mock. So
this writes an index and a file per topic instead, and the module fetches a topic
the first time it is opened.

    index.json          subjects with their counts and skills, mocks, precision
                        sets, the week plan, books and the skill map — everything
                        needed to choose something to do
    subject-<id>.json   one subject's questions, with any passages they cite
    mock-<id>.json      one mock exam's sections and questions
    precision.json      the vocabulary sets
    essay.json          the essay programme

Every file is written deterministically so CI can fail when the committed output
has drifted from the source.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "learning"
OUT = ROOT / "site" / "public" / "content" / "learning"

SUBJECTS = {
    "vr": ("Verbal reasoning", ["vr-september", "vr-weeks5-8"]),
    "qr": ("Quantitative reasoning", ["qr-september", "qr-weeks5-8"]),
    "ma": ("Mathematics", ["ma-september", "ma-weeks5-8"]),
    "rc": ("Reading comprehension", ["rc-september", "rc-weeks5-8"]),
}
PASSAGE_FILES = ["rc-september-passages.json", "rc-weeks5-8-passages.json", "mock-passages.json"]


def read(rel):
    p = SRC / rel
    if not p.exists():
        sys.exit(f"missing {p.relative_to(ROOT)}")
    return json.loads(p.read_text(encoding="utf-8"))


def write(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    return path.stat().st_size


WEEK = re.compile(r"(W[1-8])")


def question(it):
    """One source question, shortened.

    The source keeps choices as an object keyed A-D and the answer as that
    letter. The app wants an array and an index into it, so the letters are
    resolved here — the only place that has to know the source's shape — and a
    question whose answer does not name one of its choices is a content error
    rather than something to render."""
    choices = it.get("choices") or {}
    if isinstance(choices, dict):
        letters = [k for k in "ABCDE" if k in choices]
        values = [choices[k] for k in letters]
    else:
        letters = list("ABCDE")[: len(choices)]
        values = list(choices)
    correct = str(it.get("correct", it.get("answer", ""))).strip().upper()
    if correct not in letters:
        sys.exit(f"{it.get('id', '?')}: answer {correct!r} is not one of its choices {letters}")
    m = WEEK.match(str(it.get("form", "")))
    return {
        "id": it["id"],
        "w": m.group(1) if m else "W1",
        "sk": it.get("skill", ""),
        "d": it.get("difficulty", ""),
        "q": it.get("prompt", ""),
        "c": values,
        "k": letters.index(correct),
        "e": it.get("explanation", ""),
        "p": it.get("passage_id", ""),
    }


def main():
    passages = {}
    for f in PASSAGE_FILES:
        for p in read(f"passages/{f}")["items"]:
            passages[p["id"]] = {"t": p.get("title", ""), "x": p["text"]}

    index = {"schema": 1, "subjects": [], "mocks": [], "precision": [], "essay": {}}
    written = []

    # ---- one file per subject, carrying only the passages its questions cite ----
    for sid, (label, banks) in SUBJECTS.items():
        items, skills = [], set()
        for bank in banks:
            for it in read(f"question-banks/{bank}.json")["items"]:
                q = question(it)
                items.append(q)
                if q["sk"]:
                    skills.add(q["sk"])
        items.sort(key=lambda i: (int(i["w"][1:]), i["id"]))
        used = {q["p"]: passages[q["p"]] for q in items if q["p"] and q["p"] in passages}
        size = write(f"subject-{sid}.json", {"id": sid, "label": label, "items": items, "passages": used})
        written.append((f"subject-{sid}.json", size))
        index["subjects"].append({
            "id": sid, "label": label, "count": len(items),
            "skills": sorted(skills), "file": f"subject-{sid}.json",
        })

    # ---- one file per mock exam ----
    mock_items = read("question-banks/mock.json")["items"]
    by_form = {}
    for it in mock_items:
        form = str(it.get("form") or it.get("mock") or "1")
        by_form.setdefault(form, []).append(it)
    for form in sorted(by_form):
        sections = {}
        for it in by_form[form]:
            sections.setdefault(str(it.get("section") or "all"), []).append(question(it))
        used = {}
        for secs in sections.values():
            for q in secs:
                if q["p"] and q["p"] in passages:
                    used[q["p"]] = passages[q["p"]]
        total = sum(len(v) for v in sections.values())
        size = write(f"mock-{form}.json", {"id": form, "sections": sections, "passages": used})
        written.append((f"mock-{form}.json", size))
        index["mocks"].append({
            "id": form, "label": f"Mock exam {form}", "count": total,
            "sections": sorted(sections), "file": f"mock-{form}.json",
        })

    # ---- vocabulary and the essay programme ----
    precision = read("precision.json")
    size = write("precision.json", precision)
    written.append(("precision.json", size))
    sets = precision.get("sets", precision) if isinstance(precision, dict) else {}
    for key in sorted(sets) if isinstance(sets, dict) else []:
        entry = sets[key]
        index["precision"].append({
            "id": key,
            "count": len(entry) if isinstance(entry, list) else len(entry.get("words", [])) if isinstance(entry, dict) else 0,
        })

    essay = read("essay.json")
    size = write("essay.json", essay)
    written.append(("essay.json", size))
    index["essay"] = {"file": "essay.json", "prompts": len(essay.get("prompts", [])) if isinstance(essay, dict) else 0}

    # ---- small things worth having in the index itself ----
    for name in ("books", "calendar", "aops"):
        try:
            index[name] = read(f"{name}.json")
        except SystemExit:
            index[name] = {}

    index_size = write("index.json", index)
    written.insert(0, ("index.json", index_size))

    total = sum(s for _, s in written)
    biggest = max(s for _, s in written)
    print(f"wrote {len(written)} file(s) into {OUT.relative_to(ROOT)}")
    for name, size in written:
        print(f"  {size:8,} B  {name}")
    print(f"  {total:8,} B  total, of which the index is {index_size:,} B")
    if index_size > 60_000:
        sys.exit(f"index.json is {index_size:,} B: too much to fetch before a child has chosen anything")
    print(f"opening Learning fetches {index_size:,} B, not {total:,} B; the largest topic is {biggest:,} B")


if __name__ == "__main__":
    main()
