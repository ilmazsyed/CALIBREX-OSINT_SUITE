const PLAN_IDS = ['demo', 'starter', 'professional', 'business', 'enterprise'];

export function summariseCommercialAccounts(users = [], requests = [], now = Date.now()) {
  const plans = { demo: 0, starter: 0, professional: 0, business: 0, enterprise: 0, legacy: 0 };
  const statuses = { active: 0, pending: 0, suspended: 0, other: 0 };
  let trialsActive = 0, trialsExpired = 0;
  for (const user of users) {
    const tier = PLAN_IDS.includes(user.tier) ? user.tier : (user.tier === 'full' || !user.tier ? 'legacy' : 'demo');
    plans[tier] = (plans[tier] || 0) + 1;
    statuses[user.status] = (statuses[user.status] || 0) + 1;
    if (user.tier === 'trial') {
      if (user.trial_ends_at && now < user.trial_ends_at) trialsActive++;
      else trialsExpired++;
    }
  }
  const pending = requests.filter(request => request.status === 'pending');
  return {
    accounts: { total: users.length, plans, statuses, trialsActive, trialsExpired },
    licensing: {
      pendingRequests: pending.length,
      recentRequests: requests.slice(0, 20).map(({ id, at, status, kind, plan, featureId, userId }) => ({ id, at, status, kind, plan, featureId, userId }))
    }
  };
}
