
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

let sound: Audio.Sound | null = null;
let isPlaying = false;
let changeCallback: (isPlaying: boolean) => void = () => {};

export const setChangeCallback = (callback: (isPlaying: boolean) => void) => {
  changeCallback = callback;
};

export const playAzan = async () => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      interruptionModeIOS: 1, // DoNotMix
      interruptionModeAndroid: 1, // DoNotMix
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      require('../assets/audio/azan1.mp3'),
      { shouldPlay: true }
    );
    sound = newSound;
    isPlaying = true;
    changeCallback(isPlaying);

    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        stopAzan();
      }
    });
  } catch (e) {
    console.error("Error playing azan:", e);
    Alert.alert('Audio Error', 'Failed to play azan audio.');
  }
};

export const stopAzan = async () => {
  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      sound = null;
      isPlaying = false;
      changeCallback(isPlaying);
    }
  } catch (e) {
    console.error("Error stopping azan:", e);
  }
};

export const isAzanPlaying = () => {
  return isPlaying;
};
