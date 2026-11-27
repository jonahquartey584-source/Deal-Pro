// Talks to the Qp Homebase planner app running on the same Mac (http://localhost:4321).
// Keeps it in step with the bot: each investor lead becomes a step in the deal sourcing plan
// and a contact in the CRM (stage moves lead → contacted → proposal), and anything you need to
// answer yourself becomes a to-do for today.
// If the planner isn't running, every call quietly does nothing, so the bot keeps working.

const STAGE = { new: 'lead', searching: 'lead', sent: 'contacted', ready: 'proposal' };

export function createHomebase(config, log = console) {
  const opts = config.qpHomebase ?? {};
  const enabled = opts.enabled !== false;
  const base = (opts.url || 'http://localhost:4321').replace(/\/+$/, '');
  const planTitle = opts.plan || config.leadTasks?.plan || 'Deal sourcing';
  const businessName = opts.crmBusiness || 'Deal sourcing';
  let warned = false;
  let planId = null;
  let businessId = null;

  async function api(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Qp Homebase answered ${res.status}`);
    return data;
  }

  // Run a planner update; if the planner is closed, say so once and carry on.
  async function safely(what, fn) {
    if (!enabled) return null;
    try {
      const out = await fn();
      warned = false;
      return out;
    } catch (err) {
      if (!warned) log.error(`Qp Homebase: couldn't ${what} (${err.message}). Is the planner running at ${base}?`);
      warned = true;
      return null;
    }
  }

  async function plan() {
    const { plans } = await api('GET', '/api/plans');
    const found = plans.find((p) => p.id === planId) || plans.find((p) => p.title.toLowerCase() === planTitle.toLowerCase());
    if (found) {
      planId = found.id;
      return found;
    }
    const made = await api('POST', '/api/plans', {
      title: planTitle,
      emoji: '🏘️',
      goal: 'Find deals for every investor who messages on WhatsApp, send them a deal pack, and get them to move forward.',
      steps: [],
    });
    planId = made.id;
    return made;
  }

  async function business() {
    if (businessId) return businessId;
    const { businesses } = await api('GET', '/api/crm');
    const found = businesses.find((b) => b.name.toLowerCase() === businessName.toLowerCase());
    businessId = found ? found.id : (await api('POST', '/api/crm/businesses', { name: businessName, emoji: '🏘️' })).id;
    return businessId;
  }

  const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

  return {
    enabled,
    planTitle,

    /** Add or update the plan step for this investor. Returns the step id. */
    upsertStep: (lead, text, { done = false } = {}) =>
      safely('update the deal sourcing plan', async () => {
        const p = await plan();
        const steps = p.steps.map((s) => ({ id: s.id, text: s.text, done: s.done, due: s.due }));
        const i = lead.stepId ? steps.findIndex((s) => s.id === lead.stepId) : -1;
        if (i >= 0) steps[i] = { ...steps[i], text, done };
        else steps.push({ text, done, due: today() });
        const updated = await api('PATCH', `/api/plans/${p.id}`, { steps });
        const step = i >= 0 ? updated.steps.find((s) => s.id === lead.stepId) : updated.steps[updated.steps.length - 1];
        return step?.id ?? null;
      }),

    /** Add or update the CRM contact for this investor. Returns the contact id. */
    upsertContact: (lead, { name, phone, notes, stage }) =>
      safely('update the CRM', async () => {
        const bid = await business();
        const body = { name, phone: phone ? `+${String(phone).replace(/\D/g, '')}` : '', notes, stage: STAGE[stage] || 'lead', source: 'WhatsApp', tags: ['investor', 'whatsapp-bot'] };
        if (lead.contactId) {
          try {
            return (await api('PATCH', `/api/crm/contacts/${lead.contactId}`, body)).id;
          } catch {
            // deleted in the planner: make a new one
          }
        }
        return (await api('POST', '/api/crm/contacts', { ...body, businessId: bid, followUp: today() })).id;
      }),

    /** A to-do for today, e.g. "Respond to Sam about a JV". */
    addTodo: (text) => safely('add a to-do', async () => (await api('POST', '/api/todos', { text, scope: 'day' })).id),
  };
}
