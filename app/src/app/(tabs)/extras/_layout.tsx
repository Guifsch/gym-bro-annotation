import { Stack } from 'expo-router';

export default function ExtrasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="alimentacao" />
      <Stack.Screen name="timer" />
      <Stack.Screen name="relatorios" />
    </Stack>
  );
}
