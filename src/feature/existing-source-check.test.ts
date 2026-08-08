import { describe, expect, it } from 'vitest';

import {
  ExtensionRepository,
  findExistingSource,
} from './existing-source-check';

const repository: ExtensionRepository = {
  extensionList: {
    extensions: [
      {
        name: 'Example Extension',
        sources: [
          {
            homeUrl: 'https://example.org',
            language: 'en',
            mirrorUrls: ['https://mirror.example.org'],
          },
        ],
      },
    ],
  },
};

describe('findExistingSource', () => {
  it.each(['example.org', 'https://example.org'])(
    'matches a source home URL',
    (url) => {
      expect(findExistingSource(repository, url)?.extension.name).toBe(
        'Example Extension',
      );
    },
  );

  it('matches a source mirror URL', () => {
    const match = findExistingSource(repository, 'mirror.example.org');

    expect(match?.extension.name).toBe('Example Extension');
    expect(match?.source.language).toBe('en');
  });
});
