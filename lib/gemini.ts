import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
// Error Fix: 'gemini-1.5-flash' alias sometimes fails (404). 
// We are switching to 'gemini-1.5-flash-latest' which is more reliable, 
// OR you can use 'gemini-2.0-flash-exp' if you want the absolute latest.
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

// Use a specific model version to prevent "Model not found" errors
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite" 
});

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

    try {
        const result = await chat.sendMessage(message);
        return result.response.text();
    } catch (error) {
        console.error("Chat API Error:", error);
        return "I'm having trouble connecting to the AI right now. Please try again.";
    }
}