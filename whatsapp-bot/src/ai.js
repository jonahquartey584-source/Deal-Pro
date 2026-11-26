// Claude-powered replies and digests.
import Anthropic from '@anthropic-ai/sdk';

const SKIP = 'SKIP';
let client;

function getClient() {
  // Reads ANTHROPIC_API_KEY (or an `ant auth login` profile) from the environment.
  client ??= new Anthropic();
  return client;
}

async function ask({ config, system, prompt, maxTokens = 2000 }) {
  const response = await getClient().beta.messages.create({
    model: config.ai?.model || 'claude-opus-5-5',
    max_tokens: maxTokens,
    // Short chat replies don't need deep thinking; this keeps them fast and cheap.
    output_config: { effort: config.ai?.effort || 'low' },
    // If the main model declines a message, the API retries it on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') return null;
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

/**
 * Write a reply to the latest message in a chat.
 * `history` is [{ fromMe, author, text }] oldest first, ending with the new message.
 * Returns the reply text, or null when Claude thinks the owner should answer personally.
 */
export async function draftReply({ config, contactName, history }) {
  const transcript = history
    .map((m) => `${m.fromMe ? config.ownerName : m.author || contactName}: ${m.text}`)
    .join('\n');

  const system = [
    `You reply to WhatsApp messages on behalf of ${config.ownerName}, writing as them in the first person.`,
    config.ai?.persona ?? '',
    'Match the tone of the conversation and keep replies short, like a real text message. No sign-offs, no markdown.',
    "Never make promises, agree to plans, share private information, or invent facts about the owner's life or schedule.",
    `If the message needs ${config.ownerName} personally (money, plans, emotional or sensitive topics, anything you'd have to guess), or needs no reply at all, answer with exactly ${SKIP}.`,
  ].join('\n');

  const prompt = `Recent conversation with ${contactName}:\n\n${transcript}\n\nWrite ${config.ownerName}'s reply to the last message.`;
  const reply = await ask({ config, system, prompt });
  if (!reply || reply === SKIP || reply.startsWith(SKIP)) return null;
  return reply;
}

/** Summarise a batch of messages into a short digest for the owner. */
export async function summarise({ config, items }) {
  const lines = items.map((i) => `[${i.time}] ${i.contactName}: ${i.text}`).join('\n');
  const system = `You summarise ${config.ownerName}'s WhatsApp messages for them. Group by person, put anything urgent or needing a reply first, and keep it brief. Plain text, no markdown headers.`;
  return ask({ config, system, prompt: `Messages:\n\n${lines}`, maxTokens: 4000 });
}
