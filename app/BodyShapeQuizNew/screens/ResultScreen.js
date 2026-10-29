import React, { useEffect, useState } from "react";
import { quizAPI } from "../../../src/api";
import { SHARE_EMAIL_BODY_PREFIX_CRLF, getCurrentUserEmail } from "../../../src/shareEmail";
import { useRouter } from "expo-router";
import { TouchableOpacity, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import hourglassImg from "../../../assets/hourglass.png";
import pearImg from "../../../assets/pear.png";
import rectangleImg from "../../../assets/rectangle.png";
import appleImg from "../../../assets/apple.png";
import invertedtriangleImg from "../../../assets/invertedtriangle.png";

// ✅ Import Browse Look Images for rectangle
import bodyconmididress from "../../../assets/bodyconmididress.jpg";
import highwaistpants from "../../../assets/highwaistpants.jpg";
import pleatedskirt from "../../../assets/pleatedskirt.jpg";
import puffsleevetop from "../../../assets/puffsleevetop.jpg";
import corsetbelt from "../../../assets/corsetbelt.jpg";

// ✅ Import Browse Look Images for hourglass
import definedwaistjumpsuit from "../../../assets/definedwaistjumpsuit.jpg";
import peplumtops from "../../../assets/peplumtops.jpg";
import bodycondresses from "../../../assets/bodycondresses.jpg";
import beltedblazer from "../../../assets/beltedblazer.jpg";
import alineskirt from "../../../assets/alineskirt.jpg";

// ✅ Import Browse Look Images for pear
import offshouldertop from "../../../assets/offshouldertop.jpg";
import flaredpants from "../../../assets/flaredpants.jpg";
import flareddresses from "../../../assets/flareddresses.jpg";
import croppedjacket from "../../../assets/croppedjacket.jpg";
import boatnecktop from "../../../assets/boatnecktop.jpg";

// ✅ Import Browse Look Images for apple
import empirewaisttop from "../../../assets/empirewaisttop.jpg";
import shiftdresses from "../../../assets/shiftdresses.jpg";
import vneckjumpsuit from "../../../assets/vneckjumpsuit.jpg";
import bootcutjeans from "../../../assets/bootcutjeans.jpg";
import flowymidiskirt from "../../../assets/flowymidiskirt.jpg";

// ✅ Import Browse Look Images for inverted triangle
import scoopnecktop from "../../../assets/scoopnecktop.jpg";
import widelegjumpsuit from "../../../assets/widelegjumpsuit.jpg";
import minimalshoulderblazer from "../../../assets/minimalshoulderblazer.jpg";
import cardigans from "../../../assets/cardigans.jpg";
import straplessstyles from "../../../assets/straplessstyles.jpg";

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
import * as Print from "expo-print";
import { shareAsync } from "expo-sharing";

const SHAPE_DATA = {
  Rectangle: {
    emoji: "⬛",
    color: "#FCEEC0",
    highlightColor: "#fae397ff",
    description:
      "A rectangle-shaped body has balanced shoulders, waist, and hips with minimal curves.",
    illustration: rectangleImg,
    recommendations: [
      { title: "Bodycon Midi Dresses", desc: "A slightly fitted bodycon midi creates gentle curves without clinging too tightly." },
      { title: "Pleated Skirts ", desc: "Pleated skirts add graceful volume to your lower body, helping to balance your frame." },
      { title: "Puff-Sleeve Tops ", desc: "Tops with puff sleeves add dimension to your shoulders, balancing your figure and giving a curvier illusion." },
      { title: "High-waisted Pants ", desc: "Accentuate your waist and elongate your legs with high-waisted bottoms." },
      { title: "Corset Belts ", desc: "Corset belt naturally creates a curve illusion and adds modern flair." },
    ],
    browseLooks: [
      { title: "Bodycon Midi Dress", img: bodyconmididress },
      { title: "High-Waist Pants", img: highwaistpants },
      { title: "Pleated Skirt", img: pleatedskirt },
      { title: "Puff Sleeve Top", img: puffsleevetop },
      { title: "Corset Belt", img: corsetbelt },
    ],
  },
  Apple: {
    emoji: "🍎",
    color: "#FCEEC0",
    highlightColor: "#FFF7DC",
    description:
      "An apple-shaped body has a fuller midsection with broader shoulders and a less defined waist, while the hips are narrower.Elegant balance through tailored fits and smooth fabrics brings out the best in the apple silhouette.",
    illustration: appleImg,
    recommendations: [
      { title: "Empire waist tops", desc: "Highlight the slimmest part of your torso — while gently skimming over your midsection for an effortlessly flattering fit." },
      { title: "Shift Dresses", desc: "Looser fits around the waist create an elegant, effortless silhouette while keeping the focus on your legs." },
      { title: "V-Neck Jumpsuits", desc: "A structured V neckline elongates your torso, while a cinched or belted waist refines your shape." },
      { title: "Bootcut Jeans", desc: "These balance out the upper body while giving your legs a longer, leaner look." },
      { title: "Flowy Midi Skirts", desc: "Lightweight fabrics like chiffon or satin add soft movement and elegance." },
    ],
    browseLooks: [
      { title: "Empire waist top", img: empirewaisttop },
      { title: "Shift Dress", img: shiftdresses },
      { title: "V-Neck Jumpsuit", img: vneckjumpsuit },
      { title: "Bootcut Jeans", img: bootcutjeans },
      { title: "Flowy Midi Skirt", img: flowymidiskirt },
    ],
  },
  Pear: {
    emoji: "🍐",
    color: "#FCEEC0",
    highlightColor: "#FFF7DC",
    description:
      "With gently sloping shoulders and curvy hips, the pear-shaped body celebrates natural femininity. A narrow waist accentuates the silhouette, giving a graceful flow from the upper body to the hips.",
    illustration: pearImg,
    recommendations: [
      { title: "Off-shoulder tops", desc: "These broaden your shoulders and balance your frame beautifully." },
      { title: "Flared Pants", desc: "Look for gentle flares to balance hips effortlessly." },
      { title: "Flare Dresses", desc: "Hug your waist and flare out at the hips — your dream silhouette." },
      { title: "Cropped Jackets", desc: "End right above the hips to accentuate your waistline." },
      { title: "Boat Neck Tops", desc: "They draw attention upward, giving your silhouette an elegant harmony." },
    ],
    browseLooks: [
      { title: "Off-shoulder top", img: offshouldertop },
      { title: "Flared Pant", img: flaredpants },
      { title: "Flared Dress", img: flareddresses },
      { title: "Cropped Jacket", img: croppedjacket },
      { title: "Boat Neck Top", img: boatnecktop },
    ],
  },
  Hourglass: {
    emoji: "⏳",
    color: "#FCEEC0",
    highlightColor: "#FFF7DC",
    description:
      "People with an hourglass figure have soft, even contours — a narrow waist that gracefully transitions into rounded hips and a full bust, giving the body a classic, timeless symmetry.",
    illustration: hourglassImg,
    recommendations: [
      { title: "Jumpsuits with a Defined Waist ", desc: "Follow your curves with tie-waist designs." },
      { title: "Peplum Tops ", desc: "Add soft, feminine flair below the waist." },
      { title: "Bodycon Dresses ", desc: "Highlight your curves with confidence." },
      { title: "Belted Blazers ", desc: "Add structure while keeping the waist visible." },
      { title: "A-Line Skirts ", desc: "Create graceful movement and a feminine shape." },
    ],
    browseLooks: [
      { title: "Jumpsuits", img: definedwaistjumpsuit },
      { title: "Peplum Top", img: peplumtops },
      { title: "Bodycon Dress", img: bodycondresses },
      { title: "Belted Blazer", img: beltedblazer },
      { title: "A-Line Skirt", img: alineskirt },
    ],
  },
  "Inverted Triangle": {
    emoji: "🔺",
    color: "#faebbbff",
    highlightColor: "#FFF7DC",
    description:
      "An inverted triangle body shape is characterized by broader shoulders and a narrower waist and hips.Broad shoulders, defined upper body!",
    illustration: invertedtriangleImg,
    recommendations: [
      { title: "Scoop-Neck Tops", desc: "These gently narrow the shoulders and draw attention to the centerline, creating a more balanced proportion." },
      { title: "Wide-Leg Jumpsuits", desc: "Flowy pants add symmetry to your shape, while the fitted top complements your torso." },
      { title: "Minimal-Shoulder Blazers", desc: "Skip heavy shoulder pads — opt for single-breasted or soft-structured blazers for a smoother shape." },
      { title: "Cardigans", desc: "These add vertical movement that visually slims the shoulders." },
      { title: "Strapless Styles", desc: "Perfect for showing off toned arms without exaggerating shoulder width." },
    ],
    browseLooks: [
      { title: "Scoop-Neck Top", img: scoopnecktop },
      { title: "Wide-Leg Jumpsuit", img: widelegjumpsuit },
      { title: "Minimal-Shoulder Blazer", img: minimalshoulderblazer },
      { title: "Cardigan", img: cardigans },
      { title: "Strapless Style", img: straplessstyles },
    ],
  },
};

import { useLocalSearchParams } from "expo-router";

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const answersParam = params.answers;
  const fromDashboard = params.fromDashboard === 'true';
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!answersParam) return;
    try {
      const answers = typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam;
      const score = { Hourglass: 0, Rectangle: 0, Pear: 0, Apple: 0, "Inverted Triangle": 0 };
      Object.values(answers).forEach((opt) =>
        opt?.shapes?.forEach((s) => (score[s] = (score[s] || 0) + 1))
      );
      const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
      setResult(sorted[0][0]);
    } catch (error) {
      console.error('Error processing answers:', error);
    }
  }, [answersParam]);

  // Save result to API (skip if viewing from dashboard to prevent duplicates)
  useEffect(() => {
    const saveResult = async () => {
      if (!result || !answersParam || fromDashboard) return;

      try {
        const answers = typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam;
        await quizAPI.saveBodyShapeResult(answers, result);
      } catch (error) {
        console.error('Error saving body shape result:', error);
        // Fail silently - don't interrupt user experience
      }
    };

    if (result) {
      saveResult();
    }
  }, [result, answersParam]);

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
          As per the answers you provided, your body shape analysis result is:
        </Text>

        {/* Highlight Box */}
        <View style={[styles.highlightBox, { backgroundColor: shape.color }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shapeLabel}>𝐁𝐎𝐃𝐘 𝐒𝐇𝐀𝐏𝐄</Text>
            <View style={{ height: 10 }} />
            <Text style={styles.shapeName}>{shape.emoji} {result}</Text>
            <View style={{ height: 10 }} />
            <Text style={styles.shapeDesc}>{shape.description}</Text>
          </View>

          {typeof shape.illustration === "number" ? (
            <Image source={shape.illustration} style={styles.shapeImage} />
          ) : (
            <Image source={{ uri: shape.illustration }} style={styles.shapeImage} />
          )}
        </View>

        {/* Recommendations */}
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

        {/* Browse Looks */}
        <View style={{ height: 17 }} />
        <Text style={styles.sectionTitle}>Browse looks for {result} figure 🔍</Text>
        <View style={styles.browseGrid}>
          {shape.browseLooks?.map((look, index) => (
            <View key={index} style={styles.lookBox}>
              <Image source={look.img} style={styles.lookImage} />
              <Text style={styles.lookTitle}>{look.title}</Text>
            </View>
          ))}
        </View>

        {/* Share actions */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareButton} onPress={() => void handleEmailShare(result, shape)}>
            <Ionicons name="mail-outline" size={20} color="#2C2C2C" />
            <Text style={styles.shareButtonText}>Share on Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={() => handleDownloadPdf(result, shape)}>
            <Ionicons name="document-text-outline" size={20} color="#2C2C2C" />
            <Text style={styles.shareButtonText}>Download PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function handleEmailShare(result, shape) {
  if (!result || !shape) return;
  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    Alert.alert(
      "Email needed",
      "Add an email address to your profile so we can address this message to you."
    );
    return;
  }
  const subject = encodeURIComponent("My Body Shape Analysis - MatchMyTone");
  let body = `${SHARE_EMAIL_BODY_PREFIX_CRLF}My Body Shape Analysis - MatchMyTone%0D%0A%0D%0A`;
  body += `Body Shape: ${encodeURIComponent(result)}%0D%0A%0D%0A`;
  body += `${encodeURIComponent(shape.description)}%0D%0A%0D%0A`;
  body += `Top Recommendations:%0D%0A`;
  (shape.recommendations || []).forEach((rec, i) => {
    body += `${i + 1}. ${encodeURIComponent(rec.title)} - ${encodeURIComponent(rec.desc)}%0D%0A`;
  });
  body += `%0D%0A✨ Discovered with MatchMyTone ✨`;

  const mailto = `mailto:${encodeURIComponent(userEmail)}?subject=${subject}&body=${body}`;
  Linking.openURL(mailto).catch(() => { });
}

