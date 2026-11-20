"""Read the Word question bank without changing its wording or order."""
import argparse
from collections import Counter, defaultdict
import json
import re
import unicodedata
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
EXPECTED_COUNT = 107
LETTERS = "ABCD"
POSITIONAL = re.compile(
    r"\b(?:[Cc]ả|[Pp]hương án|[Đđ]áp án|[Ýý]|[Cc]âu)\s+[A-D]\b"
    r"|\b[A-D]\s*(?:[,/&+–-]|và|hoặc|lẫn)\s*[A-D]\b"
    r"|\b(?:tất cả|cả ba|cả bốn|không có|các|những|mọi|hai|ba|bốn)"
    r"[^.\n]{0,36}(?:đáp án|phương án|lựa chọn|ý|câu|mục)[^.\n]{0,24}(?:trên|dưới)"
    r"|\b(?:phương án|đáp án|lựa chọn|ý)\s+(?:đầu tiên|cuối cùng|đứng trước|ở trên|bên trên|bên dưới)"
    r"|\b(?:tất cả|cả ba|cả bốn|không có gì)\s+(?:đều\s+)?(?:ở |bên )?(?:trên|dưới)\b",
    re.I,
)


def paragraph_text(paragraph):
    text_parts = {f"{W}tab": "\t", f"{W}br": "\n"}
    return "".join(
        node.text or "" if node.tag == f"{W}t" else text_parts.get(node.tag, "")
        for node in paragraph.iter()
    ).strip()


def parse(path):
    with ZipFile(path) as archive:
        xml = ET.fromstring(archive.read("word/document.xml"))
    questions = []
    current = None
    for paragraph in xml.find(f"{W}body").iter(f"{W}p"):
        style = paragraph.find(f"{W}pPr/{W}pStyle")
        name = style.get(f"{W}val") if style is not None else None
        text = paragraph_text(paragraph)
        if name == "QuizLine":
            number, stem = re.fullmatch(r"Câu\s+(\d+)\.\s*(.*)", text, re.S).groups()
            current = {"id": int(number), "text": stem, "options": [], "correct": [], "explanation": ""}
            questions.append(current)
        elif name == "QuizOption" and current is not None:
            match = re.fullmatch(r"([A-D])\.\s*(.*)", text, re.S)
            if match is None:
                current.setdefault("review", []).append("Một phương án thiếu chữ cái A–D trong Word.")
                continue
            option, content = match.groups()
            current["options"].append({"id": option, "text": content})
            if any(element.get(f"{W}val") == "yellow" for element in paragraph.iter(f"{W}highlight")):
                current["correct"].append(option)
        elif name == "QuizEvidence" and current is not None:
            current["explanation"] = "\n".join(filter(None, [current["explanation"], text]))
    return questions


def normalized(value):
    return " ".join(re.findall(r"\w+", unicodedata.normalize("NFKC", value).casefold()))


def prepare(questions, overrides):
    id_counts = Counter(q["id"] for q in questions)
    by_stem = defaultdict(list)
    for q in questions:
        if q["text"]:
            by_stem[normalized(q["text"])].append(q["id"])

    for number, question in enumerate(questions, 1):
        source_id = question["id"]
        options = question["options"]
        notes = question.get("review", [])
        blocked = bool(notes)
        if not question["text"]:
            notes.append("Word thiếu nội dung câu hỏi.")
            blocked = True
        if id_counts[source_id] > 1:
            notes.append("Số câu xuất hiện nhiều lần trong Word.")
            blocked = True
        if [o["id"] for o in options] != list(LETTERS):
            notes.append("Cần kiểm tra thứ tự hoặc phương án A–D trong Word.")
            blocked = True
        by_letter = {option["id"]: option["text"] for option in reversed(options)}
        question["options"] = [
            {"id": letter, "text": by_letter.get(letter) or "Thiếu nội dung trong Word", "missing": True}
            if not by_letter.get(letter) else {"id": letter, "text": by_letter[letter]}
            for letter in LETTERS
        ]
        if any(o.get("missing") for o in question["options"]):
            notes.append("Có phương án bị thiếu nội dung.")
            blocked = True
        values = [normalized(o["text"]) for o in options if o["text"]]
        if len(set(values)) != len(values):
            notes.append("Có phương án trùng nội dung.")
            blocked = True
        related = by_stem[normalized(question["text"])]
        if len(related) > 1:
            notes.append("Nội dung câu hỏi trùng trong Word, số câu: " + ", ".join(map(str, related)) + ".")
        keys = [overrides[source_id]] if source_id in overrides else question["correct"]
        if not keys:
            notes.append("Word chưa tô vàng đáp án nào.")
        elif len(keys) > 1:
            notes.append("Word tô vàng nhiều phương án: " + ", ".join(keys) + ".")
        question["correct"] = keys if len(keys) == 1 and not blocked else []
        if notes:
            question["review"] = notes
        if any(POSITIONAL.search(value) for value in [question["text"], *by_letter.values()]):
            question["fixedOrder"] = True
        question["sourceNumber"] = source_id
        question["id"] = number
    return questions


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--overrides", type=Path, help="JSON object mapping Word question numbers to A–D.")
    args = parser.parse_args()
    questions = parse(args.docx)
    if len(questions) != EXPECTED_COUNT or [q["id"] for q in questions] != list(range(1, EXPECTED_COUNT + 1)):
        print(f"Kiểm tra số câu nguồn: có {len(questions)} câu, dự kiến {EXPECTED_COUNT} câu đánh số liên tiếp.")
    overrides = {}
    if args.overrides:
        overrides = {int(key): value for key, value in json.loads(args.overrides.read_text(encoding="utf-8")).items()}
        if any(key not in {q["id"] for q in questions} or value not in list(LETTERS) for key, value in overrides.items()):
            parser.error("Mỗi chỉnh sửa phải là một số câu trong Word và một đáp án A–D.")
    data = prepare(questions, overrides)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(data)} câu, {sum(len(q['options']) for q in data)} phương án, "
          f"{sum(len(q['correct']) for q in data)} câu có đáp án, "
          f"{sum(bool(q.get('review')) for q in data)} câu cần đối chiếu.")
