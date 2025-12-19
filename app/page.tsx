"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle, AlertCircle, Send, Cpu, Briefcase, Users, Layers, Layout, Key } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getGeminiAnalysis, getChatResponse } from "@/lib/gemini";

// --- Types ---
type Mode = "single" | "many-resumes" | "many-jds";

type FileData = {
  id: string;
  name: string;
  text: string;
};

type AnalysisResult = {
  id: string;
  name: string;
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
  const [mode, setMode] = useState<Mode>("single");
  const [userApiKey, setUserApiKey] = useState(""); 
  const [showApiKeyAlert, setShowApiKeyAlert] = useState(false); // New State for Alert
  
  const [resumes, setResumes] = useState<FileData[]>([]);
  const [jds, setJds] = useState<FileData[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null); 
  
  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Reset when mode changes ---
  useEffect(() => {
    setResumes([]);
    setJds([]);
    setResults([]);
    setChatHistory([]);
    setSelectedResultId(null);
  }, [mode]);

  // --- PDF Extraction Logic ---
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: FileData[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await extractTextFromPDF(file);
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          text: text
        });
      } catch (err) {
        console.error(`Failed to parse ${file.name}`);
      }
    }

    if (type === "resume") {
      setResumes(prev => mode === "single" || mode === "many-jds" ? newFiles : [...prev, ...newFiles]);
    } else {
      setJds(prev => mode === "single" || mode === "many-resumes" ? newFiles : [...prev, ...newFiles]);
    }
  };

  // --- Core Analysis Logic ---
  const analyzePair = async (resume: FileData, jd: FileData): Promise<AnalysisResult> => {
    if (resume.text.trim() === jd.text.trim()) {
       const isBatchResumes = mode === "many-resumes";
       return {
        id: isBatchResumes ? resume.id : jd.id,
        name: isBatchResumes ? resume.name : jd.name,
        score: 0, 
        missingSkills: ["Identical Files Detected"],
        verdict: "Error: You likely uploaded the JD in the Resume slot.",
        keywordMatchRate: 100, 
        aiRating: 0
      };
    }

    const clean = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
    const resumeTokens = new Set(clean(resume.text));
    const jdTokens = clean(jd.text).filter(t => t.length > 3);
    
    let keywordScore = 0;
    if (jdTokens.length > 0) {
      const matches = jdTokens.filter(token => resumeTokens.has(token));
      keywordScore = Math.min((matches.length / jdTokens.length) * 100 * 1.5, 100);
    }

    const prompt = `
      ACT AS AN ATS MATCHING SYSTEM.
      Analyze this Resume against the Job Description.
      Ignore formatting issues. Solely evaluate if the Resume contains the skills and experience requested in the JD.
      
      RESUME: ${resume.text.slice(0, 8000)}
      JD: ${jd.text.slice(0, 8000)}

      Output a valid JSON object strictly in this format:
      {
        "ai_score_0_to_100": number,
        "missing_skills": ["skill1", "skill2"],
        "verdict": "One ruthless sentence summary."
      }
    `;

    try {
      const aiJsonStr = await getGeminiAnalysis(prompt, userApiKey);
      const cleanJson = aiJsonStr?.replace(/```json|```/g, "").trim() || "{}";
      const aiData = JSON.parse(cleanJson);
      
      const aiScore = typeof aiData.ai_score_0_to_100 === 'number' ? aiData.ai_score_0_to_100 : 0;
      const finalScore = Math.round((keywordScore * 0.4) + (aiScore * 0.6));

      const isBatchResumes = mode === "many-resumes";
      
      return {
        id: isBatchResumes ? resume.id : jd.id,
        name: isBatchResumes ? resume.name : jd.name,
        score: finalScore,
        missingSkills: aiData.missing_skills || [],
        verdict: aiData.verdict || "Analysis failed.",
        keywordMatchRate: Math.round(keywordScore),
        aiRating: aiScore
      };
    } catch (e) {
      return {
        id: mode === "many-resumes" ? resume.id : jd.id,
        name: mode === "many-resumes" ? resume.name : jd.name,
        score: 0,
        missingSkills: ["Error"],
        verdict: "Failed to analyze (Check API Key).",
        keywordMatchRate: 0,
        aiRating: 0
      };
    }
  };

  const runAnalysis = async () => {
    // --- INTEGRATION: Check API Key ---
    const hasKey = userApiKey.trim() !== "" || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!hasKey) {
      setShowApiKeyAlert(true);
      return;
    }
    // ----------------------------------

    if (resumes.length === 0 || jds.length === 0) return;
    setLoading(true);
    setResults([]);

    try {
      const batchResults: AnalysisResult[] = [];

      if (mode === "single") {
        const result = await analyzePair(resumes[0], jds[0]);
        batchResults.push(result);
      } 
      else if (mode === "many-resumes") {
        for (const resume of resumes) {
          const result = await analyzePair(resume, jds[0]);
          batchResults.push(result);
        }
      } 
      else if (mode === "many-jds") {
        for (const jd of jds) {
          const result = await analyzePair(resumes[0], jd);
          batchResults.push(result);
        }
      }

      batchResults.sort((a, b) => b.score - a.score);
      setResults(batchResults);
      
      if (batchResults.length > 0) {
        setSelectedResultId(batchResults[0].id);
      }

    } catch (error) {
      console.error(error);
      alert("Analysis interrupted.");
    } finally {
      setLoading(false);
    }
  };

  // --- Chat Logic ---
  const sendChatMessage = async () => {
    // --- INTEGRATION: Check API Key ---
    const hasKey = userApiKey.trim() !== "" || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!hasKey) {
      setShowApiKeyAlert(true);
      return;
    }
    // ----------------------------------

    if (!chatInput.trim() || results.length === 0) return;
    
    let context = "";
    if (mode === "single") {
      context = `Resume: ${resumes[0].text.slice(0, 1000)}... JD: ${jds[0].text.slice(0, 1000)}...`;
    } else {
      if (mode === "many-resumes") {
        const resume = resumes.find(r => r.id === selectedResultId);
        context = `Focused Resume: ${resume?.name}. Content: ${resume?.text.slice(0, 1000)}... Target JD: ${jds[0].text.slice(0, 1000)}...`;
      } else {
        const jd = jds.find(j => j.id === selectedResultId);
        context = `Candidate Resume: ${resumes[0].text.slice(0, 1000)}... Target JD: ${jd?.name}. Content: ${jd?.text.slice(0, 1000)}...`;
      }
    }
    
    const userMsg: ChatMessage = { role: "user", text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");

    const response = await getChatResponse(chatHistory, userMsg.text, context, userApiKey);
    setChatHistory(prev => [...prev, { role: "model", text: response || "Error." }]);
  };

  // FIX 1: Prevent page jump on refresh. Only scroll if history exists.
  useEffect(() => {
    if (chatHistory.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chatHistory]);

  const getActiveResult = () => {
    if (mode === "single") return results[0];
    return results.find(r => r.id === selectedResultId) || results[0];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 pb-20">
      
      {/* FIX 2: REORGANIZED NAVBAR */}
      <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Left: Logo */}
          <div className="flex items-center gap-2 shrink-0 w-1/4">
            <Cpu className="text-indigo-500 animate-pulse" />
            <span className="font-bold text-xl tracking-tight hidden sm:inline">SprintFit <span className="text-indigo-400">AI</span></span>
          </div>
          
          {/* Center: Mode Switcher */}
          <div className="flex justify-center flex-1">
            <div className="flex bg-slate-900/80 p-1 rounded-full border border-slate-800">
              <button 
                onClick={() => setMode("single")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "single" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" : "text-slate-400 hover:text-white"}`}
              >
                1v1
              </button>
              <button 
                onClick={() => setMode("many-resumes")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "many-resumes" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" : "text-slate-400 hover:text-white"}`}
              >
                Bulk CV
              </button>
              <button 
                onClick={() => setMode("many-jds")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "many-jds" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25" : "text-slate-400 hover:text-white"}`}
              >
                Bulk JD
              </button>
            </div>
          </div>

          {/* Right: API Key */}
          <div className="flex justify-end w-1/4">
            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800 focus-within:border-indigo-500/50 transition-colors">
              <Key size={14} className="text-slate-400" />
              <input
                id="api-key-input" // --- INTEGRATION: Added ID ---
                type="password"
                placeholder="Gemini API Key"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-xs text-white w-24 sm:w-32 placeholder:text-slate-600"
              />
            </div>
          </div>

        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
        
        {/* LEFT COLUMN: Upload & Results (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Upload Zone */}
          <div className="grid md:grid-cols-2 gap-4">
            <UploadCard 
              title={mode === "many-resumes" ? "Upload Resumes (Multiple)" : "Upload Resume (PDF)"}
              count={resumes.length}
              multiple={mode === "many-resumes"}
              onUpload={(e) => handleFileUpload(e, "resume")} 
            />
            <UploadCard 
              title={mode === "many-jds" ? "Upload JDs (Multiple)" : "Upload JD (PDF)"}
              count={jds.length}
              multiple={mode === "many-jds"}
              onUpload={(e) => handleFileUpload(e, "jd")} 
            />
          </div>

          <div className="flex justify-center py-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={resumes.length === 0 || jds.length === 0 || loading}
              onClick={runAnalysis}
              className={`px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-500/20 transition-all ${
                resumes.length > 0 && jds.length > 0
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {loading ? `Analyzing ${mode === 'single' ? 'Pair' : 'Batch'}...` : "Run Analysis"}
            </motion.button>
          </div>

          {/* Results View */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                
                {/* Active Result Card */}
                <div className="bg-glass border border-white/10 rounded-2xl p-8 relative overflow-hidden shadow-2xl mb-6">
                  <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
                  
                  {getActiveResult() && (
                    <div className="grid md:grid-cols-3 gap-8 items-center relative z-10">
                      <div className="flex flex-col items-center justify-center">
                        <div className="relative w-40 h-40 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="80" cy="80" r="70" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                            <circle 
                              cx="80" cy="80" r="70" 
                              stroke={getActiveResult().score > 70 ? "#10b981" : getActiveResult().score > 40 ? "#f59e0b" : "#ef4444"} 
                              strokeWidth="10" 
                              fill="transparent"
                              strokeDasharray={440}
                              strokeDashoffset={440 - (440 * getActiveResult().score) / 100}
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <span className="absolute text-4xl font-black">{getActiveResult().score}%</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400 text-center font-bold max-w-37.5 truncate">{getActiveResult().name}</p>
                      </div>

                      <div className="md:col-span-2 space-y-6">
                        <div>
                          <h3 className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                            <Briefcase size={18} /> Verdict
                          </h3>
                          <p className="text-lg leading-relaxed text-slate-200 italic border-l-4 border-indigo-500 pl-4 bg-slate-900/30 py-2 rounded-r">
                            "{getActiveResult().verdict}"
                          </p>
                        </div>
                        <div>
                          <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                            <AlertCircle size={18} /> Missing Skills
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {getActiveResult().missingSkills.map((skill, idx) => (
                              <span key={idx} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-300 rounded-full text-sm">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Batch Leaderboard */}
                {mode !== "single" && (
                  <div className="bg-slate-900/50 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-slate-800/50 font-bold text-slate-300">
                      Leaderboard ({results.length} processed)
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {results.map((r, i) => (
                        <div 
                          key={r.id}
                          onClick={() => {
                            setSelectedResultId(r.id);
                            setChatHistory([]); 
                          }}
                          className={`flex items-center justify-between p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedResultId === r.id ? "bg-indigo-500/10 border-l-4 border-l-indigo-500" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-slate-500 text-sm">#{i + 1}</span>
                            <div>
                              <p className="font-semibold text-white truncate max-w-50">{r.name}</p>
                              <p className="text-xs text-slate-400">Match: {r.verdict.slice(0, 50)}...</p>
                            </div>
                          </div>
                          <span className={`font-bold text-lg ${r.score > 70 ? "text-green-400" : r.score > 40 ? "text-amber-400" : "text-red-400"}`}>
                            {r.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FIX 3: CHATBOT HEIGHT & POSITION */}
        <div className="lg:col-span-4 flex flex-col h-[500px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24">
          <div className="flex-1 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-indigo-900/20 border-b border-white/5">
              <span className="font-semibold flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Interviewer Bot
              </span>
              {mode !== "single" && results.length > 0 && (
                <p className="text-xs text-indigo-300 mt-1 truncate">
                  Context: <span className="font-bold">{getActiveResult()?.name || "Select an item"}</span>
                </p>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.length === 0 && (
                <div className="text-center text-slate-500 mt-10 text-sm">
                  <p>Upload & Analyze to start.</p>
                  <p className="mt-2 text-xs">I can discuss the currently selected result.</p>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user" 
                      ? "bg-indigo-600 text-white rounded-br-none" 
                      : "bg-slate-800 text-slate-300 rounded-bl-none border border-slate-700"
                  }`}>
                    {msg.role === "model" ? (
                      <ReactMarkdown 
                        components={{
                            strong: ({node, ...props}) => <span className="font-bold text-indigo-400" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-4 space-y-2 mt-2" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1" {...props} />,
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    ) : msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-white/5 bg-slate-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  disabled={results.length === 0}
                  placeholder={results.length > 0 ? "Ask about this result..." : "Waiting..."}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button 
                  onClick={sendChatMessage}
                  disabled={results.length === 0}
                  className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- INTEGRATION: API KEY WARNING MODAL --- */}
      <AnimatePresence>
        {showApiKeyAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowApiKeyAlert(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                  <Key className="w-8 h-8 text-red-500" />
                </div>
                
                <h3 className="text-2xl font-bold text-white">API Key Required</h3>
                
                <p className="text-slate-400 text-sm leading-relaxed">
                  To analyze resumes and chat with the AI, you need a Google Gemini API Key.
                </p>

                <div className="bg-slate-800/50 rounded-lg p-3 w-full text-xs text-slate-500 border border-slate-700/50">
                  <p>1. Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-400 hover:underline">Google AI Studio</a></p>
                  <p className="mt-1">2. Paste it in the top-right input box.</p>
                </div>

                <div className="flex gap-3 w-full mt-4">
                  <button
                    onClick={() => setShowApiKeyAlert(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowApiKeyAlert(false);
                      document.getElementById('api-key-input')?.focus();
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors text-sm font-medium"
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Helper Component for Upload
function UploadCard({ title, count, multiple, onUpload }: { title: string, count: number, multiple: boolean, onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className={`relative group h-40 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-4 ${
      count > 0 ? "border-green-500/50 bg-green-500/5" : "border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5"
    }`}>
      <input 
        type="file" 
        accept="application/pdf" 
        multiple={multiple}
        onChange={onUpload} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
      />
      
      {count > 0 ? (
        <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
      ) : (
        <FileText className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 mb-2 transition-colors" />
      )}
      
      <h3 className={`font-semibold ${count > 0 ? "text-green-400" : "text-slate-300"}`}>{title}</h3>
      <p className="text-xs text-slate-500 mt-1">{count > 0 ? `${count} file(s) selected` : multiple ? "Drag & drop multiple files" : "Drag & drop single PDF"}</p>
    </div>
  );
}