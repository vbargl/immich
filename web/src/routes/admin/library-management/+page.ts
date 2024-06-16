import { authenticate, requestServerInfo } from '$lib/utils/auth';
import { searchUsersAdmin } from '@immich/sdk';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

export const load = (async () => {
  await authenticate({ admin: true });
  await requestServerInfo();
  const allUsers = await searchUsersAdmin({ withDeleted: false });
  const $t = get(t);

  return {
    allUsers,
    meta: {
      title: $t('admin.external_library_management'),
    },
  };
}) satisfies PageLoad;
