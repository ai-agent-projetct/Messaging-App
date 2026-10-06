/* The sales brain: given the playbook and the conversation so far, Claude decides what to
   say next, which pipeline stage the lead is in and when to follow up. */
import Anthropic from '@anthropic-ai/sdk';
import { STAGES } from './db.js';

export const MODEL = 'claude-opus-5-5';

const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'stage', 'follow_up_in_hours', 'needs_human', 'note'],
  properties: {
    reply: { type: 'string', description: 'The WhatsApp message to send now. Empty string to send nothing.' },
    stage: { type: 'string', enum: STAGES },
    follow_up_in_hours: { type: 'number', description: 'Hours to wait before following up if the customer goes quiet. 0 = use the default schedule.' },
    needs_human: { type: 'boolean' },
    note: { type: 'string', description: 'One line for the sales team: what the customer wants, objections, budget, next step.' },
  },
};

export function systemPrompt(biz) {
  return `You are ${biz.business.agentName}, a sales assistant chatting on WhatsApp for ${biz.business.name} (${biz.business.whatsappNumber}).
Your job is to turn enquiries into paying customers: understand what the customer needs, recommend the right offer, handle objections and close.

# The business
${biz.business.about}
Website: ${biz.business.website} · Hours: ${biz.business.hours} · Location: ${biz.business.location}

# Offers (the only prices and packages that exist)
${biz.offers.map(o => `- ${o.name}: ${o.price}. Includes ${o.includes}. Best for: ${o.bestFor}`).join('\n')}

# How to sell
Goal: ${biz.sales.goal}
Payment link: ${biz.sales.closingLinks.payment}
Booking link: ${biz.sales.closingLinks.booking}
Qualify with questions like (one at a time, never a list): ${biz.sales.qualifyingQuestions.join(' | ')}
Discounts: ${biz.sales.discountRule} Maximum ${biz.sales.maxDiscountPercent}%.
Objection handling:
${Object.entries(biz.sales.objections).map(([k, v]) => `- "${k}": ${v}`).join('\n')}
Tone: ${biz.sales.tone}
Language: ${biz.sales.languages}

# Rules
- Never invent prices, packages, guarantees, discounts or facts that are not written above. If you don't know, say a teammate will confirm and set needs_human.
- As soon as the customer shows buying intent, give the payment link (or booking link if they want to talk first). Don't keep asking questions once they're ready.
- Hand off (needs_human = true, stage "human") when: ${biz.handoff.when} Tell the customer a teammate will reply shortly.
- If the customer asks you to stop messaging, reply with a short polite confirmation and set stage "opted_out".
- Stage meanings: new/contacted = no real conversation yet, engaged = talking, qualified = need and budget known, proposal = offer or link sent, won = paid or confirmed, lost = clearly declined.
- For a follow-up nudge, write one short, friendly message that adds something new (a benefit, a question, a deadline) - never just "any update?".`;
}

export function transcript(lead, now = new Date()) {
  const lines = lead.history.slice(-40).map(h =>
    `[${h.ts.slice(0, 16).replace('T', ' ')}] ${h.dir === 'in' ? 'Customer' : 'You'}: ${h.text}`);
  return `Customer name: ${lead.name || 'unknown'} · phone +${lead.phone} · current stage: ${lead.stage} · follow-ups sent so far: ${lead.followUps}
Team notes: ${lead.notes || 'none'}
Current time: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC

Conversation:
${lines.join('\n') || '(no messages yet)'}`;
}

export function createAgent({ client = new Anthropic(), model = MODEL, log = console.error } = {}) {
  return async function decide(biz, lead, { mode = 'reply' } = {}) {
    const task = mode === 'followup'
      ? 'The customer has gone quiet. Write the next follow-up message to re-open the conversation and move toward closing.'
      : 'Reply to the customer\'s latest message(s).';

    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: DECISION_SCHEMA } },
      cache_control: { type: 'ephemeral' },
      system: systemPrompt(biz),
      messages: [{ role: 'user', content: `${transcript(lead)}\n\n${task}` }],
    });

    if (response.stop_reason === 'refusal') {
      log('Claude declined to answer for', lead.phone, response.stop_details);
      return { reply: '', stage: 'human', follow_up_in_hours: 0, needs_human: true, note: 'AI declined - needs a person.' };
    }
    if (response.stop_reason === 'max_tokens') throw new Error('Claude response was cut off (max_tokens)');

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const decision = JSON.parse(text);
    if (!STAGES.includes(decision.stage)) decision.stage = lead.stage;
    return decision;
  };
}
