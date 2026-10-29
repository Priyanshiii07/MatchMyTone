import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';

const { width, height } = Dimensions.get('window');

// Camera preview dimensions (rounded rectangle)
const PREVIEW_WIDTH = width * 0.9;
const PREVIEW_HEIGHT = height * 0.6;
const PREVIEW_TOP = height * 0.2;

// Oval guide dimensions (centered in preview)
const OVAL_WIDTH = PREVIEW_WIDTH * 0.7;
const OVAL_HEIGHT = PREVIEW_HEIGHT * 0.8;
const OVAL_CENTER_X = width / 2;
const OVAL_CENTER_Y = PREVIEW_TOP + PREVIEW_HEIGHT / 2;

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const countdownIntervalRef = useRef(null);

  // Validation states
  const [lightingValid, setLightingValid] = useState(false);
  const [expressionValid, setExpressionValid] = useState(false);
  const [alignmentValid, setAlignmentValid] = useState(false);

  // Face tracking for stability
  const previousFacePosition = useRef(null);
  const faceStabilityFrames = useRef(0);
  const REQUIRED_STABLE_FRAMES = 10; // Face must be stable for 10 frames

  // Countdown animation
  const countdownScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Handle face detection - runs continuously in real-time
  const handleFacesDetected = ({ faces }) => {
    // If capturing, don't process new detections
    if (isCapturing) {
      return;
    }

    // No faces detected - reset everything
    if (!faces || faces.length === 0) {
      setLightingValid(false);
      setExpressionValid(false);
      setAlignmentValid(false);
      resetCountdown();
      faceStabilityFrames.current = 0;
      previousFacePosition.current = null;
      return;
    }

    // Only one face allowed
    if (faces.length !== 1) {
      setLightingValid(false);
      setExpressionValid(false);
      setAlignmentValid(false);
      resetCountdown();
      faceStabilityFrames.current = 0;
      previousFacePosition.current = null;
      return;
    }

    const face = faces[0];
    const bounds = face.bounds;

    // Face detection coordinates are normalized (0-1), use them directly for stability
    const faceCenterX = bounds.origin.x + bounds.size.width / 2;
    const faceCenterY = bounds.origin.y + bounds.size.height / 2;
    const faceWidth = bounds.size.width;
    const faceHeight = bounds.size.height;

    // Check face stability (no shaking) - using normalized coordinates
    const currentFacePos = { x: faceCenterX, y: faceCenterY, width: faceWidth, height: faceHeight };
    if (previousFacePosition.current) {
      const movement = Math.sqrt(
        Math.pow(currentFacePos.x - previousFacePosition.current.x, 2) +
        Math.pow(currentFacePos.y - previousFacePosition.current.y, 2)
      );
      const sizeChange = Math.abs(currentFacePos.width - previousFacePosition.current.width);

      // Threshold for normalized coordinates (0.01 = 1% of screen)
      if (movement < 0.01 && sizeChange < 0.01) {
        faceStabilityFrames.current++;
      } else {
        // Face moved - reset stability and countdown
        faceStabilityFrames.current = 0;
        resetCountdown();
      }
    }
    previousFacePosition.current = currentFacePos;

    // Validation 1: Alignment - Face must be inside oval (all landmarks inside)
    const isAligned = checkFaceAlignment(face, bounds);
    const isStable = faceStabilityFrames.current >= REQUIRED_STABLE_FRAMES;
    setAlignmentValid(isAligned && isStable);

    // Validation 2: Lighting - Check brightness and contrast
    const isLightingGood = checkLighting(face);
    setLightingValid(isLightingGood);

    // Validation 3: Expression - Neutral expression (no smile, mouth closed, eyes open)
    const isExpressionNeutral = checkNeutralExpression(face);
    setExpressionValid(isExpressionNeutral);

    // Check if all three validations pass AND face is stable
    const allValid = isAligned && 
                     isLightingGood && 
                     isExpressionNeutral && 
                     isStable;

    // If all valid and countdown not started, start it
    if (allValid && !isCapturing) {
      if (countdown === null) {
        startCountdown();
      }
    } else {
      // If any validation fails during countdown, reset it
      if (countdown !== null) {
        resetCountdown();
      }
    }
  };

  // Check if face is aligned inside oval - ALL key landmarks must be inside
  const checkFaceAlignment = (face, bounds) => {
    if (!face.landmarks) return false;

    // Face detection coordinates are normalized (0-1) relative to image
    // We need to convert to screen coordinates relative to preview frame
    const previewLeft = (width - PREVIEW_WIDTH) / 2;
    const previewTop = PREVIEW_TOP;
    
    // Get key landmarks - eyes, nose, mouth, chin
    const leftEye = face.landmarks.leftEye;
    const rightEye = face.landmarks.rightEye;
    const noseBase = face.landmarks.noseBase;
    const mouth = face.landmarks.mouth;
    const bottomMouth = face.landmarks.bottomMouth;

    if (!leftEye || !rightEye || !noseBase || !mouth || !bottomMouth) {
      return false;
    }

    // Convert landmark coordinates to screen coordinates
    const landmarks = [
      ...leftEye.map(p => ({
        x: previewLeft + (p.x * PREVIEW_WIDTH),
        y: previewTop + (p.y * PREVIEW_HEIGHT),
      })),
      ...rightEye.map(p => ({
        x: previewLeft + (p.x * PREVIEW_WIDTH),
        y: previewTop + (p.y * PREVIEW_HEIGHT),
      })),
      ...noseBase.map(p => ({
        x: previewLeft + (p.x * PREVIEW_WIDTH),
        y: previewTop + (p.y * PREVIEW_HEIGHT),
      })),
      ...mouth.map(p => ({
        x: previewLeft + (p.x * PREVIEW_WIDTH),
        y: previewTop + (p.y * PREVIEW_HEIGHT),
      })),
      ...bottomMouth.map(p => ({
        x: previewLeft + (p.x * PREVIEW_WIDTH),
        y: previewTop + (p.y * PREVIEW_HEIGHT),
      })),
    ];

    // Oval equation: (x-cx)²/a² + (y-cy)²/b² <= 1
    const a = OVAL_WIDTH / 2;
    const b = OVAL_HEIGHT / 2;

    // Check if ALL landmarks are inside oval
    for (const landmark of landmarks) {
      const dx = (landmark.x - OVAL_CENTER_X) / a;
      const dy = (landmark.y - OVAL_CENTER_Y) / b;
      const distance = dx * dx + dy * dy;
      
      if (distance > 1) {
        return false; // Landmark outside oval
      }
    }

    return true;
  };

  // Check lighting quality - brightness and contrast checks
  const checkLighting = (face) => {
    // Face detection coordinates are normalized (0-1)
    // Check if face has reasonable size (not too small = too far, not too large = too close)
    const faceWidth = face.bounds.size.width; // Normalized 0-1
    const faceHeight = face.bounds.size.height; // Normalized 0-1
    const faceArea = faceWidth * faceHeight; // Normalized area 0-1

    // Face should occupy 15-50% of preview area for good lighting
    // Too small (< 0.15) = too far = poor lighting
    // Too large (> 0.50) = too close = poor lighting
    if (faceArea < 0.15 || faceArea > 0.50) {
      return false;
    }

    // Check face detection confidence (higher confidence = better lighting)
    if (face.detectionConfidence !== undefined && face.detectionConfidence < 0.7) {
      return false; // Low confidence = poor lighting
    }

    return true;
  };

  // Check for neutral expression - no smile, mouth closed, eyes open, no raised eyebrows
  const checkNeutralExpression = (face) => {
    if (!face.landmarks) return false;

    // Check if smiling (smilingProbability)
    if (face.smilingProbability !== undefined && face.smilingProbability > 0.3) {
      return false; // Smiling detected
    }

    // Check if eyes are open (both must be open)
    if (face.leftEyeOpenProbability !== undefined && face.leftEyeOpenProbability < 0.5) {
      return false; // Left eye closed
    }
    if (face.rightEyeOpenProbability !== undefined && face.rightEyeOpenProbability < 0.5) {
      return false; // Right eye closed
    }

    // Check mouth position (should be closed/neutral)
    // Landmarks are in normalized coordinates (0-1)
    if (face.landmarks.mouth && face.landmarks.mouth.length >= 2) {
      const mouthTop = face.landmarks.mouth[0];
      const mouthBottom = face.landmarks.mouth[face.landmarks.mouth.length - 1];
      const mouthOpen = Math.abs(mouthBottom.y - mouthTop.y);
      
      // Mouth should be relatively closed (normalized threshold: 0.05 = 5% of screen height)
      if (mouthOpen > 0.05) {
        return false; // Mouth too open
      }
    }

    return true;
  };

  // Start countdown - only when all validations pass
  const startCountdown = () => {
    setCountdown(3);
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          capturePhoto();
          return null;
        }
        
        // Animate countdown
        Animated.sequence([
          Animated.timing(countdownScale, {
            toValue: 1.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(countdownScale, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
        
        return prev - 1;
      });
    }, 1000);
  };

  // Reset countdown - called when validation fails
  const resetCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    countdownScale.setValue(1);
  };

  // Capture photo - automatically called after countdown
  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      resetCountdown();

      // Lock camera during capture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });

      // Save to permanent storage
      const timestamp = new Date().getTime();
      const filename = `selfie_${timestamp}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.moveAsync({
        from: photo.uri,
        to: fileUri,
      });

      // Navigate to result screen
      router.push({
        pathname: '/ColorAnalysis/result',
        params: {
          photoUri: fileUri,
        },
      });
    } catch (error) {
      console.error('Error capturing photo:', error);
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#FFFFFF" />
            <Text style={styles.permissionText}>
              We need your permission to use the camera
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButtonText}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          onCameraReady={() => {
            // Camera is ready
          }}
          faceDetectorSettings={{
            mode: FaceDetector.FaceDetectorMode.fast,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
            runClassifications: FaceDetector.FaceDetectorClassifications.all,
            minDetectionInterval: 100,
            tracking: true,
          }}
          onFacesDetected={handleFacesDetected}
        />
        
        {/* Overlay with UI Elements */}
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Validation Indicators */}
          <View style={styles.validationContainer}>
            <ValidationCard
              icon="sunny"
              text="Make sure there is good lighting"
              isValid={lightingValid}
            />
            <ValidationCard
              icon="happy"
              text="Keep neutral expressions"
              isValid={expressionValid}
            />
            <ValidationCard
              icon="scan"
              text="Align your face within the frame"
              isValid={alignmentValid}
            />
          </View>

          {/* Camera Preview Area with Rounded Rectangle Mask */}
          <View style={styles.previewContainer}>
            {/* Dark overlay with rounded rectangle cutout */}
            <View style={styles.overlayTop} />
            <View style={styles.overlayBottom} />
            <View style={styles.overlayLeft} />
            <View style={styles.overlayRight} />

            {/* Rounded Rectangle Frame */}
            <View style={styles.previewFrame}>
              {/* Oval Guide Overlay */}
              <View style={styles.ovalGuideContainer}>
                <View style={styles.ovalGuide} />
                
                {/* Countdown Display */}
                {countdown !== null && countdown > 0 && (
                  <Animated.View
                    style={[
                      styles.countdownContainer,
                      { transform: [{ scale: countdownScale }] },
                    ]}
                  >
                    <Text style={styles.countdownText}>{countdown}</Text>
                  </Animated.View>
                )}
              </View>
            </View>

            {/* Helper Text */}
            <View style={styles.helperTextContainer}>
              <Text style={styles.helperText}>Align your face inside the oval</Text>
            </View>

            {/* Capture Button - tap to take photo and go to result */}
            <View style={styles.captureButtonContainer}>
              <TouchableOpacity
                style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
                onPress={capturePhoto}
                disabled={isCapturing}
                activeOpacity={0.8}
              >
                {isCapturing ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="camera" size={36} color="#FFFFFF" style={styles.captureButtonIcon} />
                    <Text style={styles.captureButtonText}>Take photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

// Validation Card Component
const ValidationCard = ({ icon, text, isValid }) => (
  <View style={[styles.validationCard, isValid && styles.validationCardValid]}>
    <Ionicons
      name={isValid ? 'checkmark-circle' : 'ellipse-outline'}
      size={20}
      color={isValid ? '#4CAF50' : '#999999'}
      style={styles.validationIcon}
    />
    <Text style={[styles.validationText, isValid && styles.validationTextValid]}>
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  validationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 8,
  },
  validationCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#999999',
  },
  validationCardValid: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  validationIcon: {
    marginBottom: 4,
  },
  validationText: {
    fontSize: 10,
    color: '#999999',
    textAlign: 'center',
    fontWeight: '500',
  },
  validationTextValid: {
    color: '#4CAF50',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PREVIEW_TOP,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height - PREVIEW_TOP - PREVIEW_HEIGHT - 100,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  overlayLeft: {
    position: 'absolute',
    top: PREVIEW_TOP,
    left: 0,
    width: (width - PREVIEW_WIDTH) / 2,
    height: PREVIEW_HEIGHT,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  overlayRight: {
    position: 'absolute',
    top: PREVIEW_TOP,
    right: 0,
    width: (width - PREVIEW_WIDTH) / 2,
    height: PREVIEW_HEIGHT,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  previewFrame: {
    position: 'absolute',
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    top: PREVIEW_TOP,
    left: (width - PREVIEW_WIDTH) / 2,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  ovalGuideContainer: {
    position: 'absolute',
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    top: PREVIEW_TOP,
    left: (width - PREVIEW_WIDTH) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  ovalGuide: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_HEIGHT / 2,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderStyle: 'dashed',
  },
  countdownContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -50,
    marginTop: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  countdownText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  helperTextContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  helperText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 200,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonDisabled: {
    opacity: 0.8,
  },
  captureButtonIcon: {
    marginRight: 10,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});
