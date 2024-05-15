<script lang="ts">
  import { AssetFilter, assetViewSettings } from '$lib/stores/preferences.store';
  import Slider from '$lib/components/elements/slider.svelte';

  let checkedNotInAlbums = $assetViewSettings.filter === AssetFilter.WithoutAlbum;

  const handleChangleFilter = ({ detail: toggled }: CustomEvent<boolean>) => {
    if (toggled) {
      $assetViewSettings.filter = AssetFilter.WithoutAlbum;
    } else {
      $assetViewSettings.filter = AssetFilter.All;
    }
  };
</script>

<!-- Filter Albums by Sharing Status (All, Owned, Shared) -->
<div class="xl:block h-10">
  <div
    class="inline-flex items-center justify-center transition-colors dark:text-immich-dark-fg enabled:hover:bg-immich-primary/5 enabled:hover:text-gray-700 enabled:hover:dark:text-immich-dark-fg enabled:dark:hover:bg-immich-dark-primary/25 font-medium p-2 gap-3"
  >
    <span>All</span>
    <Slider id="filter-notinalbums" on:toggle={handleChangleFilter} checked={checkedNotInAlbums} />
    <span>Without album</span>
  </div>
</div>
