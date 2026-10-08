"use strict";
const $ = (s, r = document) => r.querySelector(s);
const view = $("#view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let lib = {}; // key ("movie:1" / "tv:2") -> entry

/* ---------- utilidades ---------- */
async function api(path, body) {
  const opt = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let r;
  try { r = await fetch(path, opt); } catch { throw new Error("O app local não respondeu."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro inesperado");
  return j;
}
function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 2400);
}
const keyOf = (type, id) => `${type || "movie"}:${id}`;
const hrefOf = (type, id) => (type === "tv" ? "#/serie/" : "#/filme/") + id;
const GENERIC = ["", "★"];
async function loadLib() {
  const arr = await api("/api/library");
  lib = {}; arr.forEach((e) => (lib[e.key] = e));
  const w = arr.filter((e) => e.watched).length, l = arr.filter((e) => e.watchlist).length;
  $("#c-w").textContent = w || ""; $("#c-l").textContent = l || "";
}
function applyAppearance(a) {
  document.body.classList.toggle("solid", a.transparency === false);
  document.body.classList.toggle("light", a.theme === "light");
}
async function loadAppearance() {
  try { applyAppearance(await api("/api/settings")); } catch { /* usa o padrão */ }
}
async function refreshProfile() {
  try {
    const P = await api("/api/profile");
    const av = $("#nav-avatar .av");
    if (P.photo) { av.style.backgroundImage = `url('${P.photo}')`; av.textContent = ""; }
    else { av.style.backgroundImage = ""; av.textContent = (P.name || "").trim() ? P.name.trim()[0].toUpperCase() : "😎"; }
    $("#nav-avatar").title = P.name ? "Perfil de " + P.name : "Meu perfil";
  } catch { /* sem perfil ainda */ }
}
async function save(type, id, patch) {
  const key = keyOf(type, id);
  const { entry } = await api(`/api/library/${type}/${id}`, patch);
  if (entry) lib[key] = entry; else delete lib[key];
  await loadLib();
  return entry;
}
const allTags = () => [...new Set(Object.values(lib).flatMap((e) => e.tags || []))].sort((a, b) => a.localeCompare(b, "pt"));
const fmtH = (min) => { const h = Math.floor(min / 60); return h >= 100 ? `${h}h` : `${h}h ${String(Math.round(min % 60)).padStart(2, "0")}min`; };
const decadeOf = (y) => (y && /^\d{4}$/.test(y) ? Math.floor(+y / 10) * 10 : null);

/* ---------- componentes ---------- */
const STAR_P = "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z";
function starsStatic(v) { const f = Math.floor(v); return "★".repeat(f) + (v - f >= 0.5 ? "½" : ""); }
function posterCard(m, opts = {}) {
  const type = m.type || "movie";
  const e = lib[keyOf(type, m.id)];
  const badge = e?.watched ? `<span class="badge w" title="Assistido">✓</span>` : e?.watchlist ? `<span class="badge l" title="Quero assistir">★</span>` : "";
  const kind = type === "tv" ? `<span class="kind">SÉRIE</span>` : "";
  const bg = m.poster ? `style="background-image:url('${esc(m.poster)}')"` : "";
  const extra = opts.rating && e?.rating ? `<div class="stars-mini">${starsStatic(e.rating)}</div>` : opts.sub ? `<div class="y">${esc(opts.sub)}</div>` : "";
  const rm = opts.remove ? `<button class="rm" data-rm="${esc(keyOf(type, m.id))}" title="Remover da lista">×</button>` : "";
  return `<div class="pwrap"><a class="poster" href="${hrefOf(type, m.id)}"><div class="img" ${bg}>${m.poster ? "" : '<div class="noimg">🎞️</div>'}${badge}${kind}</div>
    <div class="t">${esc(m.title)}</div><div class="y">${esc(m.year || "")}</div>${extra}</a>${rm}</div>`;
}
function personCard(p, sub) {
  const bg = p.photo ? `style="background-image:url('${esc(p.photo)}')"` : "";
  return `<a class="person" href="#/pessoa/${p.id}"><div class="ph" ${bg}>${p.photo ? "" : "👤"}</div><b>${esc(p.name)}</b><small>${esc(sub || "")}</small></a>`;
}
const loading = () => (view.innerHTML = '<div class="spin"></div>');
function errorBox(e) {
  view.innerHTML = `<div class="err-box"><div style="font-size:48px">😕</div><h2 style="margin:8px 0">Ops!</h2><p>${esc(e.message)}</p>
  <a class="btn primary" href="#/ajustes">Abrir Ajustes</a></div>`;
}
function starsWidget(value, onPick) {
  const box = document.createElement("div");
  box.className = "stars";
  let cur = value || 0;
  box.innerHTML = [1, 2, 3, 4, 5].map((i) =>
    `<div class="star"><svg viewBox="0 0 24 24"><defs><clipPath id="sc${i}"><rect class="clip" x="0" y="0" width="0" height="24"/></clipPath></defs>
    <path class="bg" d="${STAR_P}"/><path class="fg" clip-path="url(#sc${i})" d="${STAR_P}"/></svg>
    <button class="half l" data-v="${i - 0.5}"></button><button class="half r" data-v="${i}"></button></div>`).join("");
  const clips = box.querySelectorAll(".clip");
  const draw = (v) => clips.forEach((c, k) => { const i = k + 1; c.setAttribute("width", v >= i ? 24 : v >= i - 0.5 ? 12 : 0); });
  draw(cur);
  box.addEventListener("mouseover", (e) => { const v = e.target.dataset?.v; if (v) draw(+v); });
  box.addEventListener("mouseleave", () => draw(cur));
  box.addEventListener("click", (e) => {
    const v = e.target.dataset?.v; if (!v) return;
    cur = cur === +v ? 0 : +v; draw(cur); onPick(cur);
  });
  return box;
}

/* ---------- INÍCIO: todos os títulos com ordenação e filtros ---------- */
const home = { type: "movie", sort: "popular", genre: "", decade: "", page: 0, total: 1, items: [], genres: {}, busy: false, scroll: 0 };
const SORTS = [["popular", "Relevância"], ["trending", "Em alta"], ["alpha", "A–Z"], ["rating", "Mais bem avaliados"]];
async function pageHome() {
  if (!home.genres[home.type]) {
    try { home.genres[home.type] = await api("/api/genres?type=" + home.type); } catch { home.genres[home.type] = []; }
  }
  const decades = []; for (let d = 2020; d >= 1920; d -= 10) decades.push(d);
  view.innerHTML = `<div class="pagehead"><h1>Descubra ${home.type === "tv" ? "séries" : "filmes"} 🍿</h1>
  <p class="sub">Explore tudo, filtre do seu jeito e marque o que já viu.</p></div>
  <div class="filters">
    <div class="seg" id="f-type"><button data-v="movie" class="${home.type === "movie" ? "on" : ""}">🎬 Filmes</button><button data-v="tv" class="${home.type === "tv" ? "on" : ""}">📺 Séries</button></div>
    <div class="seg" id="f-sort">${SORTS.map(([v, l]) => `<button data-v="${v}" class="${home.sort === v ? "on" : ""}">${l}</button>`).join("")}</div>
    <select id="f-genre"><option value="">Todos os gêneros</option>${home.genres[home.type].map((g) => `<option value="${g.id}" ${String(g.id) === home.genre ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>
    <select id="f-dec"><option value="">Todas as épocas</option>${decades.map((d) => `<option value="${d}" ${String(d) === home.decade ? "selected" : ""}>Anos ${d}</option>`).join("")}</select>
  </div>
  ${home.sort === "alpha" ? '<p class="sub note">A–Z pelo título original, mostrando só títulos com um mínimo de votos.</p>' : ""}
  <div class="grid" id="hgrid"></div><div id="more" class="more"></div>`;
  const reset = () => { home.page = 0; home.items = []; home.total = 1; home.scroll = 0; pageHome(); };
  $("#f-type").onclick = (e) => { const v = e.target.dataset.v; if (v && v !== home.type) { home.type = v; home.genre = ""; reset(); } };
  $("#f-sort").onclick = (e) => { const v = e.target.dataset.v; if (v && v !== home.sort) { home.sort = v; reset(); } };
  $("#f-genre").onchange = (e) => { home.genre = e.target.value; reset(); };
  $("#f-dec").onchange = (e) => { home.decade = e.target.value; reset(); };
  const draw = () => { $("#hgrid").innerHTML = home.items.map((m) => posterCard(m)).join(""); };
  const moreBox = $("#more");
  const endMsg = () => home.page < home.total ? "" : (home.items.length ? '<p class="sub">Isso é tudo por aqui 🎉</p>' : '<div class="empty"><div class="big">🔍</div><p>Nada encontrado com esses filtros.</p></div>');
  const obs = new IntersectionObserver((en) => { if (en[0].isIntersecting) loadMore(); }, { rootMargin: "600px" });
  async function loadMore() {
    if (home.busy || home.page >= home.total) return;
    home.busy = true; moreBox.innerHTML = '<div class="spin sm"></div>';
    const snap = JSON.stringify([home.type, home.sort, home.genre, home.decade]);
    try {
      let guard = 0;
      do { // filtros do "Em alta" podem esvaziar uma página: continua buscando
        const d = await api(`/api/discover?type=${home.type}&sort=${home.sort}&genre=${home.genre}&decade=${home.decade}&page=${home.page + 1}`);
        if (snap !== JSON.stringify([home.type, home.sort, home.genre, home.decade])) { home.busy = false; return; }
        home.page = d.page; home.total = d.total_pages;
        const seen = new Set(home.items.map((m) => keyOf(m.type, m.id)));
        home.items.push(...d.items.filter((m) => !seen.has(keyOf(m.type, m.id))));
      } while (home.sort === "trending" && home.page < home.total && home.page < 20 && ++guard < 6 && home.items.length < 18);
      draw();
      moreBox.innerHTML = endMsg();
      if (home.page < home.total) obs.observe(moreBox);
    } catch (e) { moreBox.innerHTML = `<p class="sub">${esc(e.message)}</p>`; }
    home.busy = false;
  }
  if (home.items.length) { // voltando de outra tela: mostra o que já estava carregado e volta onde você parou
    draw(); moreBox.innerHTML = endMsg(); obs.observe(moreBox);
    const y = home.scroll; requestAnimationFrame(() => window.scrollTo(0, y));
  } else { window.scrollTo(0, 0); await loadMore(); }
  window.__obs = obs;
}

/* ---------- BUSCA ---------- */
async function pageSearch(q) {
  loading();
  const d = await api("/api/search?q=" + encodeURIComponent(q));
  view.innerHTML = `<h1>Resultados para “${esc(q)}”</h1>` +
    (d.people.length ? `<h2>Pessoas</h2><div class="people">${d.people.map((p) => personCard(p, p.known_for)).join("")}</div>` : "") +
    (d.movies.length ? `<h2>Filmes e séries</h2><div class="grid">${d.movies.map((m) => posterCard(m)).join("")}</div>` : "") +
    (!d.people.length && !d.movies.length ? `<div class="empty"><div class="big">🔍</div><p>Nada encontrado. Tente outro nome.</p></div>` : "");
}

/* ---------- FILME / SÉRIE ---------- */
async function pageTitle(type, id) {
  loading();
  const m = await api(`/api/${type}/${id}`);
  const isTv = type === "tv";
  const base = { type, title: m.title, year: m.year, poster: m.poster_small, runtime: m.runtime_total, genres: m.genres,
    cast: m.cast.slice(0, 6).map((c) => ({ id: c.id, name: c.name })), directors: m.directors.map((d) => ({ id: d.id, name: d.name })) };
  const key = keyOf(type, id);
  let e = lib[key] || m.mine || {};
  if (lib[key] && lib[key].runtime == null) save(type, id, base).catch(() => {}); // enriquece entradas antigas
  const hrs = m.runtime ? (isTv ? `${m.runtime} min/ep.` : `${Math.floor(m.runtime / 60)}h ${String(m.runtime % 60).padStart(2, "0")}min`) : "";
  const pv = m.providers;
  const provBlock = (lst, cls, name) => lst.length ? `<div class="lbl">${name}</div><div class="provs">${lst.map((p) => `<span class="prov ${cls}">${p.logo ? `<img src="${esc(p.logo)}" alt="">` : ""}${esc(p.name)}</span>`).join("")}</div>` : "";
  const provHtml = provBlock(pv.stream, "", "Incluído na assinatura") + provBlock(pv.rent, "rent", "Alugar") + provBlock(pv.buy, "buy", "Comprar") || `<p class="sub">Não encontramos este título em streamings no Brasil agora.</p>`;
  const seasons = isTv && m.seasons.length ? `<h2>Temporadas</h2><div class="people">${m.seasons.map((s) => `<div class="person"><div class="ph" style="border-radius:18px;${s.poster ? `background-image:url('${esc(s.poster)}')` : ""}">${s.poster ? "" : "📺"}</div><b>${esc(s.name)}</b><small>${s.episodes} ep. ${s.year ? "· " + s.year : ""}</small></div>`).join("")}</div>` : "";

  view.innerHTML = `
  <section class="hero" style="${m.backdrop ? `background-image:url('${esc(m.backdrop)}')` : ""}">
    <div class="hero-in">
      <div class="big" style="${m.poster ? `background-image:url('${esc(m.poster)}')` : ""}"></div>
      <div>
        <h1>${esc(m.title)} <span style="font-weight:400;opacity:.8">(${esc(m.year)})</span></h1>
        ${m.original_title && m.original_title !== m.title ? `<div class="orig">${esc(m.original_title)}</div>` : ""}
        ${m.tagline ? `<div class="tag">“${esc(m.tagline)}”</div>` : ""}
        <div class="meta">${isTv ? '<span class="chip">📺 Série</span>' : ""}${m.vote ? `<span class="chip score">★ ${m.vote}</span>` : ""}${hrs ? `<span class="chip">${hrs}</span>` : ""}${isTv ? `<span class="chip">${m.seasons_count} temp. · ${m.episodes_count} ep.</span>` : ""}${m.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div>
        <p class="synopsis">${esc(m.overview)}</p>
        ${m.directors.length ? `<p style="margin:0 0 16px"><b>${m.director_label}:</b> ${m.directors.map((d) => `<a href="#/pessoa/${d.id}" style="text-decoration:underline">${esc(d.name)}</a>`).join(", ")}</p>` : ""}
        <div class="actions">
          <button class="btn" id="b-w"></button><button class="btn" id="b-l"></button><button class="btn" id="b-h"></button>
          ${m.trailer ? `<a class="btn ghost" href="${esc(m.trailer)}" target="_blank" rel="noopener">▶ Trailer</a>` : ""}
        </div>
      </div>
    </div>
  </section>

  <h2>Elenco</h2>
  <div class="people">${m.cast.map((p) => personCard(p, p.character)).join("") || '<p class="sub">Elenco indisponível.</p>'}</div>
  ${seasons}
  <div class="two">
    <div class="panel"><h3>📝 Minha opinião</h3>
      <div class="rowx" style="margin-bottom:12px"><div id="stars"></div><span class="sub" id="stxt" style="margin:0"></span></div>
      <div class="rowx" style="margin-bottom:12px"><label class="sub" style="margin:0">${isTv ? "Terminei em" : "Assistido em"}</label><input type="date" id="wdate" style="width:auto"></div>
      <div class="lbl">Minhas tags</div>
      <div class="tags" id="tags"></div>
      <div class="rowx" style="margin:8px 0 14px"><input type="text" id="tin" list="tlist" placeholder="Nova tag (ex.: chorei, rever, com amigos) + Enter" style="flex:1"><datalist id="tlist"></datalist></div>
      <textarea id="rev" placeholder="O que você achou? Escreva à vontade, é só pra você…"></textarea>
      <div class="rowx" style="margin-top:12px"><button class="btn primary" id="b-save">Salvar resenha</button></div>
    </div>
    <div>
      <div class="panel" style="margin-top:0"><h3>📺 Onde assistir (Brasil)</h3>${provHtml}
        <p class="sub" style="font-size:13px;margin:10px 0 0">Disponibilidade por JustWatch via TMDB.</p></div>
      <div class="panel"><h3>📚 Minhas listas</h3><div id="lsbox"></div></div>
    </div>
  </div>`;

  const bw = $("#b-w"), bl = $("#b-l"), bh = $("#b-h"), stxt = $("#stxt");
  const paint = () => {
    e = lib[key] || {};
    bw.className = "btn" + (e.watched ? " on-w" : ""); bw.textContent = e.watched ? "✓ " + (isTv ? "Já vi" : "Já assisti") : "👁 Marcar como " + (isTv ? "visto" : "assistido");
    bl.className = "btn" + (e.watchlist ? " on-l" : ""); bl.textContent = e.watchlist ? "★ Na minha lista" : "☆ Quero assistir";
    bh.className = "btn" + (e.liked ? " on-h" : ""); bh.textContent = e.liked ? "♥ Curti" : "♡ Curti";
    stxt.textContent = e.rating ? `${e.rating} de 5` : "Dê sua nota";
    $("#wdate").disabled = !e.watched; $("#wdate").value = e.watched_on || "";
    const tg = e.tags || [];
    $("#tags").innerHTML = tg.map((t) => `<span class="tag-chip">${esc(t)}<button data-t="${esc(t)}" title="Remover">×</button></span>`).join("") || '<span class="sub" style="margin:0;font-size:13px">Nenhuma tag ainda.</span>';
    $("#tlist").innerHTML = allTags().filter((t) => !tg.includes(t)).map((t) => `<option value="${esc(t)}">`).join("");
  };
  const act = (patch, msg) => async () => { try { await save(type, id, { ...base, ...patch(e) }); paint(); toast(msg(lib[key] || {})); } catch (x) { toast(x.message, 1); } };
  bw.onclick = act((e) => ({ watched: !e.watched }), (n) => (n.watched ? "Marcado como visto ✓" : "Removido dos vistos"));
  bl.onclick = act((e) => ({ watchlist: !e.watchlist }), (n) => (n.watchlist ? "Adicionado à sua lista ★" : "Removido da lista"));
  bh.onclick = act((e) => ({ liked: !e.liked }), (n) => (n.liked ? "Curtido ♥" : "Curtida removida"));
  $("#stars").appendChild(starsWidget(e.rating, async (v) => {
    try { await save(type, id, { ...base, rating: v, ...(v && !lib[key]?.watched ? { watched: true } : {}) }); paint(); toast(v ? "Nota salva ★" : "Nota removida"); } catch (x) { toast(x.message, 1); }
  }));
  $("#rev").value = e.review || "";
  $("#b-save").onclick = async () => {
    try { await save(type, id, { ...base, review: $("#rev").value.trim(), ...(lib[key]?.watched ? {} : { watched: true }) }); paint(); toast("Resenha salva 📝"); } catch (x) { toast(x.message, 1); }
  };
  $("#wdate").onchange = async (ev) => { await save(type, id, { ...base, watched_on: ev.target.value }); toast("Data salva"); };
  $("#tin").onkeydown = async (ev) => {
    if (ev.key !== "Enter") return;
    const t = ev.target.value.trim().toLowerCase().slice(0, 30); if (!t) return;
    ev.target.value = "";
    await save(type, id, { ...base, tags_add: t }); paint();
  };
  $("#tags").onclick = async (ev) => {
    const t = ev.target.dataset.t; if (!t) return;
    await save(type, id, { ...base, tags_remove: t }); paint();
  };
  paint();

  // listas próprias
  const lsbox = $("#lsbox");
  async function drawLists() {
    const L = (await api("/api/lists")).mine;
    lsbox.innerHTML = L.length ? L.map((l) => {
      const has = l.items.some((i) => i.key === key);
      return `<div class="lrow"><a href="#/lista/${l.id}">${esc(l.name)} <span class="sub" style="margin:0">(${l.items.length})</span></a>
        <button class="btn sm ${has ? "on-w" : ""}" data-l="${l.id}" data-has="${has ? 1 : 0}">${has ? "✓ Na lista" : "+ Adicionar"}</button></div>`;
    }).join("") + `<a class="sub" href="#/listas" style="font-size:13px">Gerenciar listas →</a>` : `<p class="sub">Você ainda não criou listas.</p><a class="btn sm primary" href="#/listas">Criar uma lista</a>`;
  }
  lsbox.onclick = async (ev) => {
    const b = ev.target.closest("button[data-l]"); if (!b) return;
    const item = { key, type, id: m.id, title: m.title, year: m.year, poster: m.poster_small };
    await api("/api/lists/" + b.dataset.l, b.dataset.has === "1" ? { remove: key } : { add: item });
    toast(b.dataset.has === "1" ? "Removido da lista" : "Adicionado à lista 📚"); drawLists();
  };
  drawLists().catch(() => {});
}

/* ---------- PESSOA ---------- */
async function pagePerson(id) {
  loading();
  const p = await api("/api/person/" + id);
  const roles = ["Todos", ...["Ator", "Direção", "Roteiro", "Produção"].filter((r) => p.films.some((f) => f.roles.includes(r)))];
  const defRole = p.dept === "Directing" && roles.includes("Direção") ? "Direção" : roles.includes("Ator") ? "Ator" : "Todos";
  const seen = p.films.filter((f) => lib[f.key]?.watched || f.watched).length;
  const fmtD = (d) => (d ? d.split("-").reverse().join("/") : "");
  const deptPt = { Acting: "Atuação", Directing: "Direção", Writing: "Roteiro", Production: "Produção" }[p.dept] || p.dept;
  view.innerHTML = `
  <div class="phead">
    <div class="pic" style="${p.photo ? `background-image:url('${esc(p.photo)}')` : ""}">${p.photo ? "" : "👤"}</div>
    <div style="flex:1">
      <h1>${esc(p.name)}</h1>
      <p class="sub">${[deptPt, p.birthday && "Nascimento: " + fmtD(p.birthday), p.deathday && "Falecimento: " + fmtD(p.deathday), p.place].filter(Boolean).map(esc).join(" · ")}</p>
      <p class="bio" id="bio">${esc(p.bio)}</p>
      <button class="btn sm" id="more" style="margin:6px 0 14px">Ler mais</button>
      <div><span class="stat">🎬 ${p.films.length} títulos</span><span class="stat">✓ Você viu ${seen}</span></div>
    </div>
  </div>
  <h2>Filmografia</h2>
  <div class="sel-bar"><div class="tabs" id="tabs" style="margin:0"></div>
    <select id="kind"><option value="all">Filmes e séries</option><option value="movie">Só filmes</option><option value="tv">Só séries</option></select>
    <select id="ord"><option value="year">Mais recentes</option><option value="old">Mais antigos</option><option value="pop">Mais populares</option></select>
    <select id="flt"><option value="all">Todos</option><option value="seen">Só os que vi</option><option value="unseen">Que ainda não vi</option></select></div>
  <div class="grid" id="films"></div>`;
  let role = defRole;
  const draw = () => {
    $("#tabs").innerHTML = roles.map((r) => `<button class="tab ${r === role ? "on" : ""}" data-r="${r}">${r}</button>`).join("");
    let fl = p.films.filter((f) => role === "Todos" || f.roles.includes(role));
    const k = $("#kind").value; if (k !== "all") fl = fl.filter((f) => f.type === k);
    const flt = $("#flt").value;
    if (flt === "seen") fl = fl.filter((f) => lib[f.key]?.watched); else if (flt === "unseen") fl = fl.filter((f) => !lib[f.key]?.watched);
    const o = $("#ord").value;
    fl.sort((a, b) => o === "pop" ? b.pop - a.pop : o === "old" ? (a.year || "9999").localeCompare(b.year || "9999") : (b.year || "0000").localeCompare(a.year || "0000"));
    $("#films").innerHTML = fl.map((f) => posterCard(f, { sub: f.character && role !== "Direção" ? f.character : "" })).join("") || '<p class="sub">Nada neste filtro.</p>';
  };
  $("#tabs").onclick = (ev) => { if (ev.target.dataset.r) { role = ev.target.dataset.r; draw(); } };
  $("#ord").onchange = $("#flt").onchange = $("#kind").onchange = draw;
  $("#more").onclick = () => { const b = $("#bio"); b.classList.toggle("open"); $("#more").textContent = b.classList.contains("open") ? "Ler menos" : "Ler mais"; };
  if (p.bio.length < 400) $("#more").classList.add("hidden");
  draw();
}

/* ---------- ASSISTIDOS / QUERO ASSISTIR ---------- */
const listF = { type: "all", tag: "" };
function pageList(kind) {
  const isW = kind === "assistidos";
  const base = Object.values(lib).filter((e) => (isW ? e.watched : e.watchlist));
  const tags = [...new Set(base.flatMap((e) => e.tags || []))].sort((a, b) => a.localeCompare(b, "pt"));
  if (listF.tag && !tags.includes(listF.tag)) listF.tag = "";
  const head = `<div class="pagehead"><h1>${isW ? "Já vi ✓" : "Quero assistir ★"}</h1><p class="sub" id="cnt"></p></div>`;
  if (!base.length) {
    view.innerHTML = head + `<div class="empty"><div class="big">${isW ? "🍿" : "✨"}</div><p>${isW ? "Você ainda não marcou nada como visto." : "Sua lista está vazia."}</p><a class="btn primary" href="#/">Explorar</a></div>`;
    $("#cnt").textContent = "0 títulos"; return;
  }
  view.innerHTML = head + `<div class="sel-bar">
    <div class="seg" id="lt">${[["all", "Tudo"], ["movie", "Filmes"], ["tv", "Séries"]].map(([v, l]) => `<button data-v="${v}" class="${listF.type === v ? "on" : ""}">${l}</button>`).join("")}</div>
    <select id="ord">${isW ? '<option value="w">Vistos recentemente</option><option value="r">Melhor nota</option><option value="t">Título (A–Z)</option><option value="y">Ano</option>' : '<option value="a">Adicionados recentemente</option><option value="t">Título (A–Z)</option><option value="y">Ano</option>'}</select>
    <select id="tg"><option value="">Todas as tags</option>${tags.map((t) => `<option ${t === listF.tag ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div><div class="grid" id="g"></div>`;
  const draw = () => {
    let items = base.filter((e) => (listF.type === "all" || e.type === listF.type) && (!listF.tag || (e.tags || []).includes(listF.tag)));
    const o = $("#ord").value;
    items.sort((a, b) => o === "t" ? a.title.localeCompare(b.title, "pt") : o === "y" ? (b.year || "").localeCompare(a.year || "") : o === "r" ? (b.rating || 0) - (a.rating || 0) : o === "w" ? (b.watched_on || "").localeCompare(a.watched_on || "") || b.updated - a.updated : b.added_on - a.added_on);
    $("#cnt").textContent = `${items.length} ${items.length === 1 ? "título" : "títulos"}`;
    $("#g").innerHTML = items.map((m) => posterCard(m, { rating: isW })).join("") || '<p class="sub">Nada neste filtro.</p>';
  };
  $("#lt").onclick = (ev) => { const v = ev.target.dataset.v; if (v) { listF.type = v; $("#lt").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); draw(); } };
  $("#tg").onchange = (ev) => { listF.tag = ev.target.value; draw(); };
  $("#ord").onchange = draw; draw();
}

/* ---------- LISTAS ---------- */
const mosaic = (items) => `<div class="mosaic">${[0, 1, 2, 3].map((i) => `<div style="${items[i]?.poster ? `background-image:url('${esc(items[i].poster)}')` : ""}"></div>`).join("")}</div>`;
async function pageLists() {
  const L = await api("/api/lists");
  view.innerHTML = `<div class="pagehead"><h1>Listas 📚</h1><p class="sub">Crie coleções do seu jeito e acompanhe listas públicas do TMDB.</p></div>
  <div class="panel" style="margin-top:0"><h3>Nova lista</h3><div class="rowx"><input type="text" id="ln" placeholder="Nome (ex.: Terror dos anos 80)" style="flex:1;min-width:220px"><button class="btn primary" id="lc">Criar lista</button></div></div>
  <h2>Minhas listas</h2>
  <div class="cards">${L.mine.map((l) => `<a class="lcard" href="#/lista/${l.id}">${mosaic(l.items)}<b>${esc(l.name)}</b><small>${l.items.length} ${l.items.length === 1 ? "título" : "títulos"}</small></a>`).join("") || '<p class="sub">Nenhuma lista ainda. Crie uma acima e adicione títulos pela página de cada filme ou série.</p>'}</div>
  <h2>Listas do TMDB</h2>
  <div class="panel" style="margin-top:0"><p class="sub" style="margin-bottom:12px">Procure listas feitas por outras pessoas no site themoviedb.org (menu “Listas”) e cole o link aqui para ver dentro do app. Listas do Letterboxd não podem ser lidas diretamente.</p>
    <div class="rowx"><input type="text" id="lu" placeholder="Cole o link, ex.: https://www.themoviedb.org/list/8136" style="flex:1;min-width:260px"><button class="btn primary" id="la">Adicionar</button></div></div>
  <div class="cards" style="margin-top:18px">${L.tmdb.map((r) => `<a class="lcard" href="#/tlista/${r.id}"><div class="mosaic"><div style="display:grid;place-items:center;font-size:30px;grid-column:span 2;grid-row:span 2;background:var(--lav-l)">🌐</div></div><b>${esc(r.name)}</b><small>Lista do TMDB</small></a>`).join("")}</div>`;
  $("#lc").onclick = async () => {
    const n = $("#ln").value.trim(); if (!n) return toast("Dê um nome à lista", 1);
    const l = await api("/api/lists", { name: n }); location.hash = "#/lista/" + l.id;
  };
  $("#ln").onkeydown = (e) => { if (e.key === "Enter") $("#lc").click(); };
  $("#la").onclick = async () => {
    const u = $("#lu").value.trim(); if (!u) return;
    $("#la").textContent = "Buscando…";
    try { const r = await api("/api/tmdblists", { url: u }); toast("Lista adicionada ✓"); location.hash = "#/tlista/" + r.id; } catch (x) { toast(x.message, 1); $("#la").textContent = "Adicionar"; }
  };
}
async function pageMyList(id) {
  loading();
  const l = await api("/api/lists/" + id);
  view.innerHTML = `<a class="sub" href="#/listas">← Todas as listas</a>
  <div class="rowx" style="margin:8px 0 6px"><input type="text" id="ln" value="${esc(l.name)}" style="font-size:26px;font-weight:800;flex:1;min-width:260px"><button class="btn sm" id="del">Excluir lista</button></div>
  <textarea id="ld" placeholder="Descrição (opcional)" style="min-height:70px;margin-bottom:6px">${esc(l.desc)}</textarea>
  <p class="sub">${l.items.length} títulos · adicione novos pela página de qualquer filme ou série.</p>
  <div class="grid" id="g">${l.items.map((m) => posterCard(m, { remove: true })).join("")}</div>
  ${l.items.length ? "" : '<div class="empty"><div class="big">📭</div><p>Lista vazia. Abra um filme ou série e use “Minhas listas”.</p><a class="btn primary" href="#/">Explorar</a></div>'}`;
  $("#ln").onchange = async (e) => { await api("/api/lists/" + id, { name: e.target.value }); toast("Nome salvo"); };
  $("#ld").onchange = async (e) => { await api("/api/lists/" + id, { desc: e.target.value }); toast("Descrição salva"); };
  $("#del").onclick = async (e) => {
    if (!e.target.dataset.s) { e.target.dataset.s = 1; e.target.textContent = "Clique de novo para confirmar"; e.target.classList.add("on-h"); return; }
    await api(`/api/lists/${id}/delete`, {}); toast("Lista excluída"); location.hash = "#/listas";
  };
  $("#g").onclick = async (e) => {
    const b = e.target.closest("[data-rm]"); if (!b) return;
    await api("/api/lists/" + id, { remove: b.dataset.rm }); pageMyList(id);
  };
}
async function pageTmdbList(id) {
  loading();
  const [l, all] = await Promise.all([api("/api/tmdblist/" + id), api("/api/lists")]);
  const saved = all.tmdb.some((r) => r.id === +id);
  const seen = l.items.filter((m) => lib[keyOf(m.type, m.id)]?.watched).length;
  view.innerHTML = `<a class="sub" href="#/listas">← Todas as listas</a>
  <h1 style="margin-top:6px">${esc(l.name)}</h1>
  <p class="sub">${l.by ? "Por " + esc(l.by) + " · " : ""}${l.items.length} títulos · você viu ${seen}</p>
  ${l.description ? `<p style="max-width:760px;color:var(--muted)">${esc(l.description)}</p>` : ""}
  <div class="rowx" style="margin:10px 0 20px"><button class="btn primary" id="cp">Copiar para minhas listas</button>${saved ? '<button class="btn" id="rmv">Remover dos meus links</button>' : ""}</div>
  <div class="grid">${l.items.map((m) => posterCard(m)).join("")}</div>`;
  $("#cp").onclick = async () => { const n = await api(`/api/tmdblists/${id}/copy`, {}); toast("Copiada ✓"); location.hash = "#/lista/" + n.id; };
  if (saved) $("#rmv").onclick = async () => { await api(`/api/tmdblists/${id}/remove`, {}); toast("Removida"); location.hash = "#/listas"; };
}

/* ---------- PERFIL ---------- */
const BADGES = [
  ["🎬", "Primeiro take", "Assistiu seu 1º título", (s) => s.total >= 1],
  ["🍿", "Pipoca em dia", "10 títulos vistos", (s) => s.total >= 10],
  ["🎞️", "Cinéfilo", "50 títulos vistos", (s) => s.total >= 50],
  ["🏆", "Centenário", "100 títulos vistos", (s) => s.total >= 100],
  ["🌟", "Lenda das telas", "250 títulos vistos", (s) => s.total >= 250],
  ["⏱️", "100 horas", "100 horas assistidas", (s) => s.min >= 6000],
  ["🛋️", "Maratonista", "500 horas assistidas", (s) => s.min >= 30000],
  ["📺", "Seriemaníaco", "10 séries vistas", (s) => s.shows >= 10],
  ["✍️", "Crítico", "10 resenhas escritas", (s) => s.reviews >= 10],
  ["🎭", "Eclético", "8 gêneros diferentes", (s) => s.genres.length >= 8],
  ["⏳", "Viajante do tempo", "Filmes de 5 décadas", (s) => s.decades.length >= 5],
  ["💖", "Coração mole", "10 títulos curtidos", (s) => s.liked >= 10],
  ["🏷️", "Organizado", "Usa 5 tags diferentes", (s) => s.tagCount >= 5],
];
function computeStats() {
  const W = Object.values(lib).filter((e) => e.watched);
  const count = (arr) => { const m = new Map(); arr.forEach((x) => m.set(x, (m.get(x) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };
  const people = (f) => { const m = new Map(); W.forEach((e) => (e[f] || []).forEach((p) => { const o = m.get(p.id) || { ...p, n: 0 }; o.n++; m.set(p.id, o); })); return [...m.values()].sort((a, b) => b.n - a.n); };
  const rated = Object.values(lib).filter((e) => e.rating > 0);
  const yr = String(new Date().getFullYear());
  return {
    total: W.length, movies: W.filter((e) => e.type === "movie").length, shows: W.filter((e) => e.type === "tv").length,
    min: W.reduce((a, e) => a + (e.runtime || 0), 0), missing: W.filter((e) => e.runtime == null && !enrichTried.has(e.key)),
    reviews: Object.values(lib).filter((e) => e.review).length, liked: Object.values(lib).filter((e) => e.liked).length,
    avg: rated.length ? rated.reduce((a, e) => a + e.rating, 0) / rated.length : 0,
    genres: count(W.flatMap((e) => e.genres || [])), decades: count(W.map((e) => decadeOf(e.year)).filter(Boolean)).sort((a, b) => b[0] - a[0]),
    dist: Array.from({ length: 10 }, (_, i) => rated.filter((e) => e.rating === (i + 1) / 2).length),
    actors: people("cast"), directors: people("directors"),
    thisYear: W.filter((e) => (e.watched_on || "").startsWith(yr)).length, year: yr,
    tags: count(Object.values(lib).flatMap((e) => e.tags || [])), tagCount: allTags().length,
  };
}
const bars = (rows, fmt = (x) => x) => {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return rows.map(([l, n, href]) => `<div class="brow"><span class="bl">${href ? `<a href="${href}">${esc(fmt(l))}</a>` : esc(fmt(l))}</span><div class="bt"><i style="width:${(n / mx) * 100}%"></i></div><span class="bn">${n}</span></div>`).join("");
};
function resizePhoto(file, size = 320) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image(); im.onerror = rej;
      im.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = size;
        const s = Math.min(im.width, im.height);
        c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size);
        res(c.toDataURL("image/jpeg", 0.85));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
let enriching = false;
const enrichTried = new Set(); // cada título é tentado uma vez por sessão (evita loop se falhar)
async function enrichMissing() {
  if (enriching) return;
  const todo = Object.values(lib).filter((e) => e.watched && e.runtime == null && !enrichTried.has(e.key)).slice(0, 40);
  if (!todo.length) return;
  enriching = true;
  let ok = 0;
  for (const e of todo) {
    enrichTried.add(e.key);
    try {
      const m = await api(`/api/${e.type}/${e.id}`);
      await save(e.type, e.id, { runtime: m.runtime_total, genres: m.genres, cast: m.cast.slice(0, 6).map((c) => ({ id: c.id, name: c.name })), directors: m.directors.map((d) => ({ id: d.id, name: d.name })) });
      ok++;
    } catch { /* ignora: tenta de novo só na próxima sessão */ }
  }
  enriching = false;
  if (ok && location.hash === "#/perfil") pagePerfil(true);
}
async function pagePerfil(quiet) {
  if (!quiet) loading();
  const P = await api("/api/profile");
  const s = computeStats();
  const age = (() => { if (!P.birthdate) return ""; const b = new Date(P.birthdate), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a >= 0 && a < 130 ? a : ""; })();
  const goal = +P.goal || 0, pct = goal ? Math.min(100, Math.round((s.thisYear / goal) * 100)) : 0;
  const favs = (P.favorites || []).map((k) => lib[k]).filter(Boolean);
  const days = s.min / 1440;
  view.innerHTML = `
  ${s.missing.length ? `<p class="sub note">⏳ Atualizando a duração de ${s.missing.length} título(s) para calcular suas horas…</p>` : ""}
  <div class="bento">
    <div class="b c3 profile">
      <label class="avatar" title="Trocar foto" style="${P.photo ? `background-image:url('${P.photo}')` : ""}">${P.photo ? "" : "😎"}<span>Trocar foto</span><input type="file" id="ph" accept="image/*" class="hidden"></label>
      <div class="pinfo">
        <input type="text" id="pn" value="${esc(P.name || "")}" placeholder="Seu nome" class="pname">
        <div class="rowx" style="margin:8px 0"><label class="sub" style="margin:0">Nascimento</label><input type="date" id="pb" value="${esc(P.birthdate || "")}" style="width:auto">${age !== "" ? `<span class="stat" style="margin:0">${age} anos</span>` : ""}</div>
        <textarea id="pbio" placeholder="Fale um pouco sobre seu gosto para cinema…" style="min-height:70px">${esc(P.bio || "")}</textarea>
        <div class="rowx" style="margin-top:10px"><button class="btn primary sm" id="psave">Salvar perfil</button></div>
      </div>
    </div>
    <div class="b tile accent"><b>${s.min ? fmtH(s.min) : "0h"}</b><span>Horas assistidas${days >= 1 ? `<br>≈ ${days.toFixed(1).replace(".", ",")} dias` : ""}</span></div>

    <div class="b tile"><b>${s.movies}</b><span>Filmes vistos</span></div>
    <div class="b tile"><b>${s.shows}</b><span>Séries vistas</span></div>
    <div class="b tile"><b>${s.avg ? s.avg.toFixed(1).replace(".", ",") : "–"}</b><span>Nota média ★</span></div>
    <div class="b tile"><b>${s.reviews}</b><span>Resenhas · <em>${s.liked} ♥</em></span></div>

    <div class="b c2"><h3>Meus 4 favoritos</h3>
      <div class="favs">${[0, 1, 2, 3].map((i) => { const f = (P.favorites || [])[i] && lib[P.favorites[i]];
        return f ? `<div class="fav"><a href="${hrefOf(f.type, f.id)}" class="img" style="background-image:url('${esc(f.poster || "")}')"></a><button class="rm" data-fr="${i}" title="Remover">×</button><div class="t">${esc(f.title)}</div></div>`
          : `<button class="fav empty-fav" data-fa="${i}"><span>+</span>Escolher</button>`; }).join("")}</div></div>
    <div class="b"><h3>🎯 Meta de ${s.year}</h3>
      <div class="rowx" style="justify-content:center"><input type="text" id="goal" value="${goal || ""}" placeholder="0" style="width:84px;text-align:center" inputmode="numeric"><span class="sub" style="margin:0">títulos</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <p class="sub" style="margin:0;text-align:center;font-size:14px">${goal ? `${s.thisYear} de ${goal} (${pct}%)${s.thisYear >= goal ? " 🎉" : ""}` : `Você viu ${s.thisYear} este ano.`}</p></div>
    <div class="b"><h3>⭐ Suas notas</h3>
      <div class="hist">${s.dist.map((n, i) => `<div class="hcol"><i style="height:${(n / Math.max(1, ...s.dist)) * 100}%"></i><span>${(i + 1) / 2}</span></div>`).join("")}</div></div>

    <div class="b c2"><h3>🎭 Gêneros favoritos</h3>${s.genres.length ? bars(s.genres.slice(0, 8)) : '<p class="sub" style="text-align:center">Marque títulos como vistos para ver seus gêneros.</p>'}</div>
    <div class="b c2"><h3>⏳ Por década</h3>${s.decades.length ? bars(s.decades.map(([d, n]) => [d, n]), (d) => d + "s") : '<p class="sub" style="text-align:center">Sem dados ainda.</p>'}</div>

    <div class="b c2"><h3>🌟 Atores mais vistos</h3>${s.actors.length ? bars(s.actors.slice(0, 8).map((p) => [p.name, p.n, "#/pessoa/" + p.id])) : '<p class="sub" style="text-align:center">Sem dados ainda.</p>'}</div>
    <div class="b c2"><h3>🎬 Direção mais vista</h3>${s.directors.length ? bars(s.directors.slice(0, 8).map((p) => [p.name, p.n, "#/pessoa/" + p.id])) : '<p class="sub" style="text-align:center">Sem dados ainda.</p>'}</div>

    <div class="b c4"><h3>🏷️ Minhas tags</h3><div class="tags">${s.tags.map(([t, n]) => `<a class="tag-chip big" href="#/assistidos" data-tag="${esc(t)}">${esc(t)} <small>${n}</small></a>`).join("") || '<p class="sub" style="margin:0">Crie tags na página de qualquer título (ex.: “chorei”, “rever”).</p>'}</div></div>

    <div class="b c4"><h3>🏆 Conquistas · ${BADGES.filter((b) => b[3](s)).length}/${BADGES.length}</h3>
      <div class="badges">${BADGES.map(([ico, n, d, t]) => `<div class="bdg ${t(s) ? "got" : ""}"><span>${ico}</span><b>${n}</b><small>${d}</small></div>`).join("")}</div></div>
  </div>`;

  const patch = async (p) => { await api("/api/profile", p); refreshProfile(); };
  $("#psave").onclick = async () => { await patch({ name: $("#pn").value.trim(), birthdate: $("#pb").value, bio: $("#pbio").value.trim() }); toast("Perfil salvo ✓"); pagePerfil(true); };
  $("#ph").onchange = async (e) => { try { await patch({ photo: await resizePhoto(e.target.files[0]) }); toast("Foto atualizada ✓"); pagePerfil(true); } catch { toast("Não consegui ler essa imagem", 1); } };
  $("#goal").onchange = async (e) => { await patch({ goal: parseInt(e.target.value) || 0 }); pagePerfil(true); };
  view.querySelectorAll("[data-tag]").forEach((a) => (a.onclick = () => { listF.tag = a.dataset.tag; listF.type = "all"; }));
  view.querySelector(".favs").onclick = async (e) => {
    const r = e.target.closest("[data-fr]"), a = e.target.closest("[data-fa]");
    const cur = [...(P.favorites || [])];
    if (r) { cur.splice(+r.dataset.fr, 1); await patch({ favorites: cur }); pagePerfil(true); }
    if (a) openPicker(cur, async (k) => { cur[+a.dataset.fa] = k; await patch({ favorites: cur.filter(Boolean).slice(0, 4) }); pagePerfil(true); });
  };
  if (s.missing.length) enrichMissing();
}
function openPicker(cur, onPick) {
  const items = Object.values(lib).filter((e) => e.watched && !cur.includes(e.key));
  const ov = document.createElement("div"); ov.className = "modal";
  ov.innerHTML = `<div class="mbox"><div class="rowx" style="margin-bottom:12px"><h3 style="margin:0;flex:1">Escolha um favorito</h3><button class="btn sm" id="mx">Fechar</button></div>
    <input type="text" id="mq" placeholder="Filtrar por nome…" style="margin-bottom:14px"><div class="grid" id="mg" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:14px"></div></div>`;
  document.body.appendChild(ov);
  const draw = () => {
    const q = $("#mq", ov).value.trim().toLowerCase();
    const list = items.filter((e) => e.title.toLowerCase().includes(q));
    $("#mg", ov).innerHTML = list.map((e) => `<button class="pick" data-k="${esc(e.key)}"><div class="img" style="aspect-ratio:2/3;border-radius:14px;background:var(--glass) center/cover;${e.poster ? `background-image:url('${esc(e.poster)}')` : ""}"></div><div class="t" style="font-size:12px;margin-top:6px;font-weight:700">${esc(e.title)}</div></button>`).join("") || '<p class="sub">Você ainda não marcou nada como visto.</p>';
  };
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov || e.target.id === "mx") close(); const b = e.target.closest("[data-k]"); if (b) { close(); onPick(b.dataset.k); } };
  $("#mq", ov).oninput = draw; draw();
}

/* ---------- AJUSTES ---------- */
async function pageSettings() {
  const s = await api("/api/settings");
  const reviews = Object.values(lib).filter((e) => e.review).sort((a, b) => b.updated - a.updated);
  view.innerHTML = `<div class="pagehead"><h1>Ajustes ⚙️</h1><p class="sub">Deixe o app com a sua cara.</p></div>
  <div class="bento">
    <div class="b c2"><h3>🎨 Aparência</h3>
      <div class="opt"><div><b>Transparência</b><small>Cartões de vidro com desfoque e brilho de fundo. Desligue para um visual sólido e mais leve.</small></div>
        <label class="switch"><input type="checkbox" id="opt-glass" ${s.transparency !== false ? "checked" : ""}><span></span></label></div>
      <div class="opt"><div><b>Tema claro</b><small>Fundo cinza claro em vez de grafite.</small></div>
        <label class="switch"><input type="checkbox" id="opt-light" ${s.theme === "light" ? "checked" : ""}><span></span></label></div>
    </div>
    <div class="b c2"><h3>💾 Backup</h3><p class="sub" style="text-align:center">Seus dados (biblioteca, listas e perfil) ficam só neste computador. Exporte de vez em quando para guardar uma cópia.</p>
      <div class="rowx" style="justify-content:center"><a class="btn primary" href="/api/export" download="meucinema-backup.json">Exportar backup</a>
      <button class="btn" id="imp">Importar backup</button><input type="file" id="file" accept=".json" class="hidden"></div>
      <p class="sub" style="font-size:13px;margin:12px 0 0;text-align:center">Pasta dos dados: ${esc(s.folder)}</p></div>
    <div class="b c4"><h3>🔑 Chave do TMDB</h3><p class="sub" style="text-align:center">${s.configured ? "Chave configurada ✓. Cole outra abaixo se quiser trocar." : "Cole sua chave do TMDB (themoviedb.org → Configurações → API)."}
      Aceita o “Token de Leitura da API” ou a “Chave da API”.</p>
      <div class="rowx"><input type="password" id="tok" placeholder="Cole a chave aqui" style="flex:1;min-width:240px"><button class="btn primary" id="sv">Salvar</button></div></div>
    <div class="b c4"><h3>📝 Minhas resenhas (${reviews.length})</h3>
      ${reviews.map((r) => `<div class="rev"><a href="${hrefOf(r.type, r.id)}" style="flex:none;width:56px"><div class="img" style="aspect-ratio:2/3;border-radius:10px;background:var(--fill) center/cover;${r.poster ? `background-image:url('${esc(r.poster)}')` : ""}"></div></a>
        <div><a href="${hrefOf(r.type, r.id)}"><b>${esc(r.title)}</b></a> <span class="sub">${esc(r.year)}</span> <span class="stars-mini">${starsStatic(r.rating || 0)}</span><div style="white-space:pre-line">${esc(r.review)}</div></div></div>`).join("") || '<p class="sub" style="text-align:center">Suas resenhas aparecem aqui.</p>'}
    </div>
  </div>`;
  const setAppearance = async (ev) => {
    const a = { transparency: $("#opt-glass").checked, theme: $("#opt-light").checked ? "light" : "dark" };
    applyAppearance(a); await api("/api/settings", a);
    toast(ev.target.id === "opt-glass" ? (a.transparency ? "Transparência ligada" : "Transparência desligada") : (a.theme === "light" ? "Tema claro ativado" : "Tema escuro ativado"));
  };
  $("#opt-glass").onchange = $("#opt-light").onchange = setAppearance;
  $("#imp").onclick = () => $("#file").click();
  $("#file").onchange = async (ev) => {
    try { const data = JSON.parse(await ev.target.files[0].text()); const r = await api("/api/import", data); await loadLib(); toast(`${r.imported} títulos importados`); pageSettings(); } catch (x) { toast(x.message || "Arquivo inválido", 1); }
  };
  $("#sv").onclick = async () => { const t = $("#tok").value.trim(); if (!t) return; await api("/api/settings", { token: t }); $("#tok").value = ""; toast("Chave salva ✓"); };
}

/* ---------- roteador ---------- */
let prevRoute = null;
async function route() {
  window.__obs?.disconnect();
  if (prevRoute === "") home.scroll = window.scrollY; // guarda onde parou na lista de filmes
  const h = location.hash.replace(/^#\/?/, "");
  const [a, b] = h.split("/");
  prevRoute = a || "";
  document.querySelectorAll("nav a").forEach((n) => n.classList.toggle("on", n.dataset.nav === ({ filme: "home", serie: "home", lista: "listas", tlista: "listas" }[a] || a || "home")));
  hideDrop(); if (a) window.scrollTo(0, 0);
  try {
    if (!a) await pageHome();
    else if (a === "filme") await pageTitle("movie", +b);
    else if (a === "serie") await pageTitle("tv", +b);
    else if (a === "pessoa") await pagePerson(+b);
    else if (a === "busca") await pageSearch(decodeURIComponent(b || ""));
    else if (a === "assistidos" || a === "quero") pageList(a);
    else if (a === "listas") await pageLists();
    else if (a === "lista") await pageMyList(b);
    else if (a === "tlista") await pageTmdbList(+b);
    else if (a === "perfil") await pagePerfil();
    else if (a === "ajustes") await pageSettings();
    else await pageHome();
  } catch (e) { errorBox(e); }
}

/* ---------- busca ao vivo ---------- */
const q = $("#q"), drop = $("#drop");
let tmr, seq = 0;
function hideDrop() { drop.classList.add("hidden"); }
q.addEventListener("input", () => {
  clearTimeout(tmr);
  const v = q.value.trim();
  if (v.length < 2) return hideDrop();
  tmr = setTimeout(async () => {
    const my = ++seq;
    try {
      const d = await api("/api/search?q=" + encodeURIComponent(v));
      if (my !== seq) return;
      const mv = d.movies.slice(0, 6), pe = d.people.slice(0, 4);
      drop.innerHTML = (mv.length ? "<h6>Filmes e séries</h6>" + mv.map((m) => `<a href="${hrefOf(m.type, m.id)}">${m.poster ? `<img src="${esc(m.poster)}" alt="">` : '<div class="ph"></div>'}<div><b>${esc(m.title)}</b><br><small>${m.type === "tv" ? "Série · " : ""}${esc(m.year)}</small></div></a>`).join("") : "") +
        (pe.length ? "<h6>Pessoas</h6>" + pe.map((p) => `<a href="#/pessoa/${p.id}">${p.photo ? `<img class="round" src="${esc(p.photo)}" alt="">` : '<div class="ph round"></div>'}<div><b>${esc(p.name)}</b><br><small>${esc(p.known_for || p.dept)}</small></div></a>`).join("") : "") +
        (mv.length || pe.length ? `<a class="all" href="#/busca/${encodeURIComponent(v)}">Ver todos os resultados</a>` : "<p class='sub' style='padding:10px'>Nada encontrado.</p>");
      drop.classList.remove("hidden");
    } catch (e) { drop.innerHTML = `<p class="sub" style="padding:10px">${esc(e.message)}</p>`; drop.classList.remove("hidden"); }
  }, 280);
});
q.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && q.value.trim()) { location.hash = "#/busca/" + encodeURIComponent(q.value.trim()); q.blur(); }
  if (e.key === "Escape") hideDrop();
});
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) hideDrop(); });
drop.addEventListener("click", () => { setTimeout(() => { q.value = ""; }, 50); });

document.querySelectorAll('.logo, nav a[data-nav="home"]').forEach((a) => a.addEventListener("click", () => {
  if (!location.hash || location.hash === "#/") { home.scroll = 0; window.scrollTo({ top: 0, behavior: "smooth" }); }
}));
window.addEventListener("hashchange", route);
Promise.all([loadLib(), loadAppearance()]).then(route).catch(errorBox);
refreshProfile();
