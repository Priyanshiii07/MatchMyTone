import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function AboutScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient colors={['#fffaf3', '#fbeed9']} style={styles.bg}>
      {/* Soft Grid Pattern */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: Math.ceil(height / 40) }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLine, styles.gridLineHorizontal, { top: i * 40 }]} />
        ))}
        {Array.from({ length: Math.ceil(width / 40) }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLine, styles.gridLineVertical, { left: i * 40 }]} />
        ))}
      </View>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={{ height: 40 }} />

          <View style={styles.headerContainer}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
            >
              <Ionicons name="chevron-forward" size={24} color="#2C2C2C" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>About Us</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <Text style={styles.aboutText}>
                MatchMyTone is a revolutionary personal styling and beauty analysis platform designed to help individuals discover their perfect color palette, understand their unique skin characteristics, and make informed decisions about their personal style and skincare routine. Our comprehensive platform combines cutting-edge color analysis technology with detailed skincare assessment tools to provide users with personalized recommendations that enhance their natural beauty and boost their confidence.

                Our color analysis feature helps users identify their ideal color palette by examining their skin tone, hair color, and eye color to determine which colors complement their natural features best. This scientific approach ensures that users can make confident choices when selecting clothing, accessories, and makeup that will enhance their appearance. By understanding whether they are warm, cool, or neutral-toned, users can curate a wardrobe and makeup collection that consistently makes them look their best.

                The skincare analysis component takes a comprehensive approach to understanding individual skin needs through detailed questionnaires and assessments. Our system evaluates various factors including skin type, sensitivity levels, and personal skincare goals to provide tailored recommendations. Whether you have oily, dry, combination, normal, or sensitive skin, MatchMyTone helps you understand your skin's unique characteristics and provides guidance on the best products and routines to maintain healthy, glowing skin.

                MatchMyTone also offers body and face analysis features that help users understand their body shape and facial structure, providing styling advice that helps users feel confident and comfortable. Our interactive quizzes and assessments make the process of discovering your perfect match both enjoyable and informative. At MatchMyTone, we believe that everyone deserves to feel confident and beautiful in their own skin, and our platform empowers users with knowledge about their unique characteristics to make informed decisions about their personal style and skincare.
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: "#FFF8E7"
  },
  container: {
    flex: 1,
    padding: 20
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#2C2C2C",
    flex: 1,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  aboutText: {
    color: "#2C2C2C",
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
    textAlign: 'justify',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(184, 144, 24, 0.08)',
  },
  gridLineHorizontal: {
    width: '100%',
    height: 1,
  },
  gridLineVertical: {
    height: '100%',
    width: 1,
  },
});

