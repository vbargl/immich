<script lang="ts">
  import { moonPath, moonViewBox, sunPath, sunViewBox } from '$lib/assets/svg-paths';
  import CircleIconButton from '$lib/components/elements/buttons/circle-icon-button.svelte';
  import { Theme } from '$lib/constants';
  import { colorTheme, handleToggleTheme } from '$lib/stores/preferences.store';
  import { t } from 'svelte-i18n';

  $: icon = $colorTheme.value === Theme.LIGHT ? moonPath : sunPath;
  $: viewBox = $colorTheme.value === Theme.LIGHT ? moonViewBox : sunViewBox;
</script>

{#if !$colorTheme.system}
  <CircleIconButton title={$t('toggle_theme')} {icon} {viewBox} on:click={handleToggleTheme} />
{/if}
