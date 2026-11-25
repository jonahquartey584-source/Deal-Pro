# Qp Homebase "Ruby Edition"

A private personal app for RubyQp. It runs on a computer at home and opens on
the phone like a normal app. Nothing goes to the internet except Jay's chats
(only if an OpenAI API key is added).

**What's inside**

- **Welcome screen:** "Welcome RubyQp", a moving liquid background and four themes: pink & black, pink & white, green & black, green & white.
- **Home:** today's tasks and chores, calories, Bible time, cycle day and money left this month.
- **Planner:** day view, week schedule, weekly routine, and paste-in schedule import.
- **To-do list:** due dates, priorities and lists.
- **Housework:** a chore list where each chore gets a day (weekly or one-off), the week's chores to tick off, and a full schedule with every task, routine item and chore.
- **Meal planner:** save recipes, scroll through favourites, and pick from them to fill the week. It makes the shopping list (quantities added up) and counts calories per day and per week against a goal.
- **Period tracker:** cycle day, next period and fertile-window predictions, a calendar, and daily flow, mood, symptoms and notes.
- **Budget:** log income and expenses (including monthly repeats), set category budgets, see a 6-month trend, and make savings goals with a suggested plan.
- **Bible:** notes in folders, including folders inside folders, plus search. There's a reading timer with daily, weekly and monthly logs, a daily goal and a streak.
- **Journal:** entries with a mood.
- **Jay:** an assistant that adds tasks, chores, meals, recipes, money and to-dos for you.
- **Settings:** theme, reminders, API key, and backup/restore.

No news and no email.

## Set up on a Mac (once)

1. Install [Node.js](https://nodejs.org) (LTS).
2. Put this folder in your home folder (not Downloads/Desktop/Documents), then in Terminal:

```bash
cd ~/qp-homebase-pink && bash scripts/install-mac.sh
```

It opens at **http://localhost:4400** and starts by itself every time the Mac logs in.

## Put it on the iPhone

1. Install **Tailscale** on the Mac and the iPhone and sign in to the same account on both.
2. On the Mac:

```bash
bash ~/qp-homebase-pink/scripts/phone.sh
```

3. Open the address it prints in **Safari** on the iPhone, tap **Share → Add to Home Screen**.

**The MacBook does not need to be on.** After the first open, the whole app
lives on her iPhone and her data is saved on the phone itself, so it works
anywhere, even offline. Whenever the MacBook is on, the phone automatically
backs her data up to it (`data/homebase.json`, plus a daily copy in
`data/backups/`). The Mac only needs to be on to install an update. It runs on port 4400 and Tailscale port
8443, so it never clashes with another Homebase on the same Mac.

## The moving background

Liquid-chrome loops made in OpenArt with Veo 3.1, the same model, prompt and
start-equals-end-frame loop method as Qp Homebase's background, generated in
pink & black, pink & white, green & black and green & white, filmed vertically
for phones and crossfaded so the loop has no seam:
`public/media/{pink-dark,pink-light,green-dark,green-light}.mp4`, with a still
`.jpg` of each that shows instantly. If an iPhone is in Low Power Mode and
blocks video, the still frame stays. It can be turned off in Settings to save
battery.

Made for phones: on a computer it stays phone-width in the middle of the screen.

## Privacy: Face ID

Settings → **Privacy** → **Turn on Face ID** (and optionally a backup
passcode). Choose which sections need Face ID: Journal (on by default),
Period tracker, Budget, Bible. A locked section asks for Face ID when opened
and locks again as soon as she leaves the app (or after 5 minutes). Locked
sections are hidden on the Home page and from Jay. Face ID must be set up
from the Home Screen app on her iPhone. It locks the screens on the phone;
the backup copy on the MacBook is not encrypted.

## Jay

On her phone: Settings → paste an **OpenAI** API key (from platform.openai.com → API keys, with some billing credit) → **Save on this phone**. The model defaults to `gpt-6.1-terra` and can be changed there.
Jay then works straight from the phone, without the MacBook. Everything else
works without a key.

## Tests

```bash
npm test
```
