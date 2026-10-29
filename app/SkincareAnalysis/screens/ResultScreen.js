import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Dimensions,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { quizAPI } from "../../../src/api";
import { SHARE_EMAIL_BODY_PREFIX_CRLF, getCurrentUserEmail } from "../../../src/shareEmail";
import * as Print from "expo-print";
import { shareAsync } from "expo-sharing";

/* ---------- CONSTANTS ---------- */
const { width } = Dimensions.get("window");
const CARD_WIDTH = 340;
const CARD_GAP = 18;

/* ---------- IMAGES ---------- */
import oilyImg from "../../../assets/oily.png";
import dryImg from "../../../assets/dry.png";
import combinationImg from "../../../assets/combination.png";
import normalImg from "../../../assets/normal.png";
import sensitiveImg from "../../../assets/sensitive.png";

import cleanserIcon from "../../../assets/cleanser.png";
import serumIcon from "../../../assets/serum.png";
import moisturiserIcon from "../../../assets/moisturiser.png";
import sunscreenIcon from "../../../assets/protection.png";
//for oily skin
import cleanserImg from "../../../assets/cetaphil.png";
import serumImg from "../../../assets/pilgrimserum.png";
import foxtaleImg from "../../../assets/foxtale.png";
import drshethsImg from "../../../assets/drsheths.png";

//for dry skin 
import ceraveImg from "../../../assets/ceravecleanser.png";
import plumserumImg from "../../../assets/plumserum.png";
import mamaearthImg from "../../../assets/mamaearthdry.png";
import undryImg from "../../../assets/undry.png";

//for combination skin 
import comcleanserImg from "../../../assets/comcleanser.png";
import ordinaryImg from "../../../assets/ordinaryserum.png";
import neutrogenaImg from "../../../assets/neutrogena.png";
import lakmeImg from "../../../assets/lakmesunscreen.png";

//for normal skin
import simpleImg from "../../../assets/simplecleanser.png";
import normalpilgrimImg from "../../../assets/normalpilgrim.png";
import joyImg from "../../../assets/joy.png";
import hyphenImg from "../../../assets/hyphen.png";

//for sensitive skin
import minimalistImg from "../../../assets/minimalistcleanser.png";
import chemistatplayImg from "../../../assets/chemistatplay.png";
import aveenoImg from "../../../assets/aveeno.png";
import drshethssunscreenImg from "../../../assets/drshethssunscreen.png";

/* ---------- DATA ---------- */

const SKIN_TYPES = {
  A: { name: "Oily Skin", image: oilyImg },
  B: { name: "Dry Skin", image: dryImg },
  C: { name: "Combination Skin", image: combinationImg },
  D: { name: "Normal Skin", image: normalImg },
  E: { name: "Sensitive Skin", image: sensitiveImg },
};

const SKIN_TYPE_DESCRIPTIONS = {
  A: "Oily skin produces excess sebum, making the face shiny, prone to clogged pores, acne, and frequent breakouts throughout the day.",
  B: "Dry skin lacks natural moisture, making it feel tight, rough, flaky, and sometimes itchy, especially after washing or weather changes.",
  C: "Combination skin has oily areas and dry areas, usually an oily T-zone with normal or dry cheeks.",
  D: "Normal skin is well balanced, smooth, and healthy, with minimal dryness, oiliness, or sensitivity.",
  E: "Sensitive skin reacts easily to products or weather, causing redness, irritation, or discomfort.",
};

/* ---------- SKIN CONCERNS ---------- */

