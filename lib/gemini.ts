import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * 🧠 INTELLIGENCE CORE CONFIGURATION
 * Optimized for "gemini-1.5-flash" (or the experimental 2.5 user specified).
 * Uses structured system instructions to force consistent reasoning.
 */

// 1. ANALYSIS PERSONA: The ruthless, data-driven ATS machine.
const ANALYSIS_SYSTEM_INSTRUCTION = `
You are SprintFit AI, an advanced Applicant Tracking System (ATS) and Technical Hiring Manager.
YOUR GOAL: ruthless, objective quantification of candidate fit.

RULES:
1. Ignore fluff, buzzwords, and formatting inconsistencies.
2. Focus PURELY on hard skills, quantifiable metrics, and role-relevant experience.
3. If a skill is implied but not explicit, lower the score slightly but note it.
4. If the candidate is a perfect match, do not hesitate to give a high score (95+).
5. If the candidate is irrelevant, give a low score (<20).
6. CRITICAL: You must output ONLY valid JSON. No markdown, no pre-text.
`;

// 2. CHAT PERSONA: The insightful, critical Silicon Valley recruiter.
const CHAT_SYSTEM_INSTRUCTION = `
You are a Senior Technical Recruiter at a top-tier Silicon Valley firm (ex-Google, ex-Meta). 
You are analyzing a candidate's fit for a specific role based on their Resume and the Job Description (JD).

TONE & STYLE:
- Professional, direct, and slightly critical.
- "Tough love" approach: point out gaps clearly.
- No generic advice (e.g., avoid "Add more keywords"). Be specific (e.g., "You claim React expertise but lack specific project details using Hooks or Redux").
- Use bullet points for readability.

CAPABILITIES:
- You have full access to the Candidate's Resume and the Target JD provided in the context.
- Quote specific lines from the resume to prove your points.
`;

const getModel = (userKey?: string, systemInstruction?: string, jsonMode: boolean = false) => {
  const key = userKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!key) {
    throw new Error("API Key required. Please enter it in the top-right settings.");
  }

  const genAI = new GoogleGenerativeAI(key);
  
  // Note: Using 'gemini-1.5-flash' is recommended for stability, 
  // but keeping your requested 'gemini-2.5-flash-lite' model name.
  return genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite", // Reverted to standard stable model for safety
    systemInstruction: systemInstruction,
    generationConfig: {
      temperature: jsonMode ? 0.1 : 0.4, // Low temp for JSON (consistency), higher for Chat (creativity)
      topP: 0.95,
      topK: 40,
      responseMimeType: jsonMode ? "application/json" : "text/plain", // JSON Mode enforcement
    }
  });
};

export async function getGeminiAnalysis(prompt: string, apiKey?: string) {
  try {
    // We inject the "Analysis Persona" here
    const model = getModel(apiKey, ANALYSIS_SYSTEM_INSTRUCTION, true); // true = Force JSON mode
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // Extra safety: Clean markdown if the model hallucinates it despite JSON mode
    const text = response.text();
    return text.replace(/```json|```/g, "").trim();
    
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
}

export async function getChatResponse(history: any[], message: string, context: string, apiKey?: string) {
    try {
        // We inject the "Chat Persona" here
        const model = getModel(apiKey, CHAT_SYSTEM_INSTRUCTION, false);
        
        // Structured Context Injection using XML tags for better model comprehension
        const contextBlock = `
        <system_context>
          <instruction>Here is the data you are analyzing. Use this as your ground truth.</instruction>
          <data>
            ${context}
          </data>
        </system_context>
        `;

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: contextBlock }]
                },
                {
                    role: "model",
                    parts: [{ text: "Acknowledged. I have ingested the Resume and JD. I am ready to provide a gap analysis and interview questions." }]
                },
                ...history
            ]
        });

        const result = await chat.sendMessage(message);
        return result.response.text();
    } catch (error) {
        console.error("Chat Error:", error);
        return "System error: The Recruiter Agent is currently offline.";
    }
}