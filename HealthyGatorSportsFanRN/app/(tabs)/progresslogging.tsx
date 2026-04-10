import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import {
  useNavigation,
  usePreventRemove,
  useRoute,
} from "@react-navigation/native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import StarRating from "react-native-star-rating-widget";

import User from "@/components/user";
import { AppUrls } from "@/constants/AppUrls";
import GlobalStyles from "../styles/GlobalStyles";
import { clearTokens } from "@/components/tokenStorage";
import NotificationBell from "@/components/NotificationBell";

type ProgressQuestion = {
  question_id: string | number;
  question: string;
  min_chars: number;
  max_chars?: number;
};

type ProgressQuestionAnswerPayload = {
  question_id: string | number;
  question: string;
  answer: string;
  answered_at: string;
};

const DEFAULT_MAX_CHARS = 500;

function countWords(text: string): number {
  const t = text.trim();
  if (t === "") return 0;
  return t.split(/\s+/).length;
}

const DEFAULT_PROGRESS_QUESTIONS: ProgressQuestion[] = [
  {
    question_id: "daily_1",
    question: "What went well for you today?",
    min_chars: 10,
    max_chars: DEFAULT_MAX_CHARS,
  },
  {
    question_id: "daily_2",
    question: "What is one thing you want to focus on next?",
    min_chars: 10,
    max_chars: DEFAULT_MAX_CHARS,
  },
];

const TAB_VISUAL_H = 64;

