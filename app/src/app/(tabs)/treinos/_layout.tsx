import { Stack } from 'expo-router';

export default function TreinosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[treinoId]" />
    </Stack>
  );
}
