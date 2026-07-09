from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
from wellschematicspy import Casing, Cement, OpenHole, Perforation, Tubing, WellSchema


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src" / "assets" / "wellbore"
SVG_PATH = OUT_DIR / "wellbore-schema-base.svg"
PNG_PATH = OUT_DIR / "wellbore-schema-base.png"
META_PATH = OUT_DIR / "wellbore-schema-meta.json"

WELL_DEPTH = 4200
SURFACE_CASING_DEPTH = 1200
CASING_SHOE_DEPTH = 3200
BIT_DEPTH = 3860
KICK_ZONE_TOP = 3950
KICK_ZONE_BOTTOM = 4020


def build_schema() -> WellSchema:
    surface_hole = OpenHole(
        name="surface_hole",
        top=0,
        bottom=CASING_SHOE_DEPTH,
        diameter=17.5,
        color="#eef2f7",
        hatch=".",
    )
    open_hole = OpenHole(
        name="open_hole",
        top=CASING_SHOE_DEPTH,
        bottom=WELL_DEPTH,
        diameter=8.5,
        color="#fff7ed",
        hatch="/",
    )

    surface_casing = Casing(
        name="surface_casing",
        top=0,
        bottom=SURFACE_CASING_DEPTH,
        diameter=13.375,
        cement=[
            Cement(
                name="surface_cement",
                top=0,
                bottom=SURFACE_CASING_DEPTH,
                oh=17.5,
                color="#bfdbfe",
                hatch=".",
            )
        ],
        color="#334155",
    )
    intermediate_casing = Casing(
        name="intermediate_casing",
        top=0,
        bottom=CASING_SHOE_DEPTH,
        diameter=9.625,
        cement=[
            Cement(
                name="intermediate_cement",
                top=0,
                bottom=CASING_SHOE_DEPTH,
                oh=12.25,
                color="#bfdbfe",
                hatch=".",
            )
        ],
        perforations=[
            Perforation(
                name="influx_zone_reference",
                top=KICK_ZONE_TOP,
                bottom=KICK_ZONE_BOTTOM,
                oh=8.5,
                color="#ef4444",
                scale=8,
                penetrate=1.08,
            )
        ],
        color="#1f2937",
    )

    drill_string = Tubing(
        name="drill_string",
        top=0,
        bottom=BIT_DEPTH,
        diameter=3.5,
        color="#2563eb",
    )
    bha = Tubing(
        name="bha",
        top=3600,
        bottom=BIT_DEPTH,
        diameter=5.0,
        pipe_width=0.035,
        color="#60a5fa",
    )

    return WellSchema(
        open_holes=[surface_hole, open_hole],
        casings=[surface_casing, intermediate_casing],
        completion=[drill_string, bha],
    )


def write_meta() -> None:
    metadata = {
        "source": "wellschematicspy",
        "units": {"depth": "m", "diameter": "in"},
        "wellDepth": WELL_DEPTH,
        "surfaceCasingDepth": SURFACE_CASING_DEPTH,
        "casingShoeDepth": CASING_SHOE_DEPTH,
        "bitDepth": BIT_DEPTH,
        "kickZone": {"top": KICK_ZONE_TOP, "bottom": KICK_ZONE_BOTTOM},
        "overlayViewBox": {"width": 420, "height": 850, "topY": 64, "bottomY": 786, "centerX": 210},
    }
    META_PATH.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    schema = build_schema()

    fig, ax = plt.subplots(figsize=(4.2, 8.5))
    schema.plot(ax=ax, fontsize=7, xtick=True)
    ax.set_title("")
    ax.set_xlabel("")
    ax.set_ylabel("Depth (m)")
    ax.grid(False)
    fig.savefig(SVG_PATH, format="svg", bbox_inches="tight", transparent=True)
    fig.savefig(PNG_PATH, format="png", dpi=240, bbox_inches="tight", transparent=True)
    plt.close(fig)

    write_meta()
    print(f"generated: {SVG_PATH}")
    print(f"generated: {PNG_PATH}")
    print(f"generated: {META_PATH}")


if __name__ == "__main__":
    main()
