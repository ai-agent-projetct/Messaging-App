// Subscription plans and usage metering. Minutes count real conversations
// (phone, website widget, campaigns), never browser tests or Test Lab runs.

export const PLANS = {
  trial: { label: "Free trial", minutes: 60, agents: 1, campaigns: true, priceInr: 0 },
  starter: { label: "Starter", minutes: 300, agents: 1, campaigns: false, priceInr: 2999 },
  growth: { label: "Growth", minutes: 1000, agents: 3, campaigns: true, priceInr: 7999 },
  business: { label: "Business", minutes: Infinity, agents: Infinity, campaigns: true, priceInr: null },
};

export const BILLABLE_CHANNELS = ["phone", "widget"];

export function planOf(org) {
  return PLANS[org.plan] ?? PLANS.trial;
}

export function usage(db, org, now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const seconds = db
    .find("calls", (c) => c.orgId === org.id && BILLABLE_CHANNELS.includes(c.channel) && c.createdAt.startsWith(month))
    .reduce((sum, c) => sum + Math.ceil((c.durationSec || 0) / 60) * 60, 0);
  const plan = planOf(org);
  const minutesUsed = seconds / 60;
  return {
    plan: org.plan,
    planLabel: plan.label,
    minutesUsed,
    minutesIncluded: Number.isFinite(plan.minutes) ? plan.minutes : null,
    agentsIncluded: Number.isFinite(plan.agents) ? plan.agents : null,
    campaigns: plan.campaigns,
    overLimit: minutesUsed >= plan.minutes,
  };
}

export function canTakeCalls(db, org) {
  return !usage(db, org).overLimit;
}
