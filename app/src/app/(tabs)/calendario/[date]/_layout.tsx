import { Stack } from 'expo-router';

export default function CalendarioDiaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[sessaoId]" />
    </Stack>
  );
}
