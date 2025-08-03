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
  Alert,
  AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsContext } from '../context/SettingsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notifications for background handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // Enable sound for background notifications
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
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

type RemainingTime = {
  hours: number;
  minutes: number;
  seconds: number;
};

const AZAN_STATE_KEY = '@azan_playing_state';
const NOTIFICATIONS_SCHEDULED_KEY = '@notifications_scheduled';

export default function HomeScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [prayerLoading, setPrayerLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newPrayerTimes, setNewPrayerTimes] = useState<PrayerTimings | null>(null);
  const [remainingTime, setRemainingTime] = useState<RemainingTime | null>(null);
  const [azanPlaying, setAzanPlaying] = useState<boolean | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('');
  const [appState, setAppState] = useState(AppState.currentState);
  const [isLoadingAzanState, setIsLoadingAzanState] = useState(true);
  const [notificationsScheduled, setNotificationsScheduled] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const sound = useRef<Audio.Sound | null>(null);
  const settings = useContext(SettingsContext);

  // Load azan state on app start
  useEffect(() => {
    const loadAzanState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(AZAN_STATE_KEY);
        console.log('🔍 Loading azan state from storage:', savedState);
        
        if (savedState) {
          const { isPlaying, timestamp } = JSON.parse(savedState);
          const now = Date.now();
          const timeDiff = now - timestamp;
          
          console.log('⏰ Time difference:', timeDiff / 1000, 'seconds');
          
          // If azan was playing less than 5 minutes ago, restore the state
          if (isPlaying && timeDiff < 5 * 60 * 1000) {
            console.log('🔄 Restoring azan playing state');
            setAzanPlaying(true);
          } else {
            console.log('🧹 Clearing old azan state');
            // Clear old state
            await AsyncStorage.removeItem(AZAN_STATE_KEY);
          }
        } else {
          console.log('📭 No saved azan state found');
          setAzanPlaying(false);
        }
      } catch (error) {
        console.error('Failed to load azan state:', error);
        setAzanPlaying(false);
      } finally {
        setIsLoadingAzanState(false);
      }
    };

    loadAzanState();
  }, []);

  // Save azan state when it changes
  const saveAzanState = async (isPlaying: boolean) => {
    try {
      if (isPlaying) {
        const stateData = {
          isPlaying: true,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem(AZAN_STATE_KEY, JSON.stringify(stateData));
        console.log('💾 Saved azan playing state:', stateData);
      } else {
        await AsyncStorage.removeItem(AZAN_STATE_KEY);
        console.log('🗑️ Removed azan state from storage');
      }
    } catch (error) {
      console.error('Failed to save azan state:', error);
    }
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
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return { hours, minutes, seconds };
  };

  const getPrayerTimes = async (lat: number, long: number) => {
    setPrayerLoading(true);
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${long}&method=2`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
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
      setErrorMsg('Failed to fetch prayer times. Please check your internet connection.');
      console.error('Prayer times fetch error:', error);
    } finally {
      setPrayerLoading(false);
    }
  };

  const playAzan = async () => {
    if (!settings?.azanEnabled) {
      Alert.alert('Azan Disabled', 'Please enable azan in settings to play audio.');
      return;
    }

    if (azanPlaying) {
      return; // Already playing
    }

    setAudioLoading(true);
    try {
      if (sound.current) {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../assets/audio/azan1.mp3'),
        { shouldPlay: true }
      );
      
      sound.current = newSound;
      setAzanPlaying(true);
      saveAzanState(true);

      newSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          stopAzan();
        }
      });
    } catch (error) {
      Alert.alert('Audio Error', 'Failed to play azan audio.');
      console.error('Audio playback error:', error);
    } finally {
      setAudioLoading(false);
    }
  };

  const stopAzan = async () => {
    if (!azanPlaying) {
      return; // Already stopped
    }

    try {
      if (sound.current) {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
        sound.current = null;
      }
    } catch (error) {
      console.error('Error stopping azan:', error);
    } finally {
      setAzanPlaying(false);
      saveAzanState(false);
    }
  };

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      setAppState(nextAppState as any);
      
      // If app becomes active and azan should be playing, restore audio
      if (nextAppState === 'active' && azanPlaying && !sound.current) {
        // Don't auto-restore to avoid infinite loops
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [azanPlaying]);

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (location) {
      getPrayerTimes(location.latitude, location.longitude);
    }
  }, [location]);

  // Set up notification listeners only once
  useEffect(() => {
    console.log('🔔 Setting up notification listeners...');
    
    const registerForPushNotifications = async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          Alert.alert('Permission Required', 'Please enable notifications to receive prayer reminders.');
          return;
        }
      } else {
        Alert.alert('Device Required', 'Must use physical device for notifications');
      }
    };

    registerForPushNotifications();

    // Handle notifications when app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Foreground notification received:', notification.request.content.title);
      if (notification.request.content.title === '🕌 Azan Time' && settings?.azanEnabled && !isInitializing) {
        console.log('🕌 Playing azan from foreground notification');
        // Small delay to ensure app is ready
        setTimeout(() => {
          playAzan();
        }, 100);
      }
    });

    // Handle notification responses (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification response received:', response.notification.request.content.title);
      if (response.notification.request.content.title === '🕌 Azan Time' && settings?.azanEnabled && !isInitializing) {
        console.log('🕌 Playing azan from notification response');
        // Small delay to ensure app is fully active
        setTimeout(() => {
          playAzan();
        }, 100);
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []); // Remove settings?.azanEnabled dependency to prevent recreation

  useEffect(() => {
    if (!newPrayerTimes) return;
    
    const interval = setInterval(() => {
      const nextPrayer = getNextPrayer(newPrayerTimes);
      const timeLeft = getRemainingTime(newPrayerTimes[nextPrayer]);
      setRemainingTime(timeLeft);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [newPrayerTimes]);

  // Schedule notifications only once when prayer times are loaded
  useEffect(() => {
    if (!newPrayerTimes || !settings || notificationsScheduled || isInitializing) return;

    console.log('📅 Scheduling notifications for prayer times:', newPrayerTimes);

    const scheduleOrCancelNotifications = async () => {
      try {
        if (settings.notificationsEnabled) {
          console.log('⏰ Notification scheduling starting...');
          await schedulePrayerNotifications(newPrayerTimes);
          setNotificationsScheduled(true);
          setNotificationStatus('✅ Notifications scheduled');
          
          // Show a one-time "scheduled" notification for user feedback
          setTimeout(() => {
            Notifications.scheduleNotificationAsync({
              content: {
                title: '🕌 Easy Adhan',
                body: 'Prayer notifications have been scheduled successfully!',
                sound: false,
              },
              trigger: { seconds: 1 } as Notifications.NotificationTriggerInput,
            });
          }, 1000);
        } else {
          await Notifications.cancelAllScheduledNotificationsAsync();
          setNotificationsScheduled(false);
          setNotificationStatus('🔕 Notifications disabled');
        }
      } catch (error) {
        console.error('Notification scheduling error:', error);
        setNotificationStatus('❌ Notification error');
      }
    };

    scheduleOrCancelNotifications();
  }, [newPrayerTimes, settings?.notificationsEnabled, notificationsScheduled, isInitializing]);

  // Reset notifications scheduled flag when settings change
  useEffect(() => {
    setNotificationsScheduled(false);
  }, [settings?.notificationsEnabled]);

  // Handle initialization completion
  useEffect(() => {
    if (newPrayerTimes && !isInitializing) {
      // Allow notifications to be scheduled after initialization
      setNotificationsScheduled(false);
    }
  }, [newPrayerTimes, isInitializing]);

  // Set initialization to false after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('✅ Initialization complete - notifications can now trigger');
      setIsInitializing(false);
    }, 5000); // 5 second delay

    return () => clearTimeout(timer);
  }, []);

  const schedulePrayerNotifications = async (timings: PrayerTimings) => {
    // Cancel existing notifications first to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    const now = new Date();
    let scheduledCount = 0;
    
    console.log('🔄 Starting notification scheduling...');

    for (const [name, time] of Object.entries(timings)) {
      const [hour, minute] = time.split(':').map(Number);
      const triggerTime = new Date(now);
      triggerTime.setHours(hour);
      triggerTime.setMinutes(minute);
      triggerTime.setSeconds(0);

      // If prayer time has already passed today, schedule for tomorrow
      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }

      // Only schedule if the time is at least 5 minutes in the future
      const timeDiff = triggerTime.getTime() - now.getTime();
      if (timeDiff > 300000) { // More than 5 minutes in the future
        const trigger = {
          date: triggerTime,
        } as Notifications.NotificationTriggerInput;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🕌 Azan Time',
            body: `It is time for ${name} prayer.`,
            sound: settings?.azanEnabled ? 'default' : undefined,
            data: { prayerName: name },
          },
          trigger,
        });

        scheduledCount++;
        console.log(`✅ Scheduled notification for ${name} at ${triggerTime.toLocaleString()}`);
      } else {
        console.log(`⏭️ Skipped ${name} - time already passed or too soon`);
      }
    }

    if (scheduledCount === 0) {
      console.log('📝 No notifications scheduled - all prayer times have passed for today');
    }
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const formatTime = (time: RemainingTime): string => {
    const hours = time.hours.toString().padStart(2, '0');
    const minutes = time.minutes.toString().padStart(2, '0');
    const seconds = time.seconds.toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const nextPrayer = newPrayerTimes ? getNextPrayer(newPrayerTimes) : null;

  // Don't render until settings are loaded
  if (!settings || settings.isLoading || isLoadingAzanState) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading settings...</Text>
      </View>
    );
  }

  // Debug: Force azan playing state for testing
  // setAzanPlaying(true);

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

      {notificationStatus && (
        <Text style={styles.statusText}>{notificationStatus}</Text>
      )}

      {nextPrayer && remainingTime && (
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownTitle}>
            Next Azan: {nextPrayer}
          </Text>
          <Text style={styles.countdownTime}>
            {formatTime(remainingTime)}
          </Text>
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
          onPress={azanPlaying ? stopAzan : playAzan}
          disabled={audioLoading || azanPlaying === null}
          style={[styles.audioButton, audioLoading && styles.audioButtonDisabled]}
        >
          {audioLoading ? (
            <ActivityIndicator size="large" color="#4CAF50" />
          ) : (
            <Image
              source={
                azanPlaying
                  ? require('../assets/stop.png')
                  : require('../assets/play.png')
              }
              style={styles.audioIcon}
            />
          )}
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