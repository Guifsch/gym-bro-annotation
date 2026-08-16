import { Stack } from 'expo-router';

export default function AlimentacaoLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[refeicaoId]" />
    </Stack>
  );
}
