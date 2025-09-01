const { execSync } = require('child_process');

module.exports = function(context) {
  console.log('[BeforeBuild] Running preparation script...');
  try {
    execSync('node resources/build/prepare-build.js', { stdio: 'inherit' });
    console.log('[BeforeBuild] Preparation complete!');
  } catch (error) {
    console.error('[BeforeBuild] Failed:', error.message);
    throw error;
  }
};
