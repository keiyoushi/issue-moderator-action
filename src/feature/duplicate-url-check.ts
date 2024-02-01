import * as core from '@actions/core';
import * as github from '@actions/github';
import { Issue, IssuesEvent } from '@octokit/webhooks-types/schema';

import { addDuplicateLabel, shouldIgnore } from '../util/issues';
import { urlsFromIssueBody } from '../util/urls';

/**
 * Check if other open issues have the same URL(s).
 */
export async function checkForDuplicateUrls() {
  const payload = github.context.payload as IssuesEvent;
  if (!['opened'].includes(payload.action)) {
    core.info('Irrelevant action trigger');
    return;
  }

  const duplicateCheckEnabled = core.getInput('duplicate-check-enabled');
  if (duplicateCheckEnabled !== 'true') {
    core.info('SKIP: the duplicate URL check is disabled');
    return;
  }

  const issue = payload.issue as Issue;

  if (await shouldIgnore(issue.labels?.map((l) => l.name))) {
    return;
  }

  const labelsToCheckInput = core.getInput('duplicate-check-labels', {
    required: true,
  });
  const labelsToCheck: string[] = JSON.parse(labelsToCheckInput);
  const hasRelevantLabel = issue.labels?.some((label) =>
    labelsToCheck.includes(label.name),
  );
  if (!hasRelevantLabel) {
    core.info('SKIP: no duplicate check label set');
    return;
  }

  const issueUrls = urlsFromIssueBody(issue.body);
  if (issueUrls.length === 0) {
    core.info('No URLs found in the issue body');
    return;
  }

  const client = github.getOctokit(
    core.getInput('repo-token', { required: true }),
  );

  const { repo } = github.context;

  const qualifiers = `type:issue repo:${repo.owner}/${repo.repo} state:open label:"${labelsToCheck.join('","')}"`;
  const promises = [];
  // One search can have no more than 5 OR operators; regular expression `|` doesn't work
  for (let i = 0; i < issueUrls.length; i += 6) {
    const promise = client.rest.search.issuesAndPullRequests({
      // Converting to regular expressions because text might fail to match when `www.` is removed
      q: `${qualifiers} /${issueUrls
        .slice(i, i + 6)
        .map((url) => url.replaceAll('.', '\\.'))
        .join('/ OR /')}/`,
    });
    promises.push(promise);
  }

  const responses = await Promise.all(promises);
  const filteredIssues = responses.flatMap((response) => response.data.items);

  // Make sure the URL is not from the replies
  const duplicateIssues = filteredIssues
    .filter((currIssue) => {
      let urls: string[];
      return (
        currIssue.number !== issue.number &&
        (urls = urlsFromIssueBody(currIssue.body ?? '')) &&
        issueUrls.some((url) => urls.includes(url))
      );
    })
    .map((currIssue) => '#' + currIssue.number);

  if (duplicateIssues.length === 0) {
    core.info('No duplicate issues were found');
    return;
  }

  const issueMetadata = {
    owner: repo.owner,
    repo: repo.repo,
    issue_number: issue.number,
  };

  const duplicateIssuesText = duplicateIssues
    .join(', ')
    .replace(/, ([^,]*)$/, ' and $1');

  await addDuplicateLabel(client, issueMetadata);
  await client.rest.issues.update({
    ...issueMetadata,
    state: 'closed',
    state_reason: 'not_planned',
  });

  await client.rest.issues.createComment({
    ...issueMetadata,
    body: core
      .getInput('duplicate-check-comment')
      .replace(/\{duplicateIssuesText\}/g, duplicateIssuesText),
  });
}
