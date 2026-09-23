type BillingPortalResponse = {
  url?: string;
  error?: string;
};

export async function openBillingPortal(userId: string) {
  const r = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  const data = (await r.json().catch(() => ({}))) as BillingPortalResponse;

  if (!r.ok) throw new Error(data.error || 'Portal failed');

  if (data.url) window.location.href = data.url;
  else throw new Error('No portal URL returned');
}
