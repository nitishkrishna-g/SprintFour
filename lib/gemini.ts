import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper to initialize the model dynamically with a specific key
const getModel = (userKey?: string) => {
  // Priority: User's Input Key -> Then Environment Variable
  const key = userKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!key) {
    throw new Error("API Key is missing. Please enter it in the settings.");
  }

  const genAI = new GoogleGenerativeAI(key);
  // Using 'gemini-1.5-flash' for speed/cost efficiency
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};

export async function getGeminiAnalysis(prompt: string, apiKey?: string) {
  try {
    const model = getModel(apiKey);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
}

export async function getChatResponse(history: any[], message: string, context: string, apiKey?: string) {
    try {
        const model = getModel(apiKey);
        
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `System Context: You are a strict ATS Matching System. Here is the Job Description (JD) and Resume context: ${context}` }]
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
    } catch (error) {
        console.error("Chat API Error:", error);
        return "Error: Please check your API Key or try again.";
    }
}