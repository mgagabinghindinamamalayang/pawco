import json
from pathlib import Path
import importlib.util

spec = importlib.util.spec_from_file_location("bc", "tools/build_chart.py")
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)

for p in sorted(Path("songs").glob("*/chart.json")):
    c = json.load(open(p, encoding="utf-8"))
    before = len(c["notes"])
    c["notes"] = bc.clear_notes_during_holds(c["notes"], pad=0.4)
    holds = [n for n in c["notes"] if n.get("type") == "hold"]
    overlaps = 0
    for h in holds:
        for n in c["notes"]:
            if n is h:
                continue
            if h["t"] - 0.02 < n["t"] < h["t"] + h["len"] + 0.4:
                overlaps += 1
                break
    p.write_text(json.dumps(c, indent=2) + "\n", encoding="utf-8")
    print(f"{p.parent.name}: {before}->{len(c['notes'])} notes, {len(holds)} holds, overlaps={overlaps}")
