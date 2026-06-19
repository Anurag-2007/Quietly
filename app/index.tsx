import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { WebView } from "react-native-webview";
import { Picker } from "@react-native-picker/picker";
import { NativeModules } from "react-native";

const { RingerMode } = NativeModules;

const STORAGE_KEY = "MY_GEOFENCE";
const GEOFENCE_TASK_NAME = "BACKGROUND_GEOFENCE_TASK";

// Background task logic (unchanged)
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("Geofence task error:", error.message);
    return;
  }

  const { eventType } = data;

  if (eventType === Location.GeofencingEventType.Enter) {
    console.log("Entered Geofence! Setting to Vibrate...");
    try {
      await RingerMode.setVibrate();
    } catch (e) {
      console.log("Failed to set vibrate in background:", e);
    }
  } else if (eventType === Location.GeofencingEventType.Exit) {
    console.log("Exited Geofence! Restoring volume...");
    try {
      await RingerMode.restore();
    } catch (e) {
      console.log("Failed to restore ringer in background:", e);
    }
  }
});

export default function HomeScreen() {
  const webRef = useRef<WebView>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [initialRegion, setInitialRegion] = useState({ lat: 28.6139, lng: 77.2090 });

  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState("200");
  const [mode, setMode] = useState<"vibrate" | "silent">("vibrate");

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Get user's current location on startup
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setInitialRegion({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setSearchQuery(`${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}`);
        }
      } catch (e) {
        console.warn("Could not fetch current location", e);
      } finally {
        setIsMapReady(true);
      }
    })();
  }, []);

  // Update map radius dynamically when input changes
  useEffect(() => {
    const r = Number(radius);
    if (!isNaN(r) && webRef.current) {
      webRef.current.injectJavaScript(`
        window.currentRadius = ${r};
        if (typeof circle !== 'undefined' && circle) {
          circle.setRadius(${r});
        }
        true;
      `);
    }
  }, [radius]);

  // Parse combined "Lat, Lng" input
  function setCoordinatesManually() {
    if (!searchQuery.includes(",")) {
      Alert.alert("Invalid format", "Please use the format: Latitude, Longitude (e.g. 28.61, 77.20)");
      return;
    }

    const parts = searchQuery.split(",");
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert("Invalid coordinates", "Please ensure both latitude and longitude are valid numbers.");
      return;
    }

    setLocation({ latitude: lat, longitude: lng });

    const r = Number(radius) || 200;

    // Move map marker and update circle
    webRef.current?.injectJavaScript(`
      if(marker) map.removeLayer(marker);
      if(circle) map.removeLayer(circle);
      marker = L.marker([${lat}, ${lng}]).addTo(map);
      circle = L.circle([${lat}, ${lng}], { color: '#8A2BE2', fillColor: '#8A2BE2', fillOpacity: 0.25, radius: ${r} }).addTo(map);
      map.setView([${lat}, ${lng}], 15);
      true;
    `);
  }

  async function saveGeofence() {
    if (!location) {
      Alert.alert("Action Required", "Please select or enter a location first.");
      return;
    }

    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      Alert.alert("Permission denied", "Foreground location permission is required.");
      return;
    }

    const bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      Alert.alert("Permission denied", "Background location is required for automatic profile switching.");
      return;
    }

    const data = {
      latitude: location.latitude,
      longitude: location.longitude,
      radius: Number(radius),
      mode,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [
        {
          identifier: "quietly-zone",
          latitude: location.latitude,
          longitude: location.longitude,
          radius: Number(radius),
          notifyOnEnter: true,
          notifyOnExit: true,
        },
      ]);
      
      Alert.alert(
        "Geofence Active 🛡️",
        `Monitoring started.\n\nLat: ${location.latitude.toFixed(4)}\nLng: ${location.longitude.toFixed(4)}\nRadius: ${radius}m`
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error starting geofence", err.message);
    }
  }

  // HTML Map Setup (Light theme, drawing radius circle)
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background-color: #F0F0F0; }
  .leaflet-control-attribution { display: none; } /* Cleaner look */
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  window.currentRadius = ${radius || 200};
  var map = L.map('map', { zoomControl: false }).setView([${initialRegion.lat}, ${initialRegion.lng}], 15);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  var marker = L.marker([${initialRegion.lat}, ${initialRegion.lng}]).addTo(map);
  var circle = L.circle([${initialRegion.lat}, ${initialRegion.lng}], {
    color: '#8A2BE2', /* Purple accent */
    fillColor: '#8A2BE2',
    fillOpacity: 0.25,
    radius: window.currentRadius
  }).addTo(map);

  map.on('click', function(e){
    if(marker) map.removeLayer(marker);
    if(circle) map.removeLayer(circle);

    marker = L.marker(e.latlng).addTo(map);
    circle = L.circle(e.latlng, {
      color: '#8A2BE2',
      fillColor: '#8A2BE2',
      fillOpacity: 0.25,
      radius: window.currentRadius
    }).addTo(map);

    window.ReactNativeWebView.postMessage(
      JSON.stringify({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    );
  });
</script>
</body>
</html>
`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        
        {/* Map Area */}
        <View style={styles.mapContainer}>
          {!isMapReady ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#8A2BE2" />
              <Text style={styles.loaderText}>Locating you...</Text>
            </View>
          ) : (
            <WebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{ html }}
              onMessage={(event) => {
                const data = JSON.parse(event.nativeEvent.data);
                setLocation({ latitude: data.latitude, longitude: data.longitude });
                setSearchQuery(`${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
              }}
            />
          )}
        </View>

        {/* Floating Modern Control Panel */}
        <View style={styles.panelContainer}>
          <ScrollView contentContainerStyle={styles.panel} showsVerticalScrollIndicator={false}>
            
            <Text style={styles.label}>Location Coordinates</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                keyboardType="default"
                placeholder="Latitude, Longitude"
                placeholderTextColor="#A0A0A0"
              />
              <TouchableOpacity style={styles.btnSecondary} onPress={setCoordinatesManually}>
                <Text style={styles.btnSecondaryText}>Locate</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Radius (m)</Text>
                <TextInput
                  style={styles.input}
                  value={radius}
                  onChangeText={setRadius}
                  keyboardType="numeric"
                  placeholder="200"
                  placeholderTextColor="#A0A0A0"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Zone Action</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={mode}
                    onValueChange={(value) => setMode(value)}
                    style={styles.picker}
                    dropdownIconColor="#1A1A1A"
                  >
                    <Picker.Item label="Vibrate" value="vibrate" color={Platform.OS === 'ios' ? '#1A1A1A' : '#1A1A1A'} />
                    <Picker.Item label="Silent" value="silent" color={Platform.OS === 'ios' ? '#1A1A1A' : '#1A1A1A'} />
                  </Picker>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={saveGeofence}>
              <Text style={styles.btnPrimaryText}>Activate Geofence</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.labelCenter}>Developer Testing</Text>
            <View style={styles.testButtonsRow}>
              <TouchableOpacity 
                style={[styles.btnSmall, { backgroundColor: '#F0FFF4', borderColor: '#C6F6D5', borderWidth: 1 }]} 
                onPress={async () => {
                  try {
                    await RingerMode.setVibrate();
                    Alert.alert("Tested", "Phone switched to vibrate profile.");
                  } catch (e) {
                    console.log(e);
                  }
                }}
              >
                <Text style={[styles.btnSmallText, { color: '#276749' }]}>Simulate Enter</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btnSmall, { backgroundColor: '#FFF5F5', borderColor: '#FED7D7', borderWidth: 1 }]} 
                onPress={async () => {
                  try {
                    await RingerMode.restore();
                    Alert.alert("Tested", "Previous audio mode restored.");
                  } catch (e) {
                    console.log(e);
                  }
                }}
              >
                <Text style={[styles.btnSmallText, { color: '#C53030' }]}>Simulate Exit</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean background for top safe area
  },
  container: {
    flex: 1,
    backgroundColor: "#F7F7F9",
  },
  mapContainer: {
    flex: 1.2,
    backgroundColor: "#EFEFEF",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: "#8A2BE2",
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
  },
  panelContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -20, // Creates a nice overlay effect over the map
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 20,
  },
  panel: {
    padding: 24,
    paddingBottom: 40,
  },
  label: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  labelCenter: {
    color: "#9CA3AF",
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#F3F4F6",
    color: "#1F2937",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    overflow: "hidden",
    height: 54,
    justifyContent: "center",
  },
  picker: {
    color: "#1F2937",
    width: "100%",
  },
  btnPrimary: {
    backgroundColor: "#8A2BE2",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#8A2BE2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  btnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  btnSecondaryText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 24,
  },
  testButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  btnSmall: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnSmallText: {
    fontWeight: "700",
    fontSize: 13,
  },
});