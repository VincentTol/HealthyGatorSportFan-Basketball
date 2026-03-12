import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import User from "@/components/user";
import { AppUrls } from "@/constants/AppUrls";
import GlobalStyles from "../styles/GlobalStyles";
import { clearTokens } from "@/components/tokenStorage";

type NewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string | null;
  urlToImage: string | null;
};

export default function GatorsNews() {
  const insets = useSafeAreaInsets();
  const [bottomH, setBottomH] = useState(0);
  const navigation = useNavigation();
  const route = useRoute();
  const user: any = route.params;
  const currentUser: User = user?.currentUser;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NewsArticle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await getGatorsNews();
        if (resp && Array.isArray(resp.data)) setData(resp.data);
        else setData([]);
      } catch (e: any) {
        setError("Failed to load news");
        console.log("Error fetching Gators news:", e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const openArticle = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open the article.")
    );
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.container}>
        <View style={GlobalStyles.topMenu}>
          <Image
            source={require("../../assets/images/clipboardgator.png")}
            style={{ width: 55, height: 55 }}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Gators News</Text>
          <TouchableOpacity
            style={GlobalStyles.topIcons}
            activeOpacity={0.5}
            onPress={() =>
              currentUser &&
              navigation.navigate("NotificationsPage", { currentUser } as never)
            }
          >
            <Image
              source={require("../../assets/images/bell.png")}
              style={{ width: 40, height: 40, alignSelf: "center" }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 8,
            paddingBottom: bottomH + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {loading && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="small" color={colors.ufBlue} />
              <Text style={styles.stateText}>Loading news…</Text>
            </View>
          )}
          {!loading && error && (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{error}</Text>
              <Text style={styles.hint}>
                Ensure the backend is running so news can load from Google News.
              </Text>
            </View>
          )}
          {!loading && !error && data.length === 0 && (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>No articles right now.</Text>
              <Text style={styles.hint}>
                News loads from Google News when the backend is running.
              </Text>
            </View>
          )}
          {!loading && !error && data.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Florida Gators Basketball</Text>
              {data.map((article, idx) => (
                <TouchableOpacity
                  key={`${article.url}-${idx}`}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => openArticle(article.url)}
                >
                  {article.urlToImage ? (
                    <Image
                      source={{ uri: article.urlToImage }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={3}>
                      {article.title}
                    </Text>
                    {article.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {article.description}
                      </Text>
                    ) : null}
                    <View style={styles.meta}>
                      <Text style={styles.source}>{article.source}</Text>
                      <Text style={styles.date}>
                        {formatDate(article.publishedAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
          <View style={{ height: 16 }} />
        </ScrollView>

        <View
          onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}
          style={[
            GlobalStyles.bottomMenu,
            {
              paddingBottom: insets.bottom,
              backgroundColor: "#FFFFFF",
            },
          ]}
        >
          <TouchableOpacity
            style={GlobalStyles.bottomIcons}
            activeOpacity={0.5}
            onPress={() =>
              currentUser &&
              navigation.navigate("HomePage", { currentUser } as never)
            }
          >
            <Image
              source={require("../../assets/images/bottomHomeMenu/homeIcon.png")}
              style={styles.tabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={GlobalStyles.bottomIcons}
            activeOpacity={0.5}
            onPress={() =>
              currentUser &&
              navigation.navigate("GameSchedule", { currentUser } as never)
            }
          >
            <Image
              source={require("../../assets/images/bottomHomeMenu/calendarIcon.png")}
              style={styles.tabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={GlobalStyles.bottomIcons}
            activeOpacity={0.5}
            onPress={() =>
              currentUser &&
              navigation.navigate("ProcessLogging", { currentUser } as never)
            }
          >
            <Image
              source={require("../../assets/images/bottomHomeMenu/plus.png")}
              style={styles.plusIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={GlobalStyles.bottomIcons}
            activeOpacity={0.5}
            onPress={() =>
              currentUser &&
              navigation.navigate("ProfileManagement", { currentUser } as never)
            }
          >
            <Image
              source={require("../../assets/images/bottomHomeMenu/defaultprofile.png")}
              style={styles.tabIcon}
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
              style={styles.tabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function LogoutPopup(navigation: any) {
  Alert.alert("Confirmation", "Are you sure you want to logout?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Logout",
      style: "destructive",
      onPress: () => navigation.navigate("CreateOrSignIn" as never),
    },
  ]);
  clearTokens();
}

export async function getGatorsNews(): Promise<{ data: NewsArticle[] }> {
  const response = await fetch(`${AppUrls.url}/gators-news/`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...AppUrls.apiHeaders,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Failed to fetch news");
  return data;
}

const colors = {
  ufBlue: "#0B3D91",
  ufOrange: "#F24E1E",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7FB",
  },
  headerTitle: {
    fontSize: 25,
    fontFamily: "System",
    color: colors.ufBlue,
    fontWeight: "700",
  },
  stateBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  stateText: {
    fontSize: 16,
    color: "#374151",
    marginTop: 8,
  },
  hint: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {
    width: "100%",
    height: 160,
    backgroundColor: "#E5E7EB",
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  source: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ufOrange,
  },
  date: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  tabIcon: {
    width: 30,
    height: 30,
    alignSelf: "center",
  },
  plusIcon: {
    width: 45,
    height: 45,
    alignSelf: "center",
  },
});
