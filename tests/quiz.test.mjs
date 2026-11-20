import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { studyNotes, terminology } from "../study-notes.mjs";
import {
  createRun, displayOptions, modes, outcome, restore, selectIds, stats, submit, wrongQuestions,
} from "../quiz.mjs";

const bank = JSON.parse(readFileSync(new URL("../questions.json", import.meta.url), "utf8"));
const map = new Map(bank.map(q => [q.id, q]));
const random = () => 0;
const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

test("Mỗi câu có giải thích ngắn và chỉ dẫn các thuật ngữ cần thiết", () => {
  assert.deepEqual(Object.keys(studyNotes).map(Number), bank.map(q => q.sourceNumber));
  const linkedTerms = new Set();
  for (const [explanation, terms] of Object.values(studyNotes)) {
    assert(explanation.trim() && explanation.length <= 180);
    assert(terms.length <= 4);
    assert.equal(new Set(terms).size, terms.length);
    for (const term of terms) {
      assert.equal(terminology[term]?.length, 2, term);
      assert(terminology[term].every(text => text.trim()));
      linkedTerms.add(term);
    }
  }
  assert.deepEqual([...linkedTerms].sort(), Object.keys(terminology).sort());
  assert.deepEqual(studyNotes[1][1], ["isa", "organization", "hardware"]);
  assert.deepEqual(studyNotes[2][1], ["isa"]);
  assert(studyNotes[89][1].includes("isaBus") && studyNotes[89][1].includes("isa"));
});

test("Nhập đủ 107 câu, 428 phương án và 107 đáp án theo thứ tự Word", () => {
  assert.deepEqual(bank.map(q => q.sourceNumber), range(1, 107));
  for (const q of bank) {
    assert.equal(q.id, q.sourceNumber);
    assert.deepEqual(q.options.map(o => o.id), ["A", "B", "C", "D"]);
    assert(q.options.every(o => o.text.trim() && !o.missing));
    assert.equal(q.correct.length, 1);
    assert(q.options.some(o => q.correct.includes(o.id)));
    assert.match(q.explanation, /^Chương [IV]+, slide \d+/);
  }
  for (const [id, correct] of [[1, "A"], [70, "B"], [101, "C"], [107, "D"]]) {
    assert.deepEqual(map.get(id).correct, [correct]);
  }
});

test("Năm đề liên tiếp phủ 107 câu và chênh tối đa một câu", () => {
  const bounds = [[1, 22], [23, 44], [45, 65], [66, 86], [87, 107]];
  bounds.forEach(([first, last], i) => assert.deepEqual(selectIds(bank, String(i + 1)), range(first, last)));
  assert.deepEqual(selectIds(bank, "all"), range(1, 107));
});

test("Cả bốn chế độ chấm đúng 107 câu bằng ID nội dung", () => {
  for (const mode of modes) {
    const run = createRun(bank, "all", mode, null, random);
    assert.deepEqual([...run.ids].sort((a, b) => a - b), range(1, 107));
    assert.equal(run.ids[0] === 1, !["questions", "both"].includes(mode));
    for (const q of bank) {
      const options = displayOptions(q, run.order[q.id]);
      assert.deepEqual(options.map(o => o.letter), ["A", "B", "C", "D"]);
      assert.equal(options[0].id === "A", !["options", "both"].includes(mode) || Boolean(q.fixedOrder));
      const [correct] = q.correct;
      const right = options.find(o => o.id === correct);
      const wrong = options.find(o => o.id !== correct);
      assert.equal(right.text, q.options.find(o => o.id === correct).text);
      assert.equal(outcome(q, right.id), "right");
      assert.equal(outcome(q, wrong.id), "wrong");
      assert(submit(run, q, right.id));
      assert(!submit(run, q, wrong.id));
    }
    assert.deepEqual(stats(run, map), { right: 107, wrong: 0, pending: 0, ungraded: 0, answered: 107 });
  }
});

test("Giữ thứ tự với lựa chọn có tham chiếu theo chữ cái hoặc vị trí", () => {
  for (const text of ["Cả A và C", "Tất cả các ý trên"]) {
    const q = {
      ...bank[0],
      fixedOrder: true,
      options: bank[0].options.map(o => o.id === "D" ? { ...o, text } : o),
    };
    const run = createRun([q], "all", "both", null, random);
    assert.deepEqual(run.order[q.id], ["A", "B", "C", "D"]);
    assert.equal(displayOptions(q, run.order[q.id])[3].text, text);
  }
});

test("Câu chưa xác nhận bị loại khỏi số đúng/sai và phương án thiếu không chấm", () => {
  const q = {
    ...bank[0], correct: [], review: ["Thiếu đáp án."],
    options: bank[0].options.map(o => o.id === "D" ? { ...o, missing: true } : o),
  };
  const run = createRun([q], "all", "options", null, random);
  assert(!submit(run, q, "D"));
  assert(submit(run, q, "A"));
  assert.equal(outcome(q, "A"), "ungraded");
  assert.deepEqual(stats(run, new Map([[q.id, q]])),
    { right: 0, wrong: 0, pending: 0, ungraded: 1, answered: 1 });
});

test("Khôi phục vị trí, thứ tự đảo, kết quả, dấu ôn và lượt làm lại", () => {
  const main = createRun(bank, "5", "both", null, random);
  assert(submit(main, map.get(87), "C"));
  assert(submit(main, map.get(107), "D"));
  main.index = 12;
  assert.deepEqual(wrongQuestions(main, map), [87]);
  const retry = createRun(bank, "5", "both", wrongQuestions(main, map), random);
  const saved = { version: 1, main, retry, active: "retry", marks: [87], filter: "marked" };
  assert.deepEqual(restore(JSON.parse(JSON.stringify(saved)), bank), saved);
  assert.equal(restore({ ...saved, main: { ...main, ids: [] } }, bank), null);
});
