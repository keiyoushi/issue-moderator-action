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

export function urlsFromIssueBody(body: string, sections: string[]): string[] {
  const textsToSearch = [] as string[];
  if (sections && sections.length) {
    // if sections are properly defined, seach only those sections
    for (let sectionName of sections) {
      const sectionContent = findSection(body, sectionName);
      if (sectionContent) textsToSearch.push(sectionContent);
    }
  } else {
    // if no sections are defined, seach the whole body
    textsToSearch.push(body)
  }

  const urls = new Set<string>();
  for (let text of textsToSearch) {
    urlsFromString(text)
      .filter((url) => !EXCLUSION_LIST.includes(url))
      .filter((url) => EXCLUDED_DOMAINS.every((domain) => !url.endsWith(domain)))
      .map((url) => urls.add(url));
  }
  return Array.from(urls);
}

export function cleanUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/(https?:\/\/)?(www\.)?/g, '')
    .replace(/\/$/, '');
}

function findSection(body: string, sectionName: string) {
  const start = body.indexOf(`# ${sectionName}`);
  if (start == -1) return false;

  const end = body.indexOf('\n#', start + 1);
  if (end == -1) return body.substring(start);

  return body.substring(start, end);
}
