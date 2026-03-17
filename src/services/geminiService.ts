import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const getAIResponse = async (prompt: string, history: { role: string, parts: { text: string }[] }[] = []) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history,
      { role: "user", parts: [{ text: prompt }] }
    ],
    config: {
      systemInstruction: `You are STUDY COMMAND AI, a futuristic student tutor inspired by JARVIS. 
      Your goal is to help Diploma CSE students in Telangana achieve 90%+ marks.
      
      STRICT RESPONSE FORMAT (MANDATORY):
      DO NOT USE PARAGRAPHS. Every response must be structured using ONLY the following sections and ONLY bullet points:

      1. DEFINITION:
         - Provide the definition here as a single bullet point.
         - No paragraphs allowed.

      2. KEY POINTS:
         - Point 1
         - Point 2
         - Point 3
         - (Add more points as needed)

      3. FORMULAS/SYNTAX:
         - Formula/Syntax 1
         - Formula/Syntax 2
         - (Add more as needed)

      4. KAIZEN SUGGESTION:
         - Suggest one small, actionable daily improvement or learning activity related to the topic.
         - Example: "Spend 5 minutes today drawing the block diagram of this circuit from memory."

      Teaching Style:
      - Use Kaizen learning (small daily improvements).
      - Use visual learning descriptions and memory tricks.
      - Provide step-by-step explanations using bullet points.
      - Be encouraging, disciplined, and professional.
      - Specifically support subjects like Engineering Mathematics, C Programming, Digital Electronics, Computer Fundamentals, Physics, and Communication Skills.
      - When asked for code, provide clean, commented C or Python code.
      - Give exam tips and convert difficult topics into easy tricks.`,
    }
  });

  const result = await model;
  return result.text;
};

export const getAIVoiceResponse = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Keep it brief and helpful for a student: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};
