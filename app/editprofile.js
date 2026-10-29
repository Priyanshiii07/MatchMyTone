import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

const { width, height } = Dimensions.get('window');

export default function EditProfileScreen() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editAge, setEditAge] = useState('');

  // Error states (username validation removed since it cannot be changed)
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [genderError, setGenderError] = useState('');
  const [dobError, setDobError] = useState('');
  const [ageError, setAgeError] = useState('');

  // Helper function to calculate age from DOB
  const calculateAgeFromDob = (dob) => {
    if (!dob || dob.length !== 10) return '';
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      const yy = parseInt(m[3], 10);
      const d = new Date(yy, mm, dd);
      if (!isNaN(d.getTime()) && d.getFullYear() === yy && d.getMonth() === mm && d.getDate() === dd) {
        const today = new Date();
        let age = today.getFullYear() - yy;
        const hasHadBirthday = (today.getMonth() > mm) || (today.getMonth() === mm && today.getDate() >= dd);
        if (!hasHadBirthday) age -= 1;
        if (age >= 0 && age <= 120) {
          return String(age);
        }
      }
    }
    return '';
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const currentUser = await AsyncStorage.getItem('currentUser');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        const registeredUsers = await AsyncStorage.getItem('registeredUsers');
        if (registeredUsers) {
          const users = JSON.parse(registeredUsers);
          setRegisteredUsers(users);
          const fullUserData = users.find(u => u.email === user.email || u.name === user.name);
          if (fullUserData) {
            setUserData(fullUserData);
            setEditName(fullUserData.name || '');
            setEditGender(fullUserData.gender || ''); // Keep user's gender
            setEditPhone(fullUserData.phone || '');
            setEditEmail(fullUserData.email || '');
            setEditDob(fullUserData.dob || '');
            // Calculate age from DOB if age is missing
            let ageToSet = fullUserData.age || '';
            if (!ageToSet && fullUserData.dob) {
              ageToSet = calculateAgeFromDob(fullUserData.dob);
            }
            setEditAge(ageToSet);
          } else {
            setUserData(user);
            setEditName(user.name || '');
            setEditGender(user.gender || ''); // Keep user's gender
            setEditEmail(user.email || '');
            setEditPhone(user.phone || '');
            setEditDob(user.dob || '');
            // Calculate age from DOB if age is missing
            let ageToSet = user.age || '';
            if (!ageToSet && user.dob) {
              ageToSet = calculateAgeFromDob(user.dob);
            }
            setEditAge(ageToSet);
          }
        } else {
          setUserData(user);
          setEditName(user.name || '');
          setEditGender(user.gender || ''); // Keep user's gender
          setEditEmail(user.email || '');
          setEditPhone(user.phone || '');
          setEditDob(user.dob || '');
          // Calculate age from DOB if age is missing
          let ageToSet = user.age || '';
          if (!ageToSet && user.dob) {
            ageToSet = calculateAgeFromDob(user.dob);
          }
          setEditAge(ageToSet); // Keep user's age
          setRegisteredUsers([]);
        }
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

  const validatePhone = (digits) => {
    if (!digits) {
      setPhoneError('Phone number is required');
      return;
    }
    if (digits.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return;
    }
    // Check for duplicate only if field is valid length
    setPhoneError(isPhoneDuplicate(digits) ? 'This phone number is already registered.' : '');
  };

  const handlePhoneChange = (text) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 10) {
      setEditPhone(digits);
      // Validate immediately as user types
      validatePhone(digits);
    }
  };

  const validateEmail = (email) => {
    if (!email) {
      setEmailError('Email address is required');
      return;
    }
    const trimmed = email.trim();
    const hasAt = trimmed.includes('@');
    const hasCom = trimmed.endsWith('.com') || trimmed.endsWith('.in');
    if (!hasAt || !hasCom) {
      setEmailError('Email must contain @ and end with .com or .in');
      return;
    }
    // Check for duplicate only if email format is valid
    setEmailError(isEmailDuplicate(trimmed) ? 'This email address is already registered.' : '');
  };

  const handleEmailChange = (text) => {
    setEditEmail(text);
    // Validate immediately as user types
    validateEmail(text);
  };

  const validateDob = (dob) => {
    if (!dob || dob.trim() === '') {
      setDobError('Date of birth is required');
      return;
    }
    if (dob.length !== 10) {
      setDobError('Date of birth is required');
      return;
    }
    // Check if date is in the future
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
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
        if (dateToCheck > today) {
          setDobError('Date of birth cannot be in the future');
          return;
        }
      }
    }
    setDobError('');
  };

  const handleDobChange = (text) => {
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

    setEditDob(formatted);
    // Validate immediately
    validateDob(formatted);

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
            setDobError('Date of birth cannot be in the future');
            setEditAge('');
            return;
          }

          let age = today.getFullYear() - yy;
          const hasHadBirthday = (today.getMonth() > mm) || (today.getMonth() === mm && today.getDate() >= dd);
          if (!hasHadBirthday) age -= 1;
          if (age >= 0 && age <= 120) {
            setEditAge(String(age));
          }
        }
      }
    }
  };

  const handleGenderChange = (value) => {
    setEditGender(value);
    // Validate immediately
    if (!value || value === '') {
      setGenderError('Gender is required');
    } else {
      setGenderError('');
    }
  };

  // Re-run validations when registered users load or component mounts (ensures duplicates are caught immediately)
  // Note: username validation is skipped since it cannot be changed
  useEffect(() => {
    if (!loading && userData) {
      validatePhone(editPhone);
      validateEmail(editEmail);
      validateDob(editDob);
      if (!editGender || editGender === '') {
        setGenderError('Gender is required');
      } else {
        setGenderError('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredUsers, loading, userData]);

  // Helpers to locate current user and detect duplicates
  const findCurrentUserIndex = () => {
    if (!userData || !registeredUsers?.length) return -1;
    return registeredUsers.findIndex(
      (u) => u.email === userData.email || u.name === userData.name
    );
  };

  const isPhoneDuplicate = (phone) => {
    if (!phone || !registeredUsers?.length) return false;
    const me = findCurrentUserIndex();
    return registeredUsers.some(
      (u, i) => i !== me && u.phone && u.phone === phone
    );
  };

  const isEmailDuplicate = (email) => {
    if (!email || !registeredUsers?.length) return false;
    const me = findCurrentUserIndex();
    return registeredUsers.some(
      (u, i) =>
        i !== me &&
        u.email &&
        email &&
        u.email.toLowerCase() === email.toLowerCase()
    );
  };

  const handleUpdateProfile = async () => {
    // Guard: should already be disabled via button, but keep for safety
    if (!editEmail || !editPhone || !editGender || !editDob) return;
    if (phoneError || emailError || dobError || genderError) return;
    if (editPhone.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return;
    }

    try {
      // Try to use API first if available
      try {
        const { profileAPI } = require('../src/api');
        await profileAPI.updateProfile({
          email: editEmail.trim(),
          phone: editPhone,
          gender: editGender,
          dob: editDob,
          age: editAge,
        });

        // Update local storage
        const currentUser = await AsyncStorage.getItem('currentUser');
        if (currentUser) {
          const user = JSON.parse(currentUser);
          const updatedUser = {
            ...user,
            email: editEmail.trim(),
            phone: editPhone,
            gender: editGender,
            dob: editDob,
            age: editAge,
          };
          await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }

        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      } catch (apiError) {
        console.log('API update failed, trying AsyncStorage fallback:', apiError);
      }

      // Fallback to AsyncStorage method
      const registeredUsers = await AsyncStorage.getItem('registeredUsers');

      if (registeredUsers) {
        const users = JSON.parse(registeredUsers);

        // Find the currently logged-in user in the list
        const userIndex = users.findIndex(
          (u) => u.email === userData.email || u.name === userData.name
        );

        if (userIndex !== -1) {
          // User found in registeredUsers - update there
          // Double-check duplicates before saving (in case data changed)
          const phoneTaken = isPhoneDuplicate(editPhone);
          const emailTaken = isEmailDuplicate(editEmail.trim());

          if (phoneTaken || emailTaken) {
            if (phoneTaken) setPhoneError('This phone number is already registered.');
            if (emailTaken) setEmailError('This email address is already registered.');
            return;
          }

          // No duplicates found → proceed to update this user's data
          users[userIndex] = {
            ...users[userIndex],
            name: userData.name, // Keep original username
            gender: editGender,
            phone: editPhone,
            email: editEmail.trim(),
            dob: editDob,
            age: editAge,
          };

          await AsyncStorage.setItem('registeredUsers', JSON.stringify(users));
          setRegisteredUsers(users);

          const updatedUser = users[userIndex];
          await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));

          Alert.alert('Success', 'Profile updated successfully!', [
            { text: 'OK', onPress: () => router.back() },
          ]);
          return;
        }
      }

      // If user not found in registeredUsers, just update currentUser
      // This handles API-logged-in users who aren't in registeredUsers
      const currentUser = await AsyncStorage.getItem('currentUser');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        const updatedUser = {
          ...user,
          email: editEmail.trim(),
          phone: editPhone,
          gender: editGender,
          dob: editDob,
          age: editAge,
        };
        await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
        setUserData(updatedUser);

        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', 'No user data found. Please login again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const isSaveDisabled = Boolean(
    loading ||
    !editEmail ||
    !editPhone ||
    !editGender ||
    !editDob ||
    editPhone.length !== 10 ||
    phoneError ||
    emailError ||
    genderError ||
    dobError
  );

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ height: 130 }} />
        <View style={styles.profileCard}>
          <View style={styles.cardHeader}>

            <Text style={styles.cardTitle}>Update Profile</Text>
          </View>

          <View style={styles.editContent}>
            <View style={styles.editRow}>
              <View style={styles.editColumn}>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>User Name</Text>
                  <TextInput
                    style={[styles.editInput, styles.disabledInput]}
                    value={editName}
                    editable={false}
                    placeholder="Enter full name"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Phone Number</Text>
                  <TextInput
                    style={[styles.editInput, phoneError && styles.inputError]}
                    value={editPhone}
                    onChangeText={handlePhoneChange}
                    placeholder="10-digit number"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                  {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Date of Birth</Text>
                  <TextInput
                    style={[styles.editInput, dobError && styles.inputError]}
                    value={editDob}
                    onChangeText={handleDobChange}
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  {dobError ? <Text style={styles.errorText}>{dobError}</Text> : null}
                </View>
              </View>

              <View style={styles.editColumn}>
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Gender</Text>
                  <View style={[styles.pickerContainer, genderError && styles.inputError]}>
                    <Picker
                      selectedValue={editGender}
                      onValueChange={handleGenderChange}
                      style={styles.picker}
                    >
                      <Picker.Item label="Select Gender" value="" />
                      <Picker.Item label="Female" value="female" />
                      <Picker.Item label="Male" value="male" />
                      <Picker.Item label="Other" value="other" />
                    </Picker>
                  </View>
                  {genderError ? <Text style={styles.errorText}>{genderError}</Text> : null}
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Email Address</Text>
                  <TextInput
                    style={[styles.editInput, styles.disabledInput]}
                    value={editEmail}
                    editable={false}
                    placeholder="example@gmail.com"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Age</Text>
                  <TextInput
                    style={[styles.editInput, styles.disabledInput]}
                    value={editAge ? `${editAge} years` : ''}
                    editable={false}
                    placeholder="Auto-calculated from DOB"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.updateButton, isSaveDisabled && styles.updateButtonDisabled]}
                onPress={handleUpdateProfile}
                disabled={isSaveDisabled}
              >
                <Text style={styles.updateButtonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    color: '#d32f2f',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
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
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    color: '#2c2416',
    fontSize: 26,
    fontWeight: '800',
  },
  editContent: {
    marginTop: 10,
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  editColumn: {
    flex: 1,
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    color: '#5a4a3a',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(90, 74, 58, 0.2)',
    color: '#2c2416',
    fontSize: 15,
  },
  inputError: {
    borderColor: '#d32f2f',
    borderWidth: 1.5,
  },
  disabledInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    color: '#5a4a3a',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(90, 74, 58, 0.2)',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#2c2416',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#b89018',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#b89018',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  updateButtonDisabled: {
    backgroundColor: '#c8b88a',
    shadowOpacity: 0.1,
    elevation: 0,
    opacity: 0.5,
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#8b7355',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#8b7355',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cancelButtonText: {
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
});

