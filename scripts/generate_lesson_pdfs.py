from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "uploads"
W, H = 960, 540


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def fill_rect(ops: list[str], x: int, y: int, w: int, h: int, color: str) -> None:
    r, g, b = rgb(color)
    ops.append(f"{r:.3f} {g:.3f} {b:.3f} rg {x} {y} {w} {h} re f")


def stroke_rect(ops: list[str], x: int, y: int, w: int, h: int, color: str, width: float = 1.0) -> None:
    r, g, b = rgb(color)
    ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG {width} w {x} {y} {w} {h} re S")


def line(ops: list[str], x1: int, y1: int, x2: int, y2: int, color: str, width: float = 2.0) -> None:
    r, g, b = rgb(color)
    ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG {width} w {x1} {y1} m {x2} {y2} l S")


def text(ops: list[str], x: int, y: int, body: str, size: int = 18, bold: bool = False, color: str = "#eafaff") -> None:
    r, g, b = rgb(color)
    font = "F1" if bold else "F2"
    ops.append(f"BT {r:.3f} {g:.3f} {b:.3f} rg /{font} {size} Tf {x} {y} Td ({esc(body)}) Tj ET")


def grid(ops: list[str]) -> None:
    fill_rect(ops, 0, 0, W, H, "#040916")
    fill_rect(ops, 0, 0, W, H, "#06152a")
    for x in range(0, W + 1, 48):
        line(ops, x, 0, x, H, "#12314a", 0.6)
    for y in range(0, H + 1, 48):
        line(ops, 0, y, W, y, "#12314a", 0.6)
    fill_rect(ops, 0, H - 74, W, 74, "#071d35")
    line(ops, 0, H - 74, W, H - 74, "#42e7ff", 2)


def panel(ops: list[str], x: int, y: int, w: int, h: int, title: str) -> None:
    fill_rect(ops, x, y, w, h, "#071428")
    stroke_rect(ops, x, y, w, h, "#39dfff", 1.4)
    text(ops, x + 18, y + h - 32, title, 15, True, "#66ffd1")


def bullet_lines(ops: list[str], x: int, y: int, lines: list[str], size: int = 17) -> None:
    yy = y
    for item in lines:
        text(ops, x, yy, "- " + item, size, False, "#eafaff")
        yy -= size + 10


def draw_suitcase(ops: list[str], x: int, y: int) -> None:
    fill_rect(ops, x, y, 110, 56, "#102846")
    stroke_rect(ops, x, y, 110, 56, "#42e7ff", 2)
    stroke_rect(ops, x + 34, y + 48, 42, 18, "#42e7ff", 2)
    line(ops, x + 18, y - 18, x + 92, y - 18, "#9bb7d7", 2)
    text(ops, x + 18, y - 48, "A push starts motion.", 14, False, "#cfefff")


def draw_surface(ops: list[str], x: int, y: int) -> None:
    line(ops, x, y, x + 270, y, "#d2e8ff", 4)
    fill_rect(ops, x + 28, y + 8, 44, 24, "#ff8b6b")
    fill_rect(ops, x + 126, y + 8, 44, 24, "#ffd66b")
    fill_rect(ops, x + 224, y + 8, 44, 24, "#66ffd1")
    line(ops, x + 50, y + 54, x + 252, y + 54, "#66ffd1", 2)
    line(ops, x + 242, y + 60, x + 252, y + 54, "#66ffd1", 2)
    line(ops, x + 242, y + 48, x + 252, y + 54, "#66ffd1", 2)
    text(ops, x + 12, y - 34, "Less resistance -> longer distance", 15, False, "#eafaff")


def draw_ramp(ops: list[str], x: int, y: int) -> None:
    line(ops, x, y, x + 180, y + 95, "#42e7ff", 4)
    line(ops, x + 180, y + 95, x + 360, y + 18, "#ffcf6b", 4)
    line(ops, x, y, x + 360, y, "#d2e8ff", 2)
    fill_rect(ops, x + 44, y + 32, 28, 28, "#66ffd1")
    line(ops, x + 218, y + 70, x + 345, y + 70, "#66ffd1", 2)
    text(ops, x + 20, y - 34, "As the right ramp becomes flatter, the travel distance grows.", 14, False, "#eafaff")


def draw_air_track(ops: list[str], x: int, y: int) -> None:
    fill_rect(ops, x, y, 360, 34, "#102846")
    stroke_rect(ops, x, y, 360, 34, "#42e7ff", 2)
    for i in range(16):
        line(ops, x + 18 + i * 20, y + 8, x + 18 + i * 20, y + 28, "#234b68", 1)
    fill_rect(ops, x + 58, y + 48, 60, 28, "#66ffd1")
    line(ops, x + 128, y + 62, x + 294, y + 62, "#66ffd1", 3)
    text(ops, x + 22, y - 36, "Nearly zero net force -> nearly uniform motion", 15, False, "#eafaff")


