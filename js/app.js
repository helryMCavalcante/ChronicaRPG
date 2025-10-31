// estado mínimo em memória (versão estática)
const state = {
  rooms: [],
};

const $ = (sel) => document.querySelector(sel);

function renderRooms() {
  const wrap = $("#rooms");
  wrap.innerHTML = "";
  state.rooms.forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "room";
    el.innerHTML = `
      <h3>${r.name}</h3>
      <div class="badge">${r.players}/10 jogadores</div>
    `;
    wrap.appendChild(el);
  });
}

function parseDice(expr) {
  // suporta "XdY(+/-N)?  #rótulo"
  const [left, labelRaw] = expr.split("#");
  const m = left.trim().match(/^(\d+)[dD](\d+)([+-]\d+)?$/);
  if (!m) return { error: "Use o formato: 1d20+2 #comentário" };
  const qty = +m[1], sides = +m[2], mod = m[3] ? +m[3] : 0;
  const rolls = Array.from({ length: qty }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a,b)=>a+b,0) + mod;
  return { rolls, mod, total, label: (labelRaw||"").trim() };
}

function setupUI() {
  $("#createRoom").addEventListener("click", () => {
    const name = $("#roomName").value.trim() || `Sala ${state.rooms.length+1}`;
    if (state.rooms.length >= 20) return alert("Limite de salas nesta demo.");
    state.rooms.push({ name, players: Math.floor(Math.random()*4)+1 });
    $("#roomName").value = "";
    renderRooms();
  });

  $("#rollBtn").addEventListener("click", () => {
    const expr = $("#diceExpr").value.trim();
    const out = $("#diceOut");
    const r = parseDice(expr);
    if (r.error) { out.textContent = r.error; return; }
    out.textContent = `Rolagens: [${r.rolls.join(", ")}]  Mod: ${r.mod >=0?`+${r.mod}`:r.mod}\nTotal: ${r.total}${r.label?`  #${r.label}`:""}`;
  });

  // seed de exemplo
  state.rooms = [{ name: "Taberna do Dragão", players: 3 }, { name: "Cripta Ancestral", players: 2 }];
  renderRooms();
}

document.addEventListener("DOMContentLoaded", setupUI);
