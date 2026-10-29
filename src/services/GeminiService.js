import * as FileSystem from 'expo-file-system';

/**
 * Helper to convert a React Native image URI to Base64 string.
 * @param {string} imageUri - The local file URI from React Native
 * @returns {Promise<string>} - Base64 encoded image data
 */
const imageUriToBase64 = async (imageUri) => {
  try {
    // Read file as base64 using Expo FileSystem
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64Data;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to process image');
  }
};

/**
 * Analyzes a skin/facial image to determine skin tone, undertone, and color recommendations.
 * @param {string} imageUri - The local file URI from React Native
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} - Analysis results
 */
export const analyzeSkinColor = async (imageUri, apiKey) => {
  if (!apiKey) throw new Error("API Key is missing!");

  const prompt = `
    Analyze this facial image to determine the person's skin tone type, undertone, and provide personalized color recommendations.
    
    Return a response in the following JSON format:
    {
      "isFace": true,
      "seasonType": "Soft Autumn" or "Warm Spring" or "Cool Summer" etc.,
      "undertone": "Warm" or "Cool" or "Neutral",
      "skinTone": "Light" or "Medium" or "Deep" or "Fair" etc.,
      "seasonDescription": "A brief, friendly description of this season type (1-2 sentences)",
      "undertoneDescription": "A brief, friendly description of this undertone (1-2 sentences)",
      "colorsToWear": [
        {"name": "Taupe", "hex": "#B8A082"},
        {"name": "Moss Green", "hex": "#8A9A5B"},
        {"name": "Peach", "hex": "#FFCBA4"},
        {"name": "Golden Brown", "hex": "#996515"},
        {"name": "Dusty Coral", "hex": "#D2691E"},
        {"name": "Muted Olive", "hex": "#6B8E23"}
      ],
      "colorsToAvoid": [
        {"name": "Icy Blue", "hex": "#B0E0E6"},
        {"name": "Neon Pink", "hex": "#FF1493"},
        {"name": "Bright Yellow", "hex": "#FFFF00"}
      ]
    }
    
    If the image is NOT a clear facial picture (no face detected, wrong angle, too dark, etc.), set "isFace" to false and provide a playful, friendly error message in "seasonDescription" like "Oops! That doesn't look like a clear face photo! 😊 Please upload a well-lit selfie with your face clearly visible."
    
    For season types, use common color analysis categories:
    - Spring: Warm Spring, Light Spring, Bright Spring
    - Summer: Light Summer, Soft Summer, Cool Summer
    - Autumn: Soft Autumn, Warm Autumn, Deep Autumn
    - Winter: Cool Winter, Bright Winter, Deep Winter
    
    For undertones:
    - Warm: Golden, peachy, yellow-based undertones
    - Cool: Pink, blue, red-based undertones
    - Neutral: Mix of warm and cool, often olive-toned
    
    For colors to wear, provide 6 colors that complement the detected skin tone and undertone.
    For colors to avoid, provide 3 colors that clash with the detected skin tone and undertone.
    
    Return ONLY valid JSON. Do not include markdown code blocks or any other text.
  `;

  try {
    // Convert image to base64
    const base64Image = await imageUriToBase64(imageUri);
    
    // Use Gemini REST API directly
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
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
      const errorData = await response.text();
      console.error('Gemini API Error Response:', errorData);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No response text from API');
    }

    // Clean up code fences if present
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Try to extract JSON if there's extra text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error.message.includes('JSON')) {
      throw new Error("Failed to parse analysis results. Please try again with a clearer photo.");
    }
    throw new Error("Failed to analyze image. Please try again with a clearer photo.");
  }
};

