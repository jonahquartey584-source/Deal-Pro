# Qp Homebase — pink & green edition

A private personal app for RubyQp. It runs on a computer at home and opens on
the phone like a normal app. Nothing goes to the internet except Jay's chats
(only if an Anthropic API key is added).

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

The Mac needs to be on and awake. Data lives in `data/homebase.json` on the Mac,
with a daily backup in `data/backups/`. It runs on port 4400 and Tailscale port
8443, so it never clashes with another Homebase on the same Mac.

## Animated background video (optional)

Put `pink-dark.mp4`, `pink-light.mp4`, `green-dark.mp4`, `green-light.mp4` in
`public/media/` and each theme plays its video behind the liquid animation.
Without them, the built-in liquid animation is used.

## Jay

Settings → paste an Anthropic API key. Everything else works without one.

## Tests

```bash
npm test
```
