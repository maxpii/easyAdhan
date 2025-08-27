
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

type PrayerTimings = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

// 1. Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 2. Function to request permissions
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (!Device.isDevice) {
    alert('Must use physical device for Push Notifications');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'azan1.mp3', // The sound file from app.json
    });
  }

  return true;
}

// 3. Function to schedule notifications
export async function schedulePrayerNotifications(timings: PrayerTimings) {
  // First, cancel any existing notifications to avoid duplicates
  await cancelAllNotifications();

  const prayers: (keyof PrayerTimings)[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const prayer of prayers) {
    const timeStr = timings[prayer];
    const [hour, minute] = timeStr.split(':').map(Number);

    const now = new Date();
    const prayerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

    // If the prayer time has already passed for today, schedule it for tomorrow
    if (prayerDate < now) {
      prayerDate.setDate(prayerDate.getDate() + 1);
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Prayer Time',
          body: `It's time for ${prayer} prayer.`,
          sound: 'azan1.mp3', // Ensure this matches the name in app.json
          data: { prayerName: prayer },
        },
        trigger: prayerDate,
      });
      console.log(`Scheduled notification for ${prayer} at ${prayerDate.toLocaleTimeString()}`);
    } catch (error) {
      console.error(`Failed to schedule notification for ${prayer}:`, error);
    }
  }
}

// 4. Function to cancel all notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('All scheduled notifications have been cancelled.');
}
