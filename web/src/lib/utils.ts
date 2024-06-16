import { NotificationType, notificationController } from '$lib/components/shared-components/notification/notification';
import { locales } from '$lib/constants';
import { handleError } from '$lib/utils/handle-error';
import {
  AssetJobName,
  AssetMediaSize,
  JobName,
  finishOAuth,
  getAssetOriginalPath,
  getAssetPlaybackPath,
  getAssetThumbnailPath,
  getBaseUrl,
  getPeopleThumbnailPath,
  getUserProfileImagePath,
  linkOAuthAccount,
  startOAuth,
  unlinkOAuthAccount,
  type SharedLinkResponseDto,
} from '@immich/sdk';
import { mdiCogRefreshOutline, mdiDatabaseRefreshOutline, mdiImageRefreshOutline } from '@mdi/js';
import { t } from 'svelte-i18n';
import { derived, get } from 'svelte/store';

interface DownloadRequestOptions<T = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: T;
  signal?: AbortSignal;
  onDownloadProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
}

interface UploadRequestOptions {
  url: string;
  method?: 'POST' | 'PUT';
  data: FormData;
  onUploadProgress?: (event: ProgressEvent<XMLHttpRequestEventTarget>) => void;
}

export class AbortError extends Error {
  name = 'AbortError';
}

class ApiError extends Error {
  name = 'ApiError';

  constructor(
    public message: string,
    public statusCode: number,
    public details: string,
  ) {
    super(message);
  }
}

export const uploadRequest = async <T>(options: UploadRequestOptions): Promise<{ data: T; status: number }> => {
  const { onUploadProgress: onProgress, data, url } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.addEventListener('error', (error) => reject(error));
    xhr.addEventListener('load', () => {
      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
        resolve({ data: xhr.response as T, status: xhr.status });
      } else {
        reject(new ApiError(xhr.statusText, xhr.status, xhr.response));
      }
    });

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => onProgress(event));
    }

    xhr.open(options.method || 'POST', url);
    xhr.responseType = 'json';
    xhr.send(data);
  });
};

export const downloadRequest = <TBody = unknown>(options: DownloadRequestOptions<TBody> | string) => {
  if (typeof options === 'string') {
    options = { url: options };
  }

  const { signal, method, url, data: body, onDownloadProgress: onProgress } = options;

  return new Promise<{ data: Blob; status: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.addEventListener('error', (error) => reject(error));
    xhr.addEventListener('abort', () => reject(new AbortError()));
    xhr.addEventListener('load', () => {
      if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
        resolve({ data: xhr.response as Blob, status: xhr.status });
      } else {
        reject(new ApiError(xhr.statusText, xhr.status, xhr.responseText));
      }
    });

    if (onProgress) {
      xhr.addEventListener('progress', (event) => onProgress(event));
    }

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.open(method || 'GET', url);
    xhr.responseType = 'blob';

    if (body) {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(body));
    } else {
      xhr.send();
    }
  });
};

export const getJobName = derived(t, ($t) => {
  return (jobName: JobName) => {
    const names: Record<JobName, string> = {
      [JobName.ThumbnailGeneration]: $t('admin.thumbnail_generation_job'),
      [JobName.MetadataExtraction]: $t('admin.metadata_extraction_job'),
      [JobName.Sidecar]: $t('admin.sidecar_job'),
      [JobName.SmartSearch]: $t('admin.machine_learning_smart_search'),
      [JobName.DuplicateDetection]: $t('admin.machine_learning_duplicate_detection'),
      [JobName.FaceDetection]: $t('admin.face_detection'),
      [JobName.FacialRecognition]: $t('admin.machine_learning_facial_recognition'),
      [JobName.VideoConversion]: $t('admin.video_conversion_job'),
      [JobName.StorageTemplateMigration]: $t('admin.storage_template_migration'),
      [JobName.Migration]: $t('admin.migration_job'),
      [JobName.BackgroundTask]: $t('admin.background_task_job'),
      [JobName.Search]: $t('search'),
      [JobName.Library]: $t('library'),
      [JobName.Notifications]: $t('notifications'),
    };

    return names[jobName];
  };
});

let _key: string | undefined;
let _sharedLink: SharedLinkResponseDto | undefined;

export const setKey = (key: string) => (_key = key);
export const getKey = (): string | undefined => _key;
export const setSharedLink = (sharedLink: SharedLinkResponseDto) => (_sharedLink = sharedLink);
export const getSharedLink = (): SharedLinkResponseDto | undefined => _sharedLink;

export const isSharedLink = () => {
  return !!_key;
};

