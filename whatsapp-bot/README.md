# WhatsApp auto-replier

Runs on your MacBook and links to WhatsApp (personal or **WhatsApp Business**) the way WhatsApp Web does. Your phone keeps working normally.

Each number runs as its own **profile**, with its own login, settings and learned style. You can run both at once in two Terminal windows:

| Number | Start it with | Settings file |
| --- | --- | --- |
| Business number (WhatsApp Business app) | `npm run start:awake -- business` | `config.business.json` |
| Personal number | `npm run start:awake` | `config.json` |

## What it does

**On every number**

- **Learns how you text.** It reads your recent chats (up to 60 chats, the last 300 messages in each) and writes in your style: length, capitals, slang, emoji. It also learns how you talk to each person. It keeps learning from every message you send yourself.
- **Replies automatically, as you.**
- **Says "hold on" when it needs you.** That covers deals, prices or terms, documents, meetings, complaints, or anything it would have to guess. It sends "hold on" to the person and posts the message in **Qp Homebase**.
- **Sends a picture of the chat** with every alert in Qp Homebase, so you see the conversation at a glance.
- **Lets you answer from Qp Homebase.** Swipe-reply to the alert and type; the bot sends your answer to the person as you.
- **Leaves out anyone you choose** (`!exclude Name`).
- **Steps back while you're there.** If you reply to someone yourself, the bot stays out of that chat for 15 minutes.

**Extra on the business profile (deal sourcing)**

- **Replies an hour later.** Replies go out 60 minutes after the person's latest message. If they send another message, the hour restarts. Waiting replies survive a restart of the bot.
- **Finds out what investors want.** It talks as you, a deal sourcer looking for investors: it asks about strategy (BTL, HMO, SA, R2R, flips…), areas, budget, cash or mortgage, and timeline. It tells them you'll send matching deals, and points them to **Deal Pro (usedealpro.com)** to search deals themselves.
- **Posts a 📋 Deal sourcing task to Qp Homebase** with the investor's criteria as soon as they give any, and updates it when they add more.
- **Leaves joint ventures to you.** It doesn't reply, and posts "🔔 you have to respond to *Name* about *…*" with a picture of the chat.
- **Leaves Qp Digital to you too, with a suggested reply.** It doesn't reply, and posts "🔔 you have to respond to *Name* about *…*", the chat picture, and "💬 You could say: …".
- **Reminds you** every 3 hours until you've answered anything it flagged.

You can change the business details, the topics it leaves to you, and the reply delay in `config.business.json`.

> ⚠️ WhatsApp doesn't officially allow automation on accounts that use the app, so there's a small risk to the number. Delays and reply limits keep it low.

## Before you start

1. **Create the homebase chat.** In WhatsApp, create a group called **Qp Homebase**. If you're running both numbers, put both numbers in it. The bot finds it by name.
2. **Install Node.js 20 or newer** from https://nodejs.org (the LTS download).
3. **Have your OpenAI API key ready.** You can use the same key as Deal Pro. You'll find it at https://platform.openai.com/api-keys.

## Install (one time)

In **Terminal**:

```bash
curl -L -o /tmp/wa.zip https://codeload.github.com/jonahquartey584-source/Deal-Pro/zip/refs/heads/claude/keen-cerf-1ok1pd && unzip -q -o /tmp/wa.zip -d /tmp/wa-unzip && cp -R /tmp/wa-unzip/Deal-Pro-claude-keen-cerf-1ok1pd/whatsapp-bot ~/whatsapp-bot && echo "Downloaded to ~/whatsapp-bot"
```

This downloads the project (about 65 MB, because the site's videos come with it) and keeps only the bot.

```bash
cd ~/whatsapp-bot && npm install
```

```bash
sed -i '' '/OPENAI_API_KEY/d' ~/.zshrc; echo 'export OPENAI_API_KEY="paste-your-key-here"' >> ~/.zshrc && source ~/.zshrc
```

Paste the **whole line**, with your key between the quotes. Never paste the key on its own.

Then download the browser the bot uses (needed on newer versions of npm, which skip this during install):

```bash
npx puppeteer browsers install chrome
```

If you installed an earlier version, move the old `whatsapp-bot` folder (in your home folder) to the Bin first, then run these again. Your old settings won't carry over.

## Link the business number

```bash
cd ~/whatsapp-bot && npm run start:awake -- business
```

A QR code appears in Terminal, and a large copy opens in Preview. On the phone with the **business** number:

**WhatsApp Business → ⋮ (Android) or Settings (iPhone) → Linked devices → Link a device**, then scan the code.

- **Scan straight away.** Each code works for about 20 seconds, then a new one replaces it.
- **The bot stops after 5 unscanned codes.** That's on purpose: too many attempts make WhatsApp block linking for a while. Start it again when you're ready.

### Rather type a code than scan?

Put the business number in `config.business.json`, for example `"linkWithPhoneNumber": "+44 7700 900123"`, and start the bot. It shows an 8-character code.

On the phone: **Linked devices → Link a device → "Link with phone number instead"**, then type the code.

### "Can't link new devices at this time"

That message comes from WhatsApp, not the bot. Usually it means there were too many link attempts in a short time. To fix it:

1. **Wait.** Usually an hour or two; occasionally up to 24 hours. Don't keep retrying in the meantime, because each try resets the wait.
2. **Remove old links.** On the phone, open **Linked devices** and remove any old or unused entries. You can have at most 4.
3. **Update WhatsApp Business** from the App Store or Play Store.
4. **Clear the old login and start again:**

```bash
npm run reset -- business
```

```bash
npm run start:awake -- business
```

This version also fixes two problems on the bot's side:

- It uses the library's fix for WhatsApp's new login page (released 24 Nov).
- It identifies itself as a current version of Chrome. The library's default was Chrome 101, which WhatsApp can reject.

## After linking

1. The bot reads your chats to learn your style. This takes a few minutes, and Qp Homebase gets a message when it's done.
2. Open `config.business.json` and change `ownerName` to your name.
3. Leave the Terminal window open; closing it stops the bot. `start:awake` keeps the Mac awake.

## Commands (send them in Qp Homebase)

| Command | What it does |
| --- | --- |
| *swipe-reply to an alert* | Send your answer to that person |
| `!reply 4 your text` | Same, using the alert number |
| `!done 4` | You've dealt with it; the bot can carry on in that chat |
| `!exclude Name` / `!include Name` | Stop / restart auto-replies for someone (a saved name or a number) |
| `!excluded` | List excluded and blocked people |
| `!block +44…` | Ignore someone completely |
| `!pause` / `!resume` | Stop / restart all auto-replies |
| `!status` | Current settings |
| `!learn` | Relearn your style |
| `!style` | Show what it learned about how you text |
| `!digest` | AI summary of messages since the last digest |

If both numbers are linked, each bot only listens to its own number. Answer business alerts from the **WhatsApp Business** app, and personal alerts from normal WhatsApp.

## Files that stay on your Mac

Nothing here is uploaded to GitHub. Chat text only leaves the Mac when it's sent to OpenAI to learn your style or write a reply.

- Settings: `config*.json`
- Learned style: `style*.json`
- Investor criteria: `leads*.json`
- Queued replies: `schedule*.json`
- WhatsApp login: `.wwebjs_auth/`
