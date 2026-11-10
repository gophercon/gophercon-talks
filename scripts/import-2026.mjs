import { readFile, writeFile } from "node:fs/promises";

const EVENT_ID = 802722;
const ORIGIN = "https://www.gophercon.com";
const DIRECTORY_URL = `${ORIGIN}/page/5510698/speakers`;

const decodeHtml = (value = "") => value
  .replace(/&nbsp;/g, " ")
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

const cleanText = (value = "") => decodeHtml(value)
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const fetchText = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
};

const fetchJson = async (url, options) => JSON.parse(await fetchText(url, options));

function parseDirectory(html) {
  const blocks = html.split('<div class="col-sm-3 col-xs-12 entity-photo-holder">').slice(1);
  const entries = blocks.map((block) => {
    const id = block.match(/href="\/agenda\/speakers\/(\d+)/)?.[1];
    if (!id) return null;
    const links = [...block.matchAll(/class="speaker-social-icon" href="([^"]+)/g)].map((match) => decodeHtml(match[1]));
    return {
      id: Number(id),
      name: cleanText(block.match(/<div class="atom-fullname">\s*<strong>(.*?)<\/strong>/s)?.[1]),
      role: cleanText(block.match(/<div class="atom-text1">(.*?)<\/div>/s)?.[1]),
      company: cleanText(block.match(/<div class="atom-text2">(.*?)<\/div>/s)?.[1]),
      headshot: decodeHtml(block.match(/<object[^>]+data="([^"]+)/s)?.[1] || ""),
      links,
    };
  }).filter(Boolean);

  if (entries.length !== 47) throw new Error(`Expected 47 directory speakers, found ${entries.length}`);
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function sessionFormat(title) {
  if (/lightning talks/i.test(title)) return "Lightning talks";
  if (/workshop/i.test(title)) return "Workshop";
  if (/meetup/i.test(title)) return "Meetup";
  if (/challenge series|community day|contributors' summit/i.test(title)) return "Community session";
  if (/panel|future$/i.test(title)) return "Panel";
  if (/registration|coffee|break|lunch|exhibition|hallway|shop|lounge|attendee services|welcome/i.test(title)) return "Conference";
  return "Talk";
}

const CONTENT_FORMATS = new Set(["Talk", "Workshop", "Lightning talks", "Panel"]);

function sessionLevel(description, format) {
  const level = description.match(/(?:Talk\/Attendee )?Level:\s*([^\n]+)/i)?.[1]?.trim();
  if (level) return level;
  return ["Talk", "Panel", "Lightning talks", "Workshop"].includes(format) ? "All attendees" : "Open session";
}

function sessionDate(session) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const start = formatter.format(new Date(session.startTime));
  const end = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(session.endTime));
  return `${start}–${end}`;
}

function summary(description, title) {
  const text = cleanText(description)
    .replace(/^(?:Talk\/Attendee )?Level:\s*[^.]+[.]?\s*/i, "")
    .replace(/^Abstract:\s*/i, "");
  if (!text) return `${title} at GopherCon 2026.`;
  if (text.length <= 190) return text;
  return `${text.slice(0, 187).replace(/\s+\S*$/, "")}…`;
}

function lightningTalks(session, parent) {
  const blocks = session.description.trim().split(/\n{3,}/);
  const presenters = session.speakers.filter(({ role }) => role === "Speaker");
  if (blocks.length !== presenters.length) {
    throw new Error(`Lightning session ${session.id} has ${blocks.length} abstracts but ${presenters.length} presenters`);
  }

  return blocks.map((block, index) => {
    const heading = block.split(/\n\n/, 1)[0];
    const title = heading.match(/^(.*?)\s+\|\s+/)?.[1]?.trim();
    const abstract = block.match(/\n\nAbstract:\s*([\s\S]*?)\n\nTalk\/Attendee Level:/i)?.[1]?.trim();
    const level = block.match(/\n\nTalk\/Attendee Level:\s*([^\n]+)\s*$/i)?.[1]?.trim();
    if (!title || !abstract || !level) throw new Error(`Could not parse lightning talk ${index + 1} in session ${session.id}`);

    return {
      ...parent,
      id: `${parent.id}-talk-${index + 1}`,
      title,
      speakerIds: [`speaker-${presenters[index].speakerId}`],
      format: "Lightning talk",
      level,
      summary: summary(abstract, title),
      abstract,
      parentId: parent.id,
      childIds: undefined,
    };
  });
}

function speakerLinks(apiSpeaker, directorySpeaker) {
  const urls = [
    ...(directorySpeaker?.links || []),
    apiSpeaker.linkedinProfile,
    apiSpeaker.blog,
  ].filter(Boolean);
  return [...new Set(urls)].map((url) => ({
    label: /linkedin/i.test(url) ? "LinkedIn" : /twitter|x\.com/i.test(url) ? "X" : "Website",
    url,
  }));
}

