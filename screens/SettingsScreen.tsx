import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
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

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      } catch (e) {
        setErrorMsg('Failed to get location');
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
        setCityName('Error occurred');
      } finally {
        setLoadingCity(false);
      }
    };

    fetchCity();
  }, [location]);

  if (!settings) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { fontSize: fontSize }]}>Settings</Text>

      <View style={styles.row}>
        <Text style={{ fontSize: fontSize }}>City: </Text>
        <Text style={{ fontSize: fontSize }}>
          {errorMsg
            ? errorMsg
            : location
            ? loadingCity
              ? 'Loading city...'
              : cityName || 'Unknown'
            : 'Loading...'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={{ fontSize: fontSize }}>Latitude: </Text>
        <Text style={{ fontSize: fontSize }}>
          {location ? location.coords.latitude.toFixed(6) : 'Loading...'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={{ fontSize: fontSize }}>Longitude: </Text>
        <Text style={{ fontSize: fontSize }}>
          {location ? location.coords.longitude.toFixed(6) : 'Loading...'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={{ fontSize: fontSize }}>Play Azan</Text>
        <Switch
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.azanEnabled ? '#A8E6CF' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={settings.toggleAzan}
          value={settings.azanEnabled}
        />
      </View>

      <View style={styles.row}>
        <Text style={{ fontSize: fontSize }}>Send notification</Text>
        <Switch
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={settings.notificationsEnabled ? '#A8E6CF' : '#f4f3f4'}
          ios_backgroundColor="#3e3e3e"
          onValueChange={settings.toggleNotifications}
          value={settings.notificationsEnabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
  },
  text: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 6,
  },
});
