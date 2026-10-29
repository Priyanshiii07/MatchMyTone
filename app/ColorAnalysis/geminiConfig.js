// Reads EXPO_PUBLIC_GEMINI_API_KEY from the project root .env file (not committed).
// Restart Metro (`npx expo start`) after editing .env.
// Note: EXPO_PUBLIC_* values are still included in the app bundle; this setup mainly keeps keys out of Git.

export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

// Default export to prevent Expo Router from treating this as a route
export default function GeminiConfig() {
  return null;
}
