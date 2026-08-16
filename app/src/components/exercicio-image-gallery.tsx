import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExercicioImagem } from '@/types/workout';

const MAX_IMAGENS = 5;

interface ExercicioImageGalleryProps {
  imagens: ExercicioImagem[];
  onUpload: (uri: string, contentType: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function ExercicioImageGallery({ imagens, onUpload, onDelete }: ExercicioImageGalleryProps) {
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  function handleAddPhoto() {
    Alert.alert('Adicionar foto', undefined, [
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
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setUploading(true);
    try {
      await onUpload(asset.uri, asset.mimeType ?? 'image/jpeg');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(key: string) {
    setDeletingKey(key);
    try {
      await onDelete(key);
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <View style={styles.grid}>
      {imagens.map((imagem) => (
        <View key={imagem.key} style={styles.thumbWrap}>
          <Pressable onPress={() => setZoomUrl(imagem.url)}>
            <Image source={{ uri: imagem.url }} style={styles.thumb} />
          </Pressable>
          <Pressable
            onPress={() => handleDelete(imagem.key)}
            disabled={deletingKey === imagem.key}
            style={styles.thumbDelete}>
            {deletingKey === imagem.key ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="trash-outline" size={14} color="#fff" />
            )}
          </Pressable>
        </View>
      ))}

      {imagens.length < MAX_IMAGENS && (
        <Pressable
          onPress={handleAddPhoto}
          disabled={uploading}
          style={[styles.thumb, styles.addTile, { borderColor: theme.border }]}>
          {uploading ? (
            <ActivityIndicator color={theme.textSecondary} />
          ) : (
            <Ionicons name="images-outline" size={26} color={theme.textSecondary} />
          )}
        </Pressable>
      )}

      <Modal visible={zoomUrl !== null} transparent animationType="fade" onRequestClose={() => setZoomUrl(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomUrl(null)}>
          {zoomUrl && <Image source={{ uri: zoomUrl }} style={styles.zoomImage} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbWrap: { position: 'relative' },
  thumb: { width: 84, height: 84, borderRadius: Radius.md },
  addTile: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  thumbDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    padding: 4,
  },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '80%' },
});