/** API / navigation may omit weight or send a decimal string; Math.floor(undefined) is NaN and JSON.stringify(NaN) → null on the server. */
function parseInitialWeight(w: unknown): number {
  if (w == null || w === "") return 0;
  const n = typeof w === "number" ? w : parseFloat(String(w));
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export default function ProgressLogging() {
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route.params as { currentUser?: User } | undefined;
  const currentUser =
    routeParams?.currentUser ??
    new User(0, "", "", "", "", "", "", 0, 0, 0, false, false, 0, "", 0, "");
  const missingCurrentUser = !routeParams?.currentUser;

  const insets = useSafeAreaInsets();
  const [bottomH, setBottomH] = useState<number>(TAB_VISUAL_H + insets.bottom);
  const padBottom = bottomH + 24;

  const baselineWeight = parseInitialWeight(currentUser?.currentWeight);
  const [newWeight, setNewWeight] = useState(baselineWeight);
  const [rating, setRating] = useState(0);
  const [questions, setQuestions] = useState<ProgressQuestion[]>(
    DEFAULT_PROGRESS_QUESTIONS,
  );
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, string>
  >({});

  const questionKey = (id: string | number) => String(id);

  const [isGoalToLoseWeight] = useState(currentUser.loseWeight);
  const [isGoalToFeelBetter] = useState(currentUser.feelBetter);

  useEffect(() => {
    const loadQuestionBank = async () => {
      try {
        const response = await fetch(`${AppUrls.url}/userdata/questions/`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...AppUrls.apiHeaders,
          },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const serverQuestions = data?.questions;
        if (Array.isArray(serverQuestions) && serverQuestions.length > 0) {
          setQuestions(serverQuestions);
        }
      } catch {}
    };

    loadQuestionBank();
  }, []);

  function dataEntered(): boolean {
    if (rating !== 0) return true;
    if (Object.keys(questionAnswers).length > 0) return true;
    return newWeight !== baselineWeight;
    return newWeight !== baselineWeight;
  }
  usePreventRemove(dataEntered(), () => {});

  if (missingCurrentUser) {
    return (
      <SafeAreaView
        style={[
          GlobalStyles.container,
          { backgroundColor: "#F7F9FF", justifyContent: "center", padding: 24 },
        ]}
        edges={["top"]}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#0021A5",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          Session Expired
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: "#344054",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          We could not load your user data for this screen. Please sign in
          again.
        </Text>
        <TouchableOpacity
          style={[
            GlobalStyles.confirmButton,
            { alignSelf: "center", minWidth: 200 },
          ]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("CreateOrSignIn" as never)}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Go To Sign In
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[GlobalStyles.container, { backgroundColor: "#F7F9FF" }]}
      edges={["top"]}
    >
      <View
        style={[
          GlobalStyles.topMenu,
          {
            paddingHorizontal: 20,
            paddingTop:
              (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0) +
              22,
            paddingBottom: 10,
          },
        ]}
      >
        <Image source={require('./../../assets/images/clipboardgator.png')} style={{ width: 55, height: 55 }} />
        <Text style={{ fontSize: 25, fontFamily: 'System', color: '#0021A5' }}>Enter Progress</Text>
        <View style={GlobalStyles.topIcons}>
          <NotificationBell
            currentUserId={currentUser?.userId}
            onPress={() => NavigateToNotifications(currentUser, navigation)}
            size={40}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: padBottom }}
        showsVerticalScrollIndicator={false}
      >
        {isGoalToLoseWeight && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter New Weight:</Text>
            <View style={styles.orangeBar} />

            {/* Weight input with plus and minus buttons */}
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.circleBtn}
                activeOpacity={0.7}
                onPress={() => setNewWeight(Math.floor(newWeight) - 1)}
              >
                <Image
                  source={require("./../../assets/images/progresslogging/minus.png")}
                  style={styles.circleIcon}
                />
              </TouchableOpacity>

              <Text style={styles.weightValue}>{newWeight}</Text>

              <TouchableOpacity
                style={styles.circleBtn}
                activeOpacity={0.7}
                onPress={() => setNewWeight(Math.floor(newWeight) + 1)}
              >
                <Image
                  source={require("./../../assets/images/progresslogging/plus.png")}
                  style={styles.circleIcon}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isGoalToLoseWeight && (
          <Text style={styles.goalText}>
            Your goal: {Math.floor(currentUser.goalWeight)}
          </Text>
        )}

        {/* Feeling input with star rating */}
        {isGoalToFeelBetter && (
          <View style={[styles.card, { marginTop: 18 }]}>
            <Text style={styles.cardTitle}>How are you feeling?</Text>
            <View style={styles.orangeBar} />
            <StarRating
              style={styles.stars}
              enableHalfStar={false}
              rating={rating}
              onChange={(newRating) => setRating(newRating)}
            />
          </View>
        )}

        <View style={[styles.card, { marginTop: 18 }]}>
          <Text style={styles.cardTitle}>Daily Questions</Text>
          <View style={styles.orangeBar} />

          {questions.map((questionItem) => (
            <View
              key={questionKey(questionItem.question_id)}
              style={styles.questionBlock}
            >
              {(() => {
                const qk = questionKey(questionItem.question_id);
                const answerText = questionAnswers[qk] || "";
                const maxChars = questionItem.max_chars || DEFAULT_MAX_CHARS;
                const currentChars = answerText.length;
                const currentWords = countWords(answerText);
                return (
                  <>
                    <Text style={styles.questionText}>
                      {questionItem.question}
                    </Text>
                    <TextInput
                      style={styles.answerInput}
                      multiline
                      maxLength={maxChars}
                      value={answerText}
                      onChangeText={(text: string) =>
                        setQuestionAnswers((prev) => ({
                          ...prev,
                          [qk]: text,
                        }))
                      }
                      placeholder="Type your answer"
                      placeholderTextColor="#98A2B3"
                    />
                    <Text style={styles.minCharHint}>
                      Characters: {currentChars}/{questionItem.min_chars}{" "}
                      minimum, {maxChars} maximum
                    </Text>
                    <Text style={styles.wordHint}>
                      Word count: {currentWords}
                    </Text>
                  </>
                );
              })()}
            </View>
          ))}
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[GlobalStyles.confirmButton, styles.cta]}
          activeOpacity={0.8}
          onPress={() =>
            ConfirmChanges(
              navigation,
              rating,
              newWeight,
              currentUser,
              questions,
              questionAnswers,
            )
          }
        >
          <Text style={styles.ctaText}>Submit Assessment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom navigation bar */}
      <View
        onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
        style={[GlobalStyles.bottomMenu, { paddingBottom: insets.bottom }]}
      >
        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToHomePage(currentUser, navigation)}
        >
          <Image
            source={require("../../assets/images/bottomHomeMenu/homeIcon.png")}
            style={{ width: 30, height: 30, alignSelf: "center" }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToGameSchedule(currentUser, navigation)}
        >
          <Image
            source={require("../../assets/images/bottomHomeMenu/calendarIcon.png")}
            style={{ width: 30, height: 30, alignSelf: "center" }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity style={GlobalStyles.bottomIcons} activeOpacity={0.5}>
          <Image
            source={require("../../assets/images/bottomHomeMenu/plus.png")}
            style={{ width: 45, height: 45, alignSelf: "center" }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => NavigateToProfileManagement(currentUser, navigation)}
        >
          <Image
            source={require("../../assets/images/bottomHomeMenu/defaultprofile.png")}
            style={{ width: 30, height: 30, alignSelf: "center" }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={GlobalStyles.bottomIcons}
          activeOpacity={0.5}
          onPress={() => LogoutPopup(navigation)}
        >
          <Image
            source={require("../../assets/images/bottomHomeMenu/logoutIcon.png")}
            style={{ width: 30, height: 30, alignSelf: "center" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ConfirmChanges(
  navigation: any,
  rating: number,
  newWeight: any,
  currentUser: User,
  questions: ProgressQuestion[],
  questionAnswers: Record<string, string>,
) {
  if (currentUser.feelBetter && currentUser.loseWeight) {
    currentUser.goalType = "both";
  } else if (currentUser.loseWeight) {
    currentUser.goalType = "loseWeight";
  } else if (currentUser.feelBetter) {
    currentUser.goalType = "feelBetter";
  }

  const builtQuestionAnswers: ProgressQuestionAnswerPayload[] = questions.map(
    (questionItem) => {
      const qk = String(questionItem.question_id);
      return {
        question_id: questionItem.question_id,
        question: questionItem.question,
        answer: (questionAnswers[qk] || "").trim(),
        answered_at: new Date().toISOString(),
      };
    },
  );

  for (const questionItem of questions) {
    const qk = String(questionItem.question_id);
    const answerText = (questionAnswers[qk] || "").trim();
    const maxChars = questionItem.max_chars || DEFAULT_MAX_CHARS;
    if (!answerText) {
      Alert.alert(
        "Missing Information",
        "Please answer every question before submitting.",
      );
      return;
    }
    if (answerText.length < questionItem.min_chars) {
      Alert.alert(
        "More Detail Needed",
        `Please enter at least ${questionItem.min_chars} characters for ${questionItem.question}.`,
      );
      return;
    }
    if (answerText.length > maxChars) {
      Alert.alert(
        "Too Long",
        `Please keep your answer to ${maxChars} characters or fewer for ${questionItem.question}.`,
      );
      return;
    }
  }

  // Validation to ensure user doesn't submit without rating if they have the feel-better goal
  if (currentUser.feelBetter && (rating === 0 || rating === null)) {
    Alert.alert(
      "Missing Information",
      "Uh oh! Make sure you rate how you're feeling before you submit.",
      [{ text: "Cancel", style: "cancel" }],
    );
  } else {
    Alert.alert("Confirmation", "Are you sure you want to log this data?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm Changes",
        style: "destructive",
        onPress: async () => {
          let goHome = true;
          if (
            currentUser.loseWeight &&
            currentUser.goalWeight &&
            newWeight <= currentUser.goalWeight
          ) {
            goHome = false;
          }
          // add progress logging entry, then check if we need to send feel-better message or weight goal achievement message and update goals if necessary
          await addUserProgress(
            currentUser,
            rating,
            newWeight,
            navigation,
            goHome,
            builtQuestionAnswers,
          );
          if (currentUser.feelBetter) {
            await sendFeelBetterMessage(rating);
          }
          if (
            currentUser.loseWeight &&
            currentUser.goalWeight &&
            newWeight <= currentUser.goalWeight
          ) {
            Alert.alert(
              "Congratulations!!",
              "You have reached your weight goal. We'll reset your goal to feel-better only for now. Please continue to the profile management screen to update your goals.",
              [
                {
                  text: "Continue",
                  style: "destructive",
                  onPress: async () => {
                    let newFeelBetter = true;
                    let newLoseWeight = false;
                    await updateUserGoals(
                      currentUser,
                      newFeelBetter,
                      newLoseWeight,
                      navigation,
                    );
                  },
                },
              ],
            );
          }
        },
      },
    ]);
  }
}

const sendFeelBetterMessage = async (rating: number) =>
  new Promise((resolve) => {
    let message = "";
    if (rating === 5)
      message =
        "Fantastic! You're really thriving, keep embracing that great energy!";
    if (rating === 4)
      message =
        "Great to hear! You're doing awesome, keep up the positive vibes!";
    if (rating === 3)
      message =
        "Thanks for your input! You're in a steady place, keep moving forward!";
    if (rating === 2)
      message =
        "Proud of your honesty! Remember, it's okay to have ups and downs.";
    if (rating === 1)
      message =
        "It's tough right now, but every step forward counts. You're not alone in this!";
    Alert.alert(
      "Feel-better Rating Check-in",
      message,
      [
        {
          text: "Ok",
          style: "destructive",
          onPress: () => {
            resolve("YES");
          },
        },
      ],
      { cancelable: false },
    );
  });

function LogoutPopup(navigation: any) {
  Alert.alert("Confirmation", "Are you sure you want logout?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Logout",
      style: "destructive",
      onPress: () => navigation.navigate("CreateOrSignIn" as never),
    },
  ]);
  clearTokens();
}
function NavigateToGameSchedule(currentUser: any, navigation: any) {
  Alert.alert(
    "Confirmation",
    "Are you sure you want to abandon your changes?",
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () =>
          navigation.navigate("GameSchedule", { currentUser } as never),
      },
    ],
  );
}
function NavigateToProfileManagement(currentUser: any, navigation: any) {
  Alert.alert(
    "Confirmation",
    "Are you sure you want to abandon your changes?",
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () =>
          navigation.navigate("ProfileManagement", { currentUser } as never),
      },
    ],
  );
}
function NavigateToHomePage(currentUser: any, navigation: any) {
  Alert.alert(
    "Confirmation",
    "Are you sure you want to abandon your changes?",
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () =>
          navigation.navigate("HomePage", { currentUser } as never),
      },
    ],
  );
}
function NavigateToNotifications(currentUser: any, navigation: any) {
  Alert.alert(
    "Confirmation",
    "Are you sure you want to abandon your changes?",
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () =>
          navigation.navigate("NotificationsPage", { currentUser } as never),
      },
    ],
  );
}