const SKIN_CONCERNS = {
  A: [
    { title: "Excess Oil Production", description: "Skin produces too much sebum, causing constant shine and greasiness." },
    { title: "Acne & Breakouts", description: "Clogged pores and excess oil lead to frequent pimples." },
    { title: "Blackheads & Whiteheads", description: "Oil buildup inside pores causes blackheads and whiteheads." },
    { title: "Shiny Appearance", description: "Face looks greasy, especially in the T-zone area." },
  ],
  B: [
    { title: "Dryness", description: "Skin lacks moisture, feeling tight, rough, and uncomfortable throughout the day." },
    { title: "Flakiness", description: "Skin may peel or shed dry patches, especially around nose and mouth." },
    { title: "Tight Feeling", description: "Skin feels stretched, especially after washing or exposure to cold weather." },
    { title: "Rough Texture", description: "Skin surface feels uneven and rough due to insufficient moisture." },
  ],
  C: [
    { title: "Oily T-Zone", description: "Forehead, nose, and chin produce excess oil during the day." },
    { title: "Uneven Texture", description: "Skin feels oily in some areas and rough in others." },
    { title: "Dry Cheeks", description: "Cheeks feel dry, tight, or rough compared to oily areas." },
    { title: "Occasional Breakouts", description: "Breakouts appear mainly in the T-zone due to oil buildup." },


  ],
  D: [
    { title: "Occasional Breakouts", description: "Minor pimples may appear due to stress, hormones, or product buildup." },
    { title: "Mild Oiliness", description: "Light oiliness can appear in the T-zone by end of day." },
    { title: "Dehydration", description: "Skin can feel tight if not moisturised properly." },
    { title: "Sensitivity to Weather", description: "Skin may react mildly to sudden climate changes." },
  ],
  E: [
    { title: "Redness", description: "Skin turns red easily due to irritation or environmental triggers." },
    { title: "Itching & Burning", description: "Skin may sting, itch, or burn after using certain products." },
    { title: "Product Reactions", description: "Many skincare products cause irritation or discomfort." },
    { title: "Sensitivity to Weather", description: "Skin reacts quickly to heat, cold, or humidity changes." },
  ],
};

const ROUTINE_STEPS = [
  { key: "cleanser", label: "Cleanser", icon: cleanserIcon },
  { key: "serum", label: "Serum", icon: serumIcon },
  { key: "moisturiser", label: "Moisturiser", icon: moisturiserIcon },
  { key: "sunscreen", label: "Sunscreen", icon: sunscreenIcon },
];

/* ---------- SKIN TYPE BASED ROUTINES ---------- */

