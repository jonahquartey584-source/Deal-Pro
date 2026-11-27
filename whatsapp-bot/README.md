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

**Extra on the business profile: the deal sourcing pipeline**

This is how the bot handles steps 2–8 of your business system:

1. **Instant replies for new investors only.** If a **new number** (someone not saved in your contacts) messages about deals, the bot answers within seconds and handles the whole conversation by itself.
   - **Every other message goes to Qp Homebase first.** That covers saved contacts and anything that isn't deal sourcing. The bot drafts a reply and posts it with a picture of the chat (✋ *Approve reply to …*), and nothing is sent until you approve.
   - **To approve:** swipe-reply ✅ to the draft (or `!send N`) to send it as written.
   - **To change it:** swipe-reply with your own words to send those instead.
   - **To skip:** `!skip N` sends nothing.
2. **Collects their criteria.** It talks as you, a deal sourcer looking for investors. It asks about strategy (BTL, HMO, SA, R2R, flips…), areas, budget, cash or mortgage, and timeline, and mentions **Deal Pro (usedealpro.com)** once.
3. **Searches with Claude.** Once it has strategy, areas and budget, **Claude** searches live UK listings. This runs through Claude Code on your Mac, using your Claude subscription. Claude opens each listing to check it's still available and works out the key figures.
4. **Sends a deal pack.** The client gets a short message in your style plus a **PDF deal pack**. Their copy has no listing links or addresses (pre-NDA). Your copy, with links, goes to the Qp Homebase group.
5. **Loops until they're happy.** It asks what they think. If they want something different or ask for more, it searches again and sends a new pack, without repeating deals they've already seen.
6. **Hands over when they're ready.** When they want to go ahead, it steps back from that chat and alerts you: "🎯 *Name* wants to move forward with …". From there it's yours.

Other things it does on the business number:

- **Leaves joint ventures to you.** No reply; you get "🔔 you have to respond to *Name* about …" with a picture of the chat.
- **Leaves Qp Digital to you, with a suggested reply.** Same alert, plus "💬 You could say: …".
- **Reminds you** every 3 hours until you've answered anything it flagged.

**Kept in step with the Qp Homebase planner app** (`localhost:4321`, on the same Mac):

- **Deal sourcing plan:** each investor becomes a step in the plan. The step updates as things move: 📋 criteria → 🔎 searching → 📦 pack sent → 🎯 wants to proceed.
- **CRM:** each investor becomes a contact under the business "Deal sourcing". Their stage moves lead → contacted → proposal, and their criteria and the packs sent are in the notes.
- **To-dos:** today's list gets anything you have to answer yourself, such as JV and Qp Digital messages, holds, and clients ready to go ahead.
- **If the planner isn't open:** the bot carries on and the planner simply isn't updated.

You can change the business details, the topics it leaves to you, and the reply delay in `config.business.json`.

> ⚠️ WhatsApp doesn't officially allow automation on accounts that use the app, so there's a small risk to the number. Delays and reply limits keep it low.

## Before you start

1. **Create the homebase chat.** In WhatsApp, create a group called **Qp Homebase**. If you're running both numbers, put both numbers in it. The bot finds it by name.
2. **Install Node.js 20 or newer** from https://nodejs.org (the LTS download).
3. **Have your OpenAI API key ready.** You can use the same key as Deal Pro. You'll find it at https://platform.openai.com/api-keys. OpenAI writes the chat replies.
4. **Install Claude Code and sign in.** Claude does the deal searches using your Claude subscription. In Terminal, install it:

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

   Then run `claude` once, sign in with your Claude account, and type `/exit` to leave.

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

## Test it first (practice chat)

```bash
cd ~/whatsapp-bot && npm run try -- business
```

You play an investor messaging you, and it shows exactly what the bot would do:

- its replies
- holds and 🔔 alerts
- the 📋 criteria it picked up

Once you've given a strategy, areas and budget, it runs the **real Claude deal search** and opens the PDF deal pack in Preview.

Nothing is sent on WhatsApp. Type `/new` to start again and `/quit` to stop.

## Link the business number

```bash
cd ~/whatsapp-bot && npm run start:awake -- business
```

A QR code appears in Terminal, and a large copy opens in Preview. On the phone with the **business** number:

**WhatsApp Business → ⋮ (Android) or Settings (iPhone) → Linked devices → Link a device**, then scan the code.

- **Scan straight away.** Each code works for about 20 seconds, then a new one replaces it.
- **The bot stops after 5 unscanned codes.** That's on purpose: too many attempts make WhatsApp block linking for a while. Start it again when you're ready.

### See the bot's WhatsApp in a window

```bash
npm run show -- business
```

This opens a Chrome window with WhatsApp Web in it. Scan the QR code shown there, then watch the bot read and reply. Leave the window open (you can minimise it); closing it stops the bot. Avoid clicking around in it: opening a chat there marks it as read.

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
| *swipe-reply ✅ to a draft* / `!send 4` | Approve a draft and send it as written |
| `!skip 4` | Send nothing for that alert |
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
