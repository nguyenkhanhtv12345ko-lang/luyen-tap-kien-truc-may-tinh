import {
  createRun, displayOptions, outcome, questionCount, restore, selectIds, sets, stats, submit, wrongQuestions,
} from "./quiz.mjs";
import { studyNotes, terminology } from "./study-notes.mjs";

const byId = id => document.getElementById(id);
const storageKey = "kien-truc-may-tinh-107/v1";
const sourceName = run => (run.set === "all" ? "Toàn bộ câu hỏi" : "Đề " + run.set) + " · " + run.ids.length + " câu";
const modeNames = { original: "Nguyên bản", questions: "Đảo câu hỏi", options: "Đảo phương án", both: "Đảo cả hai" };
const stateLabels = { right: "đúng", wrong: "sai", pending: "chưa làm", ungraded: "chưa có đáp án xác nhận" };
let bank, map, saved, pendingAction;
let selection = null;

const questionCard = byId("question");
const menu = byId("menu");
const confirm = byId("confirm");
const activeRun = () => saved[saved.active];
const activeQuestion = () => map.get(activeRun().ids[activeRun().index]);
const visibleOptions = () => displayOptions(activeQuestion(), activeRun().order[activeQuestion().id]);
const needsReview = question => !question.correct.length || Boolean(question.review?.length);

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved));
    byId("storage-status").textContent = "Tự lưu";
  } catch {
    byId("storage-status").textContent = "Chỉ lưu trong phiên này";
  }
}

function restoreOrStart() {
  let restored;
  try { restored = restore(JSON.parse(localStorage.getItem(storageKey)), bank); }
  catch { /* Start a new session if storage is unavailable or corrupt. */ }
  return restored ?? {
    version: 1, main: createRun(bank, "all", "original"), retry: null, active: "main",
    marks: [], filter: "all",
  };
}