const [directoryHtml, sessionPayload, apiSpeakers, agendaHtml] = await Promise.all([
  fetchText(DIRECTORY_URL),
  fetchJson(`${ORIGIN}/agenda/events/${EVENT_ID}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }),
  fetchJson(`${ORIGIN}/agenda/events/${EVENT_ID}/speakers`),
  fetchText(`${ORIGIN}/agenda`),
]);

const directory = parseDirectory(directoryHtml);
const stateMatch = agendaHtml.match(/window\.__INITIAL_STATE__ = (\{.*?\});\s*<\/script>/s);
if (!stateMatch) throw new Error("Agenda bootstrap state missing");
const state = JSON.parse(stateMatch[1]);
const locations = new Map(state.agendaReducer.settings.locations.map((location) => [location.id, location.name]));

if (sessionPayload.sessions.length !== 81) throw new Error(`Expected 81 sessions, found ${sessionPayload.sessions.length}`);
if (apiSpeakers.length < 47) throw new Error(`Expected at least 47 speaker records, found ${apiSpeakers.length}`);

const allSpeakers = apiSpeakers
  .map((apiSpeaker) => {
    const listed = directory.get(apiSpeaker.id);
    const name = listed?.name || `${apiSpeaker.firstname} ${apiSpeaker.lastname}`.trim();
    const role = listed?.role || apiSpeaker.title || "GopherCon participant";
    const company = listed?.company || "";
    return {
      id: `speaker-${apiSpeaker.id}`,
      name,
      role,
      company,
      headshot: listed?.headshot || apiSpeaker.thumbnailUrl,
      bio: apiSpeaker.bio?.trim() || `${name} participated in GopherCon 2026 as ${role}${company ? ` at ${company}` : ""}.`,
      links: speakerLinks(apiSpeaker, listed),
      listed: Boolean(listed),
      sourceUrl: `${ORIGIN}/agenda/speakers/${apiSpeaker.id}`,
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

const knownSpeakerIds = new Set(allSpeakers.map((speaker) => speaker.id));
const talks = sessionPayload.sessions
  .sort((left, right) => new Date(left.startTime) - new Date(right.startTime) || left.title.localeCompare(right.title))
  .filter((session) => CONTENT_FORMATS.has(sessionFormat(session.title)))
  .flatMap((session) => {
    const format = sessionFormat(session.title);
    const speakerIds = session.speakers.map(({ speakerId }) => `speaker-${speakerId}`);
    for (const speakerId of speakerIds) {
      if (!knownSpeakerIds.has(speakerId)) throw new Error(`Session ${session.id} references missing ${speakerId}`);
    }
    const sourceUrl = `${ORIGIN}/agenda/session/${session.id}`;
    const parent = {
      id: `session-${session.id}`,
      title: session.title,
      speakerIds,
      format,
      level: sessionLevel(session.description, format),
      date: sessionDate(session),
      startTime: session.startTime,
      endTime: session.endTime,
      location: locations.get(session.locationId) || "",
      summary: summary(session.description, session.title),
      abstract: session.description?.trim() || "Conference agenda session. No abstract was supplied.",
      youtube: "",
      slides: "",
      materials: [],
      sourceUrl,
    };
    if (format !== "Lightning talks") return [parent];
    const children = lightningTalks(session, parent);
    parent.childIds = children.map(({ id }) => id);
    return [parent, ...children];
  });

const referencedSpeakerIds = new Set(talks.flatMap((talk) => talk.speakerIds));
const speakers = allSpeakers.filter((speaker) => referencedSpeakerIds.has(speaker.id));

const yearContent = {
  year: 2026,
  location: "Seattle",
  theme: { name: "Emerald City", inspiration: "Wizard of Oz", tagline: "Still in motion." },
  speakers,
  talks,
};

const contentUrl = new URL("../data/content.json", import.meta.url);
let existing = {};
try {
  existing = JSON.parse(await readFile(contentUrl, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const years = existing.years || (existing.year ? {
  [existing.year]: {
    year: existing.year,
    location: existing.location || "",
    theme: existing.theme,
    speakers: existing.speakers,
    talks: existing.talks,
  },
} : {});
years[2026] = yearContent;
const content = {
  defaultYear: 2026,
  availableYears: Object.keys(years).map(Number).sort((left, right) => right - left),
  years,
};

await writeFile(contentUrl, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Imported ${talks.length} talks and workshops, ${speakers.length} participant records, ${speakers.filter(({ listed }) => listed).length} listed speakers.`);
