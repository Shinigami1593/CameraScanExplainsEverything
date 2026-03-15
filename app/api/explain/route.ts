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

    // --- DIFFICULTY BLOCK (unchanged) ---
    let systemInstruction = "You are an AI tutor. The user is pointing their camera at something. Explain what you see clearly and helpfully.";
    if (difficulty === "Explain like I'm 5") {
      systemInstruction = "You are a friendly AI tutor talking to a 5-year-old child. The user is pointing their camera at something. Explain what you see using very simple, fun words. Keep it short and engaging.";
    } else if (difficulty === "Student") {
      systemInstruction = "You are an AI tutor helping a student. The user is pointing their camera at something. Explain what you see clearly, focusing on educational concepts, facts, and how it works.";
    } else if (difficulty === "Expert") {
      systemInstruction = "You are an AI expert. The user is pointing their camera at something. Provide a highly detailed, technical, and precise explanation of what you see and its mechanics or underlying principles.";
    }

    const langMap: Record<string, string> = {
      nepali: "Always respond in Nepali language (नेपाली). Use simple, clear Nepali.",
      hindi: "Always respond in Hindi language (हिंदी). Use simple, clear Hindi.",
      english: "Always respond in English.",
    };
    const langInstruction = langMap[language] || langMap["nepali"];
    systemInstruction += " " + langInstruction;

    if (mode === "solve") {
      systemInstruction += " The user wants you to solve a math problem or explain code. Show ALL steps clearly numbered. If math, solve completely. If code, explain each line and fix any bugs.";
    } else if (mode === "translate") {
      systemInstruction += ` Read ALL text visible in this image. Show the original text first, then translate every word to ${language === "nepali" ? "Nepali (नेपाली)" : language === "hindi" ? "Hindi (हिंदी)" : "English"}. Format: Original: ... | Translation: ...`;
    }

    // --- ADD THIS BLOCK RIGHT HERE, AFTER THE DIFFICULTY BLOCK ---
    const modePrompts: Record<string, string> = {
      General: "",
      Ingredients: "Focus on identifying all ingredients, food items, or consumables visible. List them clearly and mention any potential allergens or nutritional highlights.",
      Hazards: "You are a safety expert. Identify any potential hazards, dangers, or safety risks visible in the image. Be specific about what could cause harm and to whom.",
      Study: "You are a tutor. Identify the subject matter in the image and provide educational context, key concepts, and what a student should know about what they see.",
      Translate: "Identify and translate any text, signs, labels, or written content visible in the image. State the original language and provide the translation.",
    };
    if (scanMode && modePrompts[scanMode]) {
      systemInstruction += " " + modePrompts[scanMode];
    }
    // --- END OF NEW BLOCK ---

    systemInstruction += " At the end of your response, always ask ONE follow-up question to encourage the user to learn more. The question must be in the same language as your response.";

    const userPrompt = question ? question : "What is this? Please explain what you see.";
    const base64Data = image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction,
    });

    let contents: any[];
    if (conversationHistory && conversationHistory.length > 0) {
      contents = [
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
      const responseText = chatResult.response.text();
      return NextResponse.json({ text: responseText });
    } else {
      const result = await model.generateContent([
        userPrompt,
        { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
      ]);
      const responseText = result.response.text();
      return NextResponse.json({ text: responseText });
    }

  } catch (error: any) {
    console.error("Error in explain API:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process image" },
      { status: 500 }
    );
  }
}