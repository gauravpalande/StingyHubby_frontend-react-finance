// src/lib/billing.ts
export async function startCheckout(userId: string, email: string) {
  const r = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || 'Checkout failed');
  }

  const { url } = await r.json();
  if (url) window.location.href = url;
  else throw new Error('No checkout URL returned');
}

export async function openPortal(userId: string) {
  const r = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || 'Portal failed');
  }

  const { url } = await r.json();
  if (url) window.location.href = url;
  else throw new Error('No portal URL returned');
}
