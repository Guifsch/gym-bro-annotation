import { Stack } from 'expo-router';

export default function AvaliacaoFisicaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[goalId]" />
    </Stack>
  );
}
