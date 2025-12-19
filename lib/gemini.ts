import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
// We use 'gemini-1.5-flash' for speed and stability. 
// If you have access to the 2.0 preview, you can change the string to 'gemini-2.0-flash-exp'.
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function getGeminiAnalysis(prompt: string) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
}

export async function getChatResponse(history: any[], message: string, context: string) {
    // We initiate a chat session with the specific context of the Resume and JD
    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: `System Context: You are a strict technical recruiter. Here is the Job Description (JD) and Resume context: ${context}` }]
            },
            {
                role: "model",
                parts: [{ text: "Understood. I am ready to answer questions about the candidate's fit based on this context." }]
            },
            ...history
        ]
    });

    const result = await chat.sendMessage(message);
    return result.response.text();
}