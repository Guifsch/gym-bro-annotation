<script setup lang="ts">
import { useSnackbar } from './composables/useSnackbar'

const { snackbar, close } = useSnackbar()
</script>

<template>
  <VApp>
    <RouterView />

    <VSnackbar v-model="snackbar.show" :color="snackbar.color" location="top" timeout="4000" @click="close">
      {{ snackbar.text }}
    </VSnackbar>
  </VApp>
</template>
