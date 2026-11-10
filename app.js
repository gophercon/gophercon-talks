const content = document.querySelector("#content");
const yearSelect = document.querySelector("#year-select");

let archive;
let catalog;
let activeYear = "2026";
let archiveSource = "";
let refreshInFlight = false;

const esc = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character]));

const initials = (name) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");

function speakerById(id) {
  return archive.speakers.find((speaker) => speaker.id === id);
}

function talkById(id) {
  return archive.talks.find((talk) => talk.id === id);
}

function listedSpeakers() {
  return archive.speakers.filter((speaker) => speaker.listed !== false);
}

function talkLinks(talk, compact = false) {
  const resources = [
    talk.youtube ? `<a class="resource video" href="${esc(talk.youtube)}">Watch video <span>↗</span></a>` : `<span class="resource pending">Video coming soon</span>`,
    talk.slides ? `<a class="resource" href="${esc(talk.slides)}">Download slides <span>↗</span></a>` : "",
    ...(talk.materials || []).map((material) => `<a class="resource" href="${esc(material.url)}">${esc(material.label)} <span>↗</span></a>`),
  ].filter(Boolean);
  return `<div class="resource-list ${compact ? "compact" : ""}">${resources.join("")}</div>`;
}

function speakerImage(speaker, eager = false) {
  return `<div class="portrait-wrap"><img class="portrait" src="${esc(speaker.headshot)}" alt="${esc(speaker.headshotAlt || `Headshot of ${speaker.name}`)}" ${eager ? "" : 'loading="lazy"'} onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span class="portrait-fallback" hidden>${esc(initials(speaker.name))}</span></div>`;
}

function talkCard(talk) {
  const speakers = talk.speakerIds.map(speakerById).filter(Boolean);
  return `<article class="talk-card">
    <div class="card-meta"><span>${esc(talk.format)}</span><span>${esc(talk.level)}</span></div>
    <h3><a href="#/talk/${esc(talk.id)}">${esc(talk.title)}</a></h3>
    <p class="byline">${speakers.map((speaker) => `<a href="#/speaker/${esc(speaker.id)}">${esc(speaker.name)}</a>`).join(", ")}</p>
    <p>${esc(talk.summary)}</p>
    <a class="text-link" href="#/talk/${esc(talk.id)}">View talk <span>→</span></a>
  </article>`;
}

function speakerCard(speaker) {
  const count = archive.talks.filter((talk) => talk.speakerIds.includes(speaker.id)).length;
  return `<article class="speaker-card">
    <a href="#/speaker/${esc(speaker.id)}">${speakerImage(speaker)}</a>
    <div><p class="eyebrow">${esc(speaker.company)}</p><h3><a href="#/speaker/${esc(speaker.id)}">${esc(speaker.name)}</a></h3><p>${esc(speaker.role)}</p><span>${count} ${count === 1 ? "talk" : "talks"}</span></div>
  </article>`;
}

function homePage() {
  const featured = archive.talks.filter((talk) => ["Talk", "Panel"].includes(talk.format)).slice(0, 3);
  return `<section class="hero oz-sky">
    <div class="hero-copy"><p class="eyebrow">GopherCon ${activeYear}${archive.location ? ` · ${esc(archive.location)}` : ""}</p><h1>Great Go ideas.<br><em>${esc(archive.theme?.tagline || "Still in motion.")}</em></h1><p>Explore talks, speakers, slides, code, and videos from GopherCon—preserved year by year.</p><div class="hero-actions"><a class="button primary" href="#/talks">Browse ${archive.talks.length} talks</a><a class="button secondary" href="#/speakers">Meet speakers</a></div></div>
    <div class="emerald-scene" aria-hidden="true"><div class="moon"></div><div class="city"><i></i><i></i><i></i><i></i><i></i></div><div class="road"></div><div class="gopher-orb"><span>Go</span></div></div>
  </section>
  <section class="intro"><p class="eyebrow">From stage to source</p><h2>One home for every idea shared at GopherCon.</h2><p>Find a session you missed, revisit a favorite, or follow a speaker across conference years.</p></section>
  <section class="section-shell"><div class="section-heading"><div><p class="eyebrow">Featured talks</p><h2>From GopherCon ${activeYear}</h2></div><a class="text-link" href="#/talks">See all talks <span>→</span></a></div><div class="talk-grid">${featured.map(talkCard).join("")}</div></section>
  <section class="yellow-path"><p class="eyebrow">Follow every thread</p><h2>Speakers, slides, source,<br>and videos—together.</h2><p>Talk pages grow as conference materials become available.</p><a class="button dark" href="#/speakers">Explore speakers</a></section>`;
}

