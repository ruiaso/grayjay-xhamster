#!/usr/bin/env node

/**
 * Initialization Script for Plugin Development
 * 
 * This script:
 * 1. Checks all dependencies are installed
 * 2. Verifies Node.js and npm versions
 * 3. Checks git configuration
 * 4. Checks GitHub CLI authentication
 * 5. Updates outdated packages
 * 6. Sets up development environment
 * 
 * Usage:
 *   npm run init
 *   node scripts/init.js
 */

const utils = require('./utils');
const { execCommand, execCommandInherit } = utils;
const fs = require('fs');
const path = require('path');

async function init() {
  utils.log('\n🎨 GrayJay Plugin Development Setup\n', utils.colors.cyan);
  
  // Step 1: Check Node.js version
  utils.log('📦 Checking Node.js version...', utils.colors.cyan);
  const nodeOk = utils.checkNodeVersion(14);
  
  if (nodeOk) {
    utils.log(`✅ Node.js ${process.version} is compatible`, utils.colors.green);
  } else {
    utils.log('\n⚠️  Continue anyway? (Ctrl+C to cancel)', utils.colors.yellow);
  }
  
  // Step 2: Check all dependencies
  const requiredDeps = ['git', 'node', 'npm'];
  const optionalDeps = ['gh', 'openssl'];
  
  utils.log('\n📋 Required dependencies:', utils.colors.cyan);
  const hasRequired = utils.checkAllDependencies(requiredDeps);
  
  if (!hasRequired) {
    utils.log('\n❌ Missing required dependencies. Please install them first.', utils.colors.red);
    process.exit(1);
  }
  
  utils.log('\n📋 Optional dependencies (recommended):', utils.colors.cyan);
  optionalDeps.forEach(tool => {
    const result = utils.checkDependency(tool, tool);
    if (result.installed) {
      utils.log(`  ✅ ${result.name}: ${result.version}`, utils.colors.green);
    } else {
      utils.log(`  ⚠️  ${result.name} not installed (optional)`, utils.colors.yellow);
      utils.log(`     Install: ${utils.getInstallInstructions(tool)}`, utils.colors.reset);
    }
  });
  
  // Step 3: Check git configuration
  utils.log('\n🔧 Checking git configuration...', utils.colors.cyan);
  const gitConfigOk = utils.checkGitConfig();
  
  if (gitConfigOk) {
    utils.log(`✅ Git configured as: ${utils.getGitUsername()} <${utils.getGitEmail()}>`, utils.colors.green);
  } else {
    utils.log('⚠️  Git configuration needed for commits', utils.colors.yellow);
  }
  
  // Step 4: Check GitHub CLI authentication (if installed)
  if (utils.commandExists('gh')) {
    utils.log('\n🔐 Checking GitHub authentication...', utils.colors.cyan);
    const ghAuthOk = utils.checkGitHubAuth();
    
    if (ghAuthOk) {
      const username = utils.getGitHubUsername();
      utils.log(`✅ Authenticated as: ${username}`, utils.colors.green);
    } else {
      utils.log('⚠️  Not authenticated with GitHub CLI', utils.colors.yellow);
      utils.log('   Run: gh auth login', utils.colors.yellow);
      utils.log('   (Required for npm run submit)', utils.colors.reset);
    }
  }
  
  // Step 5: Install npm dependencies
  utils.log('\n📦 Installing npm dependencies...', utils.colors.cyan);
  
  if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    utils.log('Installing packages...', utils.colors.yellow);
    execCommandInherit('npm install');
    utils.log('✅ Dependencies installed', utils.colors.green);
  } else {
    utils.log('✅ Dependencies already installed', utils.colors.green);
    
    // Check for outdated packages
    utils.checkNpmOutdated();
  }
  
  // Step 6: Check project structure
  utils.log('\n📁 Checking project structure...', utils.colors.cyan);
  
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'rollup.config.js',
    'src/script.ts',
    'src/constants.ts',
    'src/utils.ts',
    'config.json'
  ];
  
  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(process.cwd(), file))
  );
  
  if (missingFiles.length > 0) {
    utils.log('⚠️  Missing files:', utils.colors.yellow);
    missingFiles.forEach(file => {
      utils.log(`   - ${file}`, utils.colors.reset);
    });
  } else {
    utils.log('✅ All required files present', utils.colors.green);
  }
  
  // Step 7: Build the plugin
  utils.log('\n🔨 Building plugin...', utils.colors.cyan);
  
  try {
    execCommandInherit('npm run build');
    utils.log('✅ Plugin built successfully', utils.colors.green);
  } catch (error) {
    utils.log('❌ Build failed', utils.colors.red);
    utils.log('   Fix any errors and run: npm run build', utils.colors.yellow);
  }
  
  // Summary
  utils.log('\n🎉 Setup Complete!\n', utils.colors.green);
  
  utils.log('📝 Available commands:', utils.colors.cyan);
  utils.log('   npm run dev        - Watch mode for development', utils.colors.reset);
  utils.log('   npm run build      - Build the plugin', utils.colors.reset);
  utils.log('   npm run sign       - Sign the plugin', utils.colors.reset);
  utils.log('   npm run publish    - Bump version and publish', utils.colors.reset);
  utils.log('   npm run submit     - Submit to grayjay-sources.github.io', utils.colors.reset);
  
  utils.log('\n📖 Next steps:', utils.colors.cyan);
  utils.log('   1. Edit src/script.ts to implement your plugin logic', utils.colors.reset);
  utils.log('   2. Test in GrayJay app (scan qrcode.png or load dist/config.json)', utils.colors.reset);
  utils.log('   3. Run npm run submit to submit to the official repository', utils.colors.reset);
  
  // Check what's missing for full workflow
  const warnings = [];
  
  if (!utils.commandExists('gh')) {
    warnings.push('⚠️  GitHub CLI not installed - npm run submit will not work');
  } else if (!utils.checkGitHubAuth()) {
    warnings.push('⚠️  Not authenticated with GitHub - run: gh auth login');
  }
  
  if (!utils.commandExists('openssl')) {
    warnings.push('⚠️  OpenSSL not found - plugin signing (npm run sign) will not work');
  }
  
  if (!gitConfigOk) {
    warnings.push('⚠️  Git not configured - commits will fail');
  }
  
  if (warnings.length > 0) {
    utils.log('\n📌 Warnings:', utils.colors.yellow);
    warnings.forEach(w => utils.log(`   ${w}`, utils.colors.yellow));
  }
  
  utils.log('\n✨ Happy coding!\n', utils.colors.green);
}

init().catch((error) => {
  utils.log(`\n❌ Setup failed: ${error.message}`, utils.colors.red);
  console.error(error);
  process.exit(1);
});