async function addUserProgress(
  currentUser: any,
  rating: number,
  newWeight: number,
  navigation: any,
  goHome: boolean,
  questionAnswersPayload?: ProgressQuestionAnswerPayload[],
) {
  const w = Number(newWeight);
  const safeWeight = Number.isFinite(w) ? w : null;
  if (currentUser.loseWeight && safeWeight == null) {
    Alert.alert(
      "Invalid weight",
      "Your current weight could not be read. Please set your weight with +/− and try again.",
    );
    return;
  }

  fetch(`${AppUrls.url}/userdata/${currentUser.userId}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goal_type: currentUser.goalType,
      weight_value: safeWeight,
      feel_better_value: rating,
      ...(questionAnswersPayload && questionAnswersPayload.length > 0
        ? { question_answers: questionAnswersPayload }
        : {}),
    }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const text = await r.text();
        console.log("Save progress failed:", r.status, text);
        throw new Error("Failed");
      }
      return r.json();
    })
    .then(() => {
      currentUser.currentWeight = safeWeight ?? currentUser.currentWeight;
      currentUser.lastRating = rating;
      if (goHome) {
        navigation.navigate("HomePage", { currentUser } as never);
      }
    })
    .catch((error) => {
      Alert.alert(
        "Failed to save your progress. Please try again!",
        error?.message || "Unknown error",
      );
    });
}

const updateUserGoals = async (
  currentUser: any,
  newFeelBetter: boolean,
  newLoseWeight: boolean,
  navigation: any,
) => {
  const updatedData = {
    goal_to_feel_better: newFeelBetter,
    goal_to_lose_weight: newLoseWeight,
  };
  try {
    const response = await fetch(`${AppUrls.url}/user/${currentUser.userId}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedData),
    });
    if (response.ok) {
      currentUser.loseWeight = false;
      currentUser.goal_to_lose_weight = false;
      currentUser.goalWeight = 0;
      navigation.navigate("ProfileManagement", { currentUser } as never);
    } else {
      const errorData = await response.json();
      Alert.alert("Error updating goals", JSON.stringify(errorData));
    }
  } catch {
    Alert.alert("Network error");
  }
};

