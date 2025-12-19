"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle, AlertCircle, Send, Cpu, Briefcase } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { getGeminiAnalysis, getChatResponse } from "@/lib/gemini";

// --- PDF Worker Setup ---
// We use the specific version from your package.json to avoid mismatch errors
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs`;

// --- Types ---
type AnalysisResult = {
  score: number;
  missingSkills: string[];
  verdict: string;
  keywordMatchRate: number;
  aiRating: number;
};

type ChatMessage = {
  role: "user" | "model";
  text: string;
};

export default function SprintFitAI() {
  // --- State ---
  const [resumeText, setResumeText] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- PDF Extraction Logic ---
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // @ts-expect-error - pdfjs types can be tricky with specific versions
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + " ";
      }
      return fullText;
    } catch (error) {
      console.error("PDF Parse Error:", error);
      throw new Error("Failed to parse PDF");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "resume" | "jd") => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractTextFromPDF(file);
      if (type === "resume") setResumeText(text);
      else setJdText(text);
    } catch (err) {
      alert("Error parsing PDF. Please ensure it is a valid text-based PDF.");
    }
  };

  // --- Hybrid Scoring Engine ---
  const calculateKeywordScore = (resume: string, jd: string) => {
    const clean = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
    const resumeTokens = new Set(clean(resume));
    const jdTokens = clean(jd).filter(t => t.length > 3); 

    if (jdTokens.length === 0) return 0;
    
    const matches = jdTokens.filter(token => resumeTokens.has(token));
    const score = (matches.length / jdTokens.length) * 100;
    // Boost score slightly as exact keyword matches are rare, capping at 100
    return Math.min(score * 1.5, 100); 
  };

  const analyzeProfile = async () => {
    if (!resumeText || !jdText) return;
    setLoading(true);

    try {
      // 1. Math-based Score (40%)
      const keywordScore = calculateKeywordScore(resumeText, jdText);

      // 2. AI Analysis (60%)
      const prompt = `
        ACT AS A STRICT TECHNICAL RECRUITER.
        Analyze this Resume against the Job Description.
        
        RESUME TEXT: ${resumeText.slice(0, 10000)}
        JOB DESCRIPTION: ${jdText.slice(0, 10000)}

        Output a valid JSON object strictly in this format (do not use Markdown code blocks):
        {
          "ai_score_0_to_100": number,
          "missing_skills": ["skill1", "skill2", "skill3"],
          "verdict": "A ruthless 2-sentence summary of why they fit or fail."
        }
      `;

      const aiJsonStr = await getGeminiAnalysis(prompt);
      
      // Cleanup json string if Gemini adds markdown blocks
      const cleanJson = aiJsonStr?.replace(/```json|```/g, "").trim() || "{}";
      const aiData = JSON.parse(cleanJson);

      // 3. Final Hybrid Calculation
      const finalScore = Math.round((keywordScore * 0.4) + (aiData.ai_score_0_to_100 * 0.6));

      setResult({
        score: finalScore,
        missingSkills: aiData.missing_skills || [],
        verdict: aiData.verdict || "Analysis failed.",
        keywordMatchRate: Math.round(keywordScore),
        aiRating: aiData.ai_score_0_to_100
      });

    } catch (error) {
      console.error(error);
      alert("AI Service is busy or response format error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Chat Logic ---
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !result) return;
    
    const userMsg: ChatMessage = { role: "user", text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");

    const context = `JD: ${jdText.slice(0, 1000)}... Resume: ${resumeText.slice(0, 1000)}...`;
    const response = await getChatResponse(chatHistory, userMsg.text, context);
    
    setChatHistory(prev => [...prev, { role: "model", text: response || "Error." }]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 pb-20">
      
      {/* Header */}
      <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="text-indigo-500 animate-pulse" />
            <span className="font-bold text-xl tracking-tight">SprintFit <span className="text-indigo-400">AI</span></span>
          </div>
          <div className="text-xs text-slate-400 font-mono border border-slate-800 px-2 py-1 rounded">
            v1.0.4 // HACKATHON_BUILD
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* LEFT COLUMN: Upload & Results (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Upload Zone */}
          <div className="grid md:grid-cols-2 gap-4">
            <UploadCard 
              title="Upload Resume (PDF)" 
              active={!!resumeText} 
              onUpload={(e) => handleFileUpload(e, "resume")} 
            />
            <UploadCard 
              title="Upload JD (PDF)" 
              active={!!jdText} 
              onUpload={(e) => handleFileUpload(e, "jd")} 
            />
          </div>

          {/* Action Button */}
          <div className="flex justify-center py-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!resumeText || !jdText || loading}
              onClick={analyzeProfile}
              className={`px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-500/20 transition-all ${
                resumeText && jdText 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {loading ? "Crunching Data..." : "Run Compatibility Check"}
            </motion.button>
          </div>

          {/* Results Dashboard */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-glass border border-white/10 rounded-2xl p-8 relative overflow-hidden shadow-2xl"
              >
                {/* Decorative blob */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

                <div className="grid md:grid-cols-3 gap-8 items-center relative z-10">
                  {/* Score Circle */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                        <circle 
                          cx="80" cy="80" r="70" 
                          stroke={result.score > 70 ? "#10b981" : result.score > 40 ? "#f59e0b" : "#ef4444"} 
                          strokeWidth="10" 
                          fill="transparent"
                          strokeDasharray={440}
                          strokeDashoffset={440 - (440 * result.score) / 100}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <span className="absolute text-4xl font-black">{result.score}%</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400 text-center">Hybrid Score</p>
                    <div className="text-xs text-slate-500 mt-1 flex gap-2">
                      <span>Keywords: {result.keywordMatchRate}%</span>
                    </div>
                  </div>

                  {/* Verdict & Skills */}
                  <div className="md:col-span-2 space-y-6">
                    <div>
                      <h3 className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                        <Briefcase size={18} /> AI Recruiter Verdict
                      </h3>
                      <p className="text-lg leading-relaxed text-slate-200 italic border-l-4 border-indigo-500 pl-4 bg-slate-900/30 py-2 rounded-r">
                        "{result.verdict}"
                      </p>
                    </div>

                    <div>
                      <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                        <AlertCircle size={18} /> Missing Skills
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {result.missingSkills.map((skill, idx) => (
                          <span key={idx} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-300 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: Chatbot (4 cols) */}
        <div className="lg:col-span-4 flex flex-col h-[600px]">
          <div className="flex-1 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-indigo-900/20 border-b border-white/5 flex justify-between items-center">
              <span className="font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Interviewer Bot
              </span>
            </div>
            
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center text-slate-500 mt-10 text-sm">
                  <p>Upload files to start.</p>
                  <p className="mt-2 text-xs">Try: "What are the red flags?"</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "user" 
                      ? "bg-indigo-600 text-white rounded-br-none" 
                      : "bg-slate-800 text-slate-300 rounded-bl-none border border-slate-700"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-slate-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  disabled={!result}
                  placeholder={result ? "Ask about the JD..." : "Analyze first..."}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button 
                  onClick={sendChatMessage}
                  disabled={!result}
                  className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Constraint */}
      <footer className="mt-12 py-6 border-t border-white/5 text-center">
        <p className="text-slate-500 text-sm font-medium">
          Built for the 4th Year Sprint — Optimizing the Day-Scholar's Journey.
        </p>
      </footer>
    </div>
  );
}

// Helper Component for Upload
function UploadCard({ title, active, onUpload }: { title: string, active: boolean, onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className={`relative group h-40 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-4 ${
      active ? "border-green-500/50 bg-green-500/5" : "border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5"
    }`}>
      <input 
        type="file" 
        accept="application/pdf" 
        onChange={onUpload} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
      />
      
      {active ? (
        <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
      ) : (
        <FileText className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 mb-2 transition-colors" />
      )}
      
      <h3 className={`font-semibold ${active ? "text-green-400" : "text-slate-300"}`}>{title}</h3>
      <p className="text-xs text-slate-500 mt-1">{active ? "Ready for analysis" : "Drag & drop or click"}</p>
    </div>
  );
}