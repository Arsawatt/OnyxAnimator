import os

BRUSHES_FOLDER = "brushes"
OUTPUT_FILE = "brushes_definitions.js"


def guess_base_type(filename_lower: str) -> str:
    """Heuristic to choose soft / hard / pencil from filename."""
    if "pencil" in filename_lower:
        return "pencil"
    if "hard" in filename_lower:
        return "hard"
    # default
    return "soft"


def make_id(name: str) -> str:
    return (
        name.lower()
        .replace(".png", "")
        .replace(" ", "_")
        .replace("-", "_")
    )


def make_display_name(name: str) -> str:
    name = name.replace(".png", "")
    name = name.replace("_", " ")
    return name.title()


def main():
    if not os.path.isdir(BRUSHES_FOLDER):
        raise SystemExit(f"Folder '{BRUSHES_FOLDER}' not found.")

    pngs = [f for f in os.listdir(BRUSHES_FOLDER) if f.lower().endswith(".png")]
    pngs.sort()

    if not pngs:
        raise SystemExit(f"No .png files found in '{BRUSHES_FOLDER}'.")

    entries = []
    for fname in pngs:
        lower = fname.lower()
        base_type = guess_base_type(lower)
        brush_id = make_id(fname)
        display_name = make_display_name(fname)
        file_path = f"{BRUSHES_FOLDER}/{fname}"

        entries.append(
            f"  {{ id: '{brush_id}', name: '{display_name}', file: '{file_path}', baseType: '{base_type}' }}"
        )

    body = ",\n".join(entries)

    js = (
        "// AUTO-GENERATED. Do not edit by hand.\n"
        "// Generated from contents of the 'brushes' folder.\n\n"
        "var BRUSH_DEFINITIONS = [\n"
        f"{body}\n"
        "];\n"
    )

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(js)

    print(f"Wrote {OUTPUT_FILE} with {len(entries)} brushes.")


if __name__ == "__main__":
    main()
