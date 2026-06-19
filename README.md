# 🤫 Quietly: Automated Geofence Audio Manager

Quietly is a React Native Android application that automatically manages your phone's audio profile based on your physical location. 

Drop a pin on the map, set a radius, and Quietly will automatically switch your phone to Vibrate or Silent mode—and instantly mute your media volume—whenever you walk into that zone (like a library, classroom, or office). When you leave the zone, Quietly seamlessly restores your exact previous ringer mode and media volume. 

Built with **Expo**, **React Native**, and custom **Kotlin** native modules, Quietly utilizes background geofencing to work entirely hands-free, even when the app is completely closed or your phone is locked in your pocket.

---

## ✨ Features

* **Background Geofencing:** Relies on `expo-task-manager` and `expo-location` to monitor boundaries in the background with minimal battery drain.
* **Smart Audio & Media Management:** Custom Kotlin native modules interface directly with Android's `AudioManager`. It saves your exact previous ringer mode and media volume (`STREAM_MUSIC`) before muting, and restores them flawlessly upon exit.
* **Interactive Map:** Uses Leaflet.js inside a WebView for a fluid, brightly-lit map experience to easily drop pins and visualize your geofence radius.
* **Multiple Zones:** Add, name, and manage multiple locations simultaneously. Each zone has an independent toggle switch to pause/resume monitoring.
* **Modern UI:** A sleek, minimal layout with soft visual accents and pill-shaped inputs.
* **Developer Test Mode:** Built-in dashboard buttons to manually trigger `Enter` and `Exit` audio events without having to physically walk outside.

---

## 🛠 Tech Stack

* **Frontend:** React Native, Expo (Expo Router), React Native Safe Area Context
* **Storage:** `@react-native-async-storage/async-storage`
* **Location Services:** `expo-location`, `expo-task-manager`
* **Maps:** `react-native-webview`, Leaflet.js
* **Native Android:** Kotlin, Gradle

---

## 🚀 Installation & Setup

Because Quietly uses custom native Android modules (Kotlin) to control device hardware volumes, **this app cannot be run in the standard Expo Go app.** You must compile a custom development build or a standalone release APK.

### 1. Prerequisites
* [Node.js](https://nodejs.org/) installed.
* [Android Studio](https://developer.android.com/studio) installed (for the Android SDKs and Emulator).
* An Android device plugged in via USB (Highly recommended for testing background location).

### 2. Install Dependencies
Clone the repository, navigate into the directory, and install the NPM packages:
```bash
npm install
