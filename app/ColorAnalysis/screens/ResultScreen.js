import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { quizAPI } from '../../../src/api';
import { GEMINI_API_KEY } from '../geminiConfig';
import { analyzeSkinImage } from '../services/colorAnalysisGemini';

const { width } = Dimensions.get('window');
const CARD_PADDING = 14;
const SPARKLE = '✨';

/** Map API row (snake_case) to camelCase for Gemini repeat-analysis anchoring. */
function mapSavedToPreviousColorAnalysis(saved) {
  if (!saved) return null;
  return {
    seasonType: saved.season_type,
    seasonDescription: saved.season_description,
    undertone: saved.undertone,
    undertoneDescription: saved.undertone_description,
    skinAge: saved.skin_age,
    skinAgeDescription: saved.skin_age_description,
    colorsToWear: saved.colors_to_wear || [],
    colorsToAvoid: saved.colors_to_avoid || [],
  };
}

/** Latest successful on-server analysis for this user (newest first from API). */
async function loadLatestSuccessfulColorAnalysisForRepeat() {
  try {
    const response = await quizAPI.getQuizResult('color_analysis');
    const results = response?.results || [];
    const saved = results.find(
      (r) =>
        r.is_face &&
        Array.isArray(r.colors_to_wear) &&
        r.colors_to_wear.length >= 6 &&
        Array.isArray(r.colors_to_avoid) &&
        r.colors_to_avoid.length >= 3
    );
    return mapSavedToPreviousColorAnalysis(saved);
  } catch (e) {
    console.log('Could not load prior color analysis (ok for first-time):', e);
    return null;
  }
}

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const photoUri = params?.photoUri;
  const fromDashboard = params?.fromDashboard === 'true';
  const resultId = params?.resultId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedColorFilter, setSelectedColorFilter] = useState(null);
  const [userAge, setUserAge] = useState(null);
  const [userGender, setUserGender] = useState(null);
  const [genderMismatch, setGenderMismatch] = useState(false);
  const [detectedGender, setDetectedGender] = useState(null);
  const [pdfDownloadedOnce, setPdfDownloadedOnce] = useState(false);

  useEffect(() => {
    // Load basic user info for age-based palette
    loadUserProfileBasics();

    if (!photoUri) {
      // If coming from dashboard, try to load saved result
      if (fromDashboard) {
        loadSavedResult();
      } else {
        setError('No photo to analyze.');
        setLoading(false);
      }
      return;
    }
    runAnalysis();
  }, [photoUri, fromDashboard]);

  const loadUserProfileBasics = async () => {
    try {
      const stored = await AsyncStorage.getItem('currentUser');
      if (!stored) return;
      const user = JSON.parse(stored);
      if (user?.age) {
        const parsedAge = Number(user.age);
        if (!Number.isNaN(parsedAge)) {
          setUserAge(parsedAge);
        }
      }
      if (user?.gender) {
        setUserGender(user.gender.toLowerCase());
      }
    } catch (e) {
      console.log('Failed to load user basics for color analysis:', e);
    }
  };

  const loadSavedResult = async () => {
    try {
      setLoading(true);
      let saved = null;

      if (resultId) {
        // Load specific result by ID
        const response = await quizAPI.getColorAnalysisById(Number(resultId));
        if (response && response.result) {
          saved = response.result;
        }
      } else {
        // Fallback: load the latest result
        const response = await quizAPI.getQuizResult('color_analysis');
        if (response && response.results && response.results.length > 0) {
          saved = response.results[0];
        } else if (response && response.result) {
          saved = response.result;
        }
      }

      if (saved) {
        setResult({
          isFace: saved.is_face,
          seasonType: saved.season_type,
          seasonDescription: saved.season_description,
          undertone: saved.undertone,
          undertoneDescription: saved.undertone_description,
          skinAge: saved.skin_age,
          skinAgeDescription: saved.skin_age_description,
          colorsToWear: saved.colors_to_wear || [],
          colorsToAvoid: saved.colors_to_avoid || [],
          description: saved.description,
        });
        if (saved.colors_to_wear?.length) {
          setSelectedColorFilter(saved.colors_to_wear[0].name);
        }
      } else {
        setError('No saved color analysis found.');
      }
    } catch (error) {
      console.error('Error loading saved result:', error);
      setError('Could not load saved analysis.');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!photoUri) return;
    setLoading(true);
    setError('');
    setGenderMismatch(false);
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const previousAnalysis = await loadLatestSuccessfulColorAnalysisForRepeat();

      let registeredGenderForApi = userGender;
      if (!registeredGenderForApi) {
        try {
          const stored = await AsyncStorage.getItem('currentUser');
          if (stored) {
            const user = JSON.parse(stored);
            if (user?.gender) {
              registeredGenderForApi = user.gender.toLowerCase();
            }
          }
        } catch (e) {
          console.log('Could not read gender for color analysis:', e);
        }
      }

      const key = (GEMINI_API_KEY || '').trim();
      if (!key) {
        throw new Error(
          'Gemini API key is missing. Set EXPO_PUBLIC_GEMINI_API_KEY in the project root .env and restart Expo (npx expo start -c).'
        );
      }

      const analysis = await analyzeSkinImage(base64, 'image/jpeg', key, {
        previousAnalysis: previousAnalysis || undefined,
        registeredGender: registeredGenderForApi || undefined,
      });

      // Check gender mismatch: if face is detected, compare with registered user's gender
      if (analysis.isFace && analysis.detectedGender) {
        const detected = analysis.detectedGender.toLowerCase();
        setDetectedGender(detected);

        // Get registered user's gender directly from AsyncStorage to avoid race condition
        let registeredGender = userGender;
        if (!registeredGender) {
          try {
            const stored = await AsyncStorage.getItem('currentUser');
            if (stored) {
              const user = JSON.parse(stored);
              if (user?.gender) {
                registeredGender = user.gender.toLowerCase();
                setUserGender(registeredGender);
              }
            }
          } catch (e) {
            console.log('Failed to read gender from AsyncStorage:', e);
          }
        }

        if (registeredGender && detected !== registeredGender) {
          setGenderMismatch(true);
          setResult(analysis);
          return;
        }
      }

      setResult(analysis);
      if (analysis.isFace && analysis.colorsToWear?.length) {
        setSelectedColorFilter(analysis.colorsToWear[0].name);
      }

      // Save result to database
      await saveResultToDatabase(analysis);
    } catch (err) {
      console.error('Color analysis error:', err);
      const msg = String(err?.message || '');
      const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('Quota');
      const isModelNotFound = msg.includes('404') || msg.includes('not found') || msg.includes('is not supported');
      setError(
        isQuota
          ? 'Analysis is busy right now. Tap "Try again" in a moment, or come back later.'
          : isModelNotFound
            ? 'Analysis service is updating. Tap "Try again" or come back in a few minutes.'
            : msg || 'Something went wrong. Try another selfie!'
      );
    } finally {
      setLoading(false);
    }
  };

  const saveResultToDatabase = async (analysis) => {
    try {
      const resultData = {
        photo_uri: photoUri,
        season_type: analysis.seasonType || null,
        season_description: analysis.seasonDescription || null,
        undertone: analysis.undertone || null,
        undertone_description: analysis.undertoneDescription || null,
        skin_age: analysis.skinAge ?? null,
        skin_age_description: analysis.skinAgeDescription ?? null,
        colors_to_wear: analysis.colorsToWear || [],
        colors_to_avoid: analysis.colorsToAvoid || [],
        is_face: analysis.isFace || false,
        description: analysis.description || null,
      };

      await quizAPI.saveColorAnalysisResult(resultData);
    } catch (error) {
      console.error('Error saving color analysis result:', error);
      // Fail silently - don't interrupt user experience
    }
  };

  const handleEmailShare = async () => {
    if (!result) return;

    try {
      const displayColors = getAgeAdjustedColorsToWear(result, userAge);
      await quizAPI.shareColorAnalysisByEmail({
        result: {
          seasonType: result.seasonType,
          seasonDescription: result.seasonDescription,
          undertone: result.undertone,
          undertoneDescription: result.undertoneDescription,
          skinAge: result.skinAge,
          skinAgeDescription: result.skinAgeDescription,
          colorsToWear: result.colorsToWear,
          colorsToAvoid: result.colorsToAvoid,
        },
        colorsToWearDisplay: displayColors,
      });
      Alert.alert('Email sent', 'Check your inbox — it’s from MatchMyTone. You may need to peek in spam.');
    } catch (e) {
      const msg = e?.message || 'Could not send email.';
      Alert.alert('Email not sent', msg);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result) return;

    const doDownload = async () => {
      try {
        const ageGroupLabel = getAgeGroupLabel(userAge);
        const displayColors = getAgeAdjustedColorsToWear(result, userAge);

        const html = generatePdfHtml({
          result,
          ageGroupLabel,
          displayColors,
        });

        const { uri } = await Print.printToFileAsync({ html });
        await shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share your Color Analysis PDF',
        });
        setPdfDownloadedOnce(true);
      } catch (e) {
        console.log('Download PDF failed:', e);
      }
    };

    if (pdfDownloadedOnce) {
      Alert.alert(
        'Already downloaded',
        'This file is already downloaded. Do you want to download it again?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: doDownload },
        ]
      );
      return;
    }

    doDownload();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Analyzing your skin tone...</Text>
          <Text style={styles.loadingSubtext}>Finding your best colors</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <View style={styles.errorCard}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorTitle}>Oops!</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={runAnalysis}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goBackButton} onPress={() => router.back()}>
              <Text style={styles.goBackButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!result && !genderMismatch) return null;

  // Gender mismatch screen
  if (genderMismatch) {
    const registeredGenderDisplay = userGender ? userGender.charAt(0).toUpperCase() + userGender.slice(1) : 'Unknown';
    const detectedGenderDisplay = detectedGender ? detectedGender.charAt(0).toUpperCase() + detectedGender.slice(1) : 'Unknown';
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <View style={styles.genderMismatchCard}>
            <View style={styles.genderMismatchIconContainer}>
              <Ionicons name="warning" size={48} color="#E74C3C" />
            </View>
            <Text style={styles.genderMismatchTitle}>Gender Mismatch</Text>
            <Text style={styles.genderMismatchMessage}>
              The registered user is <Text style={styles.genderBoldText}>{registeredGenderDisplay}</Text>, but the face in the photo appears to be <Text style={styles.genderBoldText}>{detectedGenderDisplay}</Text>.{`\n\n`}Color Analysis can only be done for the registered user.{`\n\n`}Please register your own account to get your personalized Color Analysis done.
            </Text>
            <TouchableOpacity
              style={styles.genderMismatchButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.genderMismatchButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.genderMismatchGoBackButton}
              onPress={() => router.push('/home')}
              activeOpacity={0.8}
            >
              <Text style={styles.genderMismatchGoBackText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!result.isFace) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <View style={styles.playfulCard}>
            <Text style={styles.playfulEmoji}>📸</Text>
            <Text style={styles.playfulTitle}>That's not quite a selfie!</Text>
            <Text style={styles.playfulMessage}>
              {result.description || "Show me your lovely face in good lighting so I can find your best colors! ✨"}
            </Text>
            <TouchableOpacity style={styles.takeAgainButton} onPress={() => router.back()}>
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={styles.takeAgainText}>Take a selfie again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const ageGroupLabel = getAgeGroupLabel(userAge);
  const displayColorsToWear = getAgeAdjustedColorsToWear(result, userAge);
  const ageInsightText = getAgeInsightText(userAge, ageGroupLabel, result?.seasonType);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
            </TouchableOpacity>
            <View style={styles.headerIcons} />
          </View>

          {/* Title block: YOUR PERSONALISED / COLOR ANALYSIS */}
          <View style={styles.titleBlock}>
            <View style={styles.titleOval}>
              <Text style={styles.titleOvalText}>YOUR PERSONALISED</Text>
            </View>
            <View style={styles.titleBar}>
              <Text style={styles.titleBarText}>COLOR ANALYSIS</Text>
              <Text style={styles.sparkle}>{SPARKLE}</Text>
            </View>
          </View>

          {/* Photo frame with sparkle-style corners */}
          {photoUri && (
            <View style={styles.photoFrameWrapper}>
              <View style={styles.photoFrame}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <View style={[styles.frameCorner, styles.frameTopLeft]} />
                <View style={[styles.frameCorner, styles.frameTopRight]} />
                <View style={[styles.frameCorner, styles.frameBottomLeft]} />
                <View style={[styles.frameCorner, styles.frameBottomRight]} />
              </View>
            </View>
          )}

          {/* Season Type & Undertone cards */}
          <View style={styles.twoCardsRow}>
            <View style={styles.infoCard}>
              <View style={styles.leafDecor} />
              <Text style={styles.cardLabel}>SEASON TYPE</Text>
              <Text style={styles.cardValueSeason}>{result.seasonType || '—'}</Text>
              <Text style={styles.cardDescription}>
                {result.seasonDescription || 'Your seasonal color type.'}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.leafDecor} />
              <Text style={styles.cardLabel}>UNDERTONE</Text>
              <Text style={styles.cardValueUndertone}>{result.undertone || '—'}</Text>
              <Text style={styles.cardDescription}>
                {result.undertoneDescription || 'Your skin undertone.'}
              </Text>
            </View>
          </View>

          {/* Skin age card (looks like) */}
          <View style={styles.sectionCard}>
            <View style={styles.leafDecor} />
            <Text style={styles.cardLabel}>SKIN AGE (LOOKS LIKE)</Text>
            <Text style={styles.skinAgeYears}>
              {result?.skinAge ? `${result.skinAge} years` : '—'}
            </Text>
            <Text style={styles.cardDescription}>
              {result?.skinAgeDescription || ageInsightText}
            </Text>
          </View>

          {/* Colors to wear */}
          <View style={styles.sectionCard}>
            <View style={styles.leafDecor} />
            <Text style={styles.cardLabel}>COLORS TO WEAR</Text>
            <View style={styles.colorGrid}>
              {displayColorsToWear.slice(0, 6).map((c, i) => (
                <View key={i} style={[styles.colorSwatch, { backgroundColor: c.hex || '#CCC' }]}>
                  <Text style={styles.colorSwatchText}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Colors to avoid */}
          <View style={styles.sectionCard}>
            <View style={styles.leafDecor} />
            <Text style={styles.cardLabel}>COLORS TO AVOID</Text>
            <View style={styles.colorRow}>
              {(result.colorsToAvoid || []).slice(0, 3).map((c, i) => (
                <View key={i} style={[styles.colorSwatchLarge, { backgroundColor: c.hex || '#CCC' }]}>
                  <Text style={styles.colorSwatchText}>{c.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareButtonWhite} onPress={handleEmailShare}>
              <Ionicons name="mail-outline" size={22} color="#2C2C2C" />
              <Text style={styles.shareButtonTextDark}>Share on Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButtonWhite} onPress={handleDownloadPdf}>
              <Ionicons name="document-text-outline" size={22} color="#2C2C2C" />
              <Text style={styles.shareButtonTextDark}>Download PDF</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

// --- Age-based color logic & helpers ---

// 0–40: balanced palettes (not neon, not dull). Built around primary colours + gentle secondaries.
const youthPalettes = [
  [
    { name: 'Classic Red', hex: '#C62828' },
    { name: 'Primary Blue', hex: '#1565C0' },
    { name: 'Sunflower Yellow', hex: '#F2C94C' },
    { name: 'Leaf Green', hex: '#2E7D32' },
    { name: 'Warm Orange', hex: '#F2994A' },
    { name: 'Soft Purple', hex: '#6C5CE7' },
  ],
  [
    { name: 'Cherry Red', hex: '#D32F2F' },
    { name: 'Sky Blue', hex: '#4A90E2' },
    { name: 'Golden Yellow', hex: '#F5B700' },
    { name: 'Teal', hex: '#2A9D8F' },
    { name: 'Coral', hex: '#E76F51' },
    { name: 'Plum', hex: '#7B2CBF' },
  ],
  [
    { name: 'Brick Red', hex: '#B23A48' },
    { name: 'Denim Blue', hex: '#2F5D8A' },
    { name: 'Mustard Yellow', hex: '#D4A017' },
    { name: 'Olive Green', hex: '#6B8E23' },
    { name: 'Terracotta', hex: '#C76D4A' },
    { name: 'Lavender', hex: '#8E7CC3' },
  ],
  [
    { name: 'Deep Red', hex: '#8E1B1B' },
    { name: 'Navy Blue', hex: '#1D3557' },
    { name: 'Butter Yellow', hex: '#F6D365' },
    { name: 'Emerald Green', hex: '#2D6A4F' },
    { name: 'Burnt Orange', hex: '#C45A2A' },
    { name: 'Grape', hex: '#5E548E' },
  ],
  [
    { name: 'Warm Red', hex: '#C0392B' },
    { name: 'Cornflower Blue', hex: '#3F7CAC' },
    { name: 'Daffodil Yellow', hex: '#F2D64B' },
    { name: 'Sea Green', hex: '#3C8D7D' },
    { name: 'Apricot Orange', hex: '#F4A261' },
    { name: 'Royal Purple', hex: '#5B2C83' },
  ],
];

const softPalettes = [
  [
    { name: 'Warm Ivory', hex: '#F8EBDD' },
    { name: 'Camel', hex: '#C19A6B' },
    { name: 'Soft Olive', hex: '#A6AD7B' },
    { name: 'Muted Terracotta', hex: '#B86B5A' },
    { name: 'Smoky Teal', hex: '#4E7C7A' },
    { name: 'Chocolate', hex: '#6B4E3D' },
  ],
  [
    { name: 'Cream', hex: '#F5F0E8' },
    { name: 'Beige', hex: '#D8C0A8' },
    { name: 'Muted Mocha', hex: '#A47C6D' },
    { name: 'Dusty Rose', hex: '#D8A7B1' },
    { name: 'Warm Navy', hex: '#2D3A4A' },
    { name: 'Soft Gold', hex: '#C9B37E' },
  ],
  [
    { name: 'Champagne', hex: '#E8D0B0' },
    { name: 'Light Sand', hex: '#E2C8A7' },
    { name: 'Sage Green', hex: '#A3B18A' },
    { name: 'Rose Nude', hex: '#CFA19A' },
    { name: 'Warm Charcoal', hex: '#4A3F3A' },
    { name: 'Mauve Taupe', hex: '#9D8C86' },
  ],
];

function getAgeGroupLabel(age) {
  if (!age || Number.isNaN(Number(age))) return 'All ages';
  return Number(age) <= 40 ? 'Youthful (0–40)' : 'Elegant (40+)';
}

function getAgeInsightText(age, ageGroupLabel, seasonType) {
  if (!age || Number.isNaN(Number(age))) {
    return 'Your profile age helps us fine‑tune your palette, but this analysis is flattering across ages. Focus on how these shades make your skin look bright and alive.';
  }

  if (Number(age) <= 40) {
    return `You fall in the ${ageGroupLabel} group, so balanced, clear colours work beautifully on you. Think classic primary shades (red, blue, yellow) and gentle secondaries that feel fresh without looking neon.`;
  }

  return `You fall in the ${ageGroupLabel} group, where skin often looks its best in softer, luxurious hues. Gentle neutrals like cream, camel, beige and soft taupes will keep your ${seasonType || 'season'} looking polished, fresh and refined.`;
}

function pickPaletteForUser(age, seasonType, undertone) {
  const isYouthful = !age || Number(age) <= 40;
  const basePalettes = isYouthful ? youthPalettes : softPalettes;

  if (!seasonType && !undertone) return basePalettes[0];

  const season = (seasonType || '').toLowerCase();
  const tone = (undertone || '').toLowerCase();

  // Choose different palettes deterministically so 0–40 users don't all see the same set.
  // We map season/undertone to an index and mod by palette count.
  const key = `${season}|${tone}`;
  const idx = stablePaletteIndex(key, basePalettes.length);

  // Light steering so "warm" leans warm-ish palettes and "cool" leans cool-ish palettes.
  if (isYouthful) {
    if (season.includes('spring') || tone.includes('warm')) return basePalettes[idx % basePalettes.length];
    if (season.includes('summer') || tone.includes('cool')) return basePalettes[(idx + 1) % basePalettes.length];
    if (season.includes('autumn') || season.includes('fall')) return basePalettes[(idx + 2) % basePalettes.length];
    if (season.includes('winter')) return basePalettes[(idx + 3) % basePalettes.length];
    return basePalettes[idx % basePalettes.length];
  }

  // 40+ stays curated but still varies by season/undertone.
  if (season.includes('spring') || tone.includes('warm')) return basePalettes[idx % basePalettes.length];
  if (season.includes('summer') || tone.includes('cool')) return basePalettes[(idx + 1) % basePalettes.length];
  if (season.includes('autumn') || season.includes('fall')) return basePalettes[(idx + 2) % basePalettes.length];
  if (season.includes('winter')) return basePalettes[(idx + 1) % basePalettes.length];
  return basePalettes[idx % basePalettes.length];
}

function stablePaletteIndex(input, mod) {
  // Small deterministic hash (no crypto) to spread users across palettes.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return mod ? hash % mod : 0;
}

function getAgeAdjustedColorsToWear(result, age) {
  if (!result) return [];
  const baseAIColors = Array.isArray(result.colorsToWear) ? result.colorsToWear : [];

  // If no age, just fall back to AI colors
  if (!age || Number.isNaN(Number(age))) {
    return baseAIColors;
  }

  const palette = pickPaletteForUser(age, result.seasonType, result.undertone);

  // For 40+ we do NOT keep bright AI “anchors” (this was causing saturated greens/reds).
  // We return a soft, curated palette that still respects season/undertone.
  if (Number(age) > 40) {
    return palette;
  }

  // For 0–40 we can keep a couple AI anchors, then fill with vibrant palette.
  const anchors = baseAIColors
    .filter((c) => c?.hex && !isNeonOrTooBright(c))
    .slice(0, 2);
  const blended = [...anchors];

  palette.forEach((p) => {
    if (!blended.find((c) => c.name === p.name)) {
      blended.push(p);
    }
  });

  return blended;
}

function isNeonOrTooBright(color) {
  const name = String(color?.name || '').toLowerCase();
  if (name.includes('neon')) return true;

  const hex = color?.hex;
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || (hex.length !== 7)) return false;

  const { s, l } = hexToHsl(hex);
  // Neon-ish tends to be very saturated and fairly bright.
  if (s > 0.78 && l > 0.55) return true;
  // Very bright "highlighter" colors
  if (l > 0.86 && s > 0.6) return true;
  return false;
}

function hexToHsl(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h, s, l };
}

function generatePdfHtml({ result, ageGroupLabel, displayColors }) {
  const safeSeason = result.seasonType || '—';
  const safeUndertone = result.undertone || '—';

  const colorsToWearHtml = displayColors
    .map(
      (c) => `
      <div style="margin-bottom:8px; display:flex; align-items:center;">
        <div style="width:18px;height:18px;border-radius:4px;background:${c.hex ||
        '#ccc'};margin-right:8px;border:1px solid #999;"></div>
        <span style="font-size:14px;">${c.name}${c.hex ? ` (${c.hex})` : ''}</span>
      </div>`
    )
    .join('');

  const colorsToAvoidHtml = (result.colorsToAvoid || [])
    .map(
      (c) => `
      <li style="margin-bottom:4px;font-size:14px;">${c.name}${c.hex ? ` (${c.hex})` : ''}</li>`
    )
    .join('');

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding:24px; background:#FFF8E7;">
        <h1 style="font-size:24px; margin-bottom:4px; color:#2C2C2C;">MatchMyTone – Color Analysis</h1>
        <p style="margin-top:0; color:#8B5CF6; font-weight:600;">Your personalised report ✨</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Season Type</h2>
        <p style="margin:0; font-size:15px; font-weight:600;">${safeSeason}</p>
        <p style="margin-top:4px; font-size:14px; color:#555;">${result.seasonDescription || ''}</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Undertone</h2>
        <p style="margin:0; font-size:15px; font-weight:600;">${safeUndertone}</p>
        <p style="margin-top:4px; font-size:14px; color:#555;">${result.undertoneDescription || ''}</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:4px;">Age Group Insight</h2>
        <p style="margin:0; font-size:14px; color:#555;">${ageGroupLabel}</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Colors to Wear</h2>
        <div>${colorsToWearHtml}</div>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Colors to Avoid</h2>
        <ul style="padding-left:18px; margin-top:0;">${colorsToAvoidHtml}</ul>

        <p style="margin-top:32px; font-size:13px; color:#777;">Generated with love by MatchMyTone ✨</p>
      </body>
    </html>
  `;
}

function isDarkHex(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 6,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleOval: {
    backgroundColor: '#E6C229',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 100,
    marginBottom: -8,
    zIndex: 1,
  },
  titleOvalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2C2C',
    letterSpacing: 0.5,
  },
  titleBar: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleBarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  sparkle: {
    fontSize: 14,
    color: '#FFF',
  },
  photoFrameWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoFrame: {
    width: width * 0.55,
    aspectRatio: 0.75,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFF',
    padding: 3,
    borderStyle: 'solid',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  frameCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#8B5CF6',
    borderWidth: 2,
  },
  frameTopLeft: { top: 4, left: 4, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  frameTopRight: { top: 4, right: 4, borderLeftWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  frameBottomLeft: { bottom: 4, left: 4, borderRightWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  frameBottomRight: { bottom: 4, right: 4, borderLeftWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  twoCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: CARD_PADDING,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 144, 24, 0.35)',
    position: 'relative',
    overflow: 'hidden',
  },
  leafDecor: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(230, 194, 41, 0.3)',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardValueSeason: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A0522D',
    marginBottom: 6,
  },
  cardValueUndertone: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: CARD_PADDING,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 144, 24, 0.35)',
    position: 'relative',
    overflow: 'hidden',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  colorSwatch: {
    width: (width - 32 - CARD_PADDING * 4 - 20) / 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchLarge: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  shareRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  shareButtonWhite: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(184, 144, 24, 0.3)',
  },
  shareButtonTextDark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
  },
  skinAgeYears: {
    fontSize: 26,
    fontWeight: '800',
    color: '#A0522D',
    marginBottom: 6,
  },
  browseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  colorFiltersScroll: {
    marginBottom: 16,
  },
  colorFiltersContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
  },
  colorFilterChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
  },
  colorFilterChipSelected: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  colorFilterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  colorFilterChipTextLight: { color: '#FFF' },
  colorFilterChipTextDark: { color: '#2C2C2C' },
  bottomPadding: { height: 24 },
  errorCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#2C2C2C', marginBottom: 8 },
  errorMessage: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 24 },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  goBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  goBackButtonText: { color: '#8B5CF6', fontSize: 16, fontWeight: '600' },
  playfulCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  playfulEmoji: { fontSize: 56, marginBottom: 16 },
  playfulTitle: { fontSize: 22, fontWeight: '700', color: '#2C2C2C', marginBottom: 12, textAlign: 'center' },
  playfulMessage: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  takeAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  takeAgainText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  genderMismatchCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  genderMismatchIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  genderMismatchTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2C2C2C',
    marginBottom: 16,
    textAlign: 'center',
  },
  genderMismatchMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  genderBoldText: {
    fontWeight: '700',
    color: '#2C2C2C',
  },
  genderMismatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  genderMismatchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  genderMismatchGoBackButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  genderMismatchGoBackText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});

