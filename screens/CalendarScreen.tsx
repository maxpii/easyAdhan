import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { SettingsContext } from '../context/SettingsContext';

type PrayerTimings = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

type CalendarDay = {
  date: Date;
  timings: PrayerTimings | null;
  isLoading: boolean;
};

export default function CalendarScreen() {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateTimings, setSelectedDateTimings] = useState<PrayerTimings | null>(null);
  const [loadingSelectedDate, setLoadingSelectedDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
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

  const getPrayerTimesForDate = async (date: Date, lat: number, long: number): Promise<PrayerTimings> => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const response = await fetch(
      `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${lat}&longitude=${long}&method=2`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    const timings = json.data.timings;
    
    return {
      Fajr: timings.Fajr,
      Dhuhr: timings.Dhuhr,
      Asr: timings.Asr,
      Maghrib: timings.Maghrib,
      Isha: timings.Isha,
    };
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      days.push({
        date,
        timings: null,
        isLoading: false,
      });
    }
    
    return days;
  };

  const loadPrayerTimesForWeek = async () => {
    if (!location) return;

    const days = generateCalendarDays();
    setCalendarDays(days);

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      day.isLoading = true;
      setCalendarDays([...days]);

      try {
        const timings = await getPrayerTimesForDate(day.date, location.latitude, location.longitude);
        day.timings = timings;
        day.isLoading = false;
        setCalendarDays([...days]);
      } catch (error) {
        console.error(`Failed to load prayer times for ${day.date.toDateString()}:`, error);
        day.isLoading = false;
        setCalendarDays([...days]);
      }
    }
  };

  const loadPrayerTimesForSelectedDate = async (date: Date) => {
    if (!location) return;

    setLoadingSelectedDate(true);
    try {
      const timings = await getPrayerTimesForDate(date, location.latitude, location.longitude);
      setSelectedDateTimings(timings);
    } catch (error) {
      console.error(`Failed to load prayer times for selected date:`, error);
      Alert.alert('Error', 'Failed to load prayer times for selected date.');
    } finally {
      setLoadingSelectedDate(false);
    }
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatSelectedDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const convertTo12Hour = (timeStr: string): string => {
    const [hourStr, minute] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Date picker logic
  const handleDateSelection = () => {
    setTempDate(selectedDate || new Date());
    setShowDatePicker(true);
  };

  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
        loadPrayerTimesForSelectedDate(date);
      }
    } else {
      // iOS: picker stays open until user closes
      if (date) {
        setTempDate(date);
      }
    }
  };

  const onDatePickerDone = () => {
    setShowDatePicker(false);
    setSelectedDate(tempDate);
    loadPrayerTimesForSelectedDate(tempDate);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    loadPrayerTimesForSelectedDate(date);
  };

  const clearSelectedDate = () => {
    setSelectedDate(null);
    setSelectedDateTimings(null);
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (location) {
      loadPrayerTimesForWeek();
    }
  }, [location]);

  if (settings?.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prayer Calendar</Text>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text>Getting your location...</Text>
        </View>
      )}

      {/* Date Selection Section */}
      <View style={styles.dateSelectionContainer}>
        <TouchableOpacity 
          style={styles.selectDateButton}
          onPress={handleDateSelection}
        >
          <Text style={styles.selectDateButtonText}>
            {selectedDate ? 'Change Date' : 'Select Date'}
          </Text>
        </TouchableOpacity>
        
        {selectedDate && (
          <TouchableOpacity 
            style={styles.clearDateButton}
            onPress={clearSelectedDate}
          >
            <Text style={styles.clearDateButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DateTimePicker Modal */}
      {showDatePicker && (
        <View style={{ backgroundColor: Platform.OS === 'ios' ? 'white' : undefined }}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date(2100, 11, 31)}
            minimumDate={new Date(2000, 0, 1)}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.selectDateButton} onPress={onDatePickerDone}>
              <Text style={styles.selectDateButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Selected Date Prayer Times */}
      {selectedDate && (
        <View style={styles.selectedDateContainer}>
          <Text style={styles.selectedDateTitle}>
            {formatSelectedDate(selectedDate)}
          </Text>
          
          {loadingSelectedDate ? (
            <View style={styles.loadingDay}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading prayer times...</Text>
            </View>
          ) : selectedDateTimings ? (
            <View style={styles.timingsContainer}>
              <Text style={styles.prayerTime}>Fajr: {convertTo12Hour(selectedDateTimings.Fajr)}</Text>
              <Text style={styles.prayerTime}>Dhuhr: {convertTo12Hour(selectedDateTimings.Dhuhr)}</Text>
              <Text style={styles.prayerTime}>Asr: {convertTo12Hour(selectedDateTimings.Asr)}</Text>
              <Text style={styles.prayerTime}>Maghrib: {convertTo12Hour(selectedDateTimings.Maghrib)}</Text>
              <Text style={styles.prayerTime}>Isha: {convertTo12Hour(selectedDateTimings.Isha)}</Text>
            </View>
          ) : (
            <Text style={styles.errorText}>Failed to load prayer times</Text>
          )}
        </View>
      )}

      {/* Weekly Calendar */}
      {!selectedDate && (
        <>
          <Text style={styles.sectionTitle}>This Week's Prayer Times</Text>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {calendarDays.map((day, index) => (
              <View key={index} style={styles.dayContainer}>
                <Text style={styles.dayTitle}>{formatDate(day.date)}</Text>
                
                {day.isLoading ? (
                  <View style={styles.loadingDay}>
                    <ActivityIndicator size="small" color="#4CAF50" />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                ) : day.timings ? (
                  <View style={styles.timingsContainer}>
                    <Text style={styles.prayerTime}>Fajr: {convertTo12Hour(day.timings.Fajr)}</Text>
                    <Text style={styles.prayerTime}>Dhuhr: {convertTo12Hour(day.timings.Dhuhr)}</Text>
                    <Text style={styles.prayerTime}>Asr: {convertTo12Hour(day.timings.Asr)}</Text>
                    <Text style={styles.prayerTime}>Maghrib: {convertTo12Hour(day.timings.Maghrib)}</Text>
                    <Text style={styles.prayerTime}>Isha: {convertTo12Hour(day.timings.Isha)}</Text>
                  </View>
                ) : (
                  <Text style={styles.errorText}>Failed to load</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  dayContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  loadingDay: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  timingsContainer: {
    gap: 8,
  },
  prayerTime: {
    fontSize: 16,
    color: '#555',
    paddingVertical: 2,
  },
  dateSelectionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  selectDateButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  selectDateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearDateButton: {
    backgroundColor: '#f44336',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  clearDateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedDateContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedDateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
});
