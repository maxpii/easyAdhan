import React, { useState, useEffect, useContext } from 'react';
import { ScrollView, View, Text, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { SettingsContext } from '../context/SettingsContext';

const REVERSE_GEOCODING_API_KEY = 'random key';

export default function SettingsScreen() {
  const [fontSize, setFontSize] = useState(16);
  const settings = useContext(SettingsContext);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string>('');
  const [loadingCity, setLoadingCity] = useState<boolean>(false);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      setLoadingLocation(true);
      setErrorMsg(null);
      
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoadingLocation(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(loc);
      } catch (e) {
        setErrorMsg('Failed to get location. Please check your GPS settings.');
        console.error('Location error:', e);
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!location) return;

    const fetchCity = async () => {
      setLoadingCity(true);
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      try {
        const res = await fetch(
          `https://api.api-ninjas.com/v1/reversegeocoding?lat=${lat}&lon=${lon}`,
          {
            headers: {
              'X-Api-Key': REVERSE_GEOCODING_API_KEY,
            },
          }
        );
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].name) {
          setCityName(data[0].name);
        } else {
          setCityName('Unknown');
        }
      } catch (err) {
        console.warn('Reverse geocoding failed', err);
        setCityName('Location unavailable');
      } finally {
        setLoadingCity(false);
      }
    };

    fetchCity();
  }, [location]);

  if (!settings) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Settings not available</Text>
      </View>
    );
  }

  const handleToggleNotifications = () => {
    if (!settings.notificationsEnabled) {
      Alert.alert(
        'Enable Notifications',
        'This will allow you to receive prayer time reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: settings.toggleNotifications }
        ]
      );
    } else {
      settings.toggleNotifications();
    }
  };

  

  return (
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { fontSize: fontSize + 4 }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: fontSize }]}>Location Information</Text>
        
        {loadingLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={[styles.loadingText, { fontSize: fontSize - 2 }]}>Getting location...</Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { fontSize: fontSize - 2 }]}>{errorMsg}</Text>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={[styles.label, { fontSize: fontSize }]}>City: </Text>
              <Text style={[styles.value, { fontSize: fontSize }]}>
                {loadingCity ? 'Loading city...' : cityName || 'Unknown'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={[styles.label, { fontSize: fontSize }]}>Latitude: </Text>
              <Text style={[styles.value, { fontSize: fontSize }]}>
                {location ? location.coords.latitude.toFixed(3) : 'N/A'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={[styles.label, { fontSize: fontSize }]}>Longitude: </Text>
              <Text style={[styles.value, { fontSize: fontSize }]}>
                {location ? location.coords.longitude.toFixed(3) : 'N/A'}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: fontSize }]}>App Preferences</Text>
        
        

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { fontSize: fontSize }]}>Prayer Notifications</Text>
            <Text style={[styles.settingDescription, { fontSize: fontSize - 2 }]}>
              Send push notifications for prayer times
            </Text>
          </View>
          <Switch
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={settings.notificationsEnabled ? '#4CAF50' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={handleToggleNotifications}
            value={settings.notificationsEnabled}
          />
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={[styles.infoTitle, { fontSize: fontSize }]}>About Easy Adhan</Text>
        <Text style={[styles.infoText, { fontSize: fontSize - 2 }]}>
          This app helps Muslims track prayer times and receive reminders. 
          Prayer times are calculated based on your current location using 
          the Aladhan API.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    paddingBottom: 50,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: '500',
    color: '#555',
    flex: 1,
  },
  value: {
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    color: '#666',
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    color: '#666',
    lineHeight: 20,
  },
});
