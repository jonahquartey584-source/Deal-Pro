// OpenAI: learning how you text, replying like you, and summaries.
import OpenAI from 'openai';

let client;
function getClient() {
  // Reads OPENAI_API_KEY from the environment.
  client ??= new OpenAI();
  return client;
}

async function callModel({ model, effort, system, prompt, maxTokens, schema }) {
  const response = await getClient().chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    reasoning_effort: effort,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema } } } : {}),
  });
  const message = response.choices[0]?.message;
  if (!message || message.refusal) return null;
  const text = (message.content ?? '').trim();
  if (!text) return null;
  return schema ? JSON.parse(text) : text;
}

async function ask({ config, system, prompt, maxTokens = 4000, effort, schema }) {
  const options = { effort: effort || config.ai?.effort || 'low', system, prompt, maxTokens: maxTokens * 4, schema };
  const main = config.ai?.model || 'gpt-5.5';
  try {
    return await callModel({ model: main, ...options });
  } catch (err) {
    const backup = config.ai?.fallbackModel ?? 'gpt-5-mini';
    if (!backup || backup === main || err instanceof OpenAI.AuthenticationError) throw err;
    console.error(`${main} failed (${err.message}), trying ${backup}`);
    return callModel({ model: backup, ...options });
  }
}

/**
 * Study your own messages and write a description of how you text.
 * `samples` is [{ chatName, them, me }]: what they said, then what you replied.
 */
export async function learnStyle({ config, samples }) {
  const lines = samples
    .map((s) => `[chat with ${s.chatName}]${s.them ? `\nTHEM: ${s.them}` : ''}\nME: ${s.me}`)
    .join('\n\n');

  const system = `You study how one person writes WhatsApp messages so another writer can imitate them perfectly.`;
  const prompt = `Below are real messages written by ME, with the message I was replying to where there was one.

Write a precise style guide for writing exactly like me. Cover, with real examples quoted from the messages:
- message length, and whether I send one message or split thoughts over several
- capital letters, punctuation, full stops, question marks
- spelling, abbreviations, slang, dialect, and words or phrases I use a lot
- emoji: which ones, how often, where
- greetings, sign-offs, how I say yes / no / maybe / later / laughing
- tone, and how it changes between people (family, friends, work, people I don't know well)
- anything I never do

Be specific enough that someone could fool my friends.

${lines}`;

  return ask({ config, system, prompt, maxTokens: 8000, effort: 'medium' });
}

const LEAD_FIELDS = ['lookingFor', 'strategy', 'areas', 'budget', 'timeline', 'finance', 'notes'];

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['reply', 'hold', 'notify'] },
    messages: {
      type: 'array',
      items: { type: 'string' },
      description: 'For "reply": the message(s) to send, in order. Empty for "hold" and "notify".',
    },
    reason: { type: 'string', description: 'For "hold": one short line telling the owner what needs their input. Otherwise empty.' },
    topic: { type: 'string', description: 'For "notify": the name of the matching notify topic, exactly as listed. Otherwise empty.' },
    about: { type: 'string', description: 'For "notify": a few words on what they want, e.g. "a 50/50 JV on an HMO in Leeds". Otherwise empty.' },
    suggestedReply: { type: 'string', description: 'For "notify": a reply the owner could send, written in their style. Otherwise empty.' },
    lead: {
      type: 'object',
      description: 'What this person has said they are looking for as a property investor. Empty strings for anything not mentioned. isLead false if they are not a potential investor/buyer.',
      properties: {
        isLead: { type: 'boolean' },
        ...Object.fromEntries(LEAD_FIELDS.map((f) => [f, { type: 'string' }])),
      },
      required: ['isLead', ...LEAD_FIELDS],
      additionalProperties: false,
    },
  },
  required: ['action', 'messages', 'reason', 'topic', 'about', 'suggestedReply', 'lead'],
  additionalProperties: false,
};

export { LEAD_FIELDS };

/**
 * Decide what to do with the latest message in a chat, written in the owner's style.
 * Returns { action: "reply" | "hold" | "notify", messages, reason, topic, about, suggestedReply, lead }.
 */
export async function replyAsOwner({ config, styleGuide, contactName, contactExamples, generalExamples, history }) {
  const transcript = history.map((m) => `${m.fromMe ? 'ME' : 'THEM'}: ${m.text}`).join('\n');
  const examples = (list) => list.map((s) => `${s.them ? `THEM: ${s.them}\n` : ''}ME: ${s.me}`).join('\n---\n');
  const notifyTopics = config.notifyTopics ?? [];

  const system = `You are ${config.ownerName}, replying to your own WhatsApp messages. The other person must not be able to tell it isn't really you.
${config.about ? `\nABOUT ${config.ownerName.toUpperCase()} AND WHAT THEY WANT FROM THESE CHATS:\n${config.about}\n` : ''}
HOW ${config.ownerName.toUpperCase()} TEXTS:
${styleGuide || '(No style guide yet. Copy the style of the ME messages below as closely as you can.)'}

Rules for writing:
- Copy the style exactly: same length, same capitalisation, same punctuation (or lack of it), same slang, same emoji habits. If ME never uses full stops, you don't either.
- Talk to this person the way ME talks to them in the examples, not the way you'd talk to anyone else.
- If ME usually splits a reply into several short messages, return several; otherwise return one.
- Never sound like an assistant. No "Sure!", "Certainly", "I hope this helps", no explaining.
${notifyTopics.length ? `
Do NOT reply (action "notify") when the conversation is about any of these. ${config.ownerName} answers these personally:
${notifyTopics.map((t) => `- "${t.name}": ${t.description}`).join('\n')}
For "notify", fill in topic, about${notifyTopics.some((t) => t.suggestReply) ? ', and suggestedReply (what ' + config.ownerName + ' could send, in their style)' : ''}.
` : ''}
Hold instead of replying (action "hold") when the message needs the real ${config.ownerName}:
${(config.holdFor ?? []).map((h) => `- ${h}`).join('\n')}
- anything you'd have to guess or make up: facts about your life, where you are, your plans, what you think about something you haven't discussed before
- anything where a wrong answer would cause a problem

Otherwise reply (action "reply").${config.about ? '' : ' Small talk, banter, thanks, acknowledgements, and questions already answered in the conversation can all be replied to.'}

Always fill in "lead" with what this person has told you across the whole conversation about the property they want.`;

  const prompt = `${contactExamples.length ? `How ME usually texts ${contactName}:\n${examples(contactExamples)}\n\n` : ''}More examples of how ME texts other people:
${examples(generalExamples)}

CURRENT CONVERSATION WITH ${contactName} (latest last):
${transcript}

Decide what ME does with the latest message(s) from THEM.`;

  return ask({ config, system, prompt, schema: REPLY_SCHEMA, maxTokens: 4000 });
}

/** Summarise a batch of messages into a short digest for the owner. */
export async function summarise({ config, items }) {
  const lines = items.map((i) => `[${i.time}] ${i.contactName}: ${i.text}`).join('\n');
  const system = `You summarise ${config.ownerName}'s WhatsApp messages for them. Group by person, put anything urgent or needing a reply first, and keep it brief. Plain text, no markdown headers.`;
  return ask({ config, system, prompt: `Messages:\n\n${lines}` });
}
