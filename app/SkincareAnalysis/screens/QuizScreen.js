import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { questions } from "../_data/questions";

const { width } = Dimensions.get("window");

// Shuffle utility to randomize question order
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizScreen() {
  const router = useRouter();
  const [questionsState] = useState(() => shuffleArray(questions));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (index / questionsState.length) * width,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [index, progressAnim, questionsState.length]);

  const handleSelect = (option) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.85, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setAnswers((prev) => ({ ...prev, [questionsState[index].id]: option }));

    setTimeout(() => {
      if (index < questionsState.length - 1) {
        setIndex(index + 1);
    } else {
      router.push({
        pathname: "/SkincareAnalysis/result",
          params: { answers: JSON.stringify({ ...answers, [questionsState[index].id]: option }) },
      });
    }
    }, 180);
  };

  const current = questionsState[index];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8E7" />
    <View style={styles.container}>
        <View style={{ height: 40 }} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={26} color="#2C2C2C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Skincare Quiz</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.progressWrapper}>
          <View style={styles.progressTrack} />
          <Animated.View style={[styles.progressFill, { width: progressAnim }]} />
          <Text style={styles.progressText}>{index + 1}/{questionsState.length}</Text>
        </View>

        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Text style={styles.questionText}>{current.question}</Text>
          <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
            {current.options.map((opt) => (
              <TouchableOpacity
                key={opt.key || opt.label}
                activeOpacity={0.8}
                onPress={() => handleSelect(opt)}
                style={styles.optionButton}
              >
                <View style={styles.optionLeft}>
                  <View style={styles.optionLabel}>
                    <Text style={styles.optionLabelText}>{opt.label}</Text>
                  </View>
                <Text style={styles.optionText}>{opt.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
        </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => router.replace("/SkincareAnalysis")}
            style={styles.retakeButton}
          >
            <Text style={styles.retakeButtonText}>Retake Quiz</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF8E7" },
  container: { flex: 1, padding: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 36 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#2C2C2C" },
  progressWrapper: { height: 36, marginBottom: 12, justifyContent: "center" },
  progressTrack: { height: 8, backgroundColor: "#EFE8D2", borderRadius: 10 },
  progressFill: { height: 8, backgroundColor: "#D67C73", borderRadius: 10 },
  progressText: { position: "absolute", right: 0, top: -20, fontSize: 12, color: "#6B6B6B" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  questionText: { fontSize: 18, fontWeight: "700", color: "#2C2C2C" },
  optionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E3D8B3",
    backgroundColor: "#FFFDF7",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionLabel: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFF4D9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  optionLabelText: {
    fontWeight: "700",
    color: "#8b7e5a",
    fontSize: 16,
    textAlign: "center",
  },
  optionText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    color: "#2C2C2C",
    textAlignVertical: "center",
  },
  footer: { alignItems: "center", marginTop: 20 },
  retakeButton: {
    backgroundColor: "#D67C73",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retakeButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});