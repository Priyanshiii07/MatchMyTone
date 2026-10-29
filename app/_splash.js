import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function CustomSplashScreen() {
  // Try to load the logo, fallback to splash-icon if logo doesn't exist
  let logoSource;
  try {
    logoSource = require('../assets/matchmytone-logo.png');
  } catch (e) {
    // If logo doesn't exist, use splash-icon as fallback
    logoSource = require('../assets/splash-icon.png');
  }

  return (
    <LinearGradient
      colors={['#fffaf3', '#fbeed9']}
      style={styles.container}
    >
      <Image
        source={logoSource}
        style={styles.logo}
        resizeMode="contain"
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffaf3',
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
  },
});

