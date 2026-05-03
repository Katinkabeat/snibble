"""
Snibble pet art processing pipeline.

Turns Gemini-generated pet PNGs (widescreen, white-outlined sticker
style on a soft gradient background) into ship-ready transparent
512x512 sprites for the Snibble lobby/sanctuary.

Pipeline (locked 2026-05-01):
  1. rembg w/ birefnet-general + post_process_mask (better than U2Net
     for shadows + outline preservation)
  2. Hard alpha threshold at 200: alpha = 255 if v >= 200 else 0.
     Crisp edges + clean shadow cut. White sticker outline survives
     because its pixels are alpha=255 already.
  3. Crop to non-transparent bounding box.
  4. Pad to square with 5% margin (side = max(w,h) * 1.10).
  5. Resize to 512x512 with LANCZOS, optimize PNG.

Inputs:  snibble/public/pets/originals/*.png
Outputs: snibble/public/pets/<id>.png  (id derived from filename species)

Add new species to NAME_MAP as new pets are added to the catalog.

Lives at snibble/public/pets/process_pet_art.py so it sits next to
the PNGs it produces. Run from anywhere:
    python snibble/public/pets/process_pet_art.py
or from snibble/public/pets/:
    python process_pet_art.py
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

# Filename keyword (lowercased, after stripping "snibble" + underscores)
# → pet id matching sn_pets.id
NAME_MAP = {
    # Year 1
    "snail": "mossy",
    "firefly": "pip",
    "bunny": "mochi",
    "mole": "burrow",
    "hedgehog": "bramble",
    "bee": "honey",
    "turtle": "pebble",
    "spider": "bobbin",
    "cat": "cinder",
    "moth": "cosmo",
    "porcupine": "quill",
    "dragon": "kettle",
    "arctic fox": "frost",
    # Year 2
    "river otter": "marlow",
    "owlet": "hush",
    "squirrel": "acorn",
    "frog": "lily",
    "dormouse": "crumble",
    "axolotl": "pearl",
    "bat": "velvet",
    "hummingbird": "whirr",
    "ladybug": "petal",
    "robin": "sprig",
    "capybara": "marmalade",
    "sloth": "wander",
}

ALPHA_THRESHOLD = 200
SQUARE_MARGIN = 1.10
OUTPUT_SIZE = 512


def derive_pet_id(path: Path) -> str | None:
    base = path.stem.lower().replace("snibble", "").replace("_", " ").strip()
    return NAME_MAP.get(base)


def process_one(src_path: Path, out_path: Path, session) -> int:
    src = Image.open(src_path).convert("RGBA")
    cut = remove(src, session=session, post_process_mask=True)

    r, g, b, a = cut.split()
    a = a.point(lambda v: 255 if v >= ALPHA_THRESHOLD else 0)
    cut = Image.merge("RGBA", (r, g, b, a))

    bbox = cut.getbbox()
    if not bbox:
        raise ValueError("empty after threshold")
    cropped = cut.crop(bbox)

    cw, ch = cropped.size
    side = int(max(cw, ch) * SQUARE_MARGIN)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    canvas = canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)
    canvas.save(out_path, "PNG", optimize=True)
    return os.path.getsize(out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Process Snibble pet art.")
    parser.add_argument(
        "--only",
        help="Process only one pet by id (e.g. --only mossy). Default: process every original whose species is in NAME_MAP.",
    )
    here = Path(__file__).resolve().parent  # snibble/public/pets
    parser.add_argument(
        "--originals",
        default=str(here / "originals"),
        help="Folder containing source PNGs (default: ./originals next to this script).",
    )
    parser.add_argument(
        "--out",
        default=str(here),
        help="Output folder (default: this script's folder).",
    )
    args = parser.parse_args()

    originals = Path(args.originals)
    out_dir = Path(args.out)
    if not originals.is_dir():
        raise SystemExit(f"originals folder not found: {originals}")
    out_dir.mkdir(parents=True, exist_ok=True)

    session = new_session("birefnet-general")

    sources = sorted(originals.glob("*.png"))
    if not sources:
        raise SystemExit(f"no PNGs found in {originals}")

    processed = skipped = 0
    for src in sources:
        pet_id = derive_pet_id(src)
        if not pet_id:
            print(f"SKIP unknown species: {src.name}")
            skipped += 1
            continue
        if args.only and pet_id != args.only:
            continue
        out = out_dir / f"{pet_id}.png"
        try:
            size = process_one(src, out, session)
            print(f"{src.name:40s} -> {out.name:14s} {size // 1024:4d}KB")
            processed += 1
        except Exception as exc:
            print(f"FAIL {src.name}: {exc}")

    print(f"\nProcessed {processed}, skipped {skipped}")


if __name__ == "__main__":
    main()
