import React, { useEffect, useState } from "react";
import { quizAPI } from "../../../src/api";
import { SHARE_MATCHMYTONE_FROM_LINE, getCurrentUserEmail } from "../../../src/shareEmail";
import { useRouter } from "expo-router";
import {
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";

// Using placeholder images from assets
import ovalImg from "../../../assets/oval.png";
import roundImg from "../../../assets/round.png";
import squareImg from "../../../assets/square.png";
import heartImg from "../../../assets/heart.png";
import diamondImg from "../../../assets/diamond.png";

//for oval
import layerednecklaceImg from "../../../assets/layerednecklace.jpg";
import statementearringsImg from "../../../assets/statementearrings.jpg";
import beachcurlsImg from "../../../assets/beachcurls.jpg";
import longlayersImg from "../../../assets/longlayers.jpg";
import cateyeglassesImg from "../../../assets/cateyeglasses.jpg";

//for round
import vshapednecklaceImg from "../../../assets/vshapednecklace.jpg";
import longdropearringImg from "../../../assets/longdropearring.jpg";
import wayfarerImg from "../../../assets/wayfarer.jpg";
import layeredlobImg from "../../../assets/layeredlob.jpg";
import crownliftImg from "../../../assets/crownlift.jpg";

//for square
import curtainbangsImg from "../../../assets/curtainbangs.jpg";
import hoopsImg from "../../../assets/hoops.jpg";
import longpendantsImg from "../../../assets/longpendants.jpg";
import roundframesImg from "../../../assets/roundframes.jpg";
import hairclipImg from "../../../assets/hairclip.jpg";

//for diamond
import curtainfringeImg from "../../../assets/curtainfringe.jpg";
import clusterearringsImg from "../../../assets/clusterearrings.jpg";
import roundpendantnecklaceImg from "../../../assets/roundpendantnecklace.jpg";
import lowponyImg from "../../../assets/lowpony.jpg";
import oversizedframesImg from "../../../assets/oversizedframes.jpg";

//for heart
import wispyfringeImg from "../../../assets/wispyfringe.jpg";
import chokerImg from "../../../assets/choker.jpg";
import earcuffsImg from "../../../assets/earcuffs.jpg";
import curtainponyImg from "../../../assets/curtainpony.jpg";
import semirimlessframesImg from "../../../assets/semirimlessframes.jpg";

import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  StatusBar,
} from "react-native";

// ⭐ CELEBRITY DATA
const CELEB_DATA = {
  Oval: {
    name: "Deepika Padukone",
    photo: require("../../../assets/dp.jpg"),
    tag: "Elegant & balanced facial features",
  },
  Round: {
    name: "Vidya Balan",
    photo: require("../../../assets/vidya.jpg"),
    tag: "Soft cheeks & curved lines",
  },
  Square: {
    name: "Kareena Kapoor",
    photo: require("../../../assets/kareena.jpg"),
    tag: "Strong jawline & sharp angles",
  },
  Heart: {
    name: "Jacqueline Fernandez",
    photo: require("../../../assets/jf.jpg"),
    tag: "Wide forehead & pointed chin",
  },
  Diamond: {
    name: "Priyanka Chopra",
    photo: require("../../../assets/pc.jpg"),
    tag: "High cheekbones & narrow forehead",
  },
};