function talksPage() {
  return `<section class="page-hero"><p class="eyebrow">GopherCon ${activeYear}</p><h1>Talks</h1><p>Deep dives, practical lessons, and ideas shaping Go.</p></section>
  <section class="section-shell listing"><div class="filters"><label>Search talks<input id="talk-search" type="search" placeholder="Title, speaker, or topic…" /></label><span id="result-count">${archive.talks.length} talks</span></div><div id="talk-grid" class="talk-grid">${archive.talks.map(talkCard).join("")}</div></section>`;
}

function speakersPage() {
  const speakers = listedSpeakers();
  return `<section class="page-hero speaker-hero"><p class="eyebrow">GopherCon ${activeYear}</p><h1>Speakers</h1><p>Meet people sharing what they have learned with Go community.</p></section>
  <section class="section-shell listing"><div class="filters"><label>Search speakers<input id="speaker-search" type="search" placeholder="Name, role, or company…" /></label><span id="result-count">${speakers.length} speakers</span></div><div id="speaker-grid" class="speaker-grid">${speakers.map(speakerCard).join("")}</div></section>`;
}

function speakerPage(id) {
  const speaker = speakerById(id);
  if (!speaker) return notFoundPage();
  const talks = archive.talks.filter((talk) => talk.speakerIds.includes(id));
  return `<section class="profile-hero"><div>${speakerImage(speaker, true)}</div><div><a class="back-link" href="#/speakers">← All speakers</a><p class="eyebrow">${esc(speaker.company)}</p><h1>${esc(speaker.name)}</h1><p class="role">${esc(speaker.role)}</p></div></section>
  <section class="profile-body"><div><p class="eyebrow">About</p><h2>Biography</h2><p class="bio">${esc(speaker.bio)}</p>${speaker.links?.length ? `<div class="profile-links">${speaker.links.map((link) => `<a href="${esc(link.url)}">${esc(link.label)} ↗</a>`).join("")}</div>` : ""}</div><aside><p class="eyebrow">At GopherCon ${activeYear}</p><strong>${talks.length}</strong><span>${talks.length === 1 ? "session" : "sessions"}</span></aside></section>
  <section class="section-shell related"><div class="section-heading"><div><p class="eyebrow">Sessions</p><h2>${esc(speaker.name)} at GopherCon</h2></div></div><div class="talk-grid">${talks.map(talkCard).join("")}</div></section>`;
}

function talkPage(id) {
  const talk = talkById(id);
  if (!talk) return notFoundPage();
  const speakers = talk.speakerIds.map(speakerById).filter(Boolean);
  const parent = talk.parentId ? talkById(talk.parentId) : null;
  const children = (talk.childIds || []).map(talkById).filter(Boolean);
  return `<div class="talk-theme"><section class="talk-hero"><a class="back-link" href="#/talks">← All talks</a><div class="card-meta"><span>${esc(talk.format)}</span><span>${esc(talk.level)}</span><span>${esc(talk.date)}</span></div><h1>${esc(talk.title)}</h1><p class="talk-byline">Presented by ${speakers.map((speaker) => `<a href="#/speaker/${esc(speaker.id)}">${esc(speaker.name)}</a>`).join(", ")}</p>${parent ? `<p class="talk-byline">Part of <a href="#/talk/${esc(parent.id)}">${esc(parent.title)}</a></p>` : ""}${talkLinks(talk)}</section></div>
  <section class="talk-body"><article><p class="eyebrow">About this talk</p><h2>Abstract</h2>${talk.abstract.split("\n\n").map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</article><aside><p class="eyebrow">Speakers</p>${speakers.map((speaker) => `<a class="mini-speaker" href="#/speaker/${esc(speaker.id)}">${speakerImage(speaker)}<span><strong>${esc(speaker.name)}</strong><small>${esc(speaker.role)} · ${esc(speaker.company)}</small></span></a>`).join("")}</aside></section>
  ${children.length ? `<section class="section-shell related"><div class="section-heading"><div><p class="eyebrow">Inside this session</p><h2>Individual lightning talks</h2></div></div><div class="talk-grid">${children.map(talkCard).join("")}</div></section>` : ""}`;
}

