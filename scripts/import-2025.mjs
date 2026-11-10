import { readFile, writeFile } from "node:fs/promises";

const PLAYLISTS = [
  "PL2ntRZ1ySWBeBA1lEnmD3vUedkRDvgnmw",
  "PL2ntRZ1ySWBdGwP3Oj91LaRr7I66DxGV_",
];
const CONTENT_URL = new URL("../data/content.json", import.meta.url);
const ABSTRACT_PLACEHOLDER = "Placeholder: Talk abstract for 2025 has not been added yet.";
const BIO_PLACEHOLDER = "Placeholder: Speaker biography for 2025 has not been added yet.";

const slug = (value) => value.toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

function findVideos(initialData) {
  const videos = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") videos.push(value.lockupViewModel);
    for (const child of Object.values(value)) visit(child);
  };
  visit(initialData);
  return videos;
}

async function playlistVideos(playlistId) {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const html = await response.text();
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) throw new Error(`YouTube initial data missing: ${playlistId}`);
  return findVideos(JSON.parse(match[1])).map((video) => ({
    videoId: video.contentId,
    rawTitle: video.metadata?.lockupMetadataViewModel?.title?.content || "",
    playlistId,
  }));
}

function parseTitle(rawTitle) {
  const value = rawTitle.replace(/^GopherCon 2025:\s*/, "").trim();
  if (/panel discussion$/i.test(value)) {
    return { title: value, speaker: "GopherCon 2025 Panelists", format: "Panel" };
  }
  const separator = value.lastIndexOf(" - ");
  if (separator < 1) throw new Error(`Speaker missing from title: ${rawTitle}`);
  return {
    title: value.slice(0, separator).trim(),
    speaker: value.slice(separator + 3).trim(),
    format: "Talk",
  };
}

const playlistResults = (await Promise.all(PLAYLISTS.map(playlistVideos))).flat();
const videos = [...new Map(playlistResults.map((video) => [video.videoId, video])).values()]
  .filter(({ rawTitle }) => rawTitle.startsWith("GopherCon 2025:"));

const speakerMap = new Map();
const talks = videos.map((video) => {
  const parsed = parseTitle(video.rawTitle);
  const speakerId = `speaker-2025-${slug(parsed.speaker)}`;
  if (!speakerMap.has(speakerId)) {
    speakerMap.set(speakerId, {
      id: speakerId,
      name: parsed.speaker,
      role: "GopherCon 2025 speaker",
      company: "",
      headshot: "assets/speaker-placeholder.svg",
      headshotAlt: `Speaker image placeholder for ${parsed.speaker}`,
      bio: BIO_PLACEHOLDER,
      links: [],
      listed: true,
      sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
    });
  }
  return {
    id: `youtube-${video.videoId}`,
    title: parsed.title,
    speakerIds: [speakerId],
    format: parsed.format,
    level: "Level not yet available",
    date: "GopherCon 2025",
    startTime: "",
    endTime: "",
    location: "",
    summary: ABSTRACT_PLACEHOLDER,
    abstract: ABSTRACT_PLACEHOLDER,
    youtube: `https://www.youtube.com/watch?v=${video.videoId}`,
    slides: "",
    materials: [],
    sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}&list=${video.playlistId}`,
  };
});

const existing = JSON.parse(await readFile(CONTENT_URL, "utf8"));
const years = existing.years || {
  [existing.year]: {
    year: existing.year,
    location: existing.location || "",
    theme: existing.theme,
    speakers: existing.speakers,
    talks: existing.talks,
  },
};
years[2025] = {
  year: 2025,
  location: "New York",
  theme: {
    name: "New York City",
    inspiration: "City that never sleeps",
    tagline: "Built in Go. Made in New York.",
  },
  speakers: [...speakerMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
  talks,
};
const content = {
  defaultYear: existing.defaultYear || 2026,
  availableYears: Object.keys(years).map(Number).sort((left, right) => right - left),
  years,
};

await writeFile(CONTENT_URL, `${JSON.stringify(content, null, 2)}\n`);
console.log(`Imported ${talks.length} GopherCon 2025 talks and ${speakerMap.size} speakers from ${PLAYLISTS.length} playlists.`);