const STEP_RECOMMENDATIONS = {
  A: {
    cleanser: {
      name: "Cetaphil Oily Skin Cleanser",
      image: cleanserImg,
      link: "https://amzn.in/d/92hyTeN",
      bullets: "• Oil controlling\n• Non-comedogenic",
      why: "Removes excess oil without drying the skin.",
    },
    serum: {
      name: "Pilgrim Vitamin C Serum",
      image: serumImg,
      link: "https://www.firstcry.com",
      bullets: "• Brightens skin\n• Fades acne marks",
      why: "Improves skin clarity and glow.",
    },
    moisturiser: {
      name: "Foxtale Oil-Free Moisturiser",
      image: foxtaleImg,
      link: "https://foxtale.in",
      bullets: "• Lightweight\n• Controls shine",
      why: "Hydrates without clogging pores.",
    },
    sunscreen: {
      name: "Dr Sheth's SPF 50 Sunscreen",
      image: drshethsImg,
      link: "https://www.drsheths.com",
      bullets: "• SPF 50+\n• Oil-free",
      why: "Protects skin from UV damage.",
    },
  },

  B: {
    cleanser: {
      name: "CeraVe Hydrating Cleanser",
      image: ceraveImg,
      link: "https://www.netmeds.com/product/cerave-hydrating-cleanser-for-normal-to-dry-skin-236-ml-lui2z5-8253737?source_attribution=Bing-CPC-Pmax&utm_source=Bing-CPC-Pmax&utm_medium=CPC&utm_campaign=Bing-CPC-Pmax&msclkid=7e34a82607cd1afeefc4c177516e2e2a",
      bullets: "• Gently cleanses without drying\n• Maintains skin's natural moisture barrier",
      why: "Cleanses the skin effectively without stripping moisture, while ceramides help restore and protect the skin barrier.",
    },
    serum: {
      name: "Plum Rice Water & 10% Niacinamide Face Serum",
      image: plumserumImg,
      link: "https://firstcry.com",
      bullets: "• Lightweight & fast absorbing\n• Brightens skin tone",
      why: "Helps improve skin brightness and texture while strengthening the skin barrier and keeping skin hydrated.",
    },
    moisturiser: {
      name: "Mamaearth Vitamin C Daily Glow Light Gel Moisturizer",
      image: mamaearthImg,
      link: "https://www.netmeds.com/product/mamaearth-vitamin-c-daily-glow-light-gel-moisturizer-with-vit-c-turmeric-for-skin-brightening-200-gm-m8zqb3-10043309?source_attribution=Bing-CPC-Pmax&utm_source=Bing-CPC-Pmax&utm_medium=CPC&utm_campaign=Bing-CPC-Pmax&msclkid=58f1eece7b94115ec7ff879f2c6dd2a3",
      bullets: "• Deeply hydrates dry skin\n• Lightweight gel texture",
      why: "Provides long-lasting hydration to dry skin while improving brightness and leaving skin soft, smooth, and refreshed.",
    },
    sunscreen: {
      name: "Undry Hydrating Sunscreen for Dry Skin ",
      image: undryImg,
      link: "https://www.firstcry.com/undry/undry-hydrating-sunscreen-for-dry-skin-50g/17595245/product-detail?ref=BSN_Shopping_78_Sun-Protection!BSN-Standard_All_Search_Ads!&msclkid=924d2dfafefa172a084344aba7243c29&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Broad-spectrum SPF 50+ \n• Hydrates and protects dry skin",
      why: "Provides strong sun protection while deeply hydrating dry skin, helping prevent moisture loss and dryness throughout the day.",
    },
  },

  C: {
    cleanser: {
      name: "Cetaphil Bright Healthy Radiance Gentle Renewing Cleanser",
      image: comcleanserImg,
      link: "https://www.firstcry.com/cetaphil/cetaphil-bright-healthy-radiance-gentle-renewing-cleanser-100-g/17751145/product-detail?ref=BSN_Shopping_78_Facial-Care!BSN-Standard_All_Search_Ads!&msclkid=5de620cf280e12b4def4499e4831e6a4&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Gently cleanses without over-drying\n• Improves skin texture & radiance",
      why: "Cleanses combination skin effectively by removing impurities while refining texture and maintaining natural skin balance.",
    },
    serum: {
      name: "The Ordinary Niacinamide 10% + Zinc 1%",
      image: ordinaryImg,
      link: "https://www.netmeds.com/product/the-ordinary-niacinamide-10-zinc-1-eu-60-ml-m00xkb-8499798?source_attribution=Bing-CPC-Pmax&utm_source=Bing-CPC-Pmax&utm_medium=CPC&utm_campaign=Bing-CPC-Pmax&msclkid=921104f9ec8616c131916da88eb7555d",
      bullets: "• Balances oil in the T-zone\n• Lightweight, water-based formula",
      why: "Controls excess oil in oily areas while improving skin texture and clarity without over-drying the cheeks.",
    },
    moisturiser: {
      name: "Neutrogena Hydro Boost Water Gel Moisturizer",
      image: neutrogenaImg,
      link: "https://www.firstcry.com/neutrogena/neutrogena-hydro-boost-water-gel-moisturizer-15gm/10870208/product-detail?ref=BSN_Shopping_78_Facial-Care!BSN-Standard_All_Search_Ads!&msclkid=c2d35b90889b1710433932c1eba8b03c&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Lightweight hydration without greasiness\n• Keeps skin soft and plump",
      why: "Provides long-lasting hydration to dry areas while staying lightweight on the oily T-zone, keeping combination skin balanced.",
    },
    sunscreen: {
      name: "LAKME 9to5 Sun Expert Super Matte SPF 50 PA+++ Sunscreen",
      image: lakmeImg,
      link: "https://www.netmeds.com/product/lakme-sun-expert-spf-50-ultra-matte-lotion-100-ml-lui46v-8279104?source_attribution=Bing-CPC-Pmax&utm_source=Bing-CPC-Pmax&utm_medium=CPC&utm_campaign=Bing-CPC-Pmax&msclkid=09c5a1fe00781d41b13fc8af643a84af",
      bullets: "• Non-greasy\n• Comfortable",
      why: "Suitable for mixed skin.",
    },
  },

  D: {
    cleanser: {
      name: "Simple Active Skin Barrier Care Smoothing Gel Cleanser ",
      image: simpleImg,
      link: "https://www.netmeds.com/product/simple-active-skin-barrier-care-smoothing-gel-cleanser-150-ml-lui68v-8320483?source_attribution=Bing-CPC-Pmax&utm_source=Bing-CPC-Pmax&utm_medium=CPC&utm_campaign=Bing-CPC-Pmax&msclkid=79930bd9678e1884d80e6288000a423a",
      bullets: "• Gently cleanses without stripping\n• Helps maintain healthy skin barrier",
      why: "Cleanses skin gently while supporting the natural skin barrier, keeping normal skin clean, smooth, and comfortable.",
    },
    serum: {
      name: "Pilgrim Korean 2% Alpha Arbutin & 3% Vitamin C Brightening Face Serum",
      image: normalpilgrimImg,
      link: "https://www.firstcry.com/pilgrim/pilgrim-korean-2-alpha-arbutin-and-3-vitamin-c-brightening-face-serum-for-glowing-skin-30-ml/16193562/product-detail?ref=BSN_Shopping_78_Facial-Care!BSN-Standard_All_Search_Ads!&msclkid=73342d3b2b661a5cf7cb446a43b56ba3&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Brightens skin tone\n• Improves glow & clarity",
      why: "Helps enhance natural radiance, improves uneven skin tone, and keeps normal skin looking fresh and healthy.",
    },
    moisturiser: {
      name: "Joy Skin Fruits Moisturizing Skin Cream",
      image: joyImg,
      link: "https://www.firstcry.com/joy/joy-skin-fruits-moisturizing-skin-cream-with-apple-jojoba-and-almond-oil-500ml-quick-absorbing-and-non-sticky-moisturizer-for-face-hands-and-body-for-healthy-soft-and-glowing-skin/18542704/product-detail?ref=BSN_Shopping_78_Body-care!BSN-Standard_All_Search_Ads!&msclkid=e0d6163991aa1d9648587f68f861b052&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Long-lasting hydration & glow\n• Keeps skin soft and smooth",
      why: "Provides everyday moisture that keeps normal skin nourished, healthy-looking, and naturally glowing without heaviness.",
    },
    sunscreen: {
      name: "Hyphen Golden Hour Glow Sunscreen SPF 50 PA++++ ",
      image: hyphenImg,
      link: "https://www.firstcry.com/hyphen/hyphen-golden-hour-glow-sunscreen-spf-50-pa-40-g/19900178/product-detail?ref=BSN_Shopping_78_Sun-Protection!BSN-Standard_All_Search_Ads!&msclkid=d67dbca066161c8069d7d5f10cb81a88&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "•Broad-spectrum SPF 50 PA++++\n• Adds a natural glow finish",
      why: "Protects normal skin from UVA & UVB rays while giving a healthy glow without feeling heavy or greasy.",
    },
  },

  E: {
    cleanser: {
      name: "Minimalist Salicylic Acid + LHA 2% Cleanser",
      image: minimalistImg,
      link: "https://www.firstcry.com/minimalist/minimalist-salicylic-acid-lha-2-cleanser-100-ml/18253789/product-detail?ref=BSN_Shopping_78_Facial-Care!BSN-Standard_All_Search_Ads!&msclkid=6a81f29334361ff5d0b19bc12b26c155&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Fragrance-free formula\n• Designed for oily & sensitive acne-prone skin",
      why: "Cleanses pores and controls acne while being formulated to minimise irritation, making it suitable for sensitive, acne-prone skin when used gently.",
    },
    serum: {
      name: "Chemist at Play 10% Vitamin C Serum",
      image: chemistatplayImg,
      link: "https://www.firstcry.com/chemist-at-play/chemist-at-play-10-vitamin-c-serum-brightens-and-gives-glow-10-ml/20666381/product-detail?ref=BSN_Shopping_78_Facial-Care!BSN-Standard_All_Search_Ads!&msclkid=58b50f1c72af16d7c6d3664e522c230a&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Gently brightens sensitive skin\n• Supports skin barrier health",
      why: "Brightens dull skin while being gentle enough for sensitive skin, with added ceramides to help reduce irritation.",
    },
    moisturiser: {
      name: "Aveeno Skin Relief Moisturizing Lotion",
      image: aveenoImg,
      link: "https://www.firstcry.com/aveeno/aveeno-skin-relief-moisturizing-lotion-for-sensitive-skin-354-ml/10870212/product-detail?ref=BSN_Shopping_78_Facial-Care!BSN-Standard_All_Search_Ads!&msclkid=0db3060eb7e519789af46f5c96b8aeb7&utm_source=bing&utm_medium=cpc&utm_campaign=BSN-Standard_All_Search_Ads&utm_term=4586337882898975&utm_content=Ad%20group%20%231",
      bullets: "• Soothes dry, sensitive skin\n• Provides long-lasting hydration",
      why: "Instantly calms sensitive skin and helps restore moisture, keeping skin comfortable, soft, and irritation-free throughout the day.",
    },
    sunscreen: {
      name: "Dr. Sheth's Oat & Ceramide Sensitive Skin Sunscreen SPF 50+ PA++++",
      image: drshethssunscreenImg,
      link: "https://www.netmeds.com/product/dr-sheths-oat-ceramide-sensitive-skin-sunscreen-spf-50-pa-oil-free-sunscreen-50-gm-m8zqb3-10043319?source_attribution=Bing-CPC-Pmax&utm_source=Bing-CPC-Pmax&utm_medium=CPC&utm_campaign=Bing-CPC-Pmax&msclkid=e767c340f8291a247d3daa12da16f886",
      bullets: "• High SPF protection for sensitive skin\n• Calms & strengthens skin barrier",
      why: "Provides broad-spectrum sun protection while soothing sensitive skin and supporting the skin barrier with oats and ceramides—without irritation.",
    },
  },
};

