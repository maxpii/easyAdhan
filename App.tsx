import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import CalendarScreen from './screens/CalendarScreen';
import { SettingsProvider } from './context/SettingsContext';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { schedulePrayerNotifications, registerForPushNotificationsAsync } from './services/notificationManager';
import { playAzan } from './services/audioManager';

const Tab = createBottomTabNavigator();

const BACKGROUND_FETCH_TASK = 'background-prayer-fetch';

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Location permission not granted for background task.');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    // Fetch prayer times for the next day
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const response = await fetch(
      `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=2`
    );
    const json = await response.json();
    const timings = json.data.timings;

    await schedulePrayerNotifications(timings);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Helper function to register the background task
async function registerBackgroundTask() {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60 * 60 * 12, // Run approximately every 12 hours
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Background fetch task registered');
  } catch (error) {
    // TODO: Investigate why this is failing on iOS
  }
}

// Error boundary component (unchanged)
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            Please restart the app. If the problem persists, try reinstalling.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetails}>
              {this.state.error.toString()}
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    // Request notification permissions and register the background task on app start
    registerForPushNotificationsAsync();
    registerBackgroundTask();

    const notificationSubscription = Notifications.addNotificationReceivedListener(notification => {
      playAzan();
    });

    return () => {
      notificationSubscription.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#4CAF50',
              tabBarInactiveTintColor: '#666',
              tabBarStyle: {
                backgroundColor: '#fff',
                borderTopColor: '#e0e0e0',
              },
            }}
          >
            <Tab.Screen 
              name="Home" 
              component={HomeScreen}
              options={{
                tabBarLabel: 'Today',
                tabBarIcon: ({ color, size }) => (
                  <Text style={{ color, fontSize: size }}>🕌</Text>
                ),
              }}
            />
            <Tab.Screen 
              name="Calendar" 
              component={CalendarScreen}
              options={{
                tabBarLabel: 'Calendar',
                tabBarIcon: ({ color, size }) => (
                  <Text style={{ color, fontSize: size }}>📅</Text>
                ),
              }}
            />
            <Tab.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{
                tabBarLabel: 'Settings',
                tabBarIcon: ({ color, size }) => (
                  <Text style={{ color, fontSize: size }}>⚙️</Text>
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 12,
    color: '#999',
    marginTop: 20,
    textAlign: 'center',
  },
});