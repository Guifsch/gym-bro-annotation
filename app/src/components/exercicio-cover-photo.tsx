import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExercicioImagem } from '@/types/workout';

interface ExercicioCoverPhotoProps {
  capa?: ExercicioImagem;
  onUpload: (uri: string, contentType: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** A single, large "cover" photo for the exercise — separate from the up-to-5 detail gallery
 * below. Tapping the photo itself replaces it (same camera/gallery choice as the gallery); the
 * small badge in the corner removes it entirely. */
export function ExercicioCoverPhoto({ capa, onUpload, onDelete }: ExercicioCoverPhotoProps) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handlePress() {
    Alert.alert(capa ? 'Trocar foto de capa' : 'Adicionar foto de capa', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Câmera', onPress: () => pickImage('camera') },
      { text: 'Galeria', onPress: () => pickImage('library') },
    ]);
  }

  async function pickImage(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setUploading(true);
    try {
      await onUpload(asset.uri, asset.mimeType ?? 'image/jpeg');
    } finally {
      setUploading(false);
    }
  }

  function handleDelete() {
    Alert.alert('Remover foto de capa?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete();
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <Pressable onPress={handlePress} disabled={uploading} style={styles.wrap}>
      {capa ? (
        <Image source={{ uri: capa.url }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.placeholder, { borderColor: theme.border }]}>
          {uploading ? (
            <ActivityIndicator color={theme.textSecondary} />
          ) : (
            <>
              <Ionicons name="image-outline" size={32} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Adicionar foto de capa
              </ThemedText>
            </>
          )}
        </View>
      )}

      {capa && uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}

      {capa && !uploading && (
        <Pressable onPress={handleDelete} disabled={deleting} style={styles.deleteBadge}>
          {deleting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash-outline" size={16} color="#fff" />}
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderRadius: Radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  deleteBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    padding: 8,
  },
});
