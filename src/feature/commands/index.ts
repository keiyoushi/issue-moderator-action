import * as core from '@actions/core';
import * as github from '@actions/github';
import { IssueCommentEvent } from '@octokit/webhooks-types/schema';

import { GitHubClient } from '../../types';
import { minimizeComment } from '../../util/comments';

import { handleBlurb } from './blurbs';
import { closeDuplicateIssue } from './close-duplicate-issue';
import { deleteIssue } from './delete-issue';
import { editIssueTitle } from './edit-issue-title';
import { addIssueLabels, removeIssueLabels } from './label';
import { lockIssue } from './lock-issue';

type CommandFn = (client: GitHubClient, commentBody: string) => Promise<void>;
interface Command {
  minimizeComment: boolean;
  fn: CommandFn;
  /**
   * Name of an action input holding a comma/newline separated list of GitHub
   * logins allowed to run this command even when they are not organization
   * members.
   */
  userAllowlistInput?: string;
}

const BOT_CHARACTERS = '^[/?!]';
export const BOT_REGEX = new RegExp(BOT_CHARACTERS);

const COMMANDS: Record<string, Command> = {
  blurb: {
    minimizeComment: true,
    fn: handleBlurb,
  },
  delete: {
    minimizeComment: false,
    fn: deleteIssue,
  },
  duplicate: {
    minimizeComment: false,
    fn: closeDuplicateIssue,
  },
  'edit-title': {
    minimizeComment: true,
    fn: editIssueTitle,
  },
  lock: {
    minimizeComment: true,
    fn: lockIssue,
  },
  label: {
    minimizeComment: true,
    fn: addIssueLabels,
    userAllowlistInput: 'label-command-users',
  },
  unlabel: {
    minimizeComment: true,
    fn: removeIssueLabels,
    userAllowlistInput: 'label-command-users',
  },
};

/**
 * Parse a comma/newline separated action input into a set of numeric GitHub
 * user IDs.
 *
 * Only numeric IDs are accepted. Logins are deliberately rejected: a login
 * can be changed and, once an account is deleted, reused by anyone, so a
 * login-based allowlist is vulnerable to account squatting. User IDs are
 * immutable.
 */
function parseUserAllowlist(input: string): Set<number> {
  const ids = new Set<number>();
  for (const raw of input.split(/[\n,]/)) {
    const entry = raw.trim();
    if (entry.length === 0) {
      continue;
    }
    if (/^[0-9]+$/.test(entry)) {
      ids.add(Number(entry));
    } else {
      core.warning(
        `Ignoring non-numeric allowlist entry "${entry}": use the numeric ` +
          `GitHub user ID, not the login, to prevent account squatting`,
      );
    }
  }
  return ids;
}

/**
 * Check if the comment has a valid command and execute it.
 */
export async function checkForCommand() {
  const payload = github.context.payload as IssueCommentEvent;
  if (!['created'].includes(payload.action)) {
    core.info('Irrelevant action trigger');
    return;
  }

  const { repo } = github.context;
  const {
    body: commentBody,
    node_id: commentNodeId,
    user: commentUser,
  } = payload.comment;

  // Find the command used.
  const commandToRun = Object.keys(COMMANDS).find((key) => {
    return (
      commentBody.startsWith(core.getInput(`${key}-command`)) ||
      commentBody.match(new RegExp(BOT_CHARACTERS + key))
    );
  });

  if (!commandToRun) {
    core.info('No commands found');
    return;
  }

  core.info(`Command found: ${commandToRun}`);

  const client = github.getOctokit(
    core.getInput('repo-token', { required: true }),
  );

  const command = COMMANDS[commandToRun];

  let isMember = false;
  try {
    const memberToken = core.getInput('member-token');
    const memberClient = memberToken ? github.getOctokit(memberToken) : client;

    await memberClient.rest.orgs.checkMembershipForUser({
      org: repo.owner,
      username: commentUser.login,
    });
    isMember = true;
  } catch (_) {
    core.info('Could not verify the membership of the comment author');
  }

  if (!isMember) {
    const allowlist = command.userAllowlistInput
      ? parseUserAllowlist(core.getInput(command.userAllowlistInput))
      : new Set<number>();

    if (!allowlist.has(commentUser.id)) {
      core.info(
        `User ${commentUser.login} is not allowed to run the ${commandToRun} command`,
      );
      return;
    }

    core.info(
      `User ${commentUser.login} allowed via ${command.userAllowlistInput}`,
    );
  }

  await command.fn(client, commentBody);

  if (command.minimizeComment) {
    await minimizeComment(client, commentNodeId);
  }
}
