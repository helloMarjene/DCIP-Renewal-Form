# DCNI Membership Renewal — Simple Backend Setup

This backend does the same jobs as the Laravel version described earlier
(save registrations, generate the PDF, email the administrator, optionally
notify WhatsApp) but only needs **one thing installed: Node.js.** No PHP,
no Composer, no MySQL server, no `artisan` commands.

Registrations are stored in a plain file (`data/renewals.json`) instead of a
database server — good enough for a forum's volume of submissions, and easy
to look at or back up. If you ever outgrow it, a real database can be swapped
in later without changing the frontend at all.

---

## Step 1 — Install Node.js (one time only)

1. Go to **https://nodejs.org**
2. Download the **LTS** version for your operating system (Windows, Mac, or Linux).
3. Run the installer and click Next/Continue through the defaults.
4. To check it worked, open a terminal (Command Prompt on Windows, Terminal
   on Mac) and type:
   ```
   node -v
   ```
   You should see a version number like `v20.11.0`. If you see an error,
   restart your computer and try again.

## Step 2 — Get the backend files onto your computer

Put this whole `dcni-backend` folder somewhere easy to find, e.g. your
Desktop.

## Step 3 — Install the project's dependencies

1. Open a terminal.
2. Navigate into the folder. For example, if it's on your Desktop:
   ```
   cd Desktop/dcni-backend
   ```
3. Run:
   ```
   npm install
   ```
   This downloads the small set of libraries the project needs (Express,
   PDFKit, Nodemailer, etc.) into a `node_modules` folder. It can take a
   minute the first time.

## Step 4 — Configure your settings

1. Copy `.env.example` to a new file named `.env` in the same folder.
   - On Mac/Linux: `cp .env.example .env`
   - On Windows: copy the file and rename the copy to `.env`
2. Open `.env` in any text editor and fill in:
   - `DCNI_ADMIN_EMAIL` — where new-registration alerts should go.
   - `SMTP_USER` / `SMTP_PASS` — see the instructions inside `.env.example`
     for creating a free Gmail "app password" (takes about 2 minutes).
   - `ADMIN_USER` / `ADMIN_PASS` — the login for your admin dashboard.
   - Leave the `WHATSAPP_*` settings alone for now — WhatsApp stays off
     until you deliberately turn it on later.

## Step 5 — Run the backend

```
npm start
```

You should see:

```
DCNI backend running at http://localhost:3000
Admin dashboard at http://localhost:3000/admin
```

Leave this terminal window open — it needs to keep running while people are
using the form. Press `Ctrl + C` to stop it.

## Step 6 — Connect the website to it

Open `index.html` and find this line near the top of the `<script>` section:

```js
const response = await fetch('/api/membership-renewals', {
```

Change it to point at your running backend:

```js
const response = await fetch('http://localhost:3000/api/membership-renewals', {
```

While you're testing on your own computer, `index.html` and the backend can
both run on `localhost`. When you're ready to let real pastors use the form
over the internet, you'll deploy the backend somewhere it has a public
address (see "Going live" below) and update this URL to that address.

## Step 7 — Try it

1. Open `index.html` in your browser (just double-click the file, or serve
   it from any static host).
2. Fill in the form and submit.
3. Check:
   - `data/renewals.json` now has an entry.
   - `pdfs/` has a new PDF file.
   - Your `DCNI_ADMIN_EMAIL` inbox received the notification with the PDF
     attached.
   - `http://localhost:3000/admin` (log in with `ADMIN_USER`/`ADMIN_PASS`)
     shows the new registration.

---

## Going live (so pastors anywhere can use it)

Once it works on your computer, you need somewhere for the backend to run
all the time with a public web address. Free/low-cost options that don't
require any server administration experience:

- **Render.com** — connect your project, it detects Node.js automatically,
  set your `.env` values as "Environment Variables" in its dashboard.
- **Railway.app** — similar one-click deploy for Node projects.

Either way: upload the `dcni-backend` folder, set the environment variables
from your `.env` file in their dashboard (never upload your real `.env`
file itself to a public place), and they'll give you a public URL like
`https://dcni-backend.onrender.com`. Use that URL in `index.html`'s `fetch(...)`
call instead of `localhost`.

Host `index.html` (plus the `image/` folder) anywhere that serves static
files — the same Render/Railway service, Netlify, or your existing website.

---

## If you outgrow the JSON file storage

`data/renewals.json` is fine for hundreds or a few thousand registrations.
If the forum grows large, or you want several administrators editing data
at once safely, swap `db.js` for a real database (e.g. SQLite via
`better-sqlite3`, or PostgreSQL via `pg`) — the rest of the code
(`server.js`, `pdf.js`, `mailer.js`) doesn't need to change, since they all
just call the small set of functions `db.js` exports.
