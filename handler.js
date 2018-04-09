'use strict';

const get = require('lodash/get');
const fs = require('fs');
const runInBash = require('./runInBash');
const mkdirIfNotExistsSync = require('./mkdirIfNotExistsSync');
const github = require('./github');
const setupGit = require('./setupGit');
const settings = {
  github_token: process.env.GITHUB_TOKEN,
  login: process.env.GITHUB_LOGIN,
  webhook_secret: process.env.WEBHOOK_SECRET || 'x',
  debug: false,
};

// Setup home directly and save git identity
const workDir = `/tmp/work`;
mkdirIfNotExistsSync(workDir);

const repoUrl = repo_name =>
  `https://${settings.login}@github.com/${repo_name}`;

// Helpers for returning a response
const badRequest = err => ({ statusCode: 400, body: String(err) });

// Convert async function into lambda handler
const handler = fn => (event, context, callback) => {
  const data = event.body[0] === '{' ? JSON.parse(event.body) : event.body;
  if (settings.debug)
    console.log('Request body:\n' + JSON.stringify(data, null, 2));
  setupGit
    .then(() => fn(data, event, context))
    .catch(err => ({ statusCode: 500, message: String(err) }))
    .then(resp => {
      if (!resp) resp = { statusCode: resp === false ? 400 : 200, body: '' };
      else if (typeof resp === 'string') resp = { statusCode: 200, body: resp };
      else if (typeof resp === 'number') resp = { statusCode: resp };
      else if (!resp.statusCode) resp.statusCode = 200;
      if (resp.body && typeof resp.body !== 'string')
        resp.body = JSON.stringify(resp.body);
      if (settings.debug)
        console.log('Response: ' + JSON.stringify(resp, null, 2));
      callback(null, resp);
    })
    .catch(err => {
      console.log(`Error preparing response: ${err.stack || err}`);
      callback(null, { statusCode: 500, body: String(err) });
    });
};

const do_rebase = async (pull_request) => {
  const repo_name = get(pull_request, ['head', 'repo', 'full_name']);
  const owner = get(pull_request, ['head', 'repo', 'owner', 'login']);
  const repo_basename = get(pull_request, ['head', 'repo', 'name']);
  const ref = get(pull_request, ['head', 'ref']);
  const base_repo_name = get(pull_request, ['base', 'repo', 'full_name']);
  const base_repo_owner = get(pull_request, ['base', 'repo', 'owner', 'login']);
  const base_ref = get(pull_request, ['base', 'ref']);
  const repo_owner_dir = `${workDir}/${owner}`;
  const repo_dir = `${repo_owner_dir}/${repo_basename}`;

  const output = [];
  const run = (cmd, dir) =>
    runInBash(cmd, {
      cwd: dir || repo_dir,
      output: output,
    });
  try {
    if (settings.debug)
      console.log(
        `Attempting rebase of ${ref} from ${repo_name} onto ${base_ref} from ${base_repo_name}`,
      );

    const repoAlreadyCloned = fs.existsSync(`${repo_dir}/.git`);
    if (!repoAlreadyCloned) {
      mkdirIfNotExistsSync(repo_owner_dir);
      await run(`git clone ${repoUrl(repo_name)} ${repo_dir}`, repo_owner_dir);
    }

    if (repoAlreadyCloned) await run(`git fetch origin`);
    await run(
      `git config remote.${base_repo_owner}.url || git remote add ${base_repo_owner} ${repoUrl(
        base_repo_name,
      )}`,
    );
    await run(`git fetch ${base_repo_owner}`);
    await run(`git checkout -t -f -B ${ref} ${base_repo_owner}/${ref}`);
    await run(`git rebase --autosquash ${base_repo_owner}/${base_ref}`);
    await run(`git push -f origin ${base_ref}`);
    await github.add_comment_to_issue(
      pull_request.issue_url,
      '\n```\n' + output.join('') + '\n```\n',
    );
    return null;
  } catch (err) {
    await run(`git rebase --abort`).catch(err => {});
    console.log(err.stack || err);
    await github.add_comment_to_issue(
      pull_request.issue_url,
      '\n```\n' +
      output.join('') +
        '\n' +
        (err.output || err.stack || String(err)) +
        '\n```\n',
    );
    throw err;
  }
};

// Actual body of the lambda handler
module.exports.rebasebot = handler(async (data, event, context) => {
  if (!data) return badRequest('No request body');
  if (
    data.issue &&
    data.comment &&
    data.action === 'created' &&
    data.issue.pull_request &&
    data.comment.body.trim() === '/rebase'
  ) {
    const pull_request = await github.request(data.issue.pull_request.url);
    if (pull_request.rebaseable) {
      const plus_one_reaction = await github.add_reaction_to_comment(
        data.comment.url,
        '+1',
      );
      try {
        await do_rebase(pull_request);
        await github.add_reaction_to_comment(data.comment.url, 'hooray');
      } catch (err) {
        await github.add_reaction_to_comment(data.comment.url, '-1');
      } finally {
        await github.delete_reaction(plus_one_reaction);
      }
    } else {
      await github.add_reaction_to_comment(data.comment.url, 'confused');
    }
  }
});
