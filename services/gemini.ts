import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { LectureSummary, SUMMARY_JSON_SCHEMA, UserPreferences } from "../types";
import { blobToBase64 } from "./audioUtils";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const getSystemInstruction = (prefs: UserPreferences) => `
You are a professional Islamic lecture summarizer assistant. Always produce respectful, clear, accurate, and non-judgmental outputs. Never contradict explicit text from the Qur'an or sahih hadith. If a claim appears to contradict canonical texts or you are uncertain, mark it as "flagged": true. Always begin the final user-facing text with: "Aslaaamu alaykum, brothers and sisters".

Behavior:
- Output must be conversational and aimed at a general Muslim audience.
- Detect Arabic phrases in the input. For each Arabic word/phrase keep the original Arabic, provide a transliteration in Latin script using the ${prefs.transliterationScheme} scheme, and ${prefs.includeLiteralTranslation ? 'provide a short literal translation' : 'do NOT provide a literal translation'}.
- Provide explicit citations for claims that are factual or theological; list source links and a confidence score (0–100).
- Provide three summary lengths: short, medium, long.
- The output MUST be a valid JSON object.
`;

export const transcribeAudio = async (audioFile: Blob): Promise<string> => {
  const base64Audio = await blobToBase64(audioFile);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: audioFile.type || 'audio/mp3', data: base64Audio } },
        { text: "Transcribe this audio verbatim." }
      ]
    }
  });
  
  return response.text || "";
};

export const summarizeLecture = async (
  transcript: string, 
  preferences: UserPreferences = { transliterationScheme: 'ISO', includeLiteralTranslation: true }
): Promise<LectureSummary> => {
  const prompt = `
  Input Content (Transcript or URL): ${transcript}
  
  Tasks:
  1. If the input is a URL (like a YouTube link or a web page), use the Google Search tool to find the transcript or detailed content of that video/page. Do not hallucinate content if you cannot access it.
  2. Extract main points and claims.
  3. For each claim, do a short web search to validate.
  4. Produce summary_medium in conversational tone that starts exactly with "Aslaaamu alaykum, brothers and sisters" and does not exceed 4–6 sentences. Also produce summary_short (1–2 sentences) and summary_long.
  5. Detect Arabic segments; add transliteration (${preferences.transliterationScheme}) and ${preferences.includeLiteralTranslation ? 'literal translation' : 'no translation'}.
  6. If any claim appears to contradict Qur'an/Hadith or cannot be validated, set flagged=true and explain why in notes.
  
  Return ONLY JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: getSystemInstruction(preferences),
      tools: [{ googleSearch: {} }], 
      responseSchema: SUMMARY_JSON_SCHEMA,
    }
  });

  let jsonStr = response.text || "{}";
  // Remove potential markdown code blocks
  jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
  
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini response", e);
  }

  // Validate and ensure structure exists to avoid undefined errors in UI
  const summaryData: LectureSummary = {
    summary_short: parsed.summary_short || "Summary generation failed.",
    summary_medium: parsed.summary_medium || "Summary generation failed.",
    summary_long: parsed.summary_long || "Summary generation failed.",
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    transliterations: Array.isArray(parsed.transliterations) ? parsed.transliterations : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  
  if (groundingChunks && summaryData.claims.length > 0) {
     const sources = groundingChunks
      .filter((c: any) => c.web?.uri)
      .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
     
     if (sources.length > 0) {
        // Attempt to attach sources to the first relevant claim or distribute them if logic permitted.
        // For now, attaching to the first claim as a simplified example of search grounding usage.
        if (summaryData.claims[0]) {
             summaryData.claims[0].sources = sources;
        }
     }
  }

  return summaryData;
};

export const generateTTS = async (text: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return base64Audio;
};

export const createChatSession = () => {
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "You are a knowledgeable Islamic scholar assistant. Answer questions based on the Qur'an and Sunnah. Be respectful and accurate.",
    }
  });
};

export const connectLiveSession = (
  callbacks: {
    onOpen: () => void;
    onMessage: (msg: LiveServerMessage) => void;
    onClose: () => void;
    onError: (err: any) => void;
  }
) => {
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: callbacks.onOpen,
      onmessage: callbacks.onMessage,
      onclose: callbacks.onClose,
      onerror: callbacks.onError,
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      systemInstruction: "You are a helpful, polite Islamic conversation partner. Use 'As-salamu alaykum' to greet.",
    },
  });
};