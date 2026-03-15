/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, question, difficulty, scanMode, language, mode, conversationHistory } = body;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    let systemInstruction = "You are an AI tutor. The user is pointing their camera at something. Explain what you see clearly and helpfully.";
    if (difficulty === "Explain like I'm 5") {
      systemInstruction = "You are a friendly AI tutor talking to a 5-year-old child. Explain what you see using very simple, fun words. Keep it short and engaging.";
    } else if (difficulty === "Student") {
      systemInstruction = "You are an AI tutor helping a student. Explain what you see clearly, focusing on educational concepts, facts, and how it works.";
    } else if (difficulty === "Expert") {
      systemInstruction = "You are an AI expert. Provide a highly detailed, technical, and precise explanation of what you see and its mechanics or underlying principles.";
    }

    const langMap: Record<string, string> = {
      nepali: "Always respond in Nepali language (नेपाली). Use simple, clear Nepali.",
      hindi: "Always respond in Hindi language (हिंदी). Use simple, clear Hindi.",
      english: "Always respond in English.",
    };
    const langInstruction = langMap[language] || langMap["nepali"];
    systemInstruction += " " + langInstruction;

    // ── Mode-specific instructions ──────────────────────────────
    if (mode === "solve") {
      systemInstruction += " The user wants you to solve a math problem or explain code. Show ALL steps clearly numbered. If math, solve completely. If code, explain each line and fix any bugs.";
    } else if (mode === "translate") {
      systemInstruction += ` Read ALL text visible in this image. Show the original text first, then translate every word to ${language === "nepali" ? "Nepali (नेपाली)" : language === "hindi" ? "Hindi (हिंदी)" : "English"}. Format: Original: ... | Translation: ...`;
    } else if (mode === "outfit") {
      // Outfit generator — structured short response
      systemInstruction = `You are a fashion stylist AI. Analyze the clothing items visible in the image.
Respond in this EXACT format (keep it short):

👗 OUTFIT ANALYSIS
Detected: [list clothing items seen, comma separated]

✨ SUGGESTION 1: [outfit name]
- Pieces: [what to wear]
- Occasion: [where to wear it]
- Tip: [one styling tip]

✨ SUGGESTION 2: [outfit name]
- Pieces: [what to wear]
- Occasion: [where to wear it]
- Tip: [one styling tip]

🎨 COLOR ADVICE: [one sentence on colors that complement what you see]

Keep the entire response under 120 words. ${langInstruction}`;
    } else if (mode === "live") {
      // Live mode — very short
      systemInstruction = `You are a live camera narrator. Describe what you see in ONE sentence only. Maximum 20 words. Be direct. ${langInstruction}`;
    } else {
      // Regular explain — SHORT
      systemInstruction += " IMPORTANT: Keep your response to 3-4 sentences maximum. Be concise and clear. No long paragraphs.";
    }

    // ── Scan mode append (only for regular explain) ─────────────
    const modePrompts: Record<string, string> = {
      General: "",
      Ingredients: "Focus on identifying all ingredients, food items, or consumables visible. List them clearly and mention any potential allergens.",
      Hazards: "You are a safety expert. Identify any potential hazards or safety risks visible. Be specific but brief.",
      Study: "You are a tutor. Identify the subject and give key concepts only. Keep it concise.",
      Translate: "Identify and translate any text or signs visible. State the original language and translation.",
    };
    if (mode !== "outfit" && mode !== "solve" && mode !== "live" && scanMode && modePrompts[scanMode]) {
      systemInstruction += " " + modePrompts[scanMode];
    }

    // ── Follow-up question (only for regular explain, not live/outfit) ──
    if (mode !== "live" && mode !== "outfit" && mode !== "translate") {
      systemInstruction += " At the end, ask ONE short follow-up question in the same language as your response.";
    }

    const userPrompt = question ? question : "What is this? Please explain what you see.";
    const base64Data = image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

    if (conversationHistory && conversationHistory.length > 0) {
      const contents = [
        ...conversationHistory.map((msg: any) => ({
          role: msg.role === "ai" ? "model" : "user",
          parts: [{ text: msg.content }],
        })),
        {
          role: "user",
          parts: [
            { text: userPrompt },
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
          ],
        },
      ];
      const chatResult = await model.generateContent({ contents });
      return NextResponse.json({ text: chatResult.response.text() });
    } else {
      const result = await model.generateContent([
        userPrompt,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
      ]);
      return NextResponse.json({ text: result.response.text() });
    }

  } catch (error: any) {
    console.error("Error in explain API:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process image" },
      { status: 500 }
    );
  }
}