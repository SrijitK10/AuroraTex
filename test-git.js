const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

async function test() {
  const dir = path.join(__dirname, 'test-repo-' + Date.now());
  fs.mkdirSync(dir);
  const git = simpleGit(dir);
  await git.init();
  fs.writeFileSync(path.join(dir, 'test.txt'), 'hello');
  await git.add('.');
  await git.commit('init');
  const branches = await git.branch();
  console.log("Branches:", branches);
}
test().catch(console.error);
