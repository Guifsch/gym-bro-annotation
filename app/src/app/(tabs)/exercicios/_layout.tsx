import { Stack } from 'expo-router';

export default function ExerciciosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="categorias" />
      <Stack.Screen name="lista" />
    </Stack>
  );
}
