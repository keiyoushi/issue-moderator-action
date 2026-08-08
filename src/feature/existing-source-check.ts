import * as core from '@actions/core';
import * as github from '@actions/github';
import { Issue, IssuesEvent } from '@octokit/webhooks-types/schema';
import axios from 'axios';

import { addDuplicateLabel, shouldIgnore } from '../util/issues';
import { cleanUrl, urlsFromIssueBody, urlsFromString } from '../util/urls';

export interface ExtensionRepository {
  extensionList: {
    extensions: Extension[];
  };
}

export interface Extension {
  name: string;
  sources: Source[];
}

export interface Source {
  homeUrl: string;
  language: string;
  mirrorUrls?: string[];
}

/**
 * Check if the requested URL(s) already exist as sources.
 */
export async function checkForExistingSource() {
  const payload = github.context.payload as IssuesEvent;
  if (!['opened'].includes(payload.action)) {
    core.info('Irrelevant action trigger');
    return;
  }

  const existingCheckEnabled = core.getInput('existing-check-enabled');
  if (existingCheckEnabled !== 'true') {
    core.info('SKIP: the existing source check is disabled');
    return;
  }

  const issue = payload.issue as Issue;

  if (await shouldIgnore(issue.labels?.map((l) => l.name))) {
    return;
  }

  const labelsToCheckInput = core.getInput('existing-check-labels', {
    required: true,
  });
  const labelsToCheck: string[] = JSON.parse(labelsToCheckInput);
  const hasRelevantLabel = issue.labels?.some((label) =>
    labelsToCheck.includes(label.name),
  );
  if (!hasRelevantLabel) {
    core.info('SKIP: no existing check label set');
    return;
  }

  const sectionsToCeck = JSON.parse(core.getInput('url-search-sections'));
  const issueUrls = urlsFromIssueBody(issue.body, sectionsToCeck);
  if (issueUrls.length === 0) {
    core.info('No URLs found in the issue body');
    return;
  }

  const repoJsonUrl = core.getInput('existing-check-repo-url', {
    required: true,
  });

  let repository: ExtensionRepository;
  try {
    core.info(`Fetching ${repoJsonUrl}`);
    const { data } = await axios.get<ExtensionRepository>(repoJsonUrl);
    repository = data;
  } catch (_) {
    core.error('Failed to fetch the repository JSON, aborting.');
    return;
  }

  let existingExtension: Extension | undefined;
  let existingSource: Source | undefined;
  let requestUrl = '';
  for (let url of issueUrls) {
    const match = findExistingSource(repository, url);
    if (match) {
      existingExtension = match.extension;
      existingSource = match.source;
      requestUrl = url;
    }
    if (existingExtension) break;
  }

  if (!existingExtension) {
    core.info(
      `No existing extensions were found for the provided URLs: ${issueUrls.join(', ')}.`,
    );
    return;
  }

  const client = github.getOctokit(
    core.getInput('repo-token', { required: true }),
  );

  const { repo } = github.context;

  const issueMetadata = {
    owner: repo.owner,
    repo: repo.repo,
    issue_number: issue.number,
  };

  const extensionName = existingExtension.name.replace('Tachiyomi: ', '');
  const extensionLang = findLangName(existingSource!.language);

  await addDuplicateLabel(client, issueMetadata);
  await client.rest.issues.update({
    ...issueMetadata,
    state: 'closed',
    state_reason: 'not_planned',
  });

  await client.rest.issues.createComment({
    ...issueMetadata,
    body: core
      .getInput('existing-check-comment')
      .replace(/\{requestUrl\}/g, requestUrl)
      .replace(/\{extensionName\}/g, extensionName)
      .replace(/\{extensionLang\}/g, extensionLang),
  });
}

export function findExistingSource(
  repository: ExtensionRepository,
  requestedUrl: string,
) {
  for (const extension of repository.extensionList.extensions) {
    const source = extension.sources.find((source) =>
      [source.homeUrl, ...(source.mirrorUrls ?? [])].some((sourceUrl) =>
        urlsFromString(sourceUrl).includes(cleanUrl(requestedUrl)),
      ),
    );
    if (source) return { extension, source };
  }
}

function findLangName(langCode: string): string {
  const exceptions: Record<string, string> = {
    all: 'All',
    other: 'Other',
  };

  if (exceptions[langCode]) {
    return exceptions[langCode];
  }

  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
  return displayNames.of(langCode)!;
}