def draw_law(ops: list[str], x: int, y: int) -> None:
    fill_rect(ops, x, y, 360, 118, "#0b2038")
    stroke_rect(ops, x, y, 360, 118, "#66ffd1", 2)
    text(ops, x + 24, y + 78, "NET FORCE = 0", 24, True, "#66ffd1")
    text(ops, x + 24, y + 44, "Rest stays rest", 16, False, "#eafaff")
    text(ops, x + 24, y + 20, "Uniform straight-line motion stays uniform", 16, False, "#eafaff")


def draw_page(title: str, subtitle: str, cards: list[tuple[str, list[str]]], visual: str) -> bytes:
    ops: list[str] = []
    grid(ops)
    text(ops, 46, 492, title, 30, True, "#eafaff")
    text(ops, 48, 462, subtitle, 15, False, "#9fdcff")

    x, y = 46, 300
    for card_title, lines in cards:
        panel(ops, x, y, 390, 126, card_title)
        bullet_lines(ops, x + 20, y + 68, lines, 14)
        y -= 146

    panel(ops, 500, 92, 390, 334, "Visual Model")
    if visual == "suitcase":
        draw_suitcase(ops, 610, 258)
    elif visual == "surface":
        draw_surface(ops, 560, 262)
    elif visual == "ramp":
        draw_ramp(ops, 520, 230)
    elif visual == "air":
        draw_air_track(ops, 520, 250)
    else:
        draw_law(ops, 516, 232)

    stream = "\n".join(ops) + "\n"
    return stream.encode("utf-8")


def write_pdf(path: Path, pages: list[bytes]) -> None:
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids = []
    for stream in pages:
        page_id = len(objects) + 1
        content_id = len(objects) + 2
        page_ids.append(page_id)
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
            f"/Contents {content_id} 0 R >>".encode("utf-8")
        )
        objects.append(b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"endstream")

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("utf-8")

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode("ascii"))
    path.write_bytes(bytes(pdf))


INTRO = [
    draw_page(
        "Mission Brief: Newton's First Law",
        "Learning sheet for exploring motion and force",
        [
            ("Guiding Question", ["Does motion need a force to keep going?", "What really makes moving objects slow down?"]),
            ("Your Evidence Log", ["Record what changes when surfaces get smoother.", "Use data before making conclusions."]),
        ],
        "suitcase",
    ),
    draw_page(
        "Observation Station",
        "Everyday motion can be misleading",
        [
            ("What You See", ["A suitcase slows after a push.", "A skateboard speeds up on a ramp."]),
            ("What To Ask", ["Which force changes the motion?", "Is the net force zero or nonzero?"]),
        ],
        "surface",
    ),
    draw_page(
        "Galileo's Thought Experiment",
        "From real surfaces to ideal reasoning",
        [
            ("Experiment Path", ["Same release height on the left ramp.", "Right ramp angle becomes smaller."]),
            ("Ideal Leap", ["If resistance is ignored, motion continues uniformly.", "This is reasoning beyond direct observation."]),
        ],
        "ramp",
    ),
    draw_page(
        "Lab Tasks",
        "Use the simulation as a science notebook",
        [
            ("Run Three Tests", ["Rough surface, smooth surface, air track.", "Compare distance and velocity graphs."]),
            ("Explain With Physics", ["Balanced forces keep motion unchanged.", "Nonzero net force changes motion."]),
        ],
        "air",
    ),
]


SUMMARY = [
    draw_page(
        "Debrief: Motion Does Not Need Maintenance",
        "Resistance explains why everyday objects slow down",
        [
            ("Evidence", ["Less friction produced longer motion.", "Air track motion was nearly uniform."]),
            ("Core Claim", ["Motion changes when net force is nonzero.", "Balanced forces do not change velocity."]),
        ],
        "surface",
    ),
    draw_page(
        "Newton's First Law",
        "The rule for rest and uniform straight-line motion",
        [
            ("Law Statement", ["Objects remain at rest or move uniformly", "unless a nonzero net force acts on them."]),
            ("Important Detail", ["Forces can exist and still be balanced.", "Net force, not any single force, changes motion."]),
        ],
        "law",
    ),
    draw_page(
        "Inertia",
        "The tendency to keep the current motion state",
        [
            ("Definition", ["Inertia is the property of maintaining motion state.", "Every object has inertia."]),
            ("Mass Connection", ["Greater mass means greater inertia.", "More difficult to start, stop, or turn."]),
        ],
        "suitcase",
    ),
    draw_page(
        "Experiment Conclusions",
        "Translate observations into physics language",
        [
            ("Surface Test", ["Rough surface: larger resistance.", "Smooth surface: smaller resistance."]),
            ("Air Track", ["Nearly zero resistance.", "Nearly uniform straight-line motion."]),
        ],
        "air",
    ),
    draw_page(
        "Exit Ticket",
        "Answer before leaving the mission",
        [
            ("Question 1", ["A puck glides at constant speed. What is the net force?", "Explain using Newton's First Law."]),
            ("Question 2", ["Why do real objects usually slow down?", "Name the force and its effect."]),
        ],
        "law",
    ),
]


def main() -> None:
    OUT.mkdir(exist_ok=True)
    write_pdf(OUT / "newton_intro.pdf", INTRO)
    write_pdf(OUT / "newton_summary.pdf", SUMMARY)


if __name__ == "__main__":
    main()
