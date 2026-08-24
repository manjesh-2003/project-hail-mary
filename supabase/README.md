# Turning on syncing

Until this is done, every shelf lives on the device it was typed into. After it,
a shelf follows you between devices and your friends can look at it from their own room.

It's a one-off, takes about ten minutes, and only one of us needs to do it.

## 1. Make the project

Go to [supabase.com](https://supabase.com), sign up, and create a new project.
Pick a region near you and set a database password — you won't need it again for this,
but keep it somewhere.

Wait for it to finish provisioning.

## 2. Create the tables

Open **SQL Editor** in the sidebar, paste the whole of [`schema.sql`](./schema.sql)
in, and run it. It creates:

- `profiles` — one row per person, so the street knows who's who
- `items` — everything on everyone's shelves
- a `covers` storage bucket for the artwork
- the rules about who may change what

Those rules matter: everyone signed in can *read* every shelf, but you can only
*write* your own. That's enforced by the database itself, so a bug in the page
can't let someone rearrange your books.

## 2b. Run the patch

New projects only need `schema.sql`. Ours was created before two mistakes were
found, so run [`patch-001.sql`](./patch-001.sql) after it. `schema.sql` already
has both fixes folded in, so a fresh project can skip this step.

## 3. Turn on email sign-in

**Authentication → Sign In / Providers**. Email should already be on. Make sure
**"Confirm email"** is enabled and turn **off** "Enable email signups" only if you
want to keep the street private — with it off, you add each friend by hand under
**Authentication → Users**.

There are no passwords. Signing in sends a link.

## 4. Add the redirect URL

**Authentication → URL Configuration**. Add wherever the page is served from —
for GitHub Pages that's `https://manjesh-2003.github.io/project-hail-mary/`.
Add `http://localhost:*` too if you ever open it locally.

Without this the sign-in link will refuse to come back to the page.

## 5. Paste in the two values

**Project Settings → API Keys**. Copy the **publishable** key — it starts
`sb_publishable_` — and the project URL into `src/core/config.js`:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_...";
```

(Older projects show a JWT starting `eyJhbGciOi...` labelled **anon / public**
instead. Either goes in the same slot; the constant keeps its old name.)

Then `npm run build` and commit.

**Both of those are safe in a public repo.** The publishable key identifies the
project, not a person, and everything it can do is fenced by the rules from step 2.

**The secret key is not safe** — `sb_secret_...`, or `service_role` on an older
project. It bypasses every rule. Never put it in `config.js`, never commit it,
never paste it into a chat. If it ever leaks, rotate it on the same page.

## 6. Check it

Open the room, click **✎ Shelves**, then **Set up syncing**. Put your email in,
open the link that arrives, and the bar should turn green. Add something to a shelf,
open the same page on your phone, sign in there, and it should be waiting.

---

## What this costs

Nothing, at our size. Supabase's free tier is 500MB of database, 1GB of file storage
and 50,000 monthly active users. A shelf entry is well under a kilobyte and a cover
is resized to at most 900px before it's uploaded — a few thousand entries and a few
hundred covers between all of us is a rounding error.

The one thing to know: free projects **pause after a week with no activity**. Opening
the page counts as activity, so in practice this only bites if everyone forgets about
it for a while. Unpausing is one click in the dashboard.
