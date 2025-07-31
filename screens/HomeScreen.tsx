import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsContext } from '../context/SettingsContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

export default function HomeScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newPrayerTimes, setNewPrayerTimes] = useState<PrayerTimings | null>(null);
  const [remainingTime, setRemainingTime] = useState<{ minutes: number; seconds: number } | null>(null);
  const [azanPlaying, setAzanPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const settings = useContext(SettingsContext);

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
    } catch (error) {
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
    return 'Fajr'; // fallback to next day's Fajr
  };

  const getRemainingTime = (prayerTimeStr: string): { minutes: number; seconds: number } => {
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
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60,
    };
  };

  const getPrayerTimes = async (lat: number, long: number) => {
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${long}&method=2`
      );
      const json = await response.json();
      const timings = json.data.timings;
      const parsedTimings = {
        Fajr: timings.Fajr,
        Dhuhr: timings.Dhuhr,
        Asr: timings.Asr,
        Maghrib: timings.Maghrib,
        Isha: timings.Isha,
      };
      setNewPrayerTimes(parsedTimings);
    } catch (error) {
      setErrorMsg('Failed to fetch prayer times');
    } finally {
      setLoading(false);
    }
  };

  const playAzan = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/audio/azan1.mp3')
    );
    setSound(sound);
    await sound.playAsync();
    setAzanPlaying(true);

    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        stopAzan();
      }
    });
  };

  const stopAzan = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setAzanPlaying(false);
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
    const registerForPushNotifications = async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          alert('❌ Failed to get notification permission');
          return;
        }
      } else {
        alert('Must use physical device for notifications');
      }
    };

    registerForPushNotifications();

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('azan-channel', {
        name: 'Azan Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: settings?.azanEnabled ? 'azan1.mp3' : undefined,
      });
    }
  }, [settings?.azanEnabled]);

  useEffect(() => {
    if (!newPrayerTimes) return;
    const interval = setInterval(() => {
      const nextPrayer = getNextPrayer(newPrayerTimes);
      const timeLeft = getRemainingTime(newPrayerTimes[nextPrayer]);
      setRemainingTime(timeLeft);
    }, 1000);
    return () => clearInterval(interval);
  }, [newPrayerTimes]);

  useEffect(() => {
    if (!newPrayerTimes || !settings) return;

    const scheduleOrCancelNotifications = async () => {
      if (settings.notificationsEnabled) {
        await schedulePrayerNotifications(newPrayerTimes);
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('🔕 Notifications cancelled');
      }
    };

    scheduleOrCancelNotifications();
  }, [newPrayerTimes, settings?.notificationsEnabled, settings?.azanEnabled]);

  const schedulePrayerNotifications = async (timings: PrayerTimings) => {
    const now = new Date();

    for (const [name, time] of Object.entries(timings)) {
      const [hour, minute] = time.split(':').map(Number);
      const triggerTime = new Date(now);
      triggerTime.setHours(hour);
      triggerTime.setMinutes(minute);
      triggerTime.setSeconds(0);

      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }

      const trigger: Notifications.NotificationTriggerInput = {
        date: triggerTime,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🕌 Azan Time',
          body: `It is time for ${name} prayer.`,
          sound: settings?.azanEnabled && Platform.OS === 'ios' ? 'azan1.mp3' : undefined,
          channelId: settings?.azanEnabled && Platform.OS === 'android' ? 'azan-channel' : undefined,
        },
        trigger,
      });

      console.log(`✅ Scheduled notification for ${name} at ${triggerTime}`);
    }
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const nextPrayer = newPrayerTimes ? getNextPrayer(newPrayerTimes) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home - Easy Adhan</Text>

      {errorMsg && (
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <Text style={{ color: 'red', marginBottom: 5 }}>{errorMsg}</Text>
          <TouchableOpacity onPress={openAppSettings} style={styles.button}>
            <Text style={styles.buttonText}>Open App Settings</Text>
          </TouchableOpacity>
        </View>
      )}

      {nextPrayer && remainingTime && (
        <>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            Next Azan: {nextPrayer}
          </Text>
          <Text style={{ fontSize: 16 }}>
            Time Remaining: {Math.floor(remainingTime.minutes/60)}:{remainingTime.minutes % 60}:{remainingTime.seconds}
          </Text>
        </>
      )}

      <ScrollView contentContainerStyle={styles.container}>
        <Text>Today's Prayer Times</Text>
        {newPrayerTimes && (
          <>
            <Text>Fajr: {convertTo12Hour(newPrayerTimes.Fajr)}</Text>
            <Text>Dhuhr: {convertTo12Hour(newPrayerTimes.Dhuhr)}</Text>
            <Text>Asr: {convertTo12Hour(newPrayerTimes.Asr)}</Text>
            <Text>Maghrib: {convertTo12Hour(newPrayerTimes.Maghrib)}</Text>
            <Text>Isha: {convertTo12Hour(newPrayerTimes.Isha)}</Text>
          </>
        )}
      </ScrollView>

      <TouchableOpacity onPress={settings?.azanEnabled ? (azanPlaying ? stopAzan : playAzan) : () => {}}>
        <Image
          source={
            azanPlaying
              ? require('../assets/stop.png')
              : require('../assets/play.png')
          }
          style={{ width: 80, height: 80 }}
        />
        <Text>{azanPlaying ? 'Stop Adhan' : 'Play Adhan'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
    padding: 16,
  },
  text: {
    fontSize: 24,
    marginVertical: 10,
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
