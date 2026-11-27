# WhatsApp auto-replier

Runs on your MacBook, linked to your personal WhatsApp (like WhatsApp Web). Your phone keeps working normally.

## What it does

1. **Learns how you text.** When it first starts, it reads your recent chats: up to 60 chats and the last 300 messages in each. From these it works out exactly how you write: message length, capitals, punctuation, slang, emoji, how you say yes, no and lol. It also learns how you talk to each person, so your mum and your mates get different versions of you. It keeps learning from every message you send yourself, and relearns once a week.
2. **Replies to everyone automatically, as you.** It waits 10–40 seconds, so a burst of messages gets one reply. Then it shows "typing…" and replies in your style. Where you'd normally split a reply into a couple of short messages, it does the same.
3. **Says "hold on" when it needs you.** That covers money, plans and times, promises, serious topics, or anything it would have to guess. It sends **"hold on"** to the person and posts the message in your **Qp Homebase** chat, saying what it needs from you. Until you answer, it doesn't reply to that person again.
4. **You answer from Qp Homebase.** Swipe-reply to the alert and type your answer. The bot sends it to the person as you, then carries on with that chat.
5. **Leaves out anyone you choose.** People on your exclude list never get an automatic reply. Their messages come to Qp Homebase instead.
6. **Steps back when you're there.** If you reply to someone yourself, the bot stays out of that chat for 15 minutes.

Group chats are ignored.

> ⚠️ WhatsApp doesn't officially allow automation on personal accounts, so there's a small risk to your number. The human-like delays and the reply limit (20 per chat per hour) keep it low.

## Before you start

1. **Create the homebase chat.** In WhatsApp, create a group called **Qp Homebase**. You can add one person and then remove them, so it's just you. The bot finds it by name. To use a different chat, change `homebaseChat` in `config.json`. If no chat has that name, alerts go to your "Message yourself" chat.
2. **Install Node.js 20 or newer** from https://nodejs.org (the LTS download).
3. **Get a Claude API key** at https://platform.claude.com (Settings → API keys).

## Install (one time)

In **Terminal**:

```bash
git clone --depth 1 -b claude/keen-cerf-1ok1pd https://github.com/jonahquartey584-source/Deal-Pro.git /tmp/wa-download && cp -R /tmp/wa-download/whatsapp-bot ~/whatsapp-bot && rm -rf /tmp/wa-download
```

```bash
cd ~/whatsapp-bot && npm install
```

```bash
echo 'export ANTHROPIC_API_KEY="paste-your-key-here"' >> ~/.zshrc && source ~/.zshrc
```

## Run it

```bash
cd ~/whatsapp-bot && npm run start:awake
```

The first time, a QR code appears. On your phone, open WhatsApp → **Settings → Linked devices → Link a device** and scan it. You won't need to scan again.

Next, it reads your chats to learn your style. This takes a few minutes, and Qp Homebase gets a message when it's done. Send `!style` there to see what it learned about how you text.

Then open `config.json` and change `ownerName` to your name.

Leave the Terminal window open. Closing it, or pressing Ctrl+C, stops the bot. `start:awake` stops the Mac sleeping while the bot runs.

## Commands (send them in Qp Homebase)

| Command | What it does |
| --- | --- |
| *swipe-reply to an alert* | Send your answer to that person |
| `!reply 4 yeah 7 works` | Same, using the alert number |
| `!done 4` | You've dealt with it; the bot can carry on in that chat |
| `!exclude Mum` | Never auto-reply to this person (a saved name or a number) |
| `!include Mum` | Let the bot reply to them again |
| `!excluded` | List excluded and blocked people |
| `!block +44 7700 900123` | Ignore someone completely: no reply, no alert |
| `!pause` / `!resume` | Stop / restart all auto-replies |
| `!status` | Current settings |
| `!learn` | Re-read your chats and relearn your style |
| `!style` | Show what it learned about how you text |
| `!digest` | AI summary of messages since the last digest |
| `!help` | List commands |

## Settings (`config.json`)

The bot reloads this file by itself when you save it.

- `excludeList`: people it never replies to, e.g. `["Mum", "+44 7700 900123"]`. You can also manage this with `!exclude`.
- `holdFor`: the kinds of messages that get "hold on". You can add your own in plain English.
- `holdMessage`: what it says when it needs you. The default is `"hold on"`.
- `homebaseChat`: the chat where alerts go.
- `reportReplies`: set this to `true` to see every reply the bot sends, in homebase.
- `quietHours`: no auto-replies overnight if you turn it on.
- `replyDelaySeconds`, `youTakeOverMinutes`, `maxRepliesPerChatPerHour`: timing and safety limits.

Your settings, your learned style (`style.json`) and your WhatsApp login stay on your Mac and are never uploaded anywhere except to Claude when writing a reply.

## Limits

- It only runs while your Mac is on and the bot is running.
- It can't see photos or hear voice notes. It knows one was sent and usually holds.
- It only knows what's in your chats, so for anything about your life it hasn't seen, it says "hold on".

## Business number

Use the **WhatsApp Business** app on your phone. Under **Settings → Business tools** you'll find a greeting message, an away message (with business hours), quick replies (type `/`) and labels. None of this needs the bot.
