# SprintFit AI 🚀

**An Intelligent ATS Analysis & Interview Preparation Agent.**

[**View Live Demo**](https://sprint-four.vercel.app/)

![Project Banner](https://img.shields.io/badge/Status-Live-success) ![Tech](https://img.shields.io/badge/Built_With-Next.js_16_%7C_Gemini_AI-blueviolet)

## 📖 About The Project

**SprintFit AI** is a modern Next.js application designed to bridge the gap between job seekers and Applicant Tracking Systems (ATS). Leveraging Google's **Gemini AI**, it parses Resumes and Job Descriptions (JDs) to provide a "ruthless," data-driven analysis of candidate fit.

Unlike standard keyword matchers, SprintFit AI uses semantic understanding to score candidates, identify missing skills, and even acts as an **AI Recruiter** to discuss the results via an interactive chat interface.

### ✨ Key Features

* **🧠 Three Analysis Modes:**
    * **1v1:** Deep dive comparison between a single Resume and a Job Description.
    * **Bulk CV (Recruiter Mode):** Upload multiple resumes to screen candidates against one JD. Generates a ranked leaderboard.
    * **Bulk JD (Job Seeker Mode):** Match one resume against multiple job openings to find the best role.
* **📊 Smart Scoring Engine:**
    * Combines traditional **Keyword Matching** (40%) with **AI Semantic Analysis** (60%).
    * Provides a **0-100 Score**, a "Ruthless Verdict," and a list of **Missing Skills**.
* **💬 Interactive Interviewer Bot:**
    * Chat with a "Senior Silicon Valley Recruiter" persona.
    * Context-aware: The bot knows the content of the specific resume and JD you selected.
    * Ask for gap analysis, interview questions, or resume improvement tips.
* **⚡ Client-Side PDF Processing:**
    * Extracts text from PDFs entirely in the browser using `pdfjs-dist` for privacy and speed.
* **🎨 Modern UI/UX:**
    * Built with **Tailwind CSS v4** and **Framer Motion** for smooth transitions and a glassmorphism aesthetic.

---

## 🛠️ Tech Stack

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **AI Model:** [Google Gemini](https://ai.google.dev/) (via `@google/generative-ai`)
    * *Currently configured to use `gemini-2.5-flash-lite` / `gemini-1.5-flash`*
* **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) & Lucide React Icons
* **Animations:** [Framer Motion](https://www.framer.com/motion/)
* **PDF Parsing:** [PDF.js](https://mozilla.github.io/pdf.js/)

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
* Node.js (v18 or higher recommended)
* npm, yarn, or pnpm
* A Google Gemini API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/nitishkrishna-g/sprintfour.git](https://github.com/nitishkrishna-g/sprintfour.git)
    cd sprintfour
    ```

2.  **Install dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Environment Setup (Optional)**
    * The application allows users to input their API Key directly in the UI.
    * For local development, you can create a `.env.local` file to pre-load your key:
    ```env
    NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💡 How to Use

1.  **Enter API Key:**
    * Click the Key icon in the top-right corner and paste your Gemini API Key.
2.  **Select Mode:**
    * Toggle between **1v1**, **Bulk CV**, or **Bulk JD** using the top navigation bar.
3.  **Upload Files:**
    * Drag & Drop PDF files into the respective "Resume" and "JD" boxes.
4.  **Run Analysis:**
    * Click the **"Run Analysis"** button. The AI will process the text and generate scores.
5.  **View Results:**
    * **Single Mode:** See the detailed scorecard immediately.
    * **Bulk Mode:** Click on any item in the **Leaderboard** to view its specific details.
6.  **Chat with the Bot:**
    * Use the chat window on the right to ask questions like: *"Why did I get a low score?"* or *"Ask me a technical question based on this JD."*

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built by Nitish Krishna
</p>