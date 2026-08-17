import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInstagramEmbedHtml, getInstagramVideoRef, getInstagramWatchUrl } from '@/utils/instagram';
import { getYoutubeThumbnailUrl, getYoutubeVideoId, getYoutubeWatchUrl } from '@/utils/youtube';

interface VideoPreviewProps {
  url: string;
}

/** Detects YouTube/Instagram and renders the right preview (thumbnail+inline player, or an
 * Instagram card); falls back to a plain "open link" row for anything else. No text input — just
 * the display for an already-known URL, so it can be reused per-item inside a list. */
export function VideoPreview({ url }: VideoPreviewProps) {
  const theme = useTheme();
  const [playingInline, setPlayingInline] = useState(false);
  const [playerWidth, setPlayerWidth] = useState(0);
  const youtubeId = getYoutubeVideoId(url);
  const instagramRef = youtubeId ? null : getInstagramVideoRef(url);

  function openExternally() {
    if (youtubeId) {
      Linking.openURL(getYoutubeWatchUrl(youtubeId));
    } else if (instagramRef) {
      Linking.openURL(getInstagramWatchUrl(instagramRef));
    } else {
      Linking.openURL(url.trim());
    }
  }

  function handlePlayerLayout(event: LayoutChangeEvent) {
    setPlayerWidth(event.nativeEvent.layout.width);
  }

  function handlePlayerError() {
    setPlayingInline(false);
    Alert.alert(
      'Não foi possível tocar aqui',
      'Esse vídeo não permite reprodução dentro do app. Toque no ícone de abrir pra assistir direto no site.'
    );
  }

  if (youtubeId) {
    return playingInline ? (
      <View style={styles.playerWrap} onLayout={handlePlayerLayout}>
        {playerWidth > 0 && (
          <YoutubePlayer
            height={playerWidth * (9 / 16)}
            width={playerWidth}
            videoId={youtubeId}
            play
            onError={handlePlayerError}
          />
        )}
        <Pressable onPress={() => setPlayingInline(false)} style={styles.closePlayerButton} hitSlop={8}>
          <Ionicons name="close" size={16} color="#fff" />
        </Pressable>
      </View>
    ) : (
      <Pressable onPress={() => setPlayingInline(true)} style={styles.thumbWrap}>
        <Image source={{ uri: getYoutubeThumbnailUrl(youtubeId) }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={28} color="#fff" />
        </View>
        <Pressable onPress={openExternally} style={styles.externalBadge} hitSlop={8}>
          <Ionicons name="open-outline" size={16} color="#fff" />
        </Pressable>
      </Pressable>
    );
  }

  if (instagramRef) {
    return playingInline ? (
      <View style={styles.instagramPlayerWrap}>
        <WebView
          source={{ html: getInstagramEmbedHtml(instagramRef), baseUrl: 'https://www.instagram.com' }}
          style={styles.instagramPlayer}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
        <Pressable onPress={() => setPlayingInline(false)} style={styles.closePlayerButton} hitSlop={8}>
          <Ionicons name="close" size={16} color="#fff" />
        </Pressable>
      </View>
    ) : (
      <Pressable onPress={() => setPlayingInline(true)} style={[styles.instagramCard, { borderColor: theme.border }]}>
        <Ionicons name="logo-instagram" size={26} color="#E1306C" />
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          Vídeo do Instagram
        </ThemedText>
        <Ionicons name="play-circle-outline" size={22} color={theme.textSecondary} />
        <Pressable onPress={openExternally} hitSlop={8} style={styles.instagramExternalButton}>
          <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
        </Pressable>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={openExternally} style={[styles.linkRow, { borderColor: theme.border }]}>
      <Ionicons name="link-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
        {url}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { position: 'relative', borderRadius: Radius.md, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  externalBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    padding: 6,
  },
  playerWrap: { position: 'relative', borderRadius: Radius.md, overflow: 'hidden' },
  closePlayerButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    padding: 6,
    zIndex: 1,
  },
  instagramCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  instagramExternalButton: { padding: Spacing.one },
  instagramPlayerWrap: { position: 'relative', borderRadius: Radius.md, overflow: 'hidden', height: 480 },
  instagramPlayer: { flex: 1, backgroundColor: '#000' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
});
