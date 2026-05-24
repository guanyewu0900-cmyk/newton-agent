from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "uploads"


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def page_stream(title: str, lines: list[str]) -> bytes:
    parts = [
        "BT",
        "/F1 28 Tf",
        "56 790 Td",
        f"({esc(title)}) Tj",
        "/F2 15 Tf",
        "0 -48 Td",
    ]
    for line in lines:
        parts.append(f"({esc(line)}) Tj")
        parts.append("0 -24 Td")
    parts.append("ET")
    return ("\n".join(parts) + "\n").encode("utf-8")


def write_pdf(path: Path, pages: list[tuple[str, list[str]]]) -> None:
    objects: list[bytes] = []
    page_ids = []

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"")

    font1_id = 3
    font2_id = 4
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for title, lines in pages:
        content = page_stream(title, lines)
        content_id = len(objects) + 2
        page_id = len(objects) + 1
        page_ids.append(page_id)
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font1_id} 0 R /F2 {font2_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>".encode("utf-8")
        )
        objects.append(b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"endstream")

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
    (
        "Newton's First Law",
        [
            "Grade 8 Physics",
            "Topic: Motion and Force",
            "Guiding question:",
            "Does motion need a force to keep going?",
            "Today we compare observation, experiment, and ideal reasoning.",
        ],
    ),
    (
        "Everyday Observations",
        [
            "A suitcase slows down after a push.",
            "A skateboard speeds up down a ramp.",
            "A water drop falls toward Earth.",
            "These observations can mislead us if we ignore resistance.",
        ],
    ),
    (
        "From Aristotle to Galileo",
        [
            "Aristotle: force keeps objects moving.",
            "Galileo: smoother surfaces let objects travel farther.",
            "Ideal reasoning: without resistance, motion can continue uniformly.",
        ],
    ),
    (
        "Learning Tasks",
        [
            "1. Compare motion on rough and smooth surfaces.",
            "2. Use Galileo's ramp thought experiment.",
            "3. Observe an air-track slider with reduced friction.",
            "4. Explain results with net force.",
        ],
    ),
]


SUMMARY = [
    (
        "Class Summary",
        [
            "Key question: Does motion need a force to maintain it?",
            "Evidence: less resistance produces a longer travel distance.",
            "Reasoning: if resistance is zero, speed does not need to decrease.",
        ],
    ),
    (
        "Newton's First Law",
        [
            "An object remains at rest or in uniform straight-line motion",
            "unless a nonzero net force acts on it.",
            "Balanced forces do not change the motion state.",
        ],
    ),
    (
        "Inertia",
        [
            "Inertia is the property of keeping the original motion state.",
            "All objects have inertia.",
            "Greater mass means greater inertia.",
        ],
    ),
    (
        "Experiment Conclusions",
        [
            "Rough surface: friction causes clear deceleration.",
            "Smooth surface: friction is smaller, so motion lasts longer.",
            "Air track: net force is nearly zero, so motion is nearly uniform.",
        ],
    ),
    (
        "Apply The Idea",
        [
            "When analyzing motion, ask:",
            "1. What forces act on the object?",
            "2. Are the forces balanced?",
            "3. Is the net force zero or nonzero?",
        ],
    ),
]


def main() -> None:
    OUT.mkdir(exist_ok=True)
    write_pdf(OUT / "newton_intro.pdf", INTRO)
    write_pdf(OUT / "newton_summary.pdf", SUMMARY)


if __name__ == "__main__":
    main()
