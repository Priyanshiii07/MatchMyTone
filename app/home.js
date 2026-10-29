import { Link, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();

  const AnalysisCard = ({ icon, title, subtitle, onPress }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </Pressable>
  );

  return (
    <LinearGradient colors={[ '#fffaf3', '#fbeed9' ]} style={styles.bg}>
      {/* Soft Grid Pattern */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: Math.ceil(height / 40) }).map((_, i) => (
          <View key={`h-${i}`} style={[styles.gridLine, styles.gridLineHorizontal, { top: i * 40 }]} />
        ))}
        {Array.from({ length: Math.ceil(width / 40) }).map((_, i) => (
          <View key={`v-${i}`} style={[styles.gridLine, styles.gridLineVertical, { left: i * 40 }]} />
        ))}
      </View>
      <SafeAreaView style={styles.container}>
        <View style={{ height:0 }} />
        {/* Nav */}
        <View style={styles.nav}>
          <Text style={styles.brand}>MatchMyTone</Text>
          <View style={styles.navButtons}>
            <Link href="/profile" asChild>
              <TouchableOpacity style={styles.iconBtn}>
                <View style={styles.profileIconContainer}>
                  <Ionicons name="person" size={24} color="#b89018" />
                </View>
              </TouchableOpacity>
            </Link>
            <Link href="/dashboard" asChild>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="menu" size={24} color="#b89018" />
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Main content */}
        <ScrollView contentContainerStyle={styles.mainContainer}>
          <View style={styles.grid}>
            <AnalysisCard
              icon="🔬"
              title="Color Analysis"
              subtitle="Find the colors that make you glow — your perfect match is just a tap away!"
              onPress={() => router.push('/ColorAnalysis')}
            />
            <AnalysisCard
              icon="💄"
              title="Skincare Analysis"
              subtitle="Understand your skin\'s needs and care for it the right way."
              onPress={() => router.push('/SkincareAnalysis')}
            />
            <AnalysisCard
              icon="✨"
              title="Body Analysis"
              subtitle="Learn what fits your shape best — because every body is unique."
              onPress={() => router.push('/BodyShapeQuizNew')}
            />
            <AnalysisCard
              icon="😊"
              title="Face Analysis"
              subtitle="Learn what fits your shape best — because every face is unique."
              onPress={() => router.push('/FaceShapeNew')}
            />
          </View>
        </ScrollView>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: {
    flex: 1,
  },
  nav: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  brand: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'PlayfairDisplay_900Black',
    color: '#000',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  iconBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#b89018',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  mainContainer: {
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 20,
    minHeight: 500,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(184,144,24,0.3)',
    borderWidth: 2,
    borderRadius: 25,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Inter_600SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#666',
    textAlign: 'center',
    maxWidth: 280,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
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



