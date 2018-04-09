const fs = require('fs');
const mkdirIfNotExistsSync = require('./mkdirIfNotExistsSync');
const homeDir = '/tmp/home';
const setupGit = async () => {
  try {
    // Add git to PATH
    await require('lambda-git')();

    process.env.HOME = homeDir;

    mkdirIfNotExistsSync(homeDir);

    fs.writeFileSync(
      `${homeDir}/printpass`,
      `#!/usr/bin/env bash\necho ${process.env.GITHUB_TOKEN}`,
      { mode: 0o777 },
    );
    process.env.GIT_ASKPASS = `${homeDir}/printpass`;
  } catch (e) {
    console.error(e.stack);
  }
};

module.exports = setupGit();