async function handleDownloadPdf(result, shape) {
  if (!result || !shape) return;

  const recsHtml = (shape.recommendations || [])
    .map(
      (rec) => `
      <li style="margin-bottom:6px;">
        <strong>${rec.title}</strong> – ${rec.desc}
      </li>`
    )
    .join("");

  const html = `
    <html>
      <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding:24px; background:#FFF8E7;">
        <h1 style="font-size:24px; margin-bottom:4px; color:#2C2C2C;">MatchMyTone – Body Shape Analysis</h1>
        <p style="margin-top:0; color:#C24C4A; font-weight:600;">Your personalised body shape report ✨</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Body Shape</h2>
        <p style="font-size:16px; font-weight:700; margin:0;">${result}</p>
        <p style="margin-top:6px; font-size:14px; color:#555;">${shape.description}</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Recommendations</h2>
        <ul style="padding-left:18px; margin-top:0;">${recsHtml}</ul>

        <p style="margin-top:32px; font-size:13px; color:#777;">Generated with love by MatchMyTone ✨</p>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share your Body Shape Analysis PDF",
  });
}

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
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  recCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginRight: 10,
    width: 220,
    borderLeftWidth: 5,
    borderLeftColor: "#F5B971",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  recTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C" },
  recDesc: { fontSize: 13, color: "#6B6B6B", marginTop: 6 },

  // ✅ Two images next to each other for Browse Looks
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
    justifyContent: "space-between",
    marginTop: 16,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(184,144,24,0.35)",
    gap: 6,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C2C2C",
  },
});
