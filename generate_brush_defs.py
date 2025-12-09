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


# Simple per-baseType defaults — tweak as you like
BASE_PRESETS = {
    "soft": {
        "size": 12.0,
        "hardness": 0.8,
        "spacing": 0.25,
        "pressureOpacity": True,
        "pressureFlow": False,
        "lazy": False,
        "lazyStrength": 0.5,
        "simulatePressure": False,
    },
    "hard": {
        "size": 8.0,
        "hardness": 1.0,
        "spacing": 0.15,
        "pressureOpacity": False,
        "pressureFlow": False,
        "lazy": False,
        "lazyStrength": 0.4,
        "simulatePressure": False,
    },
    "pencil": {
        "size": 4.0,
        "hardness": 1.0,
        "spacing": 0.12,
        "pressureOpacity": True,
        "pressureFlow": True,
        "lazy": False,
        "lazyStrength": 0.3,
        "simulatePressure": False,
    },
}


def bool_js(b: bool) -> str:
    return "true" if b else "false"


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

        preset = BASE_PRESETS.get(base_type, BASE_PRESETS["soft"])

        entry = (
            "  { id: '%s', name: '%s', file: '%s', baseType: '%s', "
            "preset: { "
            "size: %.2f, hardness: %.2f, spacing: %.2f, "
            "pressureOpacity: %s, pressureFlow: %s, "
            "lazy: %s, lazyStrength: %.2f, simulatePressure: %s "
            "} }"
            % (
                brush_id,
                display_name,
                file_path,
                base_type,
                preset["size"],
                preset["hardness"],
                preset["spacing"],
                bool_js(preset["pressureOpacity"]),
                bool_js(preset["pressureFlow"]),
                bool_js(preset["lazy"]),
                preset["lazyStrength"],
                bool_js(preset["simulatePressure"]),
            )
        )

        entries.append(entry)

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
