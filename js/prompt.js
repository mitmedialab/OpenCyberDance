/**
 * @param {string} system
 * @param {string} input
 * @returns {string}
 */
export async function gpt(system, input) {
  const endpoint = 'https://api.openai.com/v1/chat/completions'

  // TODO: domain-restrict this!
  const token = ''

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: input},
        ],
        temperature: 0,
        max_tokens: 125,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    })

    const json = await res.json()

    return json.choices[0].message.content
  } catch (err) {
    console.warn('GPT error:', err)
  }
}
