export async function gpt(system: string, input: string) {
  const endpoint = 'https://api.openai.com/v1/chat/completions'

  // TODO: domain-restrict this!
  const token = localStorage.getItem('OPENAI_KEY') ?? ''

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
          { role: 'system', content: system },
          { role: 'user', content: input },
        ],

        // how crazy it should be. 0 is not crazy, 1 is crazy
        temperature: 0,
        max_tokens: 200,
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
