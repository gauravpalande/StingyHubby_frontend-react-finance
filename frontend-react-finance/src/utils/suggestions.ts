import { openai } from './gpt';

export async function getFinancialAdvice(latest: any) {
  const input = `
    I submitted this financial data:
    - Income: ${latest.income}
    - Mortgage: ${latest.mortgage}
    - Car Payments: ${latest.carPayments}
    - Utilities: ${latest.utilities}
    - Emergency: ${latest.emergency}
    - Health: ${latest.health}
    - Retirement: ${latest.retirement}
    - Credit Cards: ${latest.creditCards}

    Please give me 2–3 short, actionable financial suggestions based on common personal finance advice.
    Respond in simple, user-friendly language.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: input }],
  });

  console.log('GPT Response:', response.choices[0]?.message?.content);
  return response.choices[0]?.message?.content || '';
}