function notFoundPage() {
  return `<section class="not-found"><p class="eyebrow">404</p><h1>Trail went cold.</h1><p>This archive page does not exist.</p><a class="button primary" href="#/">Return home</a></section>`;
}

function wireSearch(type) {
  const input = document.querySelector(`#${type}-search`);
  if (!input) return;
  input.addEventListener("input", () => {
    const query = input.value.toLowerCase().trim();
    if (type === "talk") {
      const talks = archive.talks.filter((talk) => `${talk.title} ${talk.summary} ${talk.speakerIds.map((id) => speakerById(id)?.name).join(" ")}`.toLowerCase().includes(query));
      document.querySelector("#talk-grid").innerHTML = talks.map(talkCard).join("");
      document.querySelector("#result-count").textContent = `${talks.length} talks`;
    } else {
      const speakers = listedSpeakers().filter((speaker) => `${speaker.name} ${speaker.role} ${speaker.company}`.toLowerCase().includes(query));
      document.querySelector("#speaker-grid").innerHTML = speakers.map(speakerCard).join("");
      document.querySelector("#result-count").textContent = `${speakers.length} speakers`;
    }
  });
}

function render(resetScroll = true) {
  const [route = "", id] = location.hash.replace(/^#\//, "").split("/");
  document.body.dataset.route = route || "home";
  document.querySelectorAll("[data-nav]").forEach((link) => link.toggleAttribute("aria-current", link.dataset.nav === route));
  if (route === "talks") content.innerHTML = talksPage();
  else if (route === "speakers") content.innerHTML = speakersPage();
  else if (route === "talk") content.innerHTML = talkPage(id);
  else if (route === "speaker") content.innerHTML = speakerPage(id);
  else if (!route) content.innerHTML = homePage();
  else content.innerHTML = notFoundPage();
  wireSearch(route === "talks" ? "talk" : route === "speakers" ? "speaker" : "");
  if (resetScroll) window.scrollTo({ top: 0, behavior: "instant" });
  document.title = `${content.querySelector("h1")?.textContent || "GopherCon Archive"} · GopherCon Archive`;
}

async function fetchArchive() {
  const response = await fetch(`data/content.json?updated=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
  const source = await response.text();
  return { data: JSON.parse(source), source };
}

function applyCatalog(nextCatalog, requestedYear = activeYear) {
  catalog = nextCatalog.years ? nextCatalog : {
    defaultYear: nextCatalog.year,
    availableYears: nextCatalog.availableYears,
    years: { [nextCatalog.year]: nextCatalog },
  };
  activeYear = String(catalog.years[requestedYear] ? requestedYear : catalog.defaultYear);
  archive = catalog.years[activeYear];
  document.body.dataset.year = activeYear;
  yearSelect.innerHTML = catalog.availableYears.map((year) => `<option ${String(year) === activeYear ? "selected" : ""}>${year}</option>`).join("");
}

async function refreshArchive() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const next = await fetchArchive();
    if (next.source !== archiveSource) {
      archiveSource = next.source;
      applyCatalog(next.data, activeYear);
      render(false);
    }
  } catch (error) {
    console.error("Content refresh failed", error);
  } finally {
    refreshInFlight = false;
  }
}

async function start() {
  const initial = await fetchArchive();
  archiveSource = initial.source;
  applyCatalog(initial.data, initial.data.defaultYear || initial.data.year);
  yearSelect.addEventListener("change", () => {
    activeYear = yearSelect.value;
    archive = catalog.years[activeYear];
    document.body.dataset.year = activeYear;
    render();
  });
  render();
  window.addEventListener("hashchange", render);
  window.setInterval(refreshArchive, 2000);
}

start().catch((error) => {
  content.innerHTML = `<section class="not-found"><h1>Archive unavailable.</h1><p>${esc(error.message)}</p><p>Serve this directory over HTTP so JSON content can load.</p></section>`;
});