/**
 * Determines skin type based on answer counts with tie-breaking rules
 */
function determineSkinType(counts) {
  const { A, B, C, D, E } = counts;

  if (A === B && B === C && C === D && D === E) {
    return 'C';
  }

  const maxCount = Math.max(A, B, C, D, E);
  const topTypes = [];
  if (A === maxCount) topTypes.push('A');
  if (B === maxCount) topTypes.push('B');
  if (C === maxCount) topTypes.push('C');
  if (D === maxCount) topTypes.push('D');
  if (E === maxCount) topTypes.push('E');

  if (topTypes.length === 1) {
    return topTypes[0];
  }

  if (topTypes.includes('A') && topTypes.includes('B')) {
    return 'C';
  }

  if (topTypes.includes('C')) {
    return 'C';
  }

  if (topTypes.includes('A')) {
    return 'A';
  }

  if (topTypes.includes('E')) {
    return 'E';
  }

  if (topTypes.includes('B')) {
    return 'B';
  }

  return 'D';
}

/* ---------- SCREEN ---------- */

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const horizontalRef = useRef(null);
  const [activeStep, setActiveStep] = useState("cleanser");
  const answersParam = params.answers;
  const fromDashboard = params.fromDashboard === 'true';

  const skinType = useMemo(() => {
    if (!answersParam) return null;

    try {
      const answers = typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam;
      const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };

      Object.values(answers).forEach((answer) => {
        if (answer && typeof answer === 'object' && answer.label) {
          const key = answer.label;
          if (key && counts.hasOwnProperty(key)) {
            counts[key]++;
          }
        }
      });

      return determineSkinType(counts);
    } catch (error) {
      console.error('Error processing answers:', error);
      return null;
    }
  }, [answersParam]);

  // Save result to API (skip if viewing from dashboard to prevent duplicates)
  React.useEffect(() => {
    const saveResult = async () => {
      if (!skinType || !answersParam || fromDashboard) return;

      try {
        const answers = typeof answersParam === 'string' ? JSON.parse(answersParam) : answersParam;
        const skinTypeName = SKIN_TYPES[skinType].name;
        await quizAPI.saveSkincareResult(answers, skinTypeName);
      } catch (error) {
        console.error('Error saving skincare result:', error);
      }
    };

    if (skinType) {
      saveResult();
    }
  }, [skinType, answersParam]);

  if (!skinType) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const scrollToCard = (index) => {
    setActiveStep(ROUTINE_STEPS[index].key);
    horizontalRef.current?.scrollTo({
      x: index * (CARD_WIDTH + CARD_GAP),
      animated: true,
    });
  };

  const onHorizontalScrollEnd = (e) => {
    const index = Math.round(
      e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP)
    );
    setActiveStep(ROUTINE_STEPS[index]?.key || "cleanser");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8E7" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.push("/home")}>
          <Ionicons name="chevron-back" size={26} />
        </TouchableOpacity>

        <Text style={styles.title}>𝑯𝒆𝒓𝒆 𝒂𝒓𝒆 𝒚𝒐𝒖𝒓 𝒓𝒆𝒔𝒖𝒍𝒕𝒔! 🎉</Text>
        <Text style={styles.subtitle}>
          As per the answers you provided, your skincare analysis result is:
        </Text>

        <View style={styles.highlightBox}>
          <Image source={SKIN_TYPES[skinType].image} style={styles.skinImage} />

          <View style={{ flex: 1 }}>
            <Text style={styles.shapeName}>𝐒𝐊𝐈𝐍 𝐓𝐘𝐏𝐄</Text>
            <View style={{ height: 4 }} />
            <Text style={styles.shapeName}>{SKIN_TYPES[skinType].name}</Text>
            <View style={{ height: 6 }} />

            <Text style={styles.shapeDesc}>
              {SKIN_TYPE_DESCRIPTIONS[skinType]}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Skin Concerns ‼</Text>
        <View style={{ marginTop: -10 }}></View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 6 }}
        >
          {SKIN_CONCERNS[skinType]?.map((c, i) => (
            <View key={i} style={styles.flashcard}>
              <Text style={styles.flashcardTitle}>{c.title}</Text>
              <View style={{ height: 5 }} />
              <Text style={styles.flashcardDesc}>{c.description}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Skincare Routine 🎀</Text>

        <View style={styles.routineWrapper}>
          <View style={styles.dottedLine} />
          <View style={styles.routineContainer}>
            {ROUTINE_STEPS.map((step, index) => (
              <TouchableOpacity
                key={step.key}
                style={styles.routineItem}
                onPress={() => scrollToCard(index)}
              >
                <View
                  style={[
                    styles.circle,
                    activeStep === step.key && styles.activeCircle,
                  ]}
                >
                  <Image source={step.icon} style={styles.icon} />
                </View>
                <Text style={styles.routineLabel}>{step.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ScrollView
          ref={horizontalRef}
          horizontal
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onHorizontalScrollEnd}
        >
          {ROUTINE_STEPS.map((step, index) => {
            const rec = STEP_RECOMMENDATIONS[skinType][step.key];
            return (
              <View key={step.key} style={styles.productCard}>
                <Text style={styles.stepHeader}>
                  Step {index + 1} - {step.label}
                </Text>

                <View style={styles.productRow}>
                  <Image source={rec.image} style={styles.productImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{rec.name}</Text>
                    <Text style={styles.subText}>{rec.bullets}</Text>

                    <TouchableOpacity
                      style={styles.cartBtn}
                      onPress={() => Linking.openURL(rec.link)}
                    >
                      <Text style={styles.cartText}>Buy Now</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.whyBox}>
                  <Text style={styles.whyTitle}>Why we picked it</Text>
                  <View style={{ height: 5 }} />
                  <Text style={styles.whyText}>{rec.why}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Share actions */}
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareButton} onPress={() => void handleEmailShare(skinType)}>
            <Ionicons name="mail-outline" size={20} color="#2C2C2C" />
            <Text style={styles.shareButtonText}>Share on Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={() => handleDownloadPdf(skinType)}>
            <Ionicons name="document-text-outline" size={20} color="#2C2C2C" />
            <Text style={styles.shareButtonText}>Download PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function handleEmailShare(skinType) {
  if (!skinType) return;
  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    Alert.alert(
      "Email needed",
      "Add an email address to your profile so we can address this message to you."
    );
    return;
  }
  const subject = encodeURIComponent("My Skincare Analysis - MatchMyTone");
  let body = `${SHARE_EMAIL_BODY_PREFIX_CRLF}My Skincare Analysis - MatchMyTone%0D%0A%0D%0A`;
  body += `Skin Type: ${encodeURIComponent(SKIN_TYPES[skinType].name)}%0D%0A%0D%0A`;
  body += `${encodeURIComponent(SKIN_TYPE_DESCRIPTIONS[skinType])}%0D%0A%0D%0A`;
  body += `Key Concerns:%0D%0A`;
  (SKIN_CONCERNS[skinType] || []).forEach((c, i) => {
    body += `${i + 1}. ${encodeURIComponent(c.title)} - ${encodeURIComponent(c.description)}%0D%0A`;
  });
  body += `%0D%0A✨ Discovered with MatchMyTone ✨`;

  const mailto = `mailto:${encodeURIComponent(userEmail)}?subject=${subject}&body=${body}`;
  Linking.openURL(mailto).catch(() => { });
}

async function handleDownloadPdf(skinType) {
  if (!skinType) return;

  const concernsHtml = (SKIN_CONCERNS[skinType] || [])
    .map(
      (c) => `
      <li style="margin-bottom:6px;">
        <strong>${c.title}</strong> – ${c.description}
      </li>`
    )
    .join("");

  const html = `
    <html>
      <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding:24px; background:#FFF8E7;">
        <h1 style="font-size:24px; margin-bottom:4px; color:#2C2C2C;">MatchMyTone – Skincare Analysis</h1>
        <p style="margin-top:0; color:#C24C4A; font-weight:600;">Your personalised skincare report ✨</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Skin Type</h2>
        <p style="font-size:16px; font-weight:700; margin:0;">${SKIN_TYPES[skinType].name}</p>
        <p style="margin-top:6px; font-size:14px; color:#555;">${SKIN_TYPE_DESCRIPTIONS[skinType]}</p>

        <h2 style="font-size:18px; margin-top:24px; margin-bottom:8px;">Key Concerns</h2>
        <ul style="padding-left:18px; margin-top:0;">${concernsHtml}</ul>

        <p style="margin-top:32px; font-size:13px; color:#777;">Generated with love by MatchMyTone ✨</p>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Share your Skincare Analysis PDF",
  });
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF8E7" },
  content: { padding: 20, paddingBottom: 80 },

  title: { fontSize: 20, fontWeight: "700", marginVertical: 12 },
  subtitle: { fontSize: 14, marginBottom: 10 },

  highlightBox: {
    backgroundColor: "#FCEEC0",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    marginBottom: 20,
  },

  skinImage: { width: 100, height: 120, marginRight: 16 },
  shapeName: { fontSize: 16, fontWeight: "800", color: "#A46B39" },
  shapeDesc: { fontSize: 13 },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginVertical: 16 },

  flashcard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginRight: 10,
    marginVertical: 4,
    width: 220,

    borderLeftWidth: 5,
    borderLeftColor: "#F5B971",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,

    elevation: 1,
  },

  flashcardTitle: { fontWeight: "700" },
  flashcardDesc: { fontSize: 13 },

  routineWrapper: { position: "relative", marginBottom: 16 },
  dottedLine: {
    position: "absolute",
    top: 38,
    left: 50,
    right: 30,
    borderTopWidth: 1.,
    borderStyle: "dashed",
    borderColor: "#B8A99A",
  },

  routineContainer: { flexDirection: "row", justifyContent: "space-between" },
  routineItem: { alignItems: "center", flex: 1 },

  circle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFF8E7",
    justifyContent: "center",
    alignItems: "center",
  },

  activeCircle: { backgroundColor: "#FCEBB2" },
  icon: { width: 40, height: 68 },

  routineLabel: { marginTop: 8, fontWeight: "700" },

  productCard: {
    width: CARD_WIDTH,
    backgroundColor: "#FFF1C1",
    borderRadius: 18,
    padding: 18,
    marginRight: CARD_GAP,
  },

  stepHeader: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  productRow: { flexDirection: "row" },
  productImg: { width: 90, height: 130, marginRight: 12 },

  productName: { fontWeight: "600", fontSize: 16 },
  subText: { fontSize: 13, marginVertical: 10 },

  cartBtn: {
    backgroundColor: "#5E2D79",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },

  cartText: { color: "#FFF", fontWeight: "700" },

  whyBox: {
    backgroundColor: "#FFF8E7",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },

  whyTitle: { fontWeight: "700", fontSize: 16 },

  whyText: { fontSize: 13 },
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B6B6B',
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
