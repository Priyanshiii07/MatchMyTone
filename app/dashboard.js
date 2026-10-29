import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { quizAPI } from '../src/api';
import { useCallback } from 'react';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
  const router = useRouter();
  const [resultsExpanded, setResultsExpanded] = useState(false);
  // Now storing arrays of results per module
  const [allResults, setAllResults] = useState({
    skincare: [],
    body_shape: [],
    face_shape: [],
    color_analysis: []
  });
  const [loading, setLoading] = useState(true);
  const [errorMessages, setErrorMessages] = useState({
    skincare: '',
    body_shape: '',
    face_shape: '',
    color_analysis: ''
  });

  useEffect(() => {
    fetchQuizResults();
  }, []);

  // Refresh results when screen comes into focus (after taking a quiz)
  useFocusEffect(
    useCallback(() => {
      fetchQuizResults();
    }, [])
  );

  const fetchQuizResults = async () => {
    try {
      setLoading(true);
      const response = await quizAPI.getAllResults();
      if (response && response.results) {
        setAllResults({
          skincare: Array.isArray(response.results.skincare) ? response.results.skincare : (response.results.skincare ? [response.results.skincare] : []),
          body_shape: Array.isArray(response.results.body_shape) ? response.results.body_shape : (response.results.body_shape ? [response.results.body_shape] : []),
          face_shape: Array.isArray(response.results.face_shape) ? response.results.face_shape : (response.results.face_shape ? [response.results.face_shape] : []),
          color_analysis: Array.isArray(response.results.color_analysis) ? response.results.color_analysis : (response.results.color_analysis ? [response.results.color_analysis] : []),
        });
      }
    } catch (error) {
      console.error('Error fetching quiz results:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultsClick = () => {
    setResultsExpanded(!resultsExpanded);
  };

  const handleSeeResult = (quizType, resultItem, index) => {
    setErrorMessages(prev => ({ ...prev, [quizType]: '' }));

    switch (quizType) {
      case 'color_analysis': {
        router.push({
          pathname: '/ColorAnalysis/result',
          params: { resultId: String(resultItem.id), fromDashboard: 'true' }
        });
        break;
      }
      case 'skincare': {
        const answers = resultItem.answers || null;
        if (answers) {
          router.push({
            pathname: '/SkincareAnalysis/result',
            params: { answers: JSON.stringify(answers), fromDashboard: 'true' }
          });
        } else {
          router.push('/SkincareAnalysis/result');
        }
        break;
      }
      case 'body_shape': {
        const answers = resultItem.answers || null;
        if (answers) {
          router.push({
            pathname: '/BodyShapeQuizNew/result',
            params: { answers: JSON.stringify(answers), fromDashboard: 'true' }
          });
        } else {
          router.push('/BodyShapeQuizNew/result');
        }
        break;
      }
      case 'face_shape': {
        const answers = resultItem.answers || null;
        if (answers) {
          router.push({
            pathname: '/FaceShapeNew/result',
            params: { answers: JSON.stringify(answers), fromDashboard: 'true' }
          });
        } else {
          router.push('/FaceShapeNew/result');
        }
        break;
      }
    }
  };

  const handleBack = () => {
    router.push('/home');
  };

  const renderResultsList = (quizType, label, getResultLabel) => {
    const results = allResults[quizType];
    const hasResults = results && results.length > 0;

    return (
      <View style={styles.resultItem}>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>{label}:</Text>
          <Text style={styles.resultValue}>
            {loading ? 'Loading...' : (hasResults ? `${results.length} result${results.length > 1 ? 's' : ''}` : '-')}
          </Text>
        </View>
        {!hasResults && !loading && (
          <Text style={styles.noResultsHint}>{quizType === 'color_analysis' ? 'Take the analysis first' : 'Take the quiz first'}</Text>
        )}
        {hasResults && results.map((item, index) => (
          <View key={item.id || index} style={styles.resultEntryCard}>
            <View style={styles.resultEntryRow}>
              <View style={styles.resultEntryInfo}>
                <Text style={styles.resultEntryIndex}>#{index + 1}</Text>
                <Text style={styles.resultEntryValue}>{getResultLabel(item)}</Text>
              </View>
              <TouchableOpacity
                style={styles.seeResultsButton}
                onPress={() => handleSeeResult(quizType, item, index)}
                activeOpacity={0.6}
              >
                <Text style={styles.seeResultsButtonText}>See Results</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {errorMessages[quizType] ? (
          <Text style={styles.errorText}>{errorMessages[quizType]}</Text>
        ) : null}
      </View>
    );
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
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.optionsContainer}>
                {/* Results Option */}
                <View style={styles.optionSection}>
                  <TouchableOpacity
                    style={styles.mainOption}
                    onPress={handleResultsClick}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.optionText}>RESULTS</Text>
                    <Ionicons
                      name={resultsExpanded ? "chevron-up" : "chevron-down"}
                      size={22}
                      color="#2C2C2C"
                    />
                  </TouchableOpacity>
                  <View style={styles.divider} />

                  {/* Sub-options that appear when Results is expanded */}
                  {resultsExpanded && (
                    <View style={styles.subOptionsContainer}>
                      {renderResultsList('color_analysis', 'Color Analysis', (item) => item.season_type || 'Analysis done')}
                      {renderResultsList('skincare', 'Skincare Analysis', (item) => item.result || 'Analysis done')}
                      {renderResultsList('body_shape', 'Body Analysis', (item) => item.result || 'Analysis done')}
                      {renderResultsList('face_shape', 'Face Analysis', (item) => item.result || 'Analysis done')}
                    </View>
                  )}
                </View>

                {/* About Us Option - appears below Results (and its sub-options if expanded) */}
                <View style={styles.optionSection}>
                  <TouchableOpacity
                    style={styles.mainOption}
                    onPress={() => router.push('/about')}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.optionText}>ABOUT US</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                </View>
              </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#2C2C2C"
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
  optionsContainer: {
    gap: 24,
  },
  optionSection: {
    marginBottom: 0,
  },
  mainOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionText: {
    color: '#2C2C2C',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(184, 144, 24, 0.2)',
    marginLeft: 4,
  },
  subOptionsContainer: {
    marginTop: 8,
    marginLeft: 24,
    gap: 16,
    paddingVertical: 8,
  },
  resultItem: {
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultLabel: {
    color: '#5a4a3a',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginRight: 8,
  },
  resultValue: {
    color: '#2C2C2C',
    fontSize: 18,
    fontWeight: '600',
  },
  seeResultsButton: {
    backgroundColor: '#b89018',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  seeResultsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  noResultsHint: {
    color: '#999',
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  resultEntryCard: {
    backgroundColor: 'rgba(184, 144, 24, 0.06)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(184, 144, 24, 0.15)',
  },
  resultEntryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultEntryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  resultEntryIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b89018',
    marginRight: 10,
    minWidth: 24,
  },
  resultEntryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
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
