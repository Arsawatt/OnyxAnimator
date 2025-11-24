import os
import textwrap

BRUSHES_FOLDER = "brushes"
BRUSHES_JS_FILE = "brushes.js"

START_MARK = "// ### AUTO-GENERATED BRUSH DEFINITIONS START ###"
END_MARK   = "// ### AUTO-GENERATED BRUSH DEFINITIONS END ###"


def guess_base_type(filename_lower: str) -> str:
    """Heuristic: decide soft/hard/pencil based on file name."""
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


def generate_definitions():
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

        entry = f"  {{ id: '{brush_id}', name: '{display_name}', file: '{file_path}', baseType: '{base_type}' }}"
        entries.append(entry)

    body = ",\n".join(entries)
    js_block = "var BRUSH_DEFINITIONS = [\n" + body + "\n];"
    return js_block


def main():
    if not os.path.isfile(BRUSHES_JS_FILE):
        raise SystemExit(f"File '{BRUSHES_JS_FILE}' not found.")

    with open(BRUSHES_JS_FILE, "r", encoding="utf-8") as f:
        content = f.read()

    start_index = content.find(START_MARK)
    end_index = content.find(END_MARK)

    if start_index == -1 or end_index == -1:
        raise SystemExit("Markers not found in brushes.js. Make sure START and END comments exist.")

    # Keep everything outside the auto-generated region
    before = content[:start_index]
    after = content[end_index:]

    defs_block = generate_definitions()

    # Build new content with markers and generated block
    new_middle = (
        START_MARK
        + "\n\n"
        + defs_block
        + "\n\n"
        + END_MARK
    )

    new_content = before + new_middle + after

    with open(BRUSHES_JS_FILE, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Updated {BRUSHES_JS_FILE} with definitions from '{BRUSHES_FOLDER}/'.")


if __name__ == "__main__":
    main()
