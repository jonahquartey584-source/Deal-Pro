# WhatsApp assistant

Two setups:

1. **Personal number → this bot, running on your MacBook.**
2. **Business number → the WhatsApp Business app on your phone** (no code, see the bottom of this file).

---

## 1. Personal bot on your Mac

It links to your personal WhatsApp the way WhatsApp Web does. Your phone keeps working normally.

What it does:

- **Alerts in your own chat:** every new message is forwarded to your "Message yourself" chat, with who sent it and why the bot did or didn't reply.
- **AI replies (Claude):** it writes a reply in your style. In `draft` mode (the default), it sends you the draft and waits for your OK. In `auto` mode, it sends the reply straight away.
- **Fixed auto-replies:** keyword replies (for example "urgent" → "please call me") and a quiet-hours message overnight.
- **Control from your phone:** send commands like `!pause` to yourself. The full list is below.
- **Safety rails:**
  - Groups are ignored.
  - People on the VIP list never get an automatic reply.
  - Each chat gets at most one automatic reply every 30 minutes.
  - Replies are sent after a short, human-like delay.
  - If a message needs you personally (money, plans, anything sensitive), the AI hands it back to you instead of answering.

> ⚠️ **Read this first:** WhatsApp doesn't officially allow automation on personal accounts, and banning accounts for it is rare but possible. Draft mode, cooldowns and ignoring groups keep the risk low. Don't use it to bulk-message people.

### Install (one time)

1. Install **Node.js 20 or newer** from https://nodejs.org (the LTS download).
2. Open **Terminal** and copy the bot into its own folder in your home directory (`~/whatsapp-bot`). These commands download it, keep only the bot, and delete the rest:

```bash
git clone --depth 1 -b claude/keen-cerf-1ok1pd https://github.com/jonahquartey584-source/Deal-Pro.git /tmp/wa-download && cp -R /tmp/wa-download/whatsapp-bot ~/whatsapp-bot && rm -rf /tmp/wa-download
```

```bash
cd ~/whatsapp-bot
```

```bash
npm install
```

3. Get a Claude API key at https://platform.claude.com (Settings → API keys). Then save it on your Mac:

```bash
echo 'export ANTHROPIC_API_KEY="paste-your-key-here"' >> ~/.zshrc && source ~/.zshrc
```

### Run it

```bash
npm run start:awake
```

`start:awake` also stops the Mac from sleeping while the bot runs. Use `npm start` if you don't want that.

The first time, a QR code appears in Terminal. On your phone, open WhatsApp → **Settings → Linked devices → Link a device** and scan it. Your login is saved, so later starts don't need the QR code.

You'll get "🤖 Bot is on" in your own chat. Leave the Terminal window open; closing it, or pressing Ctrl+C, stops the bot.

### Commands (send them in your "Message yourself" chat)

| Command | What it does |
| --- | --- |
| `!help` | List commands |
| `!status` | Current mode, quiet hours, drafts waiting |
| `!mode draft` | AI writes replies, you approve them (default) |
| `!mode auto` | AI replies on its own |
| `!pause` / `!resume` | Stop / restart replying (you still get alerts) |
| `!send 3` | Send draft #3 as written |
| `!edit 3 On my way!` | Send your own text instead of draft #3 |
| `!skip 3` | Throw draft #3 away |
| `!drafts` | List drafts waiting |
| `!digest` | AI summary of everything since the last digest |
| `!quiet on` / `!quiet off` | Turn the overnight message on or off |
| `!vip +44 7700 900123` | Never auto-reply to this person |
| `!block +44 7700 900123` | Ignore this person completely |

### Customise

When the bot first starts, it creates `config.json`. Edit that file and the bot reloads it on its own:

- `ownerName` and `ai.persona` set how replies sound (tone, language, emoji).
- `quietHours` sets the overnight times and message.
- `keywordReplies` sets fixed replies triggered by words.
- `vipList`, `allowList` and `blockList` take phone numbers in any format.
- `cooldownMinutes` and `replyDelaySeconds` control how often and how fast it replies.

`config.json` and your login (`.wwebjs_auth/`) stay on your Mac and are never committed to git.

### Costs

Each AI reply is one Claude request at low effort, roughly a fraction of a penny per message. Fixed replies and alerts are free.

---

## 2. Business number on your phone (no code)

Install the **WhatsApp Business** app on your phone and register your business number. Then open **Settings → Business tools**:

- **Greeting message:** sent automatically the first time someone messages you, or after 14 days of no chat. Example: "Hi! Thanks for getting in touch 👋 How can I help?"
- **Away message:** set it to *Outside of business hours*, and fill in your hours under **Business profile → Business hours**.
- **Quick replies:** saved answers you send by typing `/`, for example `/price` or `/howitworks`. These are good for questions you get often.
- **Labels:** tag chats as *New lead*, *Pending payment*, *Follow up* and so on, so your inbox stays organised.
- **Catalogue:** list your plans or services so customers can browse them in the chat.

If you later want **AI replies on the business number** too, Meta's WhatsApp Business Platform (Cloud API) can be connected to the same number while you keep using the app on your phone ("coexistence"). That's the officially supported way to automate a business number.
