// Browser test call: talk to a receptionist with the Web Speech API
// (speech recognition + speech synthesis), or type.
import { api, h, onLeave } from "./core.js";

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let test = null;

/** beforeStart (optional) runs first, e.g. saving the form; return false to cancel. */
export function mountTestCall(agent, beforeStart) {
  document.getElementById("start").onclick = async () => {
    if (beforeStart && !(await beforeStart())) return;
    startTestCall(agent);
  };
  onLeave(stopTestCall);
}

async function startTestCall(agent) {
  const chat = document.getElementById("chat");
  const controls = document.getElementById("controls");
  chat.innerHTML = "";
  const { callId, greeting } = await api("POST", `/agents/${agent.id}/test`);
  test = { callId, lang: agent.language, busy: false, ended: false, recognizer: null };

  controls.innerHTML = `
    ${Recognition ? `<button class="mic" id="mic" title="Speak" aria-label="Speak"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ""}
    <form id="say" style="display:flex;gap:8px;flex:1"><input name="text" placeholder="Type what a caller would say…" autocomplete="off" aria-label="Message"><button class="btn btn-primary">Send</button></form>
    <button class="btn" id="hangup" title="End call">End</button>`;

  addMsg("agent", greeting);
  speak(greeting, () => listen());

  document.getElementById("say").onsubmit = (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    e.target.text.value = "";
    if (text) send(text);
  };
  document.getElementById("hangup").onclick = () => finish("You ended the call.");
  const mic = document.getElementById("mic");
  if (mic) mic.onclick = () => (test?.recognizer ? test.recognizer.stop() : listen());
}

function addMsg(role, text) {
  const chat = document.getElementById("chat");
  if (!chat) return;
  chat.insertAdjacentHTML("beforeend", `<div class="msg ${role}">${h(text)}</div>`);
  chat.scrollTop = chat.scrollHeight;
}

async function send(text) {
  if (!test || test.ended || test.busy) return;
  test.busy = true;
  addMsg("caller", text);
  addMsg("system", "…");
  try {
    const { reply, action } = await api("POST", `/calls/${test.callId}/say`, { text });
    document.querySelector("#chat .msg.system:last-child")?.remove();
    addMsg("agent", reply);
    test.busy = false;
    if (action) {
      speak(reply, () => finish(action.type === "transfer" ? "On a real call, the caller would now be transferred to your staff." : "The receptionist ended the call."));
    } else {
      speak(reply, () => listen());
    }
  } catch (err) {
    document.querySelector("#chat .msg.system:last-child")?.remove();
    addMsg("system", err.message);
    if (test) test.busy = false;
  }
}

function speak(text, done) {
  if (!("speechSynthesis" in window)) return done?.();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = test?.lang || "en-IN";
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-") === u.lang);
  if (voice) u.voice = voice;
  u.onend = () => done?.();
  u.onerror = () => done?.();
  speechSynthesis.speak(u);
}

function listen() {
  if (!Recognition || !test || test.ended || test.recognizer) return;
  const rec = new Recognition();
  rec.lang = test.lang;
  rec.interimResults = false;
  rec.onresult = (e) => send(e.results[0][0].transcript);
  rec.onend = () => {
    if (test) test.recognizer = null;
    document.getElementById("mic")?.classList.remove("listening");
  };
  rec.onerror = (e) => { if (e.error === "not-allowed") addMsg("system", "Microphone blocked. Allow it in the browser, or type instead."); };
  test.recognizer = rec;
  document.getElementById("mic")?.classList.add("listening");
  rec.start();
}

function finish(message) {
  if (!test) return;
  const { callId } = test;
  stopTestCall();
  api("POST", `/calls/${callId}/end`).catch(() => {});
  addMsg("system", `${message} It's saved under Calls.`);
  const controls = document.getElementById("controls");
  if (controls) controls.innerHTML = `<a class="btn" href="#call/${h(callId)}" style="flex:1">View transcript & analysis</a>`;
}

function stopTestCall() {
  if (!test) return;
  test.ended = true;
  test.recognizer?.abort();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  test = null;
}
