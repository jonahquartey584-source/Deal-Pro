# Day Planner

A daily task tracker that runs on your own computer at **http://localhost:4321**.
Import your schedule once, and every day's tasks are pulled from it
automatically. Claude is built in to plan your day and manage tasks for you.

- **Today view:** the day's tasks in time order, tick them off, see what's on now and next, a week strip with progress, and a one-click "move yesterday's unfinished tasks here".
- **Schedule:** your weekly routine plus one-off dated items. Each day, the planner turns the items for that day into tasks. Change the schedule and upcoming tasks follow.
- **Import:** a calendar file (`.ics` from Google Calendar, Outlook or Apple Calendar), a spreadsheet (`.csv`), `.json`, or plain text you paste in. Tick **Read it with Claude** for messy things like a timetable, a rota or an email.
- **Assistant:** chat with Claude. It can see and change your tasks and schedule: "plan my day", "add gym at 6pm every Mon and Thu", "move everything I didn't finish to tomorrow", "I've done the email one".
- Reminders in the browser when a task is about to start (turn on in Settings), dark mode, works on a phone-sized window, and a backup download.

## Set it up (once)

You need [Node.js](https://nodejs.org) 18 or newer (the LTS download is fine).

Get this folder onto your computer (download the repo or `git clone` it), then
open a terminal in the `day-planner` folder and run the line for your system.
It installs what's needed, starts the planner, and makes it **start by itself
every time you log in** and restart if it ever stops.

**Mac**

```bash
bash install/install-mac.sh
```

**Windows** (PowerShell)

```bash
powershell -ExecutionPolicy Bypass -File install\install-windows.ps1
```

**Linux**

```bash
bash install/install-linux.sh
```

Then open **http://localhost:4321** and bookmark it (in Chrome or Edge you can
also use "Install app" in the address bar to give it its own window and icon).

To stop it starting automatically, run the same script with `--uninstall`
(`-Uninstall` on Windows). Your data is kept.

Just want to try it without installing a service?

```bash
npm install && npm start
```

## Turn on Claude

1. Get an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. In the planner, open **Settings** (the gear, top right) and paste it in.

The key is saved only on your computer, in `data/planner.json`. The planner
uses `claude-opus-5-5` by default; you can change the model in Settings.
Everything except the assistant and "Read it with Claude" works without a key.

## Schedule formats

**CSV** needs a header row with a `title` (or `task`) column, plus any of
`date`, `days`, `start`, `end`, `notes`, `priority`. `days` can be
`Mon,Wed,Fri`, `Mon-Fri`, `weekdays`, `weekends` or `daily`. A row with neither
a date nor days happens every day. See [`examples/weekly-routine.csv`](examples/weekly-routine.csv).

**Text**, one item per line: an optional day or date and a colon, a time or
time range, then the title. A line that's just a day ("Saturday:") applies to
the lines under it. See [`examples/schedule.txt`](examples/schedule.txt).

```
Weekdays: 09:00-09:15 Standup
Mon, Wed, Fri: 7am Gym
2026-11-18: 14:00 Call with accountant
```

**Calendar (.ics)**: in Google Calendar go to Settings → Import & export →
Export, unzip, and import the `.ics`. Events that repeat daily or weekly become
repeating items; past events are skipped. Monthly and yearly repeats come in as
their next date only.

You always see a preview before anything is saved, and can choose to add to
your schedule or replace it.

## Where things live

| | |
| --- | --- |
| Your data | `data/planner.json` (back it up with **Schedule → Download backup**) |
| Log | `data/server.log` (Mac/Windows), `journalctl --user -u day-planner` (Linux) |
| Port | 4321. Set `PORT` before running the install script to change it |

The server only listens on `127.0.0.1`, so other devices on your network can't
reach it.

## Development

```bash
npm test
```

`server.mjs` is the web server and API, `lib/store.mjs` holds the data and
turns schedule items into tasks, `lib/importers.mjs` reads schedule files,
`lib/ai.mjs` talks to Claude, and `public/` is the web page (no build step).
