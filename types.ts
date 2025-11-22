import { Type } from "@google/genai";

export enum AppMode {
  SUMMARIZER = 'SUMMARIZER',
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  DASHBOARD = 'DASHBOARD',
}

export type TransliterationScheme = 'ISO' | 'Buckwalter';

export interface UserPreferences {
  transliterationScheme: TransliterationScheme;
  includeLiteralTranslation: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  preferences: UserPreferences;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  transcript: string;
  summary: LectureSummary | null;
}

export interface Claim {
  id: number;
  text: string;
  confidence: number;
  flagged: boolean;
  notes?: string;
  sources?: { title: string; uri: string }[];
}

export interface Transliteration {
  original: string;
  translit: string;
  translation: string;
}

export interface LectureSummary {
  summary_short: string;
  summary_medium: string;
  summary_long: string;
  claims: Claim[];
  transliterations: Transliteration[];
  warnings: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export const SUMMARY_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary_short: { type: Type.STRING },
    summary_medium: { type: Type.STRING },
    summary_long: { type: Type.STRING },
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          text: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          flagged: { type: Type.BOOLEAN },
          notes: { type: Type.STRING },
        },
        required: ["id", "text", "confidence", "flagged"]
      }
    },
    transliterations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          translit: { type: Type.STRING },
          translation: { type: Type.STRING },
        }
      }
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["summary_short", "summary_medium", "summary_long", "claims", "transliterations"]
};