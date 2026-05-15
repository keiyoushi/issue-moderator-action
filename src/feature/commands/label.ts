import * as core from '@actions/core';
import * as github from '@actions/github';

import { GitHubClient } from '../../types';
import { addLabels, removeLabels } from '../../util/issues';

/**
 * Strip the leading command token from the comment body and return the
 * remaining label names, split on commas.
 *
 * The token is either the configured prefix (e.g. "Label") or a bot-style
 * token (e.g. `/label`, `?unlabel`, `!label`).
 */
export function parseLabelArgs(commentBody: string, command: string): string[] {
  const configuredPrefix = core.getInput(`${command}-command`);

  let rest = commentBody.trim();
  if (configuredPrefix && rest.startsWith(configuredPrefix)) {
    rest = rest.slice(configuredPrefix.length);
  } else {
    rest = rest.replace(new RegExp(`^[/?!]${command}`), '');
  }

  return rest
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

/**
 * Return the set of label names that a label command is allowed to operate on.
 *
 * Currently this is every label that already exists in the repository.
 * SWAP POINT: to restrict to a configured allowlist later, replace the body
 * with a read of a `label-command-allowed-labels` action input.
 */
export async function getAllowedLabels(
  client: GitHubClient,
  owner: string,
  repo: string,
): Promise<Set<string>> {
  const labels = await client.paginate(client.rest.issues.listLabelsForRepo, {
    owner,
    repo,
    per_page: 100,
  });
  return new Set(labels.map((label) => label.name));
}

function partition(
  requested: string[],
  allowed: Set<string>,
): { valid: string[]; unknown: string[] } {
  const valid: string[] = [];
  const unknown: string[] = [];
  for (const label of requested) {
    (allowed.has(label) ? valid : unknown).push(label);
  }
  return { valid, unknown };
}

export async function addIssueLabels(
  client: GitHubClient,
  commentBody: string,
) {
  const { issue, repo } = github.context;
  const requested = parseLabelArgs(commentBody, 'label');
  if (requested.length === 0) {
    core.info('No labels provided to the label command');
    return;
  }

  const allowed = await getAllowedLabels(client, repo.owner, repo.repo);
  const { valid, unknown } = partition(requested, allowed);

  if (unknown.length > 0) {
    core.warning(`Ignoring unknown labels: ${unknown.join(', ')}`);
  }

  await addLabels(
    client,
    { owner: repo.owner, repo: repo.repo, issue_number: issue.number },
    valid,
  );
}

export async function removeIssueLabels(
  client: GitHubClient,
  commentBody: string,
) {
  const { issue, repo } = github.context;
  const requested = parseLabelArgs(commentBody, 'unlabel');
  if (requested.length === 0) {
    core.info('No labels provided to the unlabel command');
    return;
  }

  const allowed = await getAllowedLabels(client, repo.owner, repo.repo);
  const { valid, unknown } = partition(requested, allowed);

  if (unknown.length > 0) {
    core.warning(`Ignoring unknown labels: ${unknown.join(', ')}`);
  }

  await removeLabels(
    client,
    { owner: repo.owner, repo: repo.repo, issue_number: issue.number },
    valid,
  );
}
