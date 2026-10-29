from __future__ import annotations

from pathlib import Path

from PIL import Image, UnidentifiedImageError


def reencode_png(path: Path) -> bool:
    try:
        img = Image.open(path)
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        print(f"SKIP {path}: unreadable image ({exc})")
        return False

    original_format = (img.format or "").upper()
    original_info = sorted(img.info.keys())
    print(
        f"{path}: format={original_format} mode={img.mode} size={img.size} info={original_info}"
    )

    # Re-encode every PNG path to a strict PNG payload.
    # This fixes files that have .png extension but JPEG/JFIF payloads.
    out = img.convert("RGBA")
    out.save(path, format="PNG", optimize=True)

    img2 = Image.open(path)
    img2.load()
    print(
        f"  -> saved: format={(img2.format or '').upper()} mode={img2.mode} size={img2.size} info={sorted(img2.info.keys())}"
    )
    return original_format != "PNG"


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    assets_dir = root / "assets"
    changed_non_png_payloads = 0
    total = 0

    for p in sorted(assets_dir.glob("*.png")):
        total += 1
        was_non_png_payload = reencode_png(p)
        if was_non_png_payload:
            changed_non_png_payloads += 1

    print(
        f"DONE: processed {total} png files, fixed {changed_non_png_payloads} files with non-PNG payloads."
    )


if __name__ == "__main__":
    main()

