"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type ScanMode = "General" | "Ingredients" | "Hazards" | "Study" | "Translate";

type Difficulty = "Explain like I'm 5" | "Student" | "Expert";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("Student");
  const [scanMode, setScanMode] = useState<ScanMode>("General");
  const [isExplaining, setIsExplaining] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Prevent speech synthesis from stopping prematurely on long texts
  // (Browser bug workaround)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExplaining) {
      interval = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isExplaining]);

  // Initialize Camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        setError("Camera access denied or unavailable. Please allow camera permissions.");
      }
    }
    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const addMessage = (role: "user" | "ai", content: string) => {
    setChatHistory((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), role, content, timestamp: new Date() },
    ]);
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    
    // Clean up markdown asterisks for speech
    const cleanText = text.replace(/\*/g, '').replace(/_/g, '').replace(/#/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) || voices[0];
    if (voice) utterance.voice = voice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  };

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const handleExplain = async (customQuestion?: string) => {
    if (isExplaining) return;
    
    const frameBase64 = captureFrame();
    if (!frameBase64) {
      setError("Failed to capture image from camera.");
      return;
    }

    setIsExplaining(true);
    setError(null);
    
    const questionText = customQuestion || "Explain what you see.";
    addMessage("user", `📸 Captured image. ${customQuestion ? `Asked: "${customQuestion}"` : ""}`);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: frameBase64,
          question: questionText,
          difficulty,
          scanMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get explanation");
      }

      addMessage("ai", data.text);
      speakText(data.text);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      addMessage("ai", `Error: ${err.message}`);
    } finally {
      setIsExplaining(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        handleExplain(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error !== "no-speech") {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-gray-50 font-sans overflow-hidden">
      
      {/* Left Panel: Conversation History */}
      <div className="flex flex-col w-full md:w-96 border-r border-purple-500/30 bg-gradient-to-b from-gray-900 to-gray-800 h-1/2 md:h-full shrink-0 shadow-2xl">
        <div className="p-4 border-b border-purple-500/30 flex items-center justify-between shadow-sm z-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-lg">
          <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent animate-pulse">✨ Explain Anything ✨</h1>
          <div className="text-sm text-purple-200">AI-Powered Vision</div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-gradient-to-b from-transparent to-purple-900/10">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-bounce">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="text-lg font-semibold text-purple-300">Ready to Explore!</p>
              <p className="text-sm text-center text-gray-500">Point your camera at something and tap Explain, or ask a question with voice! 🎉</p>
            </div>
          ) : (
            chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-lg transform hover:scale-105 transition-transform ${
                  msg.role === "user" 
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-tr-sm shadow-blue-500/50" 
                    : "bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200 rounded-tl-sm border border-purple-500/30 shadow-purple-500/20"
                }`}>
                  {msg.role === "ai" && (
                    <div className="font-semibold text-xs text-purple-300 mb-1 flex items-center gap-1.5">
                      <span className="text-yellow-400">🤖</span> AI Assistant
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isExplaining && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 py-3 px-5 rounded-2xl rounded-tl-sm border border-purple-500/30 w-fit flex gap-1 items-center shadow-lg">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                <span className="ml-2 text-purple-300 text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Right Panel: Camera & Controls */}
      <div className="flex-1 flex flex-col relative h-1/2 md:h-full bg-gradient-to-br from-black via-purple-900/20 to-blue-900/20">
        
        {/* Error Banner */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-gradient-to-r from-red-600 to-pink-600 border border-red-400 text-red-100 px-4 py-3 rounded-xl shadow-lg flex justify-between items-center backdrop-blur-md transition-all animate-fade-in">
            <span className="text-sm font-medium">⚠️ {error}</span>
            <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100 p-1 hover:bg-red-500/20 rounded">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Camera Feed Container */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {!stream && !error && (
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-purple-900 to-blue-900 z-10 rounded-lg">
               <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-purple-300 font-medium text-lg">🌟 Accessing Camera...</p>
             </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-none md:rounded-l-3xl shadow-2xl transition-transform duration-700 hover:scale-105"
          />
          {/* Hidden Canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Difficulty Switcher Overlay */}
          <div className="absolute top-4 right-4 z-20 flex bg-gradient-to-r from-gray-900/90 to-purple-900/90 backdrop-blur-md p-1 rounded-full border border-purple-500/50 shadow-xl overflow-x-auto max-w-[calc(100vw-2rem)] hide-scrollbar animate-fade-in">
            {(["Explain like I'm 5", "Student", "Expert"] as Difficulty[]).map((level) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 transform hover:scale-110 ${
                  difficulty === level
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 shadow-md text-white scale-105"
                    : "text-gray-300 hover:text-white scale-95 hover:scale-100 hover:bg-gradient-to-r hover:from-purple-600/50 hover:to-blue-600/50"
                }`}
              >
                {level === "Explain like I'm 5" ? "ELI5" : level}
              </button>
            ))}
          </div>

          {/* Scan Mode Selector */}
          <div className="absolute top-16 right-4 z-20 flex bg-gradient-to-r from-gray-900/90 to-purple-900/90 backdrop-blur-md p-1 rounded-full border border-purple-500/50 shadow-xl overflow-x-auto max-w-[calc(100vw-2rem)] hide-scrollbar">
            {(["General", "Ingredients", "Hazards", "Study", "Translate"] as ScanMode[]).map((mode) => {
              const icons: Record<ScanMode, string> = {
                General: "🔍",
                Ingredients: "🥗",
                Hazards: "⚠️",
                Study: "📚",
                Translate: "🌐",
              };
              return (
                <button
                  key={mode}
                  onClick={() => setScanMode(mode)}
                  className={`px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 transform hover:scale-110 ${
                    scanMode === mode
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 shadow-md text-white scale-105"
                      : "text-gray-300 hover:text-white scale-95"
                  }`}
                >
                  {icons[mode]} {mode}
                </button>
              );
            })}
          </div>

          {/* Overlay scanning effect during thinking */}
          {isExplaining && (
            <div className="absolute inset-0 z-30 pointer-events-none w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 mix-blend-screen animate-pulse">
              <div className="absolute w-full h-[3px] bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 shadow-[0_0_20px_rgba(147,51,234,1)] animate-scan rounded-full"></div>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="absolute bottom-8 w-full z-40 px-6">
            <div className="max-w-md mx-auto flex items-center justify-center gap-6">
              
              {/* Voice Input Button */}
              <button
                onClick={startVoiceInput}
                disabled={isExplaining || isListening}
                className={`relative group flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 transform hover:scale-110 ${
                  isListening 
                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse" 
                  : "bg-gradient-to-r from-gray-800/90 to-purple-800/90 backdrop-blur-xl border border-purple-500/50 text-gray-300 hover:text-white shadow-xl hover:shadow-purple-500/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Ask a question"
              >
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-125 -z-10 bg-gradient-to-r from-purple-500/20 to-blue-500/20"></div>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {isListening && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></span>}
              </button>

              {/* Main Capture Button */}
              <button
                onClick={() => handleExplain()}
                disabled={isExplaining || isListening}
                className={`relative flex items-center justify-center h-24 w-24 rounded-full border-4 border-white/30 p-1 transition-all duration-300 transform hover:scale-110 ${
                  isExplaining ? "opacity-50 scale-95" : "hover:border-white/50 hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(0,0,0,0.7)]"
                }`}
                aria-label="Capture and Explain"
              >
                <div className={`w-full h-full rounded-full transition-colors duration-300 ${
                  isExplaining ? "bg-gradient-to-r from-purple-600 to-blue-600" : "bg-white hover:bg-gradient-to-r hover:from-purple-200 hover:to-blue-200"
                }`}></div>
                
                <span className="absolute -bottom-10 text-sm font-bold tracking-widest text-white/90 uppercase shadow-black drop-shadow-lg">
                  🚀 Explain
                </span>
              </button>

            </div>
          </div>

        </div>
      </div>
{/* 
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} /> */}
    </div>
  );
}