const UF_BLUE = "#0021A5";
const UF_ORANGE = "#FA4616";

const styles = StyleSheet.create({
  card: {
    width: "88%",
    alignSelf: "center",
    marginTop: "8%",
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },

  cardTitle: {
    fontSize: 22,
    fontFamily: "System",
    textAlign: "center",
    color: UF_BLUE,
    fontWeight: "700",
  },

  orangeBar: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: UF_ORANGE,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "72%",
    alignSelf: "center",
    marginTop: 12,
  },

  circleBtn: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: UF_BLUE,
    borderWidth: 2,
    borderColor: UF_ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },

  circleIcon: {
    width: 22,
    height: 22,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
  },

  weightValue: {
    fontSize: 34,
    textAlign: "center",
    minWidth: 110,
    color: "#101828",
    fontFamily: "System",
    fontWeight: "700",
  },

  goalText: {
    fontSize: 18,
    color: "#667085",
    textAlign: "center",
    marginTop: 14,
  },

  stars: { marginTop: 10, alignSelf: "center" },

  questionBlock: {
    marginTop: 12,
  },

  questionText: {
    color: "#344054",
    fontSize: 15,
    marginBottom: 8,
  },

  answerInput: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 10,
    minHeight: 84,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#101828",
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },

  minCharHint: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
  },
  wordHint: {
    marginTop: 4,
    color: "#667085",
    fontSize: 12,
  },

  cta: {
    backgroundColor: UF_ORANGE,
    borderColor: UF_ORANGE,
    width: "70%",
    alignSelf: "center",
    marginTop: 15,
    marginBottom: 8,
  },

  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
