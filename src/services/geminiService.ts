export const getAIResponse = async (prompt: string, history: { role: string, parts: { text: string }[] }[] = []) => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get AI response');
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('Gemini Service Error:', error);
    throw error;
  }
};

export const getAIVoiceResponse = async (text: string) => {
  try {
    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get AI voice response');
    }

    const data = await response.json();
    return data.audio;
  } catch (error) {
    console.error('Gemini Voice Service Error:', error);
    throw error;
  }
};
