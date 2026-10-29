import { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { authAPI } from '../src/api';

const { width, height } = Dimensions.get('window');
const REGISTER_MODAL_MAX_HEIGHT = Math.round(height * 0.9);
const REGISTER_SCROLL_MAX_HEIGHT = Math.max(REGISTER_MODAL_MAX_HEIGHT - 72, 280);

export default function MainScreen() {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // register state (moved before useEffect that uses dobOpen)
  const [rDob, setRDob] = useState('');
  const [dobOpen, setDobOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Sticker animations - left to right with wave motion
  // Create animated values for all 16 stickers
  const stickerAnimations = useMemo(() =>
    Array.from({ length: 16 }, () => ({
      x: new Animated.Value(-100), // Start off-screen left
      wave: new Animated.Value(0), // Wave motion
    })), []
  );

  // All 16 images - shuffled randomly, 8 above text, 8 below text
  const allStickers = useMemo(() => {
    const allImages = [
      { source: require('../assets/1.jpg'), sizeOffset: 0 },
      { source: require('../assets/2.jpg'), sizeOffset: 0 },
      { source: require('../assets/3.jpg'), sizeOffset: 0 },
      { source: require('../assets/4.jpg'), sizeOffset: 0 },
      { source: require('../assets/5.jpg'), sizeOffset: 0 },
      { source: require('../assets/6.jpg'), sizeOffset: 0 },
      { source: require('../assets/7.jpg'), sizeOffset: 0 },
      { source: require('../assets/8.jpg'), sizeOffset: 0 },
      { source: require('../assets/9.jpg'), sizeOffset: 0 },
      { source: require('../assets/10.jpg'), sizeOffset: 0 },
      { source: require('../assets/11.jpg'), sizeOffset: 0 },
      { source: require('../assets/12.jpg'), sizeOffset: 0 },
      { source: require('../assets/13.jpg'), sizeOffset: 35 }, // Bigger
      { source: require('../assets/14.jpg'), sizeOffset: 35 }, // Bigger
      { source: require('../assets/15.jpg'), sizeOffset: 35 }, // Bigger
      { source: require('../assets/16.jpg'), sizeOffset: 35 }, // Bigger
    ];

    // Shuffle array randomly
    const shuffled = [...allImages];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }, []);

  useEffect(() => {
    // Animate all 16 stickers - NO OVERLAPPING
    // 8 images above text, 8 images below text
    const crossScreenDuration = 6000; // Slightly slower speed
    const initialX = -500; // Start well off-screen left
    const maxImageSize = 135; // Maximum image size (100 + 35 offset)
    const safeSpacing = maxImageSize + 50; // Safe spacing between images to prevent overlap

    // Calculate Y positions to utilize all space without overlap
    const buttonBottom = 110;
    const textTop = 190;
    const textBottom = 260;
    const screenBottom = height - 100;

    // Calculate spacing to ensure no vertical overlap
    const aboveSpace = textTop - buttonBottom;
    const aboveSpacing = Math.max(aboveSpace / 8, maxImageSize + 20); // Ensure minimum spacing

    const belowSpace = screenBottom - textBottom;
    const belowSpacing = Math.max(belowSpace / 8, maxImageSize + 20); // Ensure minimum spacing

    // Separate images into above and below groups
    const aboveGroup = [];
    const belowGroup = [];

    stickerAnimations.forEach((anim, idx) => {
      const stickerData = allStickers[idx];
      const imageSize = 100 + (stickerData?.sizeOffset || 0);

      if (idx < 8) {
        // Above text group
        const yPos = buttonBottom + 10 + (idx * aboveSpacing);
        aboveGroup.push({ anim, idx, yPos, imageSize, delay: idx * (crossScreenDuration / 8) });
      } else {
        // Below text group
        const belowIdx = idx - 8;
        const yPos = textBottom + 20 + (belowIdx * belowSpacing);
        belowGroup.push({ anim, idx, yPos, imageSize, delay: belowIdx * (crossScreenDuration / 8) });
      }
    });

    const animateImage = (anim, yPos, delay, idx) => {
      // Reset position
      anim.x.setValue(initialX);
      anim.wave.setValue(0);

      // Floating motion (up-down) - continuous floating
      const floatDuration = 2000 + (idx % 3) * 300; // Vary by index for natural look
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim.wave, {
            toValue: 1,
            duration: floatDuration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.wave, {
            toValue: 0,
            duration: floatDuration,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Horizontal movement - properly spaced to prevent overlap
      const runAnimation = () => {
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim.x, {
            toValue: width + 200, // Exit well off-screen right
            duration: crossScreenDuration,
            useNativeDriver: true,
          }),
          Animated.timing(anim.x, {
            toValue: initialX, // Reset to start position
            duration: 0,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // After completing, restart with same delay pattern
          runAnimation();
        });
      };

      runAnimation();
    };

    // Animate above group - each image enters when previous is far enough
    aboveGroup.forEach(({ anim, idx, yPos, delay }) => {
      animateImage(anim, yPos, delay, idx);
    });

    // Animate below group - each image enters when previous is far enough
    belowGroup.forEach(({ anim, idx, yPos, delay }) => {
      animateImage(anim, yPos, delay, idx);
    });
  }, []);

  useEffect(() => {
    registerModalOpenRef.current = showRegister;
    if (!showRegister) setIsRegistering(false);
  }, [showRegister]);

  // register state
  const [rName, setRName] = useState('');
  const [rNameError, setRNameError] = useState('');
  const [rGender, setRGender] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rPhoneError, setRPhoneError] = useState('');
  const [rEmail, setREmail] = useState('');
  const [rEmailError, setREmailError] = useState('');
  const [rDobError, setRDobError] = useState('');
  const [rAge, setRAge] = useState('');
  const [rPassword, setRPassword] = useState('');
  const [rConfirm, setRConfirm] = useState('');
  const [rError, setRError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const registerModalOpenRef = useRef(false);

  // login state
  const [lName, setLName] = useState('');
  const [lPassword, setLPassword] = useState('');
  const [lError, setLError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // forgot password state (same password rules as register)
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Animation values for button transitions
  const [registerScale] = useState(new Animated.Value(1));
  const [loginScale] = useState(new Animated.Value(1));

  // basic password strength calc
  const strength = (() => {
    let s = 0;
    if (rPassword.length >= 8) s++;
    if (/[A-Z]/.test(rPassword)) s++;
    if (/[a-z]/.test(rPassword)) s++;
    if (/[0-9]/.test(rPassword)) s++;
    if (/[^A-Za-z0-9]/.test(rPassword)) s++;
    return s; // 0..5
  })();

  const forgotStrength = (() => {
    let s = 0;
    const p = forgotNewPassword;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[a-z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const passwordMeetsRegisterRules = (p) =>
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p);

  const clearForgotForm = () => {
    setForgotUsername('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setShowForgotNewPassword(false);
    setShowForgotConfirmPassword(false);
  };

  const onRegister = async () => {
    console.log('Register button pressed');
    setRError('');
    if (!rName || !rGender || !rPhone || !rEmail || !rDob || !rAge || !rPassword || !rConfirm) {
      setRError('Please fill all fields');
      return;
    }
    if (rNameError || rPhoneError || rEmailError || rDobError) {
      setRError('Please fix the validation errors');
      return;
    }
    if (rPhone.length !== 10) {
      setRPhoneError('Phone number must be exactly 10 digits');
      setRError('Please fix the validation errors');
      return;
    }
    if (rPassword !== rConfirm) {
      setRError('Passwords do not match');
      return;
    }

    setIsRegistering(true);
    try {
      console.log('Attempting registration...');
      const response = await authAPI.register({
        name: rName,
        email: rEmail,
        phone: rPhone,
        password: rPassword,
        gender: rGender,
        dob: rDob,
        age: rAge
      });

      console.log('Registration response received:', JSON.stringify(response, null, 2));

      if (response) {
        if (!registerModalOpenRef.current) return;
        console.log('Registration successful, showing verification message...');
        // Clear form
        setRName(''); setRNameError(''); setRGender(''); setRPhone(''); setRPhoneError('');
        setREmail(''); setREmailError(''); setRDob(''); setRAge('');
        setRPassword(''); setRConfirm(''); setRError('');
        // Close register modal
        setShowRegister(false);

        // Show verification message
        Alert.alert(
          'Check your email ✉️',
          response.message || 'We sent a verification link to your email. Please click it to verify your account, then log in.',
          [{ text: 'OK', onPress: () => setShowLogin(true) }]
        );
      }
    } catch (error) {
      console.warn('Registration error:', error?.message || error);
      setRError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const onLogin = async () => {
    if (isLoggingIn) return; // Prevent double submission

    setLError('');
    if (!lName || !lPassword) {
      setLError('Please enter username and password');
      return;
    }

    setIsLoggingIn(true);
    try {
      console.log('Attempting login...');
      const response = await authAPI.login(lName, lPassword);
      console.log('Login response received:', JSON.stringify(response, null, 2));

      // Check if login was successful - be more flexible with response structure
      if (response) {
        const user = response.user || response;
        const token = user?.token || response.token;

        if (token || user) {
          console.log('Login successful, token stored, navigating to home...');
          // Clear form
          setLName('');
          setLPassword('');
          setLError('');
          // Close modal first
          setIsLoggingIn(false);
          setShowLogin(false);
          console.log('Login modal closed, navigating to home...');

          // Verify token was stored before navigating
          const storedToken = await AsyncStorage.getItem('authToken');
          if (storedToken) {
            console.log('Token verified in storage, navigating to home...');
          } else {
            console.warn('Token not found in storage, but proceeding with navigation');
          }

          // Small delay to ensure modal is closed before navigation
          setTimeout(() => {
            try {
              console.log('Navigating to /home');
              router.replace('/home');
            } catch (navError) {
              console.error('Navigation error:', navError);
              // Try push as fallback
              try {
                console.log('Trying router.push as fallback');
                router.push('/home');
              } catch (pushError) {
                console.error('Push navigation also failed:', pushError);
                setLError('Login successful but navigation failed. Please restart the app.');
              }
            }
          }, 150);
        } else {
          console.warn('Login response missing token/user:', response);
          setIsLoggingIn(false);
          setLError('Login failed. Please check your credentials and try again.');
        }
      } else {
        console.warn('Empty login response');
        setIsLoggingIn(false);
        setLError('Login failed. Please check your credentials and try again.');
      }
    } catch (error) {
      setIsLoggingIn(false);
      const msg = error.message || 'Invalid credentials. Please check your username and password.';

      // If the error is about email verification, offer to resend the link
      if (msg.toLowerCase().includes('verify your email')) {
        Alert.alert(
          'Email Not Verified',
          'Please verify your email before logging in. Check your inbox for the verification link.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Resend Link', onPress: async () => {
                try {
                  // We need the email — ask user or try to get from response
                  const emailToResend = lName; // username might not be email, but try
                  await authAPI.resendVerification(emailToResend);
                  Alert.alert('Sent!', 'A new verification link has been sent to your email.');
                } catch (resendErr) {
                  Alert.alert('Error', resendErr.message || 'Could not resend verification email.');
                }
              }
            }
          ]
        );
      } else {
        setLError(msg);
      }
    }
  };

  const onResetPassword = async () => {
    if (isResettingPassword) return;
    setForgotError('');

    const name = forgotUsername.trim();
    if (!name || !forgotNewPassword || !forgotConfirmPassword) {
      setForgotError('Please fill all fields');
      return;
    }
    if (!passwordMeetsRegisterRules(forgotNewPassword)) {
      setForgotError('Password must meet all requirements below.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    setIsResettingPassword(true);
    try {
      await authAPI.resetPassword(name, forgotNewPassword);
      clearForgotForm();
      setShowForgot(false);
      setShowLogin(true);
      setLName(name);
      setLPassword('');
      Alert.alert('Password updated', 'You can log in with your new password.');
    } catch (error) {
      const msg = error?.message || 'Could not reset password. Try again.';
      setForgotError(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleRegisterPress = () => {
    Animated.sequence([
      Animated.timing(registerScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(registerScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => setShowRegister(true), 150);
  };

  const handleLoginPress = () => {
    Animated.sequence([
      Animated.timing(loginScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(loginScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => setShowLogin(true), 150);
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
      <ScrollView contentContainerStyle={styles.container}>
        {/* Auth Labels - Top */}
        <View style={styles.authLabelsTop}>
          <Animated.View style={{ transform: [{ scale: registerScale }] }}>
            <TouchableOpacity style={[styles.authLabel, styles.register]} onPress={handleRegisterPress}>
              <Text style={styles.authText}>REGISTER</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: loginScale }] }}>
            <TouchableOpacity style={[styles.authLabel, styles.login, { marginLeft: 14 }]} onPress={handleLoginPress}>
              <Text style={styles.authText}>LOGIN</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Main Heading - Centered */}
        <View style={styles.centerContainer}>
          <Text style={styles.mainHeading}>MatchMyTone</Text>
        </View>

        {/* Floating stickers with left-to-right and wave animation - All 16 images, NO OVERLAP */}
        {stickerAnimations.map((anim, idx) => {
          const stickerData = allStickers[idx];
          if (!stickerData) return null;
          const { source, sizeOffset } = stickerData;

          // Position 8 images above text, 8 images below text - NO OVERLAP
          let startY;
          const floatRange = 30; // Reduced floating range to prevent overlap
          const maxImageSize = 135; // Maximum image size

          // Calculate Y positions - MUST MATCH useEffect calculations
          const buttonBottom = 110;
          const textTop = 190;
          const textBottom = 260;
          const screenBottom = height - 100;

          // Same calculation as in useEffect
          const aboveSpace = textTop - buttonBottom;
          const aboveSpacing = Math.max(aboveSpace / 8, maxImageSize + 20);

          const belowSpace = screenBottom - textBottom;
          const belowSpacing = Math.max(belowSpace / 8, maxImageSize + 20);

          if (idx < 8) {
            // First 8 images: above text - MUST stay above text
            startY = buttonBottom + 10 + (idx * aboveSpacing);
            // Ensure it doesn't go below text
            if (startY + maxImageSize / 2 > textTop - 10) {
              startY = textTop - 10 - maxImageSize / 2;
            }
          } else {
            // Last 8 images: below text - MUST stay below text
            const belowIdx = idx - 8;
            startY = textBottom + 20 + (belowIdx * belowSpacing);
          }

          const stickerSize = 100 + sizeOffset;
          return (
            <Animated.Image
              key={`sticker-${idx}`}
              source={source}
              style={[
                styles.sticker,
                {
                  width: stickerSize,
                  height: stickerSize,
                  transform: [
                    { translateX: anim.x },
                    {
                      translateY: anim.wave.interpolate({
                        inputRange: [0, 1],
                        outputRange: [startY + floatRange / 2, startY - floatRange / 2], // Floating motion (30px range)
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          );
        })}
      </ScrollView>

      {/* Register Modal */}
      <Modal
        transparent
        visible={showRegister}
        animationType="slide"
        onRequestClose={() => {
          if (!isRegistering) setShowRegister(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.registerOverlay} pointerEvents="box-none">
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!isRegistering) {
                  Keyboard.dismiss();
                  setShowRegister(false);
                }
              }}
            />
            <View style={[styles.modal, styles.registerModal]} pointerEvents="auto">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Registration</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!isRegistering) {
                      Keyboard.dismiss();
                      setShowRegister(false);
                    }
                  }}
                  disabled={isRegistering}
                  accessibilityState={{ disabled: isRegistering }}
                >
                  <Text style={[styles.close, isRegistering && styles.closeDisabled]}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.registerScroll}
                contentContainerStyle={styles.registerScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
              <View style={styles.formGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={rName}
                  onChangeText={async (text) => {
                    setRName(text);
                    setRNameError('');

                    // Check if username already exists
                    if (text.trim().length > 0) {
                      try {
                        const existingUsers = await AsyncStorage.getItem('registeredUsers');
                        if (existingUsers) {
                          const users = JSON.parse(existingUsers);
                          const usernameExists = users.find((u) => u.name.toLowerCase() === text.toLowerCase().trim());
                          if (usernameExists) {
                            setRNameError('This username already exists');
                            return;
                          }
                        }
                      } catch (error) {
                        console.error('Error checking username:', error);
                      }
                    }
                  }}
                  placeholder="Enter your username"
                  placeholderTextColor="#888"
                />
                {rNameError ? <Text style={styles.fieldError}>{rNameError}</Text> : null}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={rGender}
                    onValueChange={(v) => setRGender(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select Gender" value="" />
                    <Picker.Item label="Female" value="female" />
                    <Picker.Item label="Male" value="male" />
                    <Picker.Item label="Other" value="other" />
                  </Picker>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={rPhone}
                  onChangeText={(text) => {
                    // Only allow digits
                    const digits = text.replace(/\D/g, '');
                    if (digits.length <= 10) {
                      setRPhone(digits);
                      if (digits.length === 10) {
                        setRPhoneError('');
                      } else if (digits.length > 0) {
                        setRPhoneError('Phone number must be exactly 10 digits');
                      } else {
                        setRPhoneError('');
                      }
                    }
                  }}
                  maxLength={10}
                  keyboardType="phone-pad"
                  placeholder="10-digit number"
                  placeholderTextColor="#888"
                />
                {rPhoneError ? <Text style={styles.fieldError}>{rPhoneError}</Text> : null}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={rEmail}
                  onChangeText={(text) => {
                    setREmail(text);
                    if (text.length > 0) {
                      const hasAt = text.includes('@');
                      const hasCom = text.endsWith('.com') || text.endsWith('.in');
                      if (!hasAt || !hasCom) {
                        setREmailError('Email must contain @ and end with .com or .in');
                      } else {
                        setREmailError('');
                      }
                    } else {
                      setREmailError('');
                    }
                  }}
                  keyboardType="email-address"
                  placeholder="example@gmail.com"
                  placeholderTextColor="#888"
                />
                {rEmailError ? <Text style={styles.fieldError}>{rEmailError}</Text> : null}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Date of Birth</Text>
                <View style={styles.dobRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={rDob}
                    onChangeText={(text) => {
                      // Remove all non-digits
                      const digits = text.replace(/\D/g, '');

                      // Format as DD-MM-YYYY
                      let formatted = '';
                      if (digits.length > 0) {
                        formatted = digits.substring(0, 2);
                        if (digits.length > 2) {
                          formatted += '-' + digits.substring(2, 4);
                        }
                        if (digits.length > 4) {
                          formatted += '-' + digits.substring(4, 8);
                        }
                      }

                      setRDob(formatted);
                      setRDobError(''); // Clear error when typing

                      // Calculate age when we have complete date (DD-MM-YYYY = 10 chars)
                      if (formatted.length === 10) {
                        const m = formatted.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                        if (m) {
                          const dd = parseInt(m[1], 10);
                          const mm = parseInt(m[2], 10) - 1;
                          const yy = parseInt(m[3], 10);
                          const d = new Date(yy, mm, dd);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const dateToCheck = new Date(yy, mm, dd);
                          dateToCheck.setHours(0, 0, 0, 0);

                          if (!isNaN(d.getTime()) && d.getFullYear() === yy && d.getMonth() === mm && d.getDate() === dd) {
                            // Check if date is in the future
                            if (dateToCheck > today) {
                              setRDobError('Date of birth cannot be in the future');
                              setRAge('');
                              return;
                            }

                            // Calculate age
                            let age = today.getFullYear() - yy;
                            const hasHadBirthday = (today.getMonth() > mm) || (today.getMonth() === mm && today.getDate() >= dd);
                            if (!hasHadBirthday) age -= 1;

                            if (age >= 0 && age <= 120) {
                              setRAge(String(age));
                              setRDobError('');
                              // Update picker date for calendar
                              setPickerDate(d);
                            } else {
                              setRDobError('Please enter a valid date of birth');
                              setRAge('');
                            }
                          } else {
                            setRDobError('Please enter a valid date');
                            setRAge('');
                          }
                        }
                      }
                    }}
                    keyboardType="number-pad"
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor="#888"
                    maxLength={10}
                  />
                  <TouchableOpacity
                    style={styles.calendarBtn}
                    onPress={() => {
                      // Parse current DOB or use today
                      let initialDate = new Date();
                      const m = rDob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
                      if (m) {
                        const dd = parseInt(m[1], 10);
                        const mm = parseInt(m[2], 10) - 1;
                        const yy = parseInt(m[3], 10);
                        const parsed = new Date(yy, mm, dd);
                        if (!isNaN(parsed.getTime())) {
                          initialDate = parsed;
                        }
                      }
                      setPickerDate(initialDate);
                      setDobOpen(true);
                    }}
                  >
                    <Text style={styles.calendarIcon}>📅</Text>
                  </TouchableOpacity>
                </View>
                {rDobError ? <Text style={styles.fieldError}>{rDobError}</Text> : null}
                {dobOpen && (
                  <DateTimePicker
                    mode="date"
                    value={pickerDate}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') {
                        setDobOpen(false);
                      }
                      if (event.type === 'dismissed') {
                        setDobOpen(false);
                        return;
                      }
                      if (selectedDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const selectedDateCheck = new Date(selectedDate);
                        selectedDateCheck.setHours(0, 0, 0, 0);

                        // Check if date is in the future
                        if (selectedDateCheck > today) {
                          setRDobError('Date of birth cannot be in the future');
                          setRAge('');
                          if (Platform.OS === 'android') {
                            setDobOpen(false);
                          }
                          return;
                        }

                        setPickerDate(selectedDate);
                        const dd = String(selectedDate.getDate()).padStart(2, '0');
                        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const yy = selectedDate.getFullYear();
                        const formatted = `${dd}-${mm}-${yy}`;
                        setRDob(formatted);
                        setRDobError('');

                        let age = today.getFullYear() - yy;
                        const hasHadBirthday = (today.getMonth() > selectedDate.getMonth()) || (today.getMonth() === selectedDate.getMonth() && today.getDate() >= selectedDate.getDate());
                        if (!hasHadBirthday) age -= 1;

                        if (age >= 0 && age <= 120) {
                          setRAge(String(age));
                        } else {
                          setRDobError('Please enter a valid date of birth');
                          setRAge('');
                        }

                        if (Platform.OS === 'ios') {
                          setDobOpen(false);
                        }
                      }
                    }}
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                    onError={(error) => {
                      if (error) {
                        setRDobError('Please select a valid date');
                      }
                    }}
                  />
                )}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={rAge}
                  editable={false}
                  placeholder="Enter Age"
                  placeholderTextColor="#888"
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    secureTextEntry={!showPassword}
                    value={rPassword}
                    onChangeText={setRPassword}
                    placeholder="********"
                    placeholderTextColor="#888"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Text style={styles.eyeIconText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.strengthBar}><View style={[styles.strengthFill, { width: `${(strength / 5) * 100}%` }]} /></View>
                <Text style={styles.strengthText}>Password strength</Text>
                <View style={styles.reqList}>
                  <Text style={[styles.req, rPassword.length >= 8 && styles.reqMet]}>• At least 8 characters</Text>
                  <Text style={[styles.req, /[A-Z]/.test(rPassword) && styles.reqMet]}>• One uppercase letter</Text>
                  <Text style={[styles.req, /[a-z]/.test(rPassword) && styles.reqMet]}>• One lowercase letter</Text>
                  <Text style={[styles.req, /[0-9]/.test(rPassword) && styles.reqMet]}>• One number</Text>
                  <Text style={[styles.req, /[^A-Za-z0-9]/.test(rPassword) && styles.reqMet]}>• One special character</Text>
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    secureTextEntry={!showConfirmPassword}
                    value={rConfirm}
                    onChangeText={setRConfirm}
                    placeholder="Confirm password"
                    placeholderTextColor="#888"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                    <Text style={styles.eyeIconText}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {!!rError && <Text style={styles.error}>{rError}</Text>}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.primary, isRegistering && styles.btnBusy]}
                  onPress={onRegister}
                  activeOpacity={0.8}
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <View style={styles.registeringRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.btnText, styles.primaryText, styles.registeringLabel]}>Registering…</Text>
                    </View>
                  ) : (
                    <Text style={[styles.btnText, styles.primaryText]}>Register</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.neutral, isRegistering && styles.btnBusy]}
                  disabled={isRegistering}
                  onPress={() => {
                    setRName(''); setRNameError(''); setRGender(''); setRPhone(''); setRPhoneError(''); setREmail(''); setREmailError(''); setRDob(''); setRAge(''); setRPassword(''); setRConfirm(''); setRError(''); setShowPassword(false); setShowConfirmPassword(false);
                  }}
                >
                  <Text style={[styles.btnText, styles.neutralText]}>Reset</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerNote}>
                Already have an account?{' '}
                <Text
                  onPress={() => {
                    if (!isRegistering) {
                      setShowRegister(false);
                      setShowLogin(true);
                    }
                  }}
                  style={[styles.link, isRegistering && styles.linkDisabled]}
                >
                  Login
                </Text>
              </Text>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Login Modal */}
      <Modal transparent visible={showLogin} animationType="fade" onRequestClose={() => setShowLogin(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayPressable} onPress={() => setShowLogin(false)} />
          <View style={styles.modal} pointerEvents="auto">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Login</Text>
              <TouchableOpacity onPress={() => setShowLogin(false)}><Text style={styles.close}>×</Text></TouchableOpacity>
            </View>
            <View style={styles.formGroup}><Text style={styles.label}>Username</Text><TextInput style={styles.input} value={lName} onChangeText={setLName} placeholder="Enter your username" placeholderTextColor="#888" /></View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showLoginPassword}
                  value={lPassword}
                  onChangeText={setLPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#888"
                />
                <TouchableOpacity onPress={() => setShowLoginPassword(!showLoginPassword)} style={styles.eyeIcon}>
                  <Text style={styles.eyeIconText}>{showLoginPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {!!lError && <Text style={styles.error}>{lError}</Text>}
            <TouchableOpacity
              style={[styles.btn, styles.primary, styles.loginButton, isLoggingIn && { opacity: 0.7 }]}
              onPress={onLogin}
              activeOpacity={0.8}
              disabled={isLoggingIn}
            >
              <Text style={[styles.btnText, styles.primaryText]}>{isLoggingIn ? 'Logging in...' : 'Login'}</Text>
            </TouchableOpacity>
            <Text style={styles.footerNote}>Don't have an account? <Text onPress={() => { setShowLogin(false); setShowRegister(true); }} style={styles.link}>Register</Text></Text>
            <Text style={[styles.footerNote, { marginTop: 8 }]}><Text onPress={() => { setShowLogin(false); setShowForgot(true); }} style={styles.link}>Forgot Password?</Text></Text>
          </View>
        </View>
      </Modal>

      {/* Forgot Password — same layout feel as Login; password rules match Register */}
      <Modal transparent visible={showForgot} animationType="fade" onRequestClose={() => { setShowForgot(false); clearForgotForm(); }}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.registerOverlay} pointerEvents="box-none">
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!isResettingPassword) {
                  Keyboard.dismiss();
                  setShowForgot(false);
                  clearForgotForm();
                }
              }}
            />
            <View style={[styles.modal, styles.registerModal]} pointerEvents="auto">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reset password</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (!isResettingPassword) {
                      setShowForgot(false);
                      clearForgotForm();
                    }
                  }}
                  disabled={isResettingPassword}
                >
                  <Text style={[styles.close, isResettingPassword && styles.closeDisabled]}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.registerScroll}
                contentContainerStyle={styles.registerScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator
              >
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Your MatchMyTone username"
                    placeholderTextColor="#888"
                    value={forgotUsername}
                    onChangeText={(t) => {
                      setForgotUsername(t);
                      setForgotError('');
                    }}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>New password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      secureTextEntry={!showForgotNewPassword}
                      placeholder="New password"
                      placeholderTextColor="#888"
                      value={forgotNewPassword}
                      onChangeText={(t) => {
                        setForgotNewPassword(t);
                        setForgotError('');
                      }}
                    />
                    <TouchableOpacity onPress={() => setShowForgotNewPassword(!showForgotNewPassword)} style={styles.eyeIcon}>
                      <Text style={styles.eyeIconText}>{showForgotNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.strengthBar}>
                    <View style={[styles.strengthFill, { width: `${(forgotStrength / 5) * 100}%` }]} />
                  </View>
                  <Text style={styles.strengthText}>Password strength</Text>
                  <View style={styles.reqList}>
                    <Text style={[styles.req, forgotNewPassword.length >= 8 && styles.reqMet]}>• At least 8 characters</Text>
                    <Text style={[styles.req, /[A-Z]/.test(forgotNewPassword) && styles.reqMet]}>• One uppercase letter</Text>
                    <Text style={[styles.req, /[a-z]/.test(forgotNewPassword) && styles.reqMet]}>• One lowercase letter</Text>
                    <Text style={[styles.req, /[0-9]/.test(forgotNewPassword) && styles.reqMet]}>• One number</Text>
                    <Text style={[styles.req, /[^A-Za-z0-9]/.test(forgotNewPassword) && styles.reqMet]}>• One special character</Text>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Confirm new password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      secureTextEntry={!showForgotConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#888"
                      value={forgotConfirmPassword}
                      onChangeText={(t) => {
                        setForgotConfirmPassword(t);
                        setForgotError('');
                      }}
                    />
                    <TouchableOpacity onPress={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)} style={styles.eyeIcon}>
                      <Text style={styles.eyeIconText}>{showForgotConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {!!forgotError && <Text style={styles.error}>{forgotError}</Text>}
                <TouchableOpacity
                  style={[styles.btn, styles.primary, styles.loginButton, isResettingPassword && { opacity: 0.85 }]}
                  onPress={onResetPassword}
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? (
                    <View style={styles.registeringRow}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.btnText, styles.primaryText, styles.registeringLabel]}>Updating…</Text>
                    </View>
                  ) : (
                    <Text style={[styles.btnText, styles.primaryText]}>Done</Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.footerNote}>
                  <Text
                    onPress={() => {
                      if (!isResettingPassword) {
                        setShowForgot(false);
                        clearForgotForm();
                        setShowLogin(true);
                      }
                    }}
                    style={styles.link}
                  >
                    Back to Login
                  </Text>
                </Text>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
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
  container: {
    minHeight: height,
    paddingTop: 60,
    paddingBottom: 60,
    alignItems: 'center',
    zIndex: 2,
    position: 'relative',
  },
  authLabelsTop: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    zIndex: 20,
    position: 'relative',
  },
  mainHeading: {
    fontSize: 40,
    fontWeight: '900',
    fontFamily: 'PlayfairDisplay_900Black',
    color: '#000',
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  authLabels: {
    flexDirection: 'row',
  },
  authLabel: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  register: {},
  login: {},
  authText: { fontWeight: '700', color: '#333' },

  sticker: {
    position: 'absolute',
    width: 100,
    height: 100,
    zIndex: 5,
  },

  // modal shared styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  registerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 16,
  },
  overlayPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  keyboardAvoidingRoot: {
    flex: 1,
    width: '100%',
  },
  modal: {
    backgroundColor: 'rgba(128, 128, 128, 0.85)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1000,
  },
  registerModal: {
    maxHeight: REGISTER_MODAL_MAX_HEIGHT,
    flexShrink: 1,
  },
  registerScroll: {
    maxHeight: REGISTER_SCROLL_MAX_HEIGHT,
  },
  registerScrollContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  registeringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  registeringLabel: {
    marginLeft: 8,
  },
  btnBusy: {
    opacity: 0.85,
  },
  closeDisabled: {
    opacity: 0.4,
  },
  linkDisabled: {
    opacity: 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  close: { fontSize: 28, color: '#fff', paddingHorizontal: 4 },
  formGroup: { marginBottom: 12 },
  label: { color: '#fff', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#000',
  },
  inputPassword: {
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: 10,
    padding: 5,
  },
  eyeIconText: {
    fontSize: 20,
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarBtn: {
    padding: 10,
    marginLeft: 10,
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 20,
  },
  pickerWrap: {
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  strengthBar: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden', marginTop: 8 },
  strengthFill: { height: 6, backgroundColor: '#b89018' },
  strengthText: { color: '#fff', marginTop: 6 },
  reqList: { marginTop: 6 },
  req: { color: '#fff' },
  reqMet: { color: '#4CAF50' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#b89018' },
  checkboxChecked: { backgroundColor: '#b89018' },
  error: { color: '#b00020', marginBottom: 8, fontWeight: '700' },
  fieldError: { color: '#ff0000', marginTop: 4, fontSize: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  buttonContainer: { alignItems: 'center', marginTop: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginHorizontal: 6 },
  loginButton: { width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginHorizontal: 0 },
  btnText: { fontWeight: '700', textAlign: 'center' },
  primary: { backgroundColor: '#b89018' },
  primaryText: { color: '#fff' },
  neutral: { backgroundColor: '#666' },
  neutralText: { color: '#fff' },
  footerNote: { color: '#fff', textAlign: 'center', marginTop: 10 },
  link: { color: '#b89018', fontWeight: '700' },
});
