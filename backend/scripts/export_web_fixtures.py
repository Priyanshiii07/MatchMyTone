"""Write the styling fixtures used by the web tests from the real recommendation engine.

Run from backend/:  .venv/Scripts/python scripts/export_web_fixtures.py
test_personalization.py fails if the committed fixture no longer matches the engine output.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import preferences  # noqa: E402
import skincare  # noqa: E402
import styling  # noqa: E402

TARGET = Path(__file__).resolve().parents[2] / "web" / "lib" / "__fixtures__" / "styling.json"
PALETTE = {"result_id": "color-1", "season": "Deep Autumn", "colors": [{"name": "Terracotta", "hex": "#C2593F"}, {"name": "Deep Teal", "hex": "#005F60"}, {"name": "Olive", "hex": "#6B705C"}, {"name": "Cream", "hex": "#F3E9D2"}, {"name": "Burgundy", "hex": "#6B1D2F"}, {"name": "Mustard", "hex": "#E3A857"}]}
COLOR_DOC = {"id": "color-1", "season_type": "Deep Autumn", "undertone": "Warm", "colors_to_wear": PALETTE["colors"], "colors_to_avoid": [{"name": "Icy Lavender", "hex": "#E6E6FA"}]}


def build():
    resolve = preferences.resolve
    return {
        "bodyMen": styling.body_styling("Pear", resolve({}, "male"), PALETTE),
        "bodyWomen": styling.body_styling("Pear", resolve({}, "female"), PALETTE),
        "bodyNeedsChoice": styling.body_styling("Pear", resolve({}, None), None),
        "faceMen": styling.face_styling("Round", resolve({"hair_texture": "curly"}, "male"), PALETTE),
        "faceMenPrompt": styling.face_styling("Round", resolve({}, "male"), None),
        "faceWomenMakeup": styling.face_styling("Heart", resolve({"makeup": "yes"}, "female"), PALETTE),
        "colorMen": styling.color_styling(COLOR_DOC, resolve({}, "male")),
        "colorWomen": styling.color_styling(COLOR_DOC, resolve({}, "female")),
        "skincareShaving": skincare.skincare_plan({str(i): {"label": "A"} for i in range(1, 11)}, ["shaving", "beard", "advanced"]),
    }


if __name__ == "__main__":
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(build(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {TARGET}")