const createUrl = (path: string, parameters?: Record<string, unknown>) => {
  const searchParameters = new URLSearchParams();
  for (const key in parameters) {
    const value = parameters[key];
    if (value !== undefined && value !== null) {
      searchParameters.set(key, value.toString());
    }
  }

  const url = new URL(path, 'https://example.com');
  url.search = searchParameters.toString();

  return getBaseUrl() + url.pathname + url.search + url.hash;
};

export const getAssetOriginalUrl = (options: string | { id: string; checksum?: string }) => {
  if (typeof options === 'string') {
    options = { id: options };
  }
  const { id, checksum } = options;
  return createUrl(getAssetOriginalPath(id), { key: getKey(), c: checksum });
};

export const getAssetThumbnailUrl = (options: string | { id: string; size?: AssetMediaSize; checksum?: string }) => {
  if (typeof options === 'string') {
    options = { id: options };
  }
  const { id, size, checksum } = options;
  return createUrl(getAssetThumbnailPath(id), { size, key: getKey(), c: checksum });
};

export const getAssetPlaybackUrl = (options: string | { id: string; checksum?: string }) => {
  if (typeof options === 'string') {
    options = { id: options };
  }
  const { id, checksum } = options;
  return createUrl(getAssetPlaybackPath(id), { key: getKey(), c: checksum });
};

export const getProfileImageUrl = (userId: string) => createUrl(getUserProfileImagePath(userId));

export const getPeopleThumbnailUrl = (personId: string) => createUrl(getPeopleThumbnailPath(personId));

export const getAssetJobName = (job: AssetJobName) => {
  const names: Record<AssetJobName, string> = {
    [AssetJobName.RefreshMetadata]: 'Refresh metadata',
    [AssetJobName.RegenerateThumbnail]: 'Refresh thumbnails',
    [AssetJobName.TranscodeVideo]: 'Refresh encoded videos',
  };

  return names[job];
};

export const getAssetJobMessage = (job: AssetJobName) => {
  const messages: Record<AssetJobName, string> = {
    [AssetJobName.RefreshMetadata]: 'Refreshing metadata',
    [AssetJobName.RegenerateThumbnail]: `Regenerating thumbnails`,
    [AssetJobName.TranscodeVideo]: `Refreshing encoded video`,
  };

  return messages[job];
};

export const getAssetJobIcon = (job: AssetJobName) => {
  const names: Record<AssetJobName, string> = {
    [AssetJobName.RefreshMetadata]: mdiDatabaseRefreshOutline,
    [AssetJobName.RegenerateThumbnail]: mdiImageRefreshOutline,
    [AssetJobName.TranscodeVideo]: mdiCogRefreshOutline,
  };

  return names[job];
};

export const copyToClipboard = async (secret: string) => {
  const $t = get(t);

  try {
    await navigator.clipboard.writeText(secret);
    notificationController.show({ message: $t('copied_to_clipboard'), type: NotificationType.Info });
  } catch (error) {
    handleError(error, $t('errors.unable_to_copy_to_clipboard'));
  }
};

export const makeSharedLinkUrl = (externalDomain: string, key: string) => {
  let url = externalDomain || window.location.origin;
  if (!url.endsWith('/')) {
    url += '/';
  }
  return `${url}share/${key}`;
};

export const oauth = {
  isCallback: (location: Location) => {
    const search = location.search;
    return search.includes('code=') || search.includes('error=');
  },
  isAutoLaunchDisabled: (location: Location) => {
    const values = ['autoLaunch=0', 'password=1', 'password=true'];
    for (const value of values) {
      if (location.search.includes(value)) {
        return true;
      }
    }
    return false;
  },
  authorize: async (location: Location) => {
    try {
      const redirectUri = location.href.split('?')[0];
      const { url } = await startOAuth({ oAuthConfigDto: { redirectUri } });
      window.location.href = url;
      return true;
    } catch (error) {
      handleError(error, 'Unable to login with OAuth');
      return false;
    }
  },
  login: (location: Location) => {
    return finishOAuth({ oAuthCallbackDto: { url: location.href } });
  },
  link: (location: Location) => {
    return linkOAuthAccount({ oAuthCallbackDto: { url: location.href } });
  },
  unlink: () => {
    return unlinkOAuthAccount();
  },
};

export const findLocale = (code: string | undefined) => {
  const language = locales.find((lang) => lang.code === code);
  return {
    code: language?.code,
    name: language?.name,
  };
};

export const asyncTimeout = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const handlePromiseError = <T>(promise: Promise<T>): void => {
  promise.catch((error) => console.error(`[utils.ts]:handlePromiseError ${error}`, error));
};

export const s = (count: number) => (count === 1 ? '' : 's');

export const memoryLaneTitle = (yearsAgo: number) => `${yearsAgo} year${s(yearsAgo)} ago`;
