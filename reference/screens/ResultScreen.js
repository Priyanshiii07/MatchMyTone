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
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { analyzeSkinImage } from '../services/colorAnalysisGemini';
import { GEMINI_API_KEY } from '../geminiConfig';

const { width } = Dimensions.get('window');
const CARD_PADDING = 14;
const SPARKLE = '✨';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const photoUri = params?.photoUri;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selectedColorFilter, setSelectedColorFilter] = useState(null);

  useEffect(() => {
    if (!photoUri) {
      setError('No photo to analyze.');
      setLoading(false);
      return;
    }
    runAnalysis();
  }, [photoUri]);

  const runAnalysis = async () => {
    if (!photoUri) return;
    setLoading(true);
    setError('');
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const analysis = await analyzeSkinImage(base64, 'image/jpeg', GEMINI_API_KEY);
      setResult(analysis);
      if (analysis.isFace && analysis.colorsToWear?.length) {
        setSelectedColorFilter(analysis.colorsToWear[0].name);
      }
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

  const handleShare = async () => {
    if (!result?.isFace) return;
    try {
      await Share.share({
        message: `My color analysis: ${result.seasonType}, ${result.undertone} undertone. Colors to wear: ${result.colorsToWear?.map((c) => c.name).join(', ')}`,
        title: 'My Color Analysis - MatchMyTone',
      });
    } catch (e) {}
  };

  const openWhatsApp = () => {
    const text = result?.isFace
      ? `My color analysis: ${result.seasonType}, ${result.undertone} undertone!`
      : 'Check out my color analysis on MatchMyTone!';
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
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

  if (!result) return null;

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
            <Text style={styles.headerTitle}>Color Analysis</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="flag-outline" size={22} color="#2C2C2C" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color="#2C2C2C" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="close" size={24} color="#2C2C2C" />
              </TouchableOpacity>
            </View>
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
          <View style={styles.photoFrameWrapper}>
            <View style={styles.photoFrame}>
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
              <View style={[styles.frameCorner, styles.frameTopLeft]} />
              <View style={[styles.frameCorner, styles.frameTopRight]} />
              <View style={[styles.frameCorner, styles.frameBottomLeft]} />
              <View style={[styles.frameCorner, styles.frameBottomRight]} />
            </View>
          </View>

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

          {/* Colors to wear */}
          <View style={styles.sectionCard}>
            <View style={styles.leafDecor} />
            <Text style={styles.cardLabel}>COLORS TO WEAR</Text>
            <View style={styles.colorGrid}>
              {(result.colorsToWear || []).slice(0, 6).map((c, i) => (
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

          {/* Share buttons */}
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareButtonWhite} onPress={openWhatsApp}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={styles.shareButtonTextDark}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButtonWhite} onPress={handleShare}>
              <Ionicons name="camera" size={24} color="#E4405F" />
              <Text style={styles.shareButtonTextDark}>Stories</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButtonBlack} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Browse Looks */}
          <Text style={styles.browseTitle}>Browse Looks for your analysis</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.colorFiltersScroll}
            contentContainerStyle={styles.colorFiltersContent}
          >
            {(result.colorsToWear || []).map((c, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.colorFilterChip,
                  { backgroundColor: c.hex || '#CCC' },
                  selectedColorFilter === c.name && styles.colorFilterChipSelected,
                ]}
                onPress={() => setSelectedColorFilter(c.name)}
              >
                <Text
                  style={[
                    styles.colorFilterChipText,
                    (c.hex && isDarkHex(c.hex)) ? styles.colorFilterChipTextLight : styles.colorFilterChipTextDark,
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.bottomPadding} />
        </SafeAreaView>
      </ScrollView>
    </View>
  );
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
  shareButtonBlack: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButtonTextDark: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
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
});