function textNode(tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderStudyDetails(question, answer) {
  const study = byId("study-details");
  const [explanation, terms] = studyNotes[question.sourceNumber] ?? ["", []];
  study.hidden = !answer || !(explanation || question.explanation);
  if (study.hidden) return;

  byId("study-explanation").hidden = !explanation;
  byId("study-text").textContent = explanation;
  byId("study-glossary").hidden = terms.length === 0;
  byId("study-terms").replaceChildren(...terms.map(term => {
    const [vietnamese, english, definition] = terminology[term];
    const item = document.createElement("div");
    const name = textNode("dt", vietnamese);
    if (english !== vietnamese) {
      name.append(textNode("span", ` (${english})`, "term-english"));
    }
    item.append(name, textNode("dd", definition));
    return item;
  }));
  const source = byId("study-source");
  source.hidden = !question.explanation;
  source.textContent = question.explanation || "";
}

function renderQuestion() {
  const run = activeRun();
  const question = activeQuestion();
  const answer = run.answers[question.id];
  const result = outcome(question, answer);
  const options = visibleOptions();
  byId("active-title").textContent = saved.active === "retry"
    ? "Làm lại câu sai · " + sourceName(saved.main)
    : sourceName(saved.main) + " · " + modeNames[run.mode];
  byId("question-count").textContent = "Câu " + (run.index + 1) + " / " + run.ids.length;
  byId("original-number").textContent = "Câu gốc " + question.sourceNumber;
  byId("question-text").textContent = question.text || "Tài liệu chưa có nội dung câu hỏi này.";

  const note = byId("source-note");
  note.hidden = !needsReview(question);
  note.textContent = "Cần đối chiếu" + (question.review?.length ? " · " + question.review.join(" ") : "");
  byId("order-note").hidden = !(question.fixedOrder && ["options", "both"].includes(run.mode));

  const marked = saved.marks.includes(question.id);
  byId("mark").setAttribute("aria-pressed", String(marked));
  byId("mark").querySelector("span").textContent = marked ? "Đã đánh dấu" : "Đánh dấu";
  byId("previous").disabled = run.index === 0;
  byId("next").disabled = run.index === run.ids.length - 1;

  const optionsElement = byId("options");
  optionsElement.replaceChildren();
  for (const option of options) {
    const button = textNode("button", "", "option");
    button.type = "button";
    button.dataset.option = option.id;
    button.disabled = Boolean(option.missing);
    const badge = textNode("span", option.letter, "option-letter");
    const symbol = textNode("span", "", "option-symbol");
    button.append(badge, textNode("span", option.text), symbol);
    const label = [option.letter + ".", option.text];
    if (answer) {
      button.setAttribute("aria-disabled", "true");
      if (question.correct.includes(option.id)) {
        button.dataset.result = "right";
        symbol.textContent = "✓";
        label.push("Đáp án đúng");
      } else if (answer === option.id && result === "wrong") {
        button.dataset.result = "wrong";
        symbol.textContent = "×";
        label.push("Đã chọn, sai");
      }
      if (answer === option.id) button.dataset.attempt = "true";
    }
    symbol.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-label", label.join(" "));
    button.addEventListener("click", () => choose(option.id));
    optionsElement.append(button);
  }
  updateSelection(false);
  const feedback = byId("feedback");
  feedback.hidden = !answer;
  feedback.dataset.result = result;
  feedback.replaceChildren();
  if (answer) {
    const resultText = { right: "✓ Chính xác", wrong: "× Chưa chính xác", ungraded: "Cần đối chiếu" };
    feedback.append(textNode("strong", resultText[result]));
    const correct = options.filter(option => question.correct.includes(option.id));
    feedback.append(textNode("span", correct.length
      ? "Đáp án đúng là " + correct.map(option => option.letter + ". " + option.text).join(" / ")
      : "Lựa chọn đã được lưu. Câu này được bỏ qua khi tính điểm."));
  }
  renderStudyDetails(question, answer);
}

function updateSelection(focus) {
  byId("options").querySelectorAll("button").forEach((button, index) => {
    button.dataset.selected = String(index === selection);
    button.setAttribute("aria-pressed", String(index === selection || button.dataset.attempt === "true"));
    if (focus && index === selection) button.focus();
  });
}

function renderProgress() {
  const run = activeRun();
  const counts = stats(run, map);
  const total = run.ids.length;
  const percent = Math.round(counts.answered / total * 100);
  byId("answered-count").textContent = counts.answered + "/" + total + " đã làm" +
    (counts.ungraded ? " · " + counts.ungraded + " chờ xác nhận" : "");
  byId("percent").textContent = percent + "%";
  byId("progress-bar").max = total;
  byId("progress-bar").value = counts.answered;
  byId("right-count").textContent = counts.right;
  byId("wrong-count").textContent = counts.wrong;
  byId("pending-count").textContent = counts.pending;
  byId("filter").value = saved.filter;
  byId("retry").disabled = counts.wrong === 0;
  byId("retry").textContent = counts.wrong ? "Làm lại câu sai (" + counts.wrong + ")" : "Làm lại câu sai";
  byId("back-main").hidden = saved.active !== "retry";

  const grid = byId("question-grid");
  const gridScroll = grid.scrollTop;
  const frag = document.createDocumentFragment();
  run.ids.forEach((id, index) => {
    const question = map.get(id);
    const result = outcome(question, run.answers[id]);
    const isMarked = saved.marks.includes(id);
    const review = needsReview(question);
    const filters = { all: true, wrong: result === "wrong", pending: result === "pending",
      marked: isMarked, review };
    if (!filters[saved.filter]) return;
    const button = textNode("button", "", "cell");
    button.append(textNode("span", String(question.sourceNumber)));
    const status = { right: "✓", wrong: "×", ungraded: "?" }[result];
    if (status) {
      const badge = textNode("span", status, "cell-status");
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }
    button.type = "button";
    button.dataset.question = String(id);
    button.dataset.result = result;
    button.dataset.marked = String(isMarked);
    if (index === run.index) button.setAttribute("aria-current", "true");
    button.setAttribute("aria-label", "Câu gốc " + question.sourceNumber + ", " + stateLabels[result]
      + (isMarked ? ", đã đánh dấu" : "") + (review ? ", cần đối chiếu" : ""));
    button.addEventListener("click", () => goTo(index));
    frag.append(button);
  });
  byId("grid-empty").hidden = Boolean(frag.childElementCount);
  grid.replaceChildren(frag);
  grid.scrollTop = gridScroll;

  const reviewCount = run.ids.filter(id => needsReview(map.get(id))).length;
  const linkArea = byId("review-links");
  linkArea.hidden = !reviewCount;
  linkArea.replaceChildren();
  if (reviewCount) {
    const button = textNode("button", reviewCount + " câu cần đối chiếu tài liệu");
    button.type = "button";
    button.addEventListener("click", () => {
      saved.filter = saved.filter === "review" ? "all" : "review";
      renderProgress();
      byId("filter").focus();
      save();
    });
    linkArea.append(button);
  }
}

function focusQuestion() {
  questionCard.focus({ preventScroll: true });
  questionCard.scrollIntoView({ block: "start" });
}

function present({ focus = false } = {}) {
  selection = null;
  renderQuestion();
  renderProgress();
  save();
  if (focus) focusQuestion();
}

function goTo(index) {
  const run = activeRun();
  if (index < 0 || index >= run.ids.length || run.index === index) return;
  run.index = index;
  present({ focus: true });
}

function choose(id) {
  const question = activeQuestion();
  if (!submit(activeRun(), question, id)) return;
  const focusedOption = document.activeElement?.closest("#options button");
  present();
  if (focusedOption) {
    [...byId("options").children].find(button => button.dataset.option === id)?.focus({ preventScroll: true });
  }
}

function restart(set, mode) {
  saved.main = createRun(bank, set, mode);
  saved.active = "main";
  saved.retry = null;
  saved.filter = "all";
  present({ focus: true });
}

function askRestart(description, action) {
  pendingAction = action;
  byId("confirm-text").textContent = description;
  confirm.returnValue = "";
  confirm.showModal();
}

function changeView(view) {
  saved.active = view;
  saved.filter = "all";
  present({ focus: true });
}

function openMenu() {
  byId("set").value = saved.main.set;
  byId("shuffle").value = saved.main.mode;
  menu.showModal();
}

function setupControls() {
  for (const set of sets) {
    const ids = selectIds(bank, set);
    const name = set === "all"
      ? "Toàn bộ câu hỏi · " + ids.length + " câu"
      : `Đề ${set} · Câu ${map.get(ids[0]).sourceNumber}–${map.get(ids.at(-1)).sourceNumber}`;
    const option = textNode("option", name);
    option.value = set;
    byId("set").append(option);
  }
  byId("mark").addEventListener("click", () => {
    const id = activeQuestion().id;
    saved.marks = saved.marks.includes(id) ? saved.marks.filter(mark => mark !== id) : [...saved.marks, id];
    renderQuestion();
    renderProgress();
    save();
  });
  byId("filter").addEventListener("change", event => {
    saved.filter = event.target.value;
    renderProgress();
    save();
  });
  byId("previous").addEventListener("click", () => goTo(activeRun().index - 1));
  byId("next").addEventListener("click", () => goTo(activeRun().index + 1));
  byId("open-menu").addEventListener("click", openMenu);
  menu.querySelector("[data-close]").addEventListener("click", () => menu.close());
  byId("menu-form").addEventListener("submit", event => {
    event.preventDefault();
    const set = byId("set").value;
    const mode = byId("shuffle").value;
    menu.close();
    if (set === saved.main.set && mode === saved.main.mode) {
      if (saved.active === "retry") changeView("main");
      return;
    }
    if (saved.main.index !== 0 || Object.keys(saved.main.answers).length || saved.retry) {
      askRestart("Áp dụng đề hoặc kiểu đảo mới sẽ đặt lại tiến độ hiện tại. Các câu đã đánh dấu vẫn được lưu.",
        () => restart(set, mode));
    } else restart(set, mode);
  });
  byId("new-run").addEventListener("click", () => {
    if (saved.active === "retry") {
      askRestart("Tiến độ ôn lại câu sai sẽ được đặt lại. Kết quả của lượt chính và các câu đã đánh dấu vẫn được lưu.", () => {
        saved.retry = createRun(bank, saved.retry.set, saved.retry.mode, saved.retry.ids);
        saved.filter = "all";
        present({ focus: true });
      });
    } else {
      askRestart("Tiến độ của lượt hiện tại sẽ được đặt lại. Các câu đã đánh dấu vẫn được lưu.",
        () => restart(saved.main.set, saved.main.mode));
    }
  });
  confirm.querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    const action = event.submitter?.value === "confirm" ? pendingAction : undefined;
    pendingAction = undefined;
    confirm.close();
    action?.();
  });
  confirm.addEventListener("cancel", () => { pendingAction = undefined; });
  byId("retry").addEventListener("click", () => {
    const run = activeRun();
    const ids = wrongQuestions(run, map).sort((a, b) => a - b);
    if (!ids.length) return;
    const start = () => {
      saved.retry = createRun(bank, run.set, run.mode, ids);
      changeView("retry");
    };
    if (saved.retry && (saved.retry.index !== 0 || Object.keys(saved.retry.answers).length)) {
      askRestart("Ghi đè tiến độ của lượt ôn câu sai trước đó?", start);
    } else {
      start();
    }
  });
  byId("back-main").addEventListener("click", () => changeView("main"));
  document.addEventListener("keydown", onShortcut);
}

