import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const instructions = [
  '1. Stand in good light',
  '2. Remove glasses & makeup',
  '3. Keep your face straight',
];

export default function SelfieScreen() {
  const router = useRouter();
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update index
        setCurrentInstructionIndex((prev) => (prev + 1) % instructions.length);
        
        // Reset position
        slideAnim.setValue(20);
        
        // Fade in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2000); // Change every 2 seconds

    return () => clearInterval(interval);
  }, [fadeAnim, slideAnim]);

  const handleTakeSelfie = () => {
    // Navigate to next page (will be defined later)
    router.push('/ColorAnalysis/camera');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Soft Grid Pattern */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: Math.ceil(height / 40) }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLine, styles.gridLineHorizontal, { top: i * 40 }]} />
        ))}
        {Array.from({ length: Math.ceil(width / 40) }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLine, styles.gridLineVertical, { left: i * 40 }]} />
        ))}
      </View>
      <SafeAreaView style={styles.safeArea}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>
            Let's analyze your skin{'\n'}with a well-lit selfie
          </Text>

          {/* Selfie Image */}
          <View style={styles.imageContainer}>
            <View style={styles.imagePlaceholder}>
              <Image
                source={require('../../../assets/color1.png')}
                style={styles.selfieImage}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Rotating Instructions */}
          <View style={styles.instructionContainer}>
            <Animated.View
              style={[
                styles.instructionWrapper,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.instruction}>
                {instructions[currentInstructionIndex]}
              </Text>
            </Animated.View>
          </View>

          {/* Take a selfie Button */}
          <TouchableOpacity
            style={styles.takeSelfieButton}
            onPress={handleTakeSelfie}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={24} color="#FFFFFF" style={styles.cameraIcon} />
            <Text style={styles.takeSelfieText}>Take a selfie</Text>
          </TouchableOpacity>

          {/* Privacy Statement */}
          <View style={styles.privacyContainer}>
            <Ionicons name="lock-closed" size={14} color="#666666" style={styles.lockIcon} />
            <Text style={styles.privacyText}>
              Your selfie is processed securely, used only for analysis, and never stored or shared.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
    zIndex: 2,
    position: 'relative',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 32,
  },
  imageContainer: {
    width: width * 0.85,
    aspectRatio: 0.75,
    marginBottom: 30,
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(184, 144, 24, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  instructionContainer: {
    height: 30,
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionWrapper: {
    position: 'absolute',
  },
  instruction: {
    fontSize: 16,
    color: '#2C2C2C',
    textAlign: 'center',
  },
  takeSelfieButton: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: width * 0.85,
    marginBottom: 20,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cameraIcon: {
    marginRight: 8,
  },
  takeSelfieText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(184, 144, 24, 0.2)',
  },
  lockIcon: {
    marginRight: 6,
  },
  privacyText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
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

