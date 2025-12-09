# SpankBang Grayjay Plugin

## Overview

This project is a plugin for the Grayjay video aggregation application that integrates SpankBang content. Grayjay is a platform that allows users to aggregate content from multiple video sources through a plugin system. This plugin enables users to search, browse, and play SpankBang videos within the Grayjay app, including features like channel subscriptions, profile viewing, and video downloads via HLS streaming.

The plugin is distributed as a JSON configuration file and a JavaScript implementation that runs within Grayjay's sandboxed environment, communicating with SpankBang's web platform through HTTP requests and DOM parsing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Plugin Architecture

**Plugin System Integration**
- The plugin follows Grayjay's plugin specification, using a dual-file architecture:
  - `SpankbangConfig.json`: Metadata, permissions, and versioning
  - `SpankbangScript.js`: Core implementation logic
- Runs in a sandboxed JavaScript environment with limited packages (Http, DOMParser, Utilities)
- Uses a capability-based permission system for HTTP access to specific domains
- Version-controlled with signature verification support (currently unsigned in development)

**Rationale**: Grayjay's architecture requires plugins to be self-contained, remotely loadable modules. The JSON/JS split allows for efficient metadata parsing without loading the full script.

### Content Retrieval Pattern

**Web Scraping Approach**
- Primary method: HTTP requests + DOM parsing of SpankBang's web pages
- No official API usage (SpankBang doesn't provide a public API)
- Parses HTML responses to extract video metadata, thumbnails, stream URLs, and channel information
- HLS (HTTP Live Streaming) for video delivery

**Rationale**: Without an official API, web scraping is the only viable approach. HLS was chosen as it's the standard streaming format SpankBang uses, supporting adaptive bitrate streaming and broad compatibility.

**Alternatives Considered**: 
- Reverse-engineering mobile apps (rejected due to complexity and legal concerns)
- Static MP4 downloads (rejected in favor of HLS for better bandwidth efficiency)

**Trade-offs**:
- ✅ Pros: Works without API access, can access all public content
- ❌ Cons: Fragile to website changes, requires HTML parsing overhead, no official support

### Data Models

**Platform ID System**
- Uses Grayjay's PlatformID class to uniquely identify content
- Claim type 3 for content identification
- Internal URL scheme: `spankbang://profile/` for profile linking
- Maps SpankBang's native IDs to Grayjay's universal ID format

**Content Types**:
- Videos (primary content type)
- Channels (models, pornstars, regular channels)
- Search results
- User profiles

**Rationale**: Grayjay requires a unified content identification system across all plugins. The PlatformID abstraction allows the main app to track, cache, and reference content consistently.

### Authentication Mechanism

**Cookie-Based Session Management**
- Supports optional login via web view authentication flow
- Captures session cookies: `sb_id`, `session`, `ss`
- Login URL: `https://spankbang.com/users/login`
- Stores authentication state in plugin state object

**Rationale**: SpankBang uses traditional cookie-based web authentication. The web view approach allows users to authenticate securely without the plugin handling credentials directly.

**Current Status**: Authentication is now fully implemented with proper cookie capture, session validation, and username display via `getLoggedInUser()`. The plugin persists authentication state (username, userId, cookies) across sessions.

### Video Quality Handling

**Multi-Quality Support**
- Defined quality tiers: 240p, 320p, 360p, 480p, 720p, 1080p, 4K
- Each quality includes resolution metadata (width/height)
- Quality selection not yet implemented (extraction logic pending)

**Rationale**: Different quality options accommodate varying network conditions and user preferences. The predefined quality map ensures consistent quality tier naming.

### Search and Discovery

**Search Capabilities**
- Video search (implemented)
- Profile/channel search (implemented)
- Playlist search (implemented)
- Configurable filters for duration, quality, time period, and sort order

**Filter Architecture**:
- Duration: Short/Medium/Long
- Quality: HD/FHD/UHD
- Period: Today/Week/Month/Year
- Sort: Relevance/New/Trending/Popular/Views/Rating/Length

**Rationale**: Mirrors SpankBang's native filtering system to provide familiar UX within Grayjay.

### Static File Serving

**Development Server**
- Node.js HTTP server (`server.js`) for local development/testing
- Serves plugin files, QR code for installation, and documentation
- CORS-enabled for cross-origin requests
- Hosts on 0.0.0.0:5000

**Rationale**: Allows developers to test the plugin locally and provides an easy installation method via QR code scanning in Grayjay.

## Replit Environment Setup

### Project Configuration
- **Language**: Node.js (v20.19.3)
- **Package Manager**: npm
- **Build System**: None required (vanilla JavaScript)
- **Server**: Native Node.js HTTP server

### Workflow Configuration
- **Name**: Grayjay Plugin Server
- **Command**: `npm start`
- **Port**: 5000 (webview)
- **Host**: 0.0.0.0 (required for Replit proxy)

### Deployment Configuration
- **Target**: Autoscale (stateless web server)
- **Run Command**: `node server.js`
- **No build step required** (serves static files directly)

### File Structure
- `/server.js` - HTTP server implementation
- `/index.html` - Plugin information page
- `/SpankbangConfig.json` - Grayjay plugin configuration
- `/SpankbangScript.js` - Plugin implementation (2850 lines)
- `/icon.png` - Plugin icon
- `/assets/SBQR.png` - QR code for installation
- `/plugin.d.ts`, `/types.d.ts`, `/ref.js` - TypeScript definitions for development

### Endpoints Served
- `/` - Plugin information page with QR code
- `/SpankbangConfig.json` - Plugin configuration
- `/SpankbangScript.js` - Plugin implementation
- `/icon.png` - Plugin icon
- `/assets/SBQR.png` - Installation QR code

### Recent Changes
- **Dec 8, 2025**: Plugin v15 - Major feature updates
  - Fixed Trending filter: correctly maps order "2" to `o=trending` URL parameter
  - Enhanced playlist functionality: added parseRelatedPlaylists, improved searchPlaylists with pagination
  - Improved authentication: added getUserPlaylists, getFavorites, enhanced validateSession with additional login detection
  - Added related playlists display in video descriptions
  - Added parseFavoritesPage fallback for favorites page parsing
- **Dec 8, 2025**: Initial Replit setup
  - Configured Node.js workflow for port 5000
  - Added .gitignore for Node.js projects
  - Configured autoscale deployment
  - Verified all plugin endpoints are accessible

## External Dependencies

### Third-Party Services

**SpankBang Platform**
- Base URL: `https://www.spankbang.com`
- Primary content source
- CDN domains: `.spankcdn.com`, `.sb-cd.com`, `.sb-cdn.com`, multiple CDN subdomains
- Thumbnail service: `tbi.sb-cd.com`
- Pornstar images: `https://spankbang.com/pornstarimg/f/`

**Content Delivery**: SpankBang uses multiple CDN domains for video streaming and thumbnail delivery, requiring the plugin to whitelist numerous subdomains.

### Grayjay Platform Packages

**Required Packages** (provided by Grayjay runtime):
- `Http`: HTTP request handling
- `DOMParser`: HTML parsing for web scraping
- `Utilities`: Helper functions and utilities

**Permission Requirements**:
- `allowAllHttpHeaderAccess: true`: Needed for authentication cookie handling
- `allowEval: true`: Required for dynamic code execution (if needed for parsing)
- URL whitelist: Extensive list of SpankBang domains and CDNs

### Repository Hosting

**Distribution**:
- GitHub repository: `https://github.com/ruiaso/spankbang-grayjay-plugin`
- Raw file hosting via GitHub for plugin files
- QR code-based installation workflow

**Assets**:
- Plugin icon hosted on GitHub
- QR code for easy plugin installation
- Configuration and script files served directly from repository

### Development Dependencies

**Type Definitions**:
- `plugin.d.ts`: Grayjay plugin API type definitions
- `ref.js`: Reference implementation for auto-completion
- `types.d.ts`: Custom type definitions for SpankBang data structures

**Rationale**: TypeScript definitions improve developer experience without requiring a build step, as the plugin runs in vanilla JavaScript.