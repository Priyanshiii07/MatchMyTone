import { GoogleGenerativeAI } from '@google/generative-ai';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Models that support image input; try in order (404 = model not available for this project)
const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

function parseGeminiJson(text) {
  let cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  return JSON.parse(cleaned);
}

/**
 * When the user already has a saved analysis, keep palette + core labels stable
 * (model still refreshes copy in descriptions via the prompt).
 */
function applyRepeatAnalysisConsistency(parsed, previousAnalysis, registeredGender) {
  if (!previousAnalysis || !parsed?.isFace) return parsed;
  if (registeredGender && parsed.detectedGender) {
    if (String(parsed.detectedGender).toLowerCase() !== String(registeredGender).toLowerCase()) {
      return parsed;
    }
  }
  const p = previousAnalysis;
  if (p.seasonType) parsed.seasonType = p.seasonType;
  if (p.undertone) parsed.undertone = p.undertone;
  if (typeof p.skinAge === 'number' && !Number.isNaN(p.skinAge)) {
    parsed.skinAge = p.skinAge;
  }
  if (Array.isArray(p.colorsToWear) && p.colorsToWear.length >= 6) {
    parsed.colorsToWear = p.colorsToWear.slice(0, 6).map((c) => ({
      name: String(c.name || ''),
      hex: String(c.hex || '').trim(),
    }));
  }
  if (Array.isArray(p.colorsToAvoid) && p.colorsToAvoid.length >= 3) {
    parsed.colorsToAvoid = p.colorsToAvoid.slice(0, 3).map((c) => ({
      name: String(c.name || ''),
      hex: String(c.hex || '').trim(),
    }));
  }
  return parsed;
}

function buildPrompt(previousAnalysis) {
  const repeatBlock =
    previousAnalysis &&
    (previousAnalysis.colorsToWear?.length >= 6 || previousAnalysis.seasonType)
      ? `
=== REPEAT ANALYSIS (same account) ===
The user completed color analysis before. Use this prior result as ground truth for labels and palette unless the new image is clearly a different person (different facial structure, age group, or features).

Previous JSON (must match on output for core fields):
${JSON.stringify({
          seasonType: previousAnalysis.seasonType,
          undertone: previousAnalysis.undertone,
          skinAge: previousAnalysis.skinAge,
          colorsToWear: previousAnalysis.colorsToWear,
          colorsToAvoid: previousAnalysis.colorsToAvoid,
        })}

Rules for repeat:
- Output the SAME seasonType, undertone, skinAge, colorsToWear (all 6 name+hex), and colorsToAvoid (all 3 name+hex) as in previous — character-for-character for hex and season/undertone labels.
- You may rewrite seasonDescription, undertoneDescription, and skinAgeDescription only, to reflect the new photo while staying consistent with those fixed values.
- If the face is clearly not the same person, ignore this block and do a full fresh analysis.
`
      : '';

  return `
You are an expert color analyst and personal stylist. Analyze this image.
${repeatBlock}
If the image shows a CLEAR, WELL-LIT FACE (one person's face visible for skin analysis):
- Determine the gender of the person in the photo: "male" or "female".
- Determine the person's color season (one specific label, e.g. Soft Autumn, Cool Summer, Warm Spring, Deep Winter, Light Summer, Bright Spring, etc.) and a short description tied to THIS face.
- Determine their skin undertone: exactly one of "Warm", "Cool", or "Neutral", with a short description based on what you see.
- Estimate "skinAge" as a whole number of years (how old the skin looks) and a 1–2 sentence friendly, non-medical description.

COLOR PALETTE RULES (first-time only — skip if REPEAT ANALYSIS block applies):
- Derive every recommended color from THIS person's visible skin depth, undertone, contrast (hair/eyes), and season. Do NOT copy canned example palettes.
- Pick 6 "colorsToWear" that are flattering and use diverse hue families where appropriate (e.g. mix neutrals with muted jewel, soft cool, or warm earth tones as fits their season — avoid six near-identical browns unless truly correct).
- Pick 3 "colorsToAvoid" that would clash; they must differ from the wear list and be specific, not generic placeholders.
- Each color needs a clear common name and a valid 6-digit hex in #RRGGBB that honestly matches the name and their analysis.

Return ONLY valid JSON (no markdown, no code fences). The structure below shows FIELD SHAPES ONLY — the season, undertone, age, names, and hex values are arbitrary examples. You must infer real values from the photo (or from the REPEAT block). Never output this sample season, undertone, or these sample colors unless they truly match.
{
  "isFace": true,
  "detectedGender": "female",
  "seasonType": "Bright Winter",
  "seasonDescription": "…",
  "undertone": "Cool",
  "undertoneDescription": "…",
  "skinAge": 31,
  "skinAgeDescription": "…",
  "colorsToWear": [
    { "name": "Berry", "hex": "#8E3B5A" },
    { "name": "Icy Gray", "hex": "#C5CED3" },
    { "name": "Royal Blue", "hex": "#2143A0" },
    { "name": "True Red", "hex": "#C41E3A" },
    { "name": "Charcoal", "hex": "#36454F" },
    { "name": "Emerald", "hex": "#287C5A" }
  ],
  "colorsToAvoid": [
    { "name": "Muted Beige", "hex": "#D8C8B0" },
    { "name": "Dusty Peach", "hex": "#E8B89A" },
    { "name": "Warm Camel", "hex": "#C19A6B" }
  ]
}

If the image does NOT show a clear face (e.g. food, object, landscape, multiple faces, no face, blurry, or not a selfie):
Return ONLY this JSON:
{
  "isFace": false,
  "description": "A short, playful, friendly message (1-2 sentences) asking them to upload a clear, well-lit selfie instead."
}

Return ONLY the JSON object. No other text before or after.
`;
}

/**
 * @param {string} imageBase64
 * @param {string} mimeType
 * @param {string} apiKey
 * @param {{ previousAnalysis?: object; registeredGender?: string } | undefined} options - camelCase fields for previousAnalysis; registeredGender skips palette lock on mismatch
 */
export const analyzeSkinImage = async (imageBase64, mimeType, apiKey, options = {}) => {
  if (!apiKey) throw new Error('API Key is missing!');

  const { previousAnalysis, registeredGender } = options;
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildPrompt(previousAnalysis);

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType || 'image/jpeg',
    },
  };

  const generationConfig = {
    temperature: previousAnalysis ? 0.25 : 0.92,
    topP: 0.95,
  };

  let lastError;
  for (const modelName of MODELS_TO_TRY) {
    const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        const text = response.text();
        const parsed = parseGeminiJson(text);
        return applyRepeatAnalysisConsistency(parsed, previousAnalysis, registeredGender);
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '');
        const is404 = msg.includes('404') || msg.includes('not found') || msg.includes('is not supported');
        const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('Quota');
        const retryDelay = msg.match(/retry in ([\d.]+)/i)?.[1] || 8;
        if (is404) break; // try next model
        if (is429 && attempt < maxRetries) {
          await sleep(Number(retryDelay) * 1000);
          continue;
        }
        throw err;
      }
    }
  }

  throw lastError;
};

// Default export to prevent Expo Router from treating this as a route
export default function ColorAnalysisGemini() {
  return null;
}
