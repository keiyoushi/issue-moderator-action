const URL_REGEX = /(?:https?:\/\/)?(?:[-\w]+\.)+[a-z]{2,18}\/?/gi;
const EXCLUSION_LIST = [
  'tachiyomi.org',
  'github.com',
  'user-images.githubusercontent.com',
  'gist.github.com',
  'keiyoushi.github.io',
  'github.blog',
  'mihon.app',
];
// Also file name extensions
const EXCLUDED_DOMAINS = ['.md'];

export function urlsFromString(str: string): string[] {
  return Array.from(str.matchAll(URL_REGEX)).map((url) => cleanUrl(url[0]));
}

export function urlsFromIssueBody(body: string): string[] {
  const urls = urlsFromString(body)
    .filter((url) => !EXCLUSION_LIST.includes(url))
    .filter((url) => EXCLUDED_DOMAINS.every((domain) => !url.endsWith(domain)));
  return Array.from(new Set(urls));
}

export function cleanUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/(https?:\/\/)?(www\.)?/g, '')
    .replace(/\/$/, '');
}