// ⭐ FACE SHAPE DATA
const SHAPE_DATA = {
  Oval: {
    emoji: "🥚",
    color: "#FCEEC0",
    highlightColor: "#fae397ff",
    description:
      "An oval face shape is longer than wide with soft curves and a slightly narrower chin, giving it naturally balanced proportions.",
    illustration: ovalImg,
    recommendations: [
      { title: "Layered necklaces", desc: "Layered necklaces beautifully frame the neckline, adding depth and elegance to your look." },
      { title: "Statement earrings", desc: "Hoops and chandeliers highlight your cheekbones effortlessly." },
      { title: "Hairstyles", desc: "Soft waves or beach curls enhance your natural symmetry." },
      { title: "Haircuts", desc: "Long layers add movement and keep the face balanced." },
      { title: "Eyewear", desc: "Cat-eye frames give a lifted and defined look." },
    ],
    browseLooks: [
      { title: "Layered necklace", img: layerednecklaceImg },
      { title: "Beach Curls", img: beachcurlsImg },
      { title: "Cat-eye frame", img: cateyeglassesImg },
      { title: "Statement earring", img: statementearringsImg },
      { title: "Long Layers", img: longlayersImg },
    ],
  },

  Round: {
    emoji: "⚫",
    color: "#FCEEC0",
    highlightColor: "#FFF7DC",
    description:
      "A round face shape has soft curves, fuller cheeks, and almost equal length and width, giving a youthful and gentle look.",
    illustration: roundImg,
    recommendations: [
      { title: "V-Shaped Necklaces", desc: "Guide the eyes downward to create a longer face appearance." },
      { title: "Long Drop Earrings", desc: "Elongate your face with soft vertical lines." },
      { title: "Wayfarers", desc: "Add gentle angles that balance rounded features." },
      { title: "Layered Lob", desc: "Creates structure without sharpness, softly shaping your face." },
      { title: "Crown Lift Ponytail", desc: "Adds height at the crown, giving your face a longer look." },
    ],
    browseLooks: [
      { title: "Crown Lift Ponytail", img: crownliftImg },
      { title: "V-Shaped Necklace", img: vshapednecklaceImg },
      { title: "Long Drop Earring", img: longdropearringImg },
      { title: "Layered Lob", img: layeredlobImg },
      { title: "Wayfarers", img: wayfarerImg },
    ],
  },

  Square: {
    emoji: "⬜",
    color: "#FCEEC0",
    highlightColor: "#FFF7DC",
    description:
      "A square face shape has a broad forehead, strong jawline, and straight sides, giving a bold and defined look.",
    illustration: squareImg,
    recommendations: [
      { title: "Long Pendants", desc: "Create vertical movement to soften your jawline." },
      { title: "Hoop Earrings", desc: "Add feminine curves that balance angular features." },
      { title: "Curtain Bangs", desc: "Frame your face while softening sharp edges." },
      { title: "Round Frames", desc: "Add contrast to angular lines for a balanced look." },
      { title: "Soft Hair Clips", desc: "Add delicate detail that complements strong features." },
    ],
    browseLooks: [
      { title: "Curtain Bangs", img: curtainbangsImg },
      { title: "Hoop Earrings", img: hoopsImg },
      { title: "Long Pendants", img: longpendantsImg },
      { title: "Round Frames", img: roundframesImg },
      { title: "Soft Hair Clip", img: hairclipImg },
    ],
  },

  Heart: {
    emoji: "❤️",
    color: "#FCEEC0",
    highlightColor: "#FFF7DC",
    description:
      "A heart face shape features a wider forehead, soft cheekbones, and a narrow, pointed chin, giving an elegant and delicate look.",
    illustration: heartImg,
    recommendations: [
      { title: "Wispy Fringe", desc: "Wispy bangs slightly shorten the forehead, and medium-length hair adds fullness where the face naturally tapers." },
      { title: "Choker", desc: "Add movement around the lower half of the face." },
      { title: "Ear Cuff", desc: "Adds subtle width near the jawline while keeping the upper face soft and elegant." },
      { title: "Curtain Ponytail", desc: "A mid-height ponytail paired with curtain bangs balances the top-heavy proportions of a heart shape." },
      { title: "Semi-Rimless Frames", desc: "Since the forehead is already prominent, rimless frames remove heaviness and give a clean, delicate, face-opening look." },
    ],
    browseLooks: [
      { title: "Wispy Fringe", img: wispyfringeImg },
      { title: "Choker", img: chokerImg },
      { title: "Ear Cuff", img: earcuffsImg },
      { title: "Curtain Ponytail", img: curtainponyImg },
      { title: "Semi-Rimless Frames", img: semirimlessframesImg },
    ],
  },

  Diamond: {
    emoji: "💎",
    color: "#FAEBC0",
    highlightColor: "#FFF7DC",
    description:
      "A diamond face shape has high cheekbones, a narrow forehead, and a pointed chin, creating a striking and sculpted look.",
    illustration: diamondImg,
    recommendations: [
      { title: "Curtain Fringe", desc: "Softens cheekbones and adds balance to the forehead." },
      { title: "Cluster Earrings", desc: "Add width near the jawline for perfect harmony." },
      { title: "Round Pendant Necklaces", desc: "Soften sharp angles beautifully." },
      { title: "Low Ponytail", desc: "Keeps the look sleek and highlights your cheekbones gently." },
      { title: "Oversized Frames", desc: "Balance sharp edges for a soft glam look." },
    ],
    browseLooks: [
      { title: "Curtain Fringe", img: curtainfringeImg },
      { title: "Cluster Earrings", img: clusterearringsImg },
      { title: "Round Pendant Necklace", img: roundpendantnecklaceImg },
      { title: "Low Ponytail", img: lowponyImg },
      { title: "Oversized Frame", img: oversizedframesImg },
    ],
  },
};

