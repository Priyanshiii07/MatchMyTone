const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Models that support image input; try in order (404 = model not available for this project)
const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

/**
 * Analyzes a face image for skin tone, undertone, and color recommendations.
 * Tries multiple models if one returns 404; retries on 429 (quota/rate limit).
 * Uses REST API directly for React Native compatibility.
 */
export const analyzeSkinImage = async (imageBase64, mimeType, apiKey) => {
  if (!apiKey) throw new Error('API Key is missing!');

  const prompt = `
You are an expert color analyst and personal stylist. Analyze this image.

If the image shows a CLEAR, WELL-LIT FACE (one person's face visible for skin analysis):
- Determine the person's color season (e.g. Soft Autumn, Cool Summer, Warm Spring, Deep Winter, etc.) and a short description of why.
- Determine their skin undertone: "Warm", "Cool", or "Neutral", with a short description.
- Estimate their "skin age (looks like)" as a whole number of years and a 1-2 sentence description (friendly, non-medical, confidence-based).
- Recommend 6 colors they should WEAR (flattering for their skin). For each color give: name (e.g. "Taupe", "Moss Green") and hex code (e.g. "#C4A484").
- Recommend 3 colors they should AVOID (unflattering). For each give: name and hex code.

Return ONLY valid JSON in this exact format (no markdown, no code block):
{
  "isFace": true,
  "seasonType": "Soft Autumn",
  "seasonDescription": "Your warm and subtle features give you a deep, understated look that feels rich and grounded.",
  "undertone": "Neutral",
  "undertoneDescription": "Neutral undertones blend warm and cool tones, often creating a balanced, olive-like appearance.",
  "skinAge": 26,
  "skinAgeDescription": "Your skin looks smooth and even with minimal visible lines—like someone in their mid‑20s.",
  "colorsToWear": [
    { "name": "Taupe", "hex": "#C4A484" },
    { "name": "Moss Green", "hex": "#8A9A5B" },
    { "name": "Peach", "hex": "#FFCBA4" },
    { "name": "Golden Brown", "hex": "#996515" },
    { "name": "Dusty Coral", "hex": "#E07878" },
    { "name": "Muted Olive", "hex": "#6B8E23" }
  ],
  "colorsToAvoid": [
    { "name": "Icy Blue", "hex": "#B0E0E6" },
    { "name": "Neon Pink", "hex": "#FF69B4" },
    { "name": "Bright Yellow", "hex": "#FFFF00" }
  ]
}

If the image does NOT show a clear face (e.g. food, object, landscape, multiple faces, no face, blurry, or not a selfie):
Return ONLY this JSON (no markdown):
{
  "isFace": false,
  "description": "A short, playful, friendly message (1-2 sentences) asking them to upload a clear, well-lit selfie instead. Be cute and encouraging, like: 'That's not quite a selfie! Show me your lovely face in good lighting so I can find your best colors! ✨'"
}

Return ONLY the JSON object. No other text before or after.
`;

  let lastError;
  for (const modelName of MODELS_TO_TRY) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Use REST API directly
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const requestBody = {
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: mimeType || 'image/jpeg',
                }
              }
            ]
          }]
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const msg = errorText || `HTTP ${response.status}`;
          const is404 = msg.includes('404') || msg.includes('not found') || msg.includes('is not supported') || response.status === 404;
          const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('Quota') || response.status === 429;
          
          if (is404) break; // try next model
          if (is429 && attempt < maxRetries) {
            const retryDelay = msg.match(/retry in ([\d.]+)/i)?.[1] || 8;
            await sleep(Number(retryDelay) * 1000);
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          throw new Error('No response text from API');
        }

        const cleanedText = text
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        
        return JSON.parse(cleanedText);
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