function onShortcut(event) {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey ||
    event.isComposing || menu.open || confirm.open ||
    event.target.closest?.("select,input,textarea,[contenteditable],summary")) return;
  const key = event.key.toLowerCase();
  const run = activeRun();
  const answered = run.answers[activeQuestion().id];
  const buttons = [...byId("options").children];
  const focusIndex = buttons.indexOf(document.activeElement);
  if (key === "arrowleft" || key === "arrowright") {
    event.preventDefault();
    goTo(run.index + (key === "arrowleft" ? -1 : 1));
  } else if (!answered && /^[a-d]$/.test(key)) {
    const index = key.charCodeAt(0) - 97;
    if (!buttons[index] || buttons[index].disabled) return;
    event.preventDefault();
    selection = index;
    updateSelection(true);
  } else if (!answered && buttons.length && ["arrowup", "arrowdown"].includes(key)) {
    if (buttons.every(button => button.disabled)) return;
    event.preventDefault();
    const step = key === "arrowup" ? -1 : 1;
    const from = selection ?? (focusIndex === -1 ? (step > 0 ? -1 : 0) : focusIndex);
    selection = from;
    do {
      selection = (selection + step + buttons.length) % buttons.length;
    } while (buttons[selection].disabled);
    updateSelection(true);
  } else if (!answered && key === "enter" && (focusIndex !== -1 || selection !== null &&
    !event.target.closest?.("button,a"))) {
    const index = focusIndex !== -1 ? focusIndex : selection;
    event.preventDefault();
    choose(buttons[index].dataset.option);
  }
}

async function boot() {
  try {
    const response = await fetch(new URL("./questions.json", import.meta.url));
    if (!response.ok) throw new Error("Không tải được dữ liệu câu hỏi.");
    bank = await response.json();
    if (bank.length !== questionCount) throw new Error("Thiếu dữ liệu câu hỏi.");
    map = new Map(bank.map(question => [question.id, question]));
    saved = restoreOrStart();
    setupControls();
    present();
  } catch (error) {
    byId("question-text").textContent = "Không tải được câu hỏi. Hãy tải lại trang.";
    console.error(error);
  } finally {
    questionCard.removeAttribute("aria-busy");
  }
}

boot();
