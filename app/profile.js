import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileAPI, authAPI } from '../src/api';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  // Refresh data when screen comes into focus (after editing)
  useFocusEffect(
    React.useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    try {
      // Try API first, fallback to AsyncStorage for compatibility
      try {
        const response = await profileAPI.getProfile();
        if (response.user) {
          setUserData(response.user);
          setLoading(false);
          return;
        }
      } catch (apiError) {
        console.log('API fetch failed, trying AsyncStorage fallback:', apiError);
      }

      // Fallback to AsyncStorage
      const currentUser = await AsyncStorage.getItem('currentUser');
      if (currentUser) {
        const user = JSON.parse(currentUser);
          setUserData(user);
      } else {
        Alert.alert('Error', 'No user data found. Please login again.');
        router.replace('/');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    router.push('/editprofile');
  };


  const handleLogout = async () => {
    try {
      await authAPI.logout();
      router.replace('/');
    } catch (error) {
      console.error('Error logging out:', error);
      // Still try to clear local storage
      await AsyncStorage.removeItem('currentUser');
      router.replace('/');
    }
  };

  const handleBack = () => {
    router.push('/home');
  };

  if (loading) {
    return (
      <LinearGradient colors={['#f5f1e8', '#faf8f3', '#f5f1e8']} style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  if (!userData) {
    return (
      <LinearGradient colors={['#f5f1e8', '#faf8f3', '#f5f1e8']} style={styles.container}>
        <Text style={styles.errorText}>No user data available</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#f5f1e8', '#faf8f3', '#f0ebe0', '#f5f1e8']} style={styles.container}>
      {/* Soft Grid Pattern */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: Math.ceil(height / 40) }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLine, styles.gridLineHorizontal, { top: i * 40 }]} />
        ))}
        {Array.from({ length: Math.ceil(width / 40) }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLine, styles.gridLineVertical, { left: i * 40 }]} />
        ))}
      </View>
      <TouchableOpacity
        onPress={handleBack}
        style={styles.backButton}
      >
        <Ionicons name="chevron-forward" size={24} color="#2C2C2C" />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ height: 110 }} />
        <View style={styles.profileCard}>
          <View style={{ height: 15 }} />
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>User Profile</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.editIconButton} onPress={handleEditProfile}>
                <Ionicons name="pencil" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileContent}>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Full Name</Text>
              <Text style={styles.profileValue}>{userData.name || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Gender</Text>
              <Text style={styles.profileValue}>{userData.gender ? userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1) : 'N/A'}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Phone Number</Text>
              <Text style={styles.profileValue}>{userData.phone || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Email Address</Text>
              <Text style={styles.profileValue}>{userData.email || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Date of Birth</Text>
              <Text style={styles.profileValue}>{userData.dob || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Age</Text>
              <Text style={styles.profileValue}>{userData.age || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingText: {
    color: '#8b7355',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    fontWeight: '600',
  },
  errorText: {
    color: '#d4a574',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    // Glassmorphism effect
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    color: '#2c2416',
    fontSize: 26,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#b89018',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#b89018',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  profileContent: {
    marginTop: 10,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  profileLabel: {
    color: '#5a4a3a',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  profileValue: {
    color: '#2c2416',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(90, 74, 58, 0.2)',
    marginVertical: 4,
  },
  logoutButton: {
    backgroundColor: '#b89018',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#b89018',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
    zIndex: 10,
  },
});


