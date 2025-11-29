#!/usr/bin/env node

/**
 * GrayJay Plugin Testing Script
 *
 * This script:
 * 1. Uses mDNS to discover GrayJay devices via sync service (_gsync._tcp.local)
 * 2. Falls back to network scan if mDNS unavailable
 * 3. Starts a local HTTP server to serve plugin files
 * 4. Injects the plugin config to the dev server (port 11337)
 * 5. Tests plugin methods using the dev-portal-client
 *
 * Usage:
 *   npm run test                                  # Auto-discover
 *   npm run test -- --dev-ip 192.168.1.100       # Manual IP
 *   npm run test -- --dev-ip 100.100.1.57 --dev-port 11337
 *   npm run test -- --port 3000                  # Custom local server port
 *   npm run test -- --skip-mdns                  # Skip mDNS, use network scan
 */

const {
  DevPortalClient,
  discoverDevices,
} = require("@grayjay-sources/dev-portal-client");
const utils = require("./utils");
const { log, colors, readJsonFile, getArgValue, openBrowser } = utils;
const http = require("http");
const fs = require("fs");
const path = require("path");

// Configuration
const DEV_SERVER_IP = getArgValue("dev-ip");
const DEV_SERVER_PORT = parseInt(getArgValue("dev-port")) || 11337;
const LOCAL_SERVER_PORT = parseInt(getArgValue("port")) || 3000;
const SKIP_MDNS = process.argv.includes("--skip-mdns");

/**
 * Start local HTTP server to serve plugin files
 */
function startLocalServer(port) {
  return new Promise((resolve, reject) => {
    const distPath = path.join(process.cwd(), "dist");

    if (!fs.existsSync(distPath)) {
      reject(
        new Error('dist/ directory not found. Run "npm run build" first.')
      );
      return;
    }

    const server = http.createServer((req, res) => {
      let filePath = path.join(
        distPath,
        req.url === "/" ? "config.json" : req.url
      );

      // Security: prevent directory traversal
      if (!filePath.startsWith(distPath)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }

        const ext = path.extname(filePath);
        const contentType =
          {
            ".json": "application/json",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".html": "text/html",
          }[ext] || "text/plain";

        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        });
        res.end(data);
      });
    });

    server.listen(port, () => {
      resolve(server);
    });

    server.on("error", reject);
  });
}

// Discovery is now handled by dev-portal-client

/**
 * Main test function
 */
