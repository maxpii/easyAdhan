import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import CalendarScreen from './screens/CalendarScreen';
import { SettingsProvider } from './context/SettingsContext';

const Tab = createBottomTabNavigator();

// Error boundary component
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
