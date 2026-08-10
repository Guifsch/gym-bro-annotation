import { Stack } from 'expo-router';

export default function SessaoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[exercicioId]" />
    </Stack>
  );
}