async function main() {
  log(
    "\n╔════════════════════════════════════════════════════════════════╗",
    colors.cyan
  );
  log(
    "║     GrayJay Plugin Testing Tool                               ║",
    colors.cyan
  );
  log(
    "╚════════════════════════════════════════════════════════════════╝\n",
    colors.cyan
  );

  try {
    // Step 1: Discover devices using the dev-portal-client
    let devServerHost;

    if (DEV_SERVER_IP) {
      log(
        `\n🎯 Using manually specified IP: ${DEV_SERVER_IP}:${DEV_SERVER_PORT}`,
        colors.cyan
      );
      devServerHost = DEV_SERVER_IP;
    } else {
      log("\n📡 Discovering GrayJay devices...", colors.cyan);
      const devices = await discoverDevices(SKIP_MDNS);

      if (devices.length === 0) {
        log("\n❌ No dev servers found. Exiting.", colors.red);
        log("\n💡 Make sure:", colors.cyan);
        log("   • GrayJay app is running", colors.reset);
        log("   • Dev mode is enabled in GrayJay settings", colors.reset);
        log("   • Your device is on the same network", colors.reset);
        process.exit(1);
      }

      devServerHost = devices[0].host;
      log(`\n✅ Found device at ${devServerHost}`, colors.green);
    }

    // Step 2: Initialize dev portal client
    const client = new DevPortalClient(devServerHost, DEV_SERVER_PORT);

    // Step 3: Read config.json
    const configPath = path.join(process.cwd(), "dist", "config.json");

    if (!fs.existsSync(configPath)) {
      log("\n❌ Config file not found: dist/config.json", colors.red);
      log('   Run "npm run build" first', colors.yellow);
      process.exit(1);
    }

    const config = readJsonFile(configPath);
    log(`\n📦 Plugin: ${config.name} v${config.version}`, colors.cyan);

    // Step 4: Start local server
    log(
      `\n🌐 Starting local HTTP server on port ${LOCAL_SERVER_PORT}...`,
      colors.cyan
    );
    const server = await startLocalServer(LOCAL_SERVER_PORT);

    // Choose IP in same subnet as dev server for reachability
    const localIPs = utils.getLocalIPs();
    const devServerSubnet = devServerHost.split(".").slice(0, 3).join(".");
    let localIP =
      localIPs.find((ip) => ip.startsWith(devServerSubnet)) ||
      localIPs[0] ||
      "localhost";

    log(
      `   ✅ Server running at http://${localIP}:${LOCAL_SERVER_PORT}`,
      colors.green
    );
    log(
      `   Dev server: ${devServerHost} (subnet: ${devServerSubnet}.x)`,
      colors.reset
    );

    // Step 5: Load portal and inject plugin
    log(`\n🔧 Loading dev portal and injecting plugin...`, colors.cyan);

    // Use the dev server's reachable IP for the script URL
    const scriptUrl = `http://${localIP}:${LOCAL_SERVER_PORT}/script.js`;
    log(`   Script URL: ${scriptUrl}`, colors.reset);

    await client.loadPortal(10000);
    await client.updateTestPlugin(scriptUrl, config);

    log(`   ✅ Plugin injected`, colors.green);

    // Verify the plugin loaded by checking enable() result
    log(`   🔍 Verifying plugin loaded...`, colors.yellow);
    const verifyResult = await client.testMethod("enable");
    if (verifyResult.success && verifyResult.result) {
      const loadedConfig = verifyResult.result;
      if (loadedConfig.name === config.name) {
        log(`   ✅ Correct plugin loaded: ${config.name}`, colors.green);
      } else {
        log(
          `   ⚠️  Warning: Expected ${config.name} but got ${
            loadedConfig.name || "unknown"
          }`,
          colors.yellow
        );
      }
    }

    // Step 6: Test plugin methods
    log(`\n🧪 Testing Plugin Methods`, colors.cyan);
    log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      colors.reset
    );

    // Test getHome
    log(`\n   Testing getHome()...`, colors.yellow);
    const homeResult = await client.testMethod("getHome");
    log(
      `   • getHome(): ${homeResult.success ? "✅" : "❌"}`,
      homeResult.success ? colors.green : colors.red
    );

    if (homeResult.success && homeResult.result) {
      const videos = Array.isArray(homeResult.result)
        ? homeResult.result
        : homeResult.result.results || [];
      log(`      Videos: ${videos.length}`, colors.reset);

      if (videos.length === 0) {
        log(
          `      ℹ️  Empty result (expected for skeleton plugin)`,
          colors.cyan
        );
      }
    }

    // Open browser to dev portal
    log(`\n🌐 Opening dev portal in browser...`, colors.cyan);
    const devPortalUrl = `http://${devServerHost}:${DEV_SERVER_PORT}/dev`;
    openBrowser(devPortalUrl);

    // Summary
    log(`\n✨ Testing environment ready!`, colors.green);
    log(`\n📝 Next steps:`, colors.cyan);
    log("   1. Use the dev portal to test other methods", colors.reset);
    log("   2. Make changes to your source code", colors.reset);
    log('   3. Run "npm run build" to rebuild', colors.reset);
    log('   4. Click "Reload" in the dev portal to test changes', colors.reset);
    log(`\n⚠️  Press Ctrl+C to stop the local server\n`, colors.yellow);
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  log("\n\n👋 Shutting down...", colors.yellow);
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
