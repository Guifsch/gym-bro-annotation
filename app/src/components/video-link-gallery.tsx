import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { LabeledTextField } from '@/components/labeled-text-field';
import { VideoPreview } from '@/components/video-preview';
import { Radius, Spacing, Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_VIDEOS = 5;
const VIDEO_URL_MAX_LENGTH = 500;

interface VideoLinkGalleryProps {
  videos: string[];
  onAdd: (url: string) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
}

export function VideoLinkGallery({ videos, onAdd, onRemove }: VideoLinkGalleryProps) {
  const theme = useTheme();
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setNewUrl('');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(url: string) {
    setRemovingUrl(url);
    try {
      await onRemove(url);
    } finally {
      setRemovingUrl(null);
    }
  }

  return (
    <View style={styles.container}>
      {videos.map((url) => (
        <View key={url} style={styles.videoRow}>
          <View style={{ flex: 1 }}>
            <VideoPreview url={url} />
          </View>
          <Pressable onPress={() => handleRemove(url)} disabled={removingUrl === url} style={styles.deleteButton}>
            {removingUrl === url ? (
              <ActivityIndicator size="small" color="#e53935" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#e53935" />
            )}
          </Pressable>
        </View>
      ))}

      {videos.length < MAX_VIDEOS && (
        <View style={styles.addRow}>
          <View style={{ flex: 1 }}>
            <LabeledTextField
              placeholder="Link do YouTube ou Instagram"
              value={newUrl}
              onChangeText={setNewUrl}
              onClear={() => setNewUrl('')}
              maxLength={VIDEO_URL_MAX_LENGTH}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Pressable
            onPress={handleAdd}
            disabled={adding || !newUrl.trim()}
            style={[styles.addButton, { borderColor: theme.border }]}>
            {adding ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="add" size={20} color={Brand.primary} />}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  videoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  deleteButton: { padding: Spacing.one },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
