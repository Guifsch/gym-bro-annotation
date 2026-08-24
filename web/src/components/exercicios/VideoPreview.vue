<script setup lang="ts">
import { computed, ref } from 'vue'
import { extractInstagram, extractYouTubeId } from '../../utils/video'

const props = defineProps<{ url: string }>()
defineEmits<{ remove: [] }>()

const playing = ref(false)

const youtubeId = computed(() => extractYouTubeId(props.url))
const instagram = computed(() => (youtubeId.value ? null : extractInstagram(props.url)))
</script>

<template>
  <VCard variant="outlined" class="video-preview">
    <div v-if="youtubeId" class="video-preview__media">
      <iframe
        v-if="playing"
        :src="`https://www.youtube.com/embed/${youtubeId}?autoplay=1`"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
        class="video-preview__frame"
      />
      <button v-else class="video-preview__thumb" type="button" @click="playing = true">
        <img :src="`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`" alt="Miniatura do vídeo" />
        <VIcon icon="mdi-play-circle" size="48" color="white" class="video-preview__play" />
      </button>
    </div>

    <div v-else-if="instagram" class="video-preview__media">
      <iframe
        v-if="playing"
        :src="`https://www.instagram.com/${instagram.type}/${instagram.shortcode}/embed/`"
        allow="encrypted-media"
        class="video-preview__frame video-preview__frame--instagram"
      />
      <button v-else class="video-preview__instagram-card" type="button" @click="playing = true">
        <VIcon icon="mdi-instagram" size="28" />
        <span>Vídeo do Instagram</span>
      </button>
    </div>

    <a v-else :href="url" target="_blank" rel="noopener" class="video-preview__fallback">
      <VIcon icon="mdi-open-in-new" size="18" class="mr-1" />
      Abrir link
    </a>

    <VCardActions class="pa-2">
      <span class="text-caption text-truncate flex-grow-1">{{ url }}</span>
      <VBtn icon="mdi-close" size="x-small" variant="text" @click="$emit('remove')" />
    </VCardActions>
  </VCard>
</template>

<style scoped>
.video-preview {
  overflow: hidden;
}

.video-preview__media {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
}

.video-preview__thumb {
  position: relative;
  width: 100%;
  height: 100%;
  border: none;
  padding: 0;
  cursor: pointer;
  display: block;
}

.video-preview__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-preview__play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.video-preview__frame {
  width: 100%;
  height: 100%;
  border: none;
}

.video-preview__frame--instagram {
  aspect-ratio: unset;
  min-height: 480px;
}

.video-preview__instagram-card {
  width: 100%;
  height: 100%;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #405de6, #c13584, #fd1d1d);
  color: #fff;
  font-weight: 600;
}

.video-preview__fallback {
  display: flex;
  align-items: center;
  padding: 16px;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
</style>
