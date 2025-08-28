import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsContext } from '../context/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { schedulePrayerNotifications } from '../services/notificationManager';
import { playAzan, stopAzan, isAzanPlaying, setChangeCallback } from '../services/audioManager';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

type HomeScreenProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type PrayerTimings = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

type RemainingTime = {
  hours: number;
  minutes: number;
  seconds: number;
};

const AZAN_STATE_KEY = '@azan_playing_state';

export default function HomeScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newPrayerTimes, setNewPrayerTimes] = useState<PrayerTimings | null>(null);
  const [remainingTime, setRemainingTime] = useState<RemainingTime | null>(null);
  const [azanPlaying, setAzanPlaying] = useState(isAzanPlaying());
  const [isLoadingAzanState, setIsLoadingAzanState] = useState(true);
  const settings = useContext(SettingsContext);

  useEffect(() => {
    const loadAzanState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(AZAN_STATE_KEY);
        if (savedState) {
          const { isPlaying, timestamp } = JSON.parse(savedState);
          const now = Date.now();
          const timeDiff = now - timestamp;
          if (isPlaying && timeDiff < 5 * 60 * 1000) {
            setAzanPlaying(true);
          } else {
            await AsyncStorage.removeItem(AZAN_STATE_KEY);
            setAzanPlaying(false);
          }
        } else {
          setAzanPlaying(false);
        }
      } catch {
        setAzanPlaying(false);
      } finally {
        setIsLoadingAzanState(false);
      }
    };
    loadAzanState();
  }, []);

  useEffect(() => {
    setChangeCallback(setAzanPlaying);
  }, []);

  const saveAzanState = async (isPlaying: boolean) => {
    try {
      const stateData = { isPlaying, timestamp: Date.now() };
      await AsyncStorage.setItem(AZAN_STATE_KEY, JSON.stringify(stateData));
    } catch {}
  };

  const handlePlayAzan = async () => {
    if (!settings?.azanEnabled) {
      Alert.alert('Azan Disabled', 'Please enable azan in settings to play audio.');
      return;
    }
    await playAzan();
    setAzanPlaying(true);
    saveAzanState(true);
  };

  const handleStopAzan = async () => {
    await stopAzan();
    setAzanPlaying(false);
    saveAzanState(false);
  };

  const getUserLocation = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied.');
        setLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      setErrorMsg('❌ Could not get location');
    } finally {
      setLoading(false);
    }
  };

  function convertTo12Hour(timeStr: string): string {
    const [hourStr, minute] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
  }

  const getPrayerDate = (timeStr: string): Date => {
    const now = new Date();
    const [hour, minute] = timeStr.split(':').map(Number);
    const prayerTime = new Date(now);
    prayerTime.setHours(hour);
    prayerTime.setMinutes(minute);
    prayerTime.setSeconds(0);
    return prayerTime;
  };

  const getNextPrayer = (timings: PrayerTimings): keyof PrayerTimings => {
    const prayers: (keyof PrayerTimings)[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const now = new Date();
    for (const prayer of prayers) {
      const prayerTime = getPrayerDate(timings[prayer]);
      if (prayerTime > now) return prayer;
    }
    return 'Fajr';
  };

  const getRemainingTime = (prayerTimeStr: string): RemainingTime => {
    const now = new Date();
    const [hour, minute] = prayerTimeStr.split(':').map(Number);
    const prayerTime = new Date();
    prayerTime.setHours(hour);
    prayerTime.setMinutes(minute);
    prayerTime.setSeconds(0);
    let diff = prayerTime.getTime() - now.getTime();
    if (diff < 0) {
      prayerTime.setDate(prayerTime.getDate() + 1);
      diff = prayerTime.getTime() - now.getTime();
    }
    const totalSeconds = Math.floor(diff / 1000);
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  };

  const getPrayerTimes = async (lat: number, long: number) => {
    setPrayerLoading(true);
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${long}&method=2`
      );
      const json = await response.json();
      const timings = json.data.timings;
      setNewPrayerTimes(timings);

      if (settings?.notificationsEnabled) {
        await schedulePrayerNotifications(timings);
      }

    } catch {
      setErrorMsg('Failed to fetch prayer times. Please check your internet connection.');
    } finally {
      setPrayerLoading(false);
    }
  };

  const scheduleTestNotification = async () => {
    Alert.alert('Test Scheduled', 'You should receive a notification in 5 seconds.');
    const trigger = new Date(Date.now() + 5 * 1000); // 5 seconds from now
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Test Notification',
        body: 'If you see this, the notification system is working!',
        sound: 'azan1.mp3',
      },
      trigger,
    });
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (location) {
      getPrayerTimes(location.latitude, location.longitude);
    }
  }, [location]);

  useEffect(() => {
    if (!newPrayerTimes) return;
    const interval = setInterval(() => {
      const nextPrayer = getNextPrayer(newPrayerTimes);
      const timeLeft = getRemainingTime(newPrayerTimes[nextPrayer]);
      setRemainingTime(timeLeft);
    }, 1000);
    return () => clearInterval(interval);
  }, [newPrayerTimes]);

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const formatTime = (time: RemainingTime): string =>
    `${time.hours.toString().padStart(2, '0')}:${time.minutes
      .toString()
      .padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`;

  const nextPrayer = newPrayerTimes ? getNextPrayer(newPrayerTimes) : null;

  if (!settings || settings.isLoading || isLoadingAzanState) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Easy Adhan</Text>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={openAppSettings} style={styles.button}>
            <Text style={styles.buttonText}>Open App Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text>Getting your location...</Text>
        </View>
      )}

      {prayerLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text>Loading prayer times...</Text>
        </View>
      )}

      {nextPrayer && remainingTime && (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownTitle}>Next Azan: {nextPrayer}</Text>
          <Text style={styles.countdownTime}>{formatTime(remainingTime)}</Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Today's Prayer Times</Text>
        {newPrayerTimes && (
          <View style={styles.prayerTimesContainer}>
            <Text style={styles.prayerTime}>Fajr: {convertTo12Hour(newPrayerTimes.Fajr)}</Text>
            <Text style={styles.prayerTime}>Dhuhr: {convertTo12Hour(newPrayerTimes.Dhuhr)}</Text>
            <Text style={styles.prayerTime}>Asr: {convertTo12Hour(newPrayerTimes.Asr)}</Text>
            <Text style={styles.prayerTime}>Maghrib: {convertTo12Hour(newPrayerTimes.Maghrib)}</Text>
            <Text style={styles.prayerTime}>Isha: {convertTo12Hour(newPrayerTimes.Isha)}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.audioContainer}>
        <TouchableOpacity
          onPress={scheduleTestNotification}
          style={[styles.button, { marginBottom: 10, backgroundColor: '#f0ad4e' }]}
        >
          <Text style={styles.buttonText}>Test Notification in 5s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={azanPlaying ? handleStopAzan : handlePlayAzan}
          style={styles.audioButton}
        >
          <Image
            source={
              azanPlaying
                ? require('../assets/stop.png')
                : require('../assets/play.png')
            }
            style={styles.audioIcon}
          />
          <Text style={styles.audioText}>
            {azanPlaying ? 'Stop Adhan' : 'Play Adhan'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  statusText: {
    fontSize: 14,
    marginVertical: 5,
    textAlign: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 20,
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    minWidth: 200,
  },
  countdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2e7d32',
  },
  countdownTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
    fontFamily: 'monospace',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  prayerTimesContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 250,
  },
  prayerTime: {
    fontSize: 16,
    marginVertical: 5,
    color: '#555',
  },
  audioContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  audioButton: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#4CAF50',
    borderRadius: 25,
    minWidth: 120,
  },
  audioButtonDisabled: {
    opacity: 0.6,
  },
  audioIcon: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  audioText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
