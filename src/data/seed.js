/* What a brand-new shelf starts with.

   These are placeholders so an empty room isn't a blank wall. Once you add
   your own entries they simply sit alongside them, and "reset shelf" in the
   editor brings this list back. */

export const SEED = [
  { kind: "anime", title: "Frieren: Beyond Journey's End", altTitle: "葬送のフリーレン", year: 2023,
    creator: "Madhouse", seasons: 1, units: 28, done: 22, status: "watching",
    genres: ["Fantasy", "Drama"], started: "2026-07-12",
    note: "Taking this one slowly on purpose. Something about the pacing makes me not want it to end." },
  { kind: "anime", title: "Attack on Titan", altTitle: "進撃の巨人", year: 2013,
    creator: "Wit Studio / MAPPA", seasons: 4, units: 89, done: 89, status: "done", rating: 9.4,
    genres: ["Action", "Drama"], started: "2024-01-03", finished: "2024-02-28",
    note: "Watched the last four episodes in one sitting at 3am. Bad idea. Worth it." },
  { kind: "anime", title: "Steins;Gate", altTitle: "シュタインズ・ゲート", year: 2011,
    creator: "White Fox", seasons: 1, units: 24, done: 24, status: "done", rating: 10,
    genres: ["Sci-Fi", "Thriller"], started: "2025-08-09", finished: "2025-08-21",
    note: "Episode 12 onwards is a different show entirely. El Psy Kongroo." },
  { kind: "anime", title: "Mob Psycho 100", altTitle: "モブサイコ100", year: 2016,
    creator: "Bones", seasons: 3, units: 37, done: 37, status: "done", rating: 9.1,
    genres: ["Comedy", "Action"], started: "2025-03-14", finished: "2025-04-02",
    note: "The animation goes completely feral and somehow it's still the kindest show I've seen." },
  { kind: "anime", title: "Vinland Saga", altTitle: "ヴィンランド・サガ", year: 2019,
    creator: "Wit Studio / MAPPA", seasons: 2, units: 48, done: 48, status: "done", rating: 9.2,
    genres: ["Drama", "Action"], started: "2025-11-20", finished: "2025-12-19",
    note: "Season 2 has almost no fighting and is somehow twice as intense." },
  { kind: "anime", title: "Monster", altTitle: "モンスター", year: 2004,
    creator: "Madhouse", seasons: 1, units: 74, done: 31, status: "watching",
    genres: ["Thriller", "Drama"], started: "2026-08-01",
    note: "Slow burn. I keep pausing to think about whether Tenma was right." },
  { kind: "anime", title: "Cowboy Bebop", altTitle: "カウボーイビバップ", year: 1998,
    creator: "Sunrise", seasons: 1, units: 26, done: 26, status: "done", rating: 9.8,
    genres: ["Sci-Fi", "Adventure"], started: "2025-05-05", finished: "2025-05-30",
    note: "Put the soundtrack on while studying and got nothing done. See you, space cowboy." },
  { kind: "anime", title: "One Piece", altTitle: "ワンピース", year: 1999,
    creator: "Toei Animation", seasons: 21, units: 1120, done: 412, status: "watching",
    genres: ["Adventure", "Comedy"], started: "2025-02-17",
    note: "The fattest book on the shelf and I'm barely a third in. This is a lifestyle now." },
  { kind: "anime", title: "Jujutsu Kaisen", altTitle: "呪術廻戦", year: 2020,
    creator: "MAPPA", seasons: 2, units: 47, done: 47, status: "done", rating: 8.3,
    genres: ["Action", "Fantasy"], started: "2025-10-11", finished: "2025-10-29",
    note: "Shibuya arc broke me. The Gojo fight animation is unreal." },
  { kind: "anime", title: "Violet Evergarden", altTitle: "ヴァイオレット・エヴァーガーデン", year: 2018,
    creator: "Kyoto Animation", seasons: 1, units: 13, done: 0, status: "planned",
    genres: ["Drama"],
    note: "Three people have told me to watch this. Sitting on the pile, judging me." }
];

export const ROOM_OWNER = "Sid";

export const STREET = [
  { n: "Sid's loft",   s: "You are here", me: true },
  { n: "Mahi's place", s: "Not built yet" },
  { n: "Empty plot",   s: "Not built yet" },
  { n: "Empty plot",   s: "Not built yet" }
];

export const BAYS = {
  anime:  { label: "ANIME",           blurb: "Everything you've watched, are watching, or keep meaning to." },
  screen: { label: "MOVIES & SERIES", blurb: "Films and live-action series." },
  books:  { label: "BOOKS",           blurb: "Novels and manga." }
};
