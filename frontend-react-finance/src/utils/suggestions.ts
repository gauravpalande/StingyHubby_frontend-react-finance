import { openai } from './gpt';

export async function getFinancialAdvice(latest: any, goals: any) {
  const input = `
    I submitted this financial data:
    - Income: ${latest.income}
    - Checking: ${latest.checking}
    - Mortgage: ${latest.mortgage}
    - Car Payments: ${latest.carPayments}
    - Utilities: ${latest.utilities}
    - Emergency: ${latest.emergency}
    - Health: ${latest.health}
    - Retirement: ${latest.retirement}
    - Credit Cards: ${latest.creditCards}
    - Emergency Goal: ${goals?.emergency || 0}
    - Retirement Goal: ${goals?.retirement || 0}
    - Health Goal: ${goals?.health || 0}

    Please give me one very detailed short-term and one very detailed long-term, actionable financial suggestion, based on https://imgur.com/personal-income-spending-flowchart-united-states-lSoUQr2 and common personal finance advice.
    Respond in simple, user-friendly language. Also include a short summary of the progress towards each goal, like "You are 50% towards your emergency fund goal of $5000, keep it up!".
  `;

  try {
    console.log('GPT Input:', input);
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: input }],
  });

  console.log('GPT Response:', response.choices[0]?.message?.content);
  return response.choices[0]?.message?.content || '';
  } catch (error: any) {
  console.error('GPT Error:', error.message || error);
  return '⚠️ GPT is temporarily unavailable. Please try again later.';
}
}
