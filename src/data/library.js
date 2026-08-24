/* Sample records. These get replaced by AniList data once the API is wired in;
   keep the shape stable so nothing downstream has to change. */

export const GENRE = {
  action: "#8E3B30", fantasy: "#2F5A46", scifi: "#2B475E", drama: "#5A3B62",
  comedy: "#9A6A24", thriller: "#3A3542", adventure: "#245C58"
};

export const LIB = [
  { t: "Frieren: Beyond Journey's End", jp: "葬送のフリーレン", y: 2023, studio: "Madhouse", seasons: 1, eps: 28, seen: 22,
    status: "watching", rate: null, g: ["Fantasy", "Drama"], c: GENRE.fantasy, start: "12 Jul 2026", end: null,
    note: "Taking this one slowly on purpose. Something about the pacing makes me not want it to end." },
  { t: "Attack on Titan", jp: "進撃の巨人", y: 2013, studio: "Wit Studio / MAPPA", seasons: 4, eps: 89, seen: 89,
    status: "done", rate: 9.4, g: ["Action", "Drama"], c: GENRE.action, start: "03 Jan 2024", end: "28 Feb 2024",
    note: "Watched the last four episodes in one sitting at 3am. Bad idea. Worth it." },
  { t: "Steins;Gate", jp: "シュタインズ・ゲート", y: 2011, studio: "White Fox", seasons: 1, eps: 24, seen: 24,
    status: "done", rate: 10, g: ["Sci-Fi", "Thriller"], c: GENRE.scifi, start: "09 Aug 2025", end: "21 Aug 2025",
    note: "Episode 12 onwards is a different show entirely. El Psy Kongroo." },
  { t: "Mob Psycho 100", jp: "モブサイコ100", y: 2016, studio: "Bones", seasons: 3, eps: 37, seen: 37,
    status: "done", rate: 9.1, g: ["Comedy", "Action"], c: GENRE.comedy, start: "14 Mar 2025", end: "02 Apr 2025",
    note: "The animation goes completely feral and somehow it's still the kindest show I've seen." },
  { t: "Vinland Saga", jp: "ヴィンランド・サガ", y: 2019, studio: "Wit Studio / MAPPA", seasons: 2, eps: 48, seen: 48,
    status: "done", rate: 9.2, g: ["Drama", "Action"], c: GENRE.drama, start: "20 Nov 2025", end: "19 Dec 2025",
    note: "Season 2 has almost no fighting and is somehow twice as intense." },
  { t: "Monster", jp: "モンスター", y: 2004, studio: "Madhouse", seasons: 1, eps: 74, seen: 31,
    status: "watching", rate: null, g: ["Thriller", "Drama"], c: GENRE.thriller, start: "01 Aug 2026", end: null,
    note: "Slow burn. I keep pausing to think about whether Tenma was right." },
  { t: "Cowboy Bebop", jp: "カウボーイビバップ", y: 1998, studio: "Sunrise", seasons: 1, eps: 26, seen: 26,
    status: "done", rate: 9.8, g: ["Sci-Fi", "Adventure"], c: GENRE.adventure, start: "05 May 2025", end: "30 May 2025",
    note: "Put the soundtrack on while studying and got nothing done. See you, space cowboy." },
  { t: "One Piece", jp: "ワンピース", y: 1999, studio: "Toei Animation", seasons: "ongoing", eps: 1120, seen: 412,
    status: "watching", rate: null, g: ["Adventure", "Comedy"], c: GENRE.adventure, start: "17 Feb 2025", end: null,
    note: "The fattest book on the shelf and I'm barely a third in. This is a lifestyle now." },
  { t: "Jujutsu Kaisen", jp: "呪術廻戦", y: 2020, studio: "MAPPA", seasons: 2, eps: 47, seen: 47,
    status: "done", rate: 8.3, g: ["Action", "Fantasy"], c: GENRE.action, start: "11 Oct 2025", end: "29 Oct 2025",
    note: "Shibuya arc broke me. The Gojo fight animation is unreal." },
  { t: "Violet Evergarden", jp: "ヴァイオレット・エヴァーガーデン", y: 2018, studio: "Kyoto Animation", seasons: 1, eps: 13, seen: 0,
    status: "planned", rate: null, g: ["Drama"], c: GENRE.drama, start: null, end: null,
    note: "Three people have told me to watch this. Sitting on the pile, judging me." }
];

export const STATUS = {
  done:     { label: "Completed",     stamp: "COMPLETED",   col: "#4F7C5E" },
  watching: { label: "Watching",      stamp: "IN PROGRESS", col: "#C07A24" },
  planned:  { label: "Plan to watch", stamp: "ON THE PILE", col: "#6E6678" },
  dropped:  { label: "Set aside",     stamp: "SET ASIDE",   col: "#8E4034" }
};

export const WATCHING = LIB.filter(b => b.status === "watching");
export const UP_NEXT = LIB.find(b => b.status === "planned") || LIB[0];

/* Shelf bays. Only "anime" holds records today; the others are reserved
   so each can be given its own catalogue later. */
export const BAYS = {
  anime:  { label: "ANIME",           blurb: "Everything you've watched, are watching, or keep meaning to." },
  screen: { label: "MOVIES & SERIES", blurb: "Films and live-action series. Nothing catalogued here yet." },
  books:  { label: "BOOKS",           blurb: "Novels and manga. Nothing catalogued here yet." }
};

export const ROOM_OWNER = "Sid";

export const STREET = [
  { n: "Sid's loft",   s: "You are here", me: true },
  { n: "Mahi's place", s: "Not built yet" },
  { n: "Empty plot",   s: "Not built yet" },
  { n: "Empty plot",   s: "Not built yet" }
];
