import * as core from '@actions/core';
import { GitHubClient } from '../types';

interface IssueParameters {
  owner: string;
  repo: string;
  issue_number: number;
}

export async function shouldIgnore(
  labels: string[] | undefined,
): Promise<boolean> {
  if (!labels) {
    core.info('SKIP: issue has no labels');
    return true;
  }

  const ignoreLabel: string = core.getInput('auto-close-ignore-label');
  if (ignoreLabel) {
    const hasIgnoreLabel = !!labels.find(
      (label: string) => label === ignoreLabel,
    );
    if (hasIgnoreLabel) {
      core.info(`SKIP: ignoring issue with label ${ignoreLabel}`);
      return true;
    }
  }

  return false;
}

export async function addDuplicateLabel(
  client: GitHubClient,
  params: IssueParameters,
) {
  const label = core.getInput('duplicate-label');
  if (!label) {
    return;
  }
  await addLabels(client, params, [label]);
}

export async function addLabels(
  client: GitHubClient,
  params: IssueParameters,
  labels: string[],
) {
  if (labels.length == 0) {
    return;
  }
  await client.rest.issues.addLabels({
    ...params,
    labels,
  });
  core.info(`Added labels: ${labels}`);
}

export async function removeLabels(
  client: GitHubClient,
  params: IssueParameters,
  labels: string[],
) {
  for (const name of labels) {
    try {
      await client.rest.issues.removeLabel({ ...params, name });
      core.info(`Removed label: ${name}`);
    } catch (error: any) {
      // 404 means the label is simply not on the issue; ignore it.
      if (error.status === 404) {
        core.info(`Label not present, skipping: ${name}`);
        continue;
      }
      throw error;
    }
  }
}

export async function deleteIssue(client: GitHubClient, issueId: string) {
  try {
    await client.graphql(
      `
        mutation {
          deleteIssue(input: {issueId: "${issueId}", clientMutationId: "Delete test issue"}) {
            clientMutationId
          }
        }
      `,
    );
  } catch (error: any) {
    core.warning(`Failed to delete issue: ${error.message}`);
  }
}