import { useLocalSearchParams } from "expo-router";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const answersParam = params.answers;
  const answers = answersParam ? (typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam) : {};
  const [result, setResult] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const viewOnly = params?.viewOnly === "true";

  useEffect(() => {
    if (!answersParam) return;
    try {
      const parsedAnswers = typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam;
      const score = {
        Oval: 0,
        Round: 0,
        Square: 0,
        Heart: 0,
        Diamond: 0,
      };

      Object.values(parsedAnswers).forEach((opt) =>
        opt?.shapes?.forEach((s) => (score[s] = (score[s] || 0) + 1))
      );
      const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
      setResult(sorted[0][0]);
    } catch (error) {
      console.error('Error processing answers:', error);
    }
  }, [answersParam]);

  // Save result to API
  useEffect(() => {
    const saveResult = async () => {
      if (!result || !answersParam || viewOnly) return;

      try {
        const parsedAnswers = typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam;
        await quizAPI.saveFaceShapeResult(parsedAnswers, result);
      } catch (error) {
        console.error('Error saving face shape result:', error);
        // Fail silently - don't interrupt user experience
      }
    };

    if (result) {
      saveResult();
    }
  }, [result, answersParam]);

  const handleShareEmail = async () => {
    if (!result) return;
    const userEmail = await getCurrentUserEmail();
    if (!userEmail) {
      Alert.alert(
        "Email needed",
        "Add an email address to your profile so we can address this message to you."
      );
      return;
    }
    const shape = SHAPE_DATA[result];
    if (!shape) return;

    const celeb = CELEB_DATA[result];
    const subject = `My Face Shape Analysis - ${result}`;
    let body = `${SHARE_MATCHMYTONE_FROM_LINE}\n\n`;

    body += `Face Shape: ${result}\n`;
    body += `${shape.description}\n\n`;

    if (celeb) {
      body += `Celebrity Match: ${celeb.name}\n`;
      if (celeb.tag) {
        body += `Why: ${celeb.tag}\n`;
      }
      body += "\n";
    }

    if (shape.recommendations?.length) {
      body += "Recommendations:\n";
      shape.recommendations.forEach((rec, i) => {
        body += `${i + 1}. ${rec.title} - ${rec.desc}\n`;
      });
      body += "\n";
    }

    if (shape.browseLooks?.length) {
      body += "Browse Looks:\n";
      shape.browseLooks.forEach((look, i) => {
        body += `${i + 1}. ${look.title}\n`;
      });
      body += "\n";
    }

    body += "\nDiscovered with MatchMyTone";

    const mailtoUrl = `mailto:${encodeURIComponent(userEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    Linking.openURL(mailtoUrl);
  };

  const handleDownloadPdfInternal = async () => {
    if (!result) return;
    const shape = SHAPE_DATA[result];
    if (!shape) return;

    const celeb = CELEB_DATA[result];

    try {
      const recHtml = (shape.recommendations || [])
        .map(
          (rec, i) => `${i + 1}. <strong>${rec.title}</strong> - ${rec.desc}`
        )
        .join("<br/>");

      const looksHtml = (shape.browseLooks || [])
        .map((look, i) => `${i + 1}. ${look.title}`)
        .join("<br/>");

      const celebHtml = celeb
        ? `<p><strong>${celeb.name}</strong> - ${celeb.tag || ""}</p>`
        : "";

      const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; color: #2C2C2C; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            h2 { font-size: 18px; margin-top: 18px; margin-bottom: 4px; }
            p { font-size: 14px; line-height: 1.5; margin: 2px 0; }
            .section { margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <h1>Face Shape Analysis Result</h1>
          <div class="section">
            <h2>Face Shape</h2>
            <p><strong>${result}</strong></p>
            <p>${shape.description}</p>
          </div>
          <div class="section">
            <h2>Celebrity Match</h2>
            ${celebHtml || "<p>—</p>"}
          </div>
          <div class="section">
            <h2>Recommendations</h2>
            <p>${recHtml || "—"}</p>
          </div>
          <div class="section">
            <h2>Browse Looks</h2>
            <p>${looksHtml || "—"}</p>
          </div>
          <p style="margin-top:24px;">Discovered with MatchMyTone</p>
        </body>
      </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Face Shape Analysis PDF",
        });
      } else {
        Alert.alert("PDF created", `PDF file saved at:\n${uri}`);
      }
    } catch (e) {
      Alert.alert("Error", "Could not generate PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result || downloadingPdf) return;

    try {
      const flag = await AsyncStorage.getItem("faceShapePdfDownloaded");
      if (flag === "true") {
        Alert.alert(
          "PDF already downloaded",
          "You have already downloaded this face shape analysis PDF. Do you want to download it again?",
          [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: () => { handleDownloadPdfInternal(); } },
          ]
        );
        return;
      }

      setDownloadingPdf(true);
      await handleDownloadPdfInternal();
      await AsyncStorage.setItem("faceShapePdfDownloaded", "true");
    } catch (e) {
      setDownloadingPdf(false);
      Alert.alert("Error", "Could not generate PDF. Please try again.");
    }
  };

  if (!result) return <Text>Loading...</Text>;
  const shape = SHAPE_DATA[result];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor="#FFF8E7" barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.push("/home")} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="#2C2C2C" />
        </TouchableOpacity>
        <View style={{ height: 10 }} />

        <Text style={styles.title}>𝑯𝒆𝒓𝒆 𝒂𝒓𝒆 𝒚𝒐𝒖𝒓 𝒓𝒆𝒔𝒖𝒍𝒕𝒔! 🎉</Text>
        <Text style={styles.subtitle}>
          As per the answers you provided, your face shape analysis result is:
        </Text>

        {/* ⭐ FACE SHAPE CARD */}
        <View style={[styles.highlightBox, { backgroundColor: shape.color }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shapeLabel}>𝐅𝐀𝐂𝐄 𝐒𝐇𝐀𝐏𝐄</Text>

            <View style={{ height: 10 }} />
            <Text style={styles.shapeName}>
              {shape.emoji} {result}
            </Text>

            <View style={{ height: 10 }} />

            {/* ⭐ Description */}
            <Text style={styles.shapeDesc}>{shape.description}</Text>
          </View>

          <Image source={shape.illustration} style={styles.shapeImage} />
        </View>

        {/* ⭐ CELEBRITY MATCH POLAROID */}
        <Text style={styles.sectionTitle}>Found your Celebrity Match 🌟</Text>

        <View style={styles.polaroidCard}>
          <View style={styles.tape} />
          <Image
            source={CELEB_DATA[result].photo}
            style={styles.polaroidImage}
          />

          <Text style={styles.polaroidName}>{CELEB_DATA[result].name}</Text>
          <Text style={styles.polaroidTag}>{CELEB_DATA[result].tag}</Text>

          <Text style={styles.polaroidCaption}>
            {CELEB_DATA[result].name} – {result} Face Shape
          </Text>
        </View>

        {/* ⭐ RECOMMENDATIONS */}
        <Text style={styles.sectionTitle}>Recommendations 🔮</Text>

        <FlatList
          data={shape.recommendations}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, i) => i.toString()}
          renderItem={({ item }) => (
            <View style={styles.recCard}>
              <Text style={styles.recTitle}>{item.title}</Text>
              <Text style={styles.recDesc}>{item.desc}</Text>
            </View>
          )}
        />

        {/* ⭐ BROWSE LOOKS */}
        <View style={{ height: 17 }} />
        <Text style={styles.sectionTitle}>Browse looks for {result} face 🔍</Text>

        <View style={styles.browseGrid}>
          {shape.browseLooks?.map((look, index) => (
            <View key={index} style={styles.lookBox}>
              <Image source={look.img} style={styles.lookImage} />
              <Text style={styles.lookTitle}>{look.title}</Text>
            </View>
          ))}
        </View>

        {/* Share / Download */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareButtonWhite} onPress={handleShareEmail}>
            <Ionicons name="mail-outline" size={24} color="#2C2C2C" />
            <Text style={styles.shareButtonTextDark}>Share on Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButtonWhite} onPress={handleDownloadPdf}>
            <Ionicons name="download-outline" size={24} color="#2C2C2C" />
            <Text style={styles.shareButtonTextDark}>
              {downloadingPdf ? "Downloading…" : "Download PDF"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF8E7" },
  scroll: { padding: 20, paddingBottom: 40 },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#2C2C2C" },
  subtitle: { fontSize: 14, color: "#6B6B6B", marginVertical: 10 },

  highlightBox: {
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  shapeLabel: { color: "#A46B39", fontSize: 13, fontWeight: "600" },
  shapeName: { fontSize: 24, fontWeight: "800", color: "#C24C4A" },
  shapeDesc: { color: "#4F4F4F", fontSize: 15, lineHeight: 22, width: "98%" },
  shapeImage: {
    width: 150,
    height: 180,
    resizeMode: "contain",
    marginLeft: 10,
    borderRadius: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 12,
  },

  polaroidCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#EAD9A1",

    transform: [{ rotate: "-1.5deg" }],
    position: "relative",
    overflow: "visible",
  },

  tape: {
    width: 70,
    height: 22,
    backgroundColor: "#FFEFD2",
    position: "absolute",
    top: -10,
    borderRadius: 6,
    opacity: 0.9,
    transform: [{ rotate: "2deg" }],
  },

  polaroidImage: {
    width: 170,
    height: 190,
    borderRadius: 10,
    marginBottom: 15,
  },

  polaroidName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 3,
  },

  polaroidTag: {
    fontSize: 13,
    color: "#8A7F70",
    marginBottom: 10,
    textAlign: "center",
    width: "85%",
  },

  polaroidCaption: {
    marginTop: 6,
    backgroundColor: "#FFF9D9",
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B573F",
    fontStyle: "italic",
  },

  recCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginRight: 10,
    width: 220,
    borderLeftWidth: 5,
    borderLeftColor: "#F5B971",
  },

  recTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  recDesc: { fontSize: 13, color: "#6B6B6B", marginTop: 6 },

  browseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  lookBox: {
    width: "48%",
    backgroundColor: "#FFF3CC",
    borderRadius: 12,
    marginBottom: 14,
    overflow: "hidden",
    borderColor: "#EAD9A1",
    borderWidth: 1,
  },

  lookImage: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },

  lookTitle: {
    textAlign: "center",
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#2C2C2C",
  },
  shareRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 16,
    marginBottom: 24,
  },
  shareButtonWhite: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(184, 144, 24, 0.3)",
  },
  shareButtonTextDark: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C2C2C",
  },
});
