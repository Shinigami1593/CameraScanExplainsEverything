"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
    <div className="flex flex-col md:flex-row h-screen bg-gray-950 text-gray-50 font-sans overflow-hidden">
      
      {/* Left Panel: Conversation History */}
      <div className="flex flex-col w-full md:w-96 border-r border-gray-800 bg-gray-900 h-1/2 md:h-full shrink-0">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between shadow-sm z-10">
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Explain Anything</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
              <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <p>Conversation empty</p>
              <p className="text-sm text-center">Point the camera and tap Explain or ask a question.</p>
            </div>
          ) : (
            chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                  msg.role === "user" 
                    ? "bg-indigo-600 text-white rounded-tr-sm" 
                    : "bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700"
                }`}>
                  {msg.role === "ai" && (
                    <div className="font-semibold text-xs text-indigo-400 mb-1 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isExplaining && (
            <div className="flex justify-start">
              <div className="bg-gray-800 py-3 px-5 rounded-2xl rounded-tl-sm border border-gray-700 w-fit flex gap-1 items-center shadow-md">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0.4s" }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Right Panel: Camera & Controls */}
      <div className="flex-1 flex flex-col relative h-1/2 md:h-full bg-black">
        
        {/* Error Banner */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-red-900/90 border border-red-500 text-red-100 px-4 py-3 rounded-xl shadow-lg flex justify-between items-center backdrop-blur-md transition-all">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Camera Feed Container */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {!stream && !error && (
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900 z-10">
               <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-indigo-400 font-medium">Accessing Camera...</p>
             </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-none md:rounded-l-3xl shadow-2xl transition-transform duration-700"
          />
          {/* Hidden Canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Difficulty Switcher Overlay */}
          <div className="absolute top-4 right-4 z-20 flex bg-gray-900/80 backdrop-blur-md p-1 rounded-full border border-gray-700/50 shadow-xl overflow-x-auto max-w-[calc(100vw-2rem)] hide-scrollbar">
            {(["Explain like I'm 5", "Student", "Expert"] as Difficulty[]).map((level) => (
              <button
                key={level}
                onClick={() => setDifficulty(level)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                  difficulty === level
                    ? "bg-indigo-600 shadow-md text-white scale-100"
                    : "text-gray-400 hover:text-gray-200 scale-95 hover:scale-100 hover:bg-gray-800/80"
                }`}
              >
                {level === "Explain like I'm 5" ? "ELI5" : level}
              </button>
            ))}
          </div>

          {/* Overlay scanning effect during thinking */}
          {isExplaining && (
            <div className="absolute inset-0 z-30 pointer-events-none w-full h-full bg-indigo-500/10 mix-blend-screen">
              <div className="absolute w-full h-[2px] bg-indigo-400/80 shadow-[0_0_15px_rgba(99,102,241,1)] animate-scan"></div>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="absolute bottom-8 w-full z-40 px-6">
            <div className="max-w-md mx-auto flex items-center justify-center gap-6">
              
              {/* Voice Input Button */}
              <button
                onClick={startVoiceInput}
                disabled={isExplaining || isListening}
                className={`relative group flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 ${
                  isListening 
                  ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse" 
                  : "bg-gray-800/80 backdrop-blur-xl border border-gray-600/50 text-gray-300 hover:bg-gray-700 hover:text-white shadow-xl hover:shadow-indigo-500/20"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Ask a question"
              >
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-110 -z-10 bg-indigo-500/0 group-hover:bg-indigo-500/10"></div>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Main Capture Button */}
              <button
                onClick={() => handleExplain()}
                disabled={isExplaining || isListening}
                className={`relative flex items-center justify-center h-20 w-20 rounded-full border-4 border-white/20 p-1 transition-all duration-300 ${
                  isExplaining ? "opacity-50 scale-95" : "hover:border-white/40 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                }`}
                aria-label="Capture and Explain"
              >
                <div className={`w-full h-full rounded-full transition-colors duration-300 ${
                  isExplaining ? "bg-indigo-800" : "bg-white hover:bg-gray-200"
                }`}></div>
                
                <span className="absolute -bottom-8 text-xs font-semibold tracking-widest text-white/80 uppercase shadow-black drop-shadow-md">
                  Explain
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
