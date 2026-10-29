import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shown at the top of the email body. Mail apps choose the real "From" account themselves;
 * this line makes the MatchMyTone sender clear to the user.
 */
export const SHARE_MATCHMYTONE_FROM_LINE = 'From: MatchMyTone <noreply@matchmytone.online>';

/**
 * Prefix for mailto bodies built with %0D%0A line breaks (Color Analysis, Skincare, Body Shape).
 */
export const SHARE_EMAIL_BODY_PREFIX_CRLF =
  'From:%20MatchMyTone%20%3Cnoreply@matchmytone.online%3E%0D%0A%0D%0A';

export async function getCurrentUserEmail() {
  try {
    const stored = await AsyncStorage.getItem('currentUser');
    if (!stored) return '';
    const user = JSON.parse(stored);
    const email = user?.email;
    return email ? String(email).trim() : '';
  } catch {
    return '';
  }
}
