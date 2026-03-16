/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type ScanMode = "General" | "Study" | "Translate";
type Language = "english" | "nepali" | "hindi";
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
  const [activeSpeech, setActiveSpeech] = useState(false);
  const [language, setLanguage] = useState<"nepali" | "hindi" | "english">("english");
  const [isLiveMode, setIsLiveMode] = useState(false);
  const liveModeRef = useRef<NodeJS.Timeout | null>(null);

  //resizable panels
  const [panelWidth, setPanelWidth] = useState(384); // 384px = md:w-96 default
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  //Outfit mode states
  const [outfitOverlay, setOutfitOverlay] = useState<string | null>(null);
  const [isOutfitLoading, setIsOutfitLoading] = useState(false);
  const [outfitKeywords, setOutfitKeywords] = useState<string[]>([]);

  const [isMobile, setIsMobile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    // Clamp between 250px and 600px
    const clamped = Math.min(600, Math.max(250, newWidth));
    setPanelWidth(clamped);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Touch support for mobile
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.touches[0].clientX - containerRect.left;
    const clamped = Math.min(600, Math.max(250, newWidth));
    setPanelWidth(clamped);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // run once on mount
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove]);

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
    if (isLiveMode) {
      liveModeRef.current = setInterval(async () => {
        const frameBase64 = captureFrame();
        if (!frameBase64) return;
        try {
          const res = await fetch("/api/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: frameBase64,
              question: "Briefly describe what you see in 1-2 sentences only.",
              difficulty,
              scanMode,
              language,
              mode: "live",
              conversationHistory: [],
            }),
          });
          const data = await res.json();
          if (data.text) {
            addMessage("ai", "🔴 LIVE: " + data.text);
          }
        } catch (e) {
          console.error("Live mode error:", e);
        }
      }, 6000);
    } else {
      if (liveModeRef.current) {
        clearInterval(liveModeRef.current);
        liveModeRef.current = null;
      }
    }
    return () => {
      if (liveModeRef.current) clearInterval(liveModeRef.current);
    };
  }, [isLiveMode, language, difficulty, scanMode]);

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

  const speakText = (text: string, forceLanguage?: Language) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/\*/g, '').replace(/_/g, '').replace(/#/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetLang = forceLanguage || language;

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();

      let voice: SpeechSynthesisVoice | undefined;

      if (targetLang === "nepali") {
        voice =
          voices.find(v => v.lang === "ne-NP") ||
          voices.find(v => v.lang === "hi-IN") ||
          voices.find(v => v.lang.startsWith("hi")) ||
          voices.find(v => v.lang === "en-IN") ||
          voices.find(v => v.lang.startsWith("en"));
      } else if (targetLang === "hindi") {
        voice =
          voices.find(v => v.lang === "hi-IN") ||
          voices.find(v => v.lang.startsWith("hi")) ||
          voices.find(v => v.lang === "en-IN") ||
          voices.find(v => v.lang.startsWith("en"));
      } else {
        voice =
          voices.find(v => v.lang === "en-US") ||
          voices.find(v => v.lang.startsWith("en"));
      }

      if (!voice) voice = voices[0];

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.onstart = () => setActiveSpeech(true);
      utterance.onend = () => setActiveSpeech(false);
      utterance.onerror = (e) => {
        console.warn("Speech error:", e.error);
        setActiveSpeech(false);
      };

      window.speechSynthesis.speak(utterance);
    };

    // Voices may not be loaded yet — wait if empty
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        trySpeak();
      };
    } else {
      trySpeak();
    }
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
          language,
          mode: "explain",
          conversationHistory: chatHistory.slice(-6),
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
    recognition.lang = language === "nepali" ? "ne-NP" : language === "hindi" ? "hi-IN" : "en-US";
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

  const handleSolve = () => {
    if (isExplaining) return;
    const frameBase64 = captureFrame();
    if (!frameBase64) return;
    setIsExplaining(true);
    setError(null);
    addMessage("user", "🔢 Solve this math or code problem.");
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: frameBase64,
        question: "Solve this completely. Show every step clearly numbered.",
        difficulty,
        scanMode,
        language,
        mode: "solve",
        conversationHistory: chatHistory.slice(-6),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        addMessage("ai", data.text);
        speakText(data.text);
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsExplaining(false));
  };

  const handleTranslate = () => {
    if (isExplaining) return;
    const frameBase64 = captureFrame();
    if (!frameBase64) return;
    setIsExplaining(true);
    setError(null);
    addMessage("user", "🌐 Translate all text in this image.");
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: frameBase64,
        question: "Read all text in this image and translate it.",
        difficulty,
        scanMode,
        language,
        mode: "translate",
        conversationHistory: [],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        addMessage("ai", data.text);
        speakText(data.text);
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsExplaining(false));
  };

  //Image Google links
  const extractClothingKeywords = (text: string): string[] => {
  const keywords: string[] = [];

  // Extract items from "Detected:" line
  const detectedMatch = text.match(/Detected:\s*([^\n]+)/i);
    if (detectedMatch) {
      const items = detectedMatch[1].split(",").map(s => s.trim()).filter(Boolean);
      keywords.push(...items);
    }

    // Extract items from "Pieces:" lines
    const piecesMatches = text.matchAll(/Pieces:\s*([^\n]+)/gi);
    for (const match of piecesMatches) {
      const items = match[1].split(",").map(s => s.trim()).filter(Boolean);
      keywords.push(...items);
    }

    // Deduplicate and limit to 8 keywords
    return [...new Set(keywords)].slice(0, 8);
  };

  const openGoogleImages = (keyword: string) => {
    const query = encodeURIComponent(`${keyword} outfit fashion style`);
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
  };

  //Outfit
  const handleOutfit = async () => {
    if (isExplaining || isOutfitLoading) return;

    const frameBase64 = captureFrame();
    if (!frameBase64) {
      setError("Failed to capture image from camera.");
      return;
    }

    setIsOutfitLoading(true);
    setOutfitOverlay(null);
    setOutfitKeywords([]);
    setError(null);

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: frameBase64,
          question: "Analyze the clothing and suggest outfits.",
          difficulty,
          scanMode,
          language,
          mode: "outfit",
          conversationHistory: [],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to analyze outfit");

      // Extract keywords from the response
      const keywords = extractClothingKeywords(data.text);

      setOutfitOverlay(data.text);
      setOutfitKeywords(keywords);
      addMessage("ai", data.text);
      speakText(data.text);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsOutfitLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-gray-50 font-sans overflow-hidden">

      {/* Left Panel: Conversation History */}
      <div
        className="flex flex-col border-r border-purple-500/30 bg-gradient-to-b from-gray-900 to-gray-800 shrink-0 shadow-2xl"
        style={{
          width: isMobile ? "100%" : `${panelWidth}px`,
          height: isMobile ? "50%" : "100%",
        }}
      >
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
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-lg transform hover:scale-105 transition-transform ${msg.role === "user"
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
          {/* Outfit Overlay — appears on top of the live video */}
          {outfitOverlay && (
            <div className="absolute inset-0 z-35 flex items-end justify-center pb-32 px-4 pointer-events-none">
              <div className="pointer-events-auto w-full max-w-sm bg-black/80 backdrop-blur-md border border-purple-500/50 rounded-2xl p-4 shadow-2xl animate-fade-in">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👗</span>
                    <span className="text-sm font-bold text-purple-300">Style Suggestions</span>
                  </div>
                  <button
                    onClick={() => { setOutfitOverlay(null); setOutfitKeywords([]); }}
                    className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Suggestion Text */}
                <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap mb-3">
                  {outfitOverlay}
                </p>

                {/* Google Images Pills */}
                {outfitKeywords.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-purple-400 font-semibold mb-2">
                      🔍 Tap to see outfit visuals on Google Images:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {outfitKeywords.map((keyword, index) => (
                        <button
                          key={index}
                          onClick={() => openGoogleImages(keyword)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600/70 to-pink-600/70 border border-purple-400/50 text-white text-xs font-medium hover:from-purple-500 hover:to-pink-500 hover:scale-105 transition-all shadow-md"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          {keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Outfit Search Button */}
                <button
                  onClick={() => {
                    const fullQuery = outfitKeywords.slice(0, 3).join(" ");
                    openGoogleImages(fullQuery + " complete outfit");
                  }}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600/70 to-purple-600/70 border border-blue-400/50 text-white text-xs font-bold hover:opacity-90 transition-opacity mb-2 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  See Full Outfit Inspiration
                </button>

                {/* Scan Again */}
                <button
                  onClick={() => { setOutfitOverlay(null); setOutfitKeywords([]); handleOutfit(); }}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  👗 Scan Again
                </button>

              </div>
            </div>
          )}

          {/* Loading shimmer while outfit is being analyzed */}
          {isOutfitLoading && (
            <div className="absolute inset-0 z-35 flex items-end justify-center pb-32 px-4 pointer-events-none">
              <div className="w-full max-w-sm bg-black/80 backdrop-blur-md border border-purple-500/50 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-lg">👗</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                  </div>
                  <span className="text-xs text-purple-300 font-semibold">Analyzing your style...</span>
                </div>
              </div>
            </div>
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

      {/* Draggable Divider */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        className="hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center group relative z-50"
        style={{ background: "transparent" }}
      >
        {/* Visual track */}
        <div className="absolute inset-y-0 w-px bg-purple-500/30 group-hover:bg-purple-400/60 transition-colors duration-150" />

        {/* Drag handle pill — visible on hover */}
        <div className="relative z-10 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="w-1 h-8 rounded-full bg-purple-400/80 shadow-lg" />
          <div className="flex flex-col gap-0.5">
            <div className="w-3 h-0.5 rounded-full bg-purple-300/60" />
            <div className="w-3 h-0.5 rounded-full bg-purple-300/60" />
            <div className="w-3 h-0.5 rounded-full bg-purple-300/60" />
          </div>
          <div className="w-1 h-8 rounded-full bg-purple-400/80 shadow-lg" />
        </div>
      </div>

      {/* Right Panel: Camera & Controls */}
      <div className="flex-1 flex flex-col relative h-1/2 md:h-full bg-gradient-to-br from-black via-purple-900/20 to-blue-900/20 min-w-0">

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
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 transform hover:scale-110 ${difficulty === level
                  ? "bg-gradient-to-r from-purple-500 to-blue-500 shadow-md text-white scale-105"
                  : "text-gray-300 hover:text-white scale-95 hover:scale-100 hover:bg-gradient-to-r hover:from-purple-600/50 hover:to-blue-600/50"
                  }`}
              >
                {level === "Explain like I'm 5" ? "ELI5" : level}
              </button>
            ))}
          </div>

          <div className="absolute top-28 left-4 z-20 flex bg-gray-900/90 backdrop-blur-md p-1 rounded-full border border-purple-500/50 shadow-xl gap-1">
            {(["nepali", "hindi", "english"] as const).map((lang) => {
              const labels = { nepali: "नेपाली", hindi: "हिंदी", english: "EN" };
              return (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${language === lang
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                    : "text-gray-300 hover:text-white"
                    }`}
                >
                  {labels[lang]}
                </button>
              );
            })}
          </div>

          <div className="absolute top-40 left-4 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur-md px-3 py-2 rounded-full border border-purple-500/50 shadow-xl">
            <div
              onClick={() => setIsLiveMode((v) => !v)}
              className={`w-10 h-5 rounded-full cursor-pointer transition-colors duration-300 relative ${isLiveMode ? "bg-red-500" : "bg-gray-600"
                }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${isLiveMode ? "translate-x-5" : "translate-x-0.5"
                }`} />
            </div>
            <span className="text-xs text-gray-300 font-semibold">
              {isLiveMode ? "🔴 Live" : "Live"}
            </span>
          </div>

          {/* Scan Mode Selector */}
          <div className="absolute top-16 right-4 z-20 flex bg-linear-to-r from-gray-900/90 to-purple-900/90 backdrop-blur-md p-1 rounded-full border border-purple-500/50 shadow-xl overflow-x-auto max-w-[calc(100vw-2rem)] hide-scrollbar">
            {(["General", "Study", "Translate"] as ScanMode[]).map((mode) => {
              const icons: Record<ScanMode, string> = {
                General: "🔍",
                Study: "📚",
                Translate: "🌐"
              };
              return (
                <button
                  key={mode}
                  onClick={() => setScanMode(mode)}
                  className={`px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 transform hover:scale-110 ${scanMode === mode
                    ? "bg-linear-to-r from-purple-500 to-blue-500 shadow-md text-white scale-105"
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
            <div className="absolute inset-0 z-30 pointer-events-none w-full h-full bg-linear-to-br from-purple-500/20 to-blue-500/20 mix-blend-screen animate-pulse">
              <div className="absolute w-full h-0.75 bg-linear-to-r from-purple-400 via-blue-400 to-indigo-400 shadow-[0_0_20px_rgba(147,51,234,1)] animate-scan rounded-full"></div>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="absolute bottom-8 w-full z-40 px-6">
            <div className="max-w-md mx-auto flex items-center justify-center gap-6">

              {/* Voice Input Button */}
              <button
                onClick={startVoiceInput}
                disabled={isExplaining || isListening}
                className={`relative group flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 transform hover:scale-110 ${isListening
                  ? "bg-linear-to-r from-red-500 to-pink-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.8)] animate-pulse"
                  : "bg-linear-to-r from-gray-800/90 to-purple-800/90 backdrop-blur-xl border border-purple-500/50 text-gray-300 hover:text-white shadow-xl hover:shadow-purple-500/30"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Ask a question"
              >
                <div className="absolute inset-0 rounded-full transition-transform duration-300 group-hover:scale-125 -z-10 bg-linear-to-r from-purple-500/20 to-blue-500/20"></div>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {isListening && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></span>}
              </button>

              {/* Solve Button */}
              <button
                onClick={handleSolve}
                disabled={isExplaining || isListening}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-linear-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg hover:scale-110 transition-all disabled:opacity-50"
              >
                🔢 Solve
              </button>

              {/* Main Capture Button */}
              <button
                onClick={() => handleExplain()}
                disabled={isExplaining || isListening}
                className={`relative flex items-center justify-center h-24 w-24 rounded-full border-4 border-white/30 p-1 transition-all duration-300 transform hover:scale-110 ${isExplaining ? "opacity-50 scale-95" : "hover:border-white/50 hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(0,0,0,0.7)]"
                  }`}
                aria-label="Capture and Explain"
              >
                <div className={`w-full h-full rounded-full transition-colors duration-300 ${isExplaining ? "bg-linear-to-r from-purple-600 to-blue-600" : "bg-white hover:bg-linear-to-r hover:from-purple-200 hover:to-blue-200"
                  }`}></div>

                <span className="absolute -bottom-10 text-sm font-bold tracking-widest text-white/90 uppercase shadow-black drop-shadow-lg">
                  🚀 Explain
                </span>
              </button>

              {/* Translate Button */}
              <button
                onClick={handleTranslate}
                disabled={isExplaining || isListening}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-linear-to-r from-green-500 to-teal-500 text-white text-sm font-bold shadow-lg hover:scale-110 transition-all disabled:opacity-50"
              >
                🌐 Translate
              </button>

              <button
                onClick={handleOutfit}
                disabled={isExplaining || isListening || isOutfitLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg hover:scale-110 transition-all disabled:opacity-50 ${
                  isOutfitLoading
                    ? "bg-linear-to-r from-pink-600 to-purple-600 animate-pulse"
                    : "bg-linear-to-r from-pink-500 to-purple-500"
                }`}
              >
                👗 Style
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
