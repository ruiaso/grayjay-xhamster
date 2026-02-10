const BASE_URL = "https://spankbang.com";
const PLATFORM = "SpankBang";
const PLATFORM_CLAIMTYPE = 3;

const USER_URLS = {
    PLAYLISTS: "https://spankbang.com/users/playlists",
    HISTORY: "https://spankbang.com/users/history",
    SUBSCRIPTIONS: "https://spankbang.com/users/subscriptions",
    FAVORITES: "https://spankbang.com/users/favorites",
    PROFILE: "https://spankbang.com/users/profile"
};

var config = {};
let localConfig = {
    pornstarShortIds: {},
    channelAvatars: {},  // Cache for channel avatars: { "shortId:slug": "avatarUrl" }
    lastRequestTime: 0,
    requestDelay: 500, // Increased to 500ms delay between requests to avoid rate limiting
    consecutiveErrors: 0
};
var state = {
    sessionCookie: "",
    isAuthenticated: false,
    authCookies: "",
    username: "",
    userId: ""
};

const CONFIG = {
    DEFAULT_PAGE_SIZE: 20,
    COMMENTS_PAGE_SIZE: 50,
    VIDEO_QUALITIES: {
        "240": { name: "240p", width: 320, height: 240 },
        "320": { name: "320p", width: 480, height: 320 },
        "360": { name: "360p", width: 640, height: 360 },
        "480": { name: "480p", width: 854, height: 480 },
        "720": { name: "720p", width: 1280, height: 720 },
        "1080": { name: "1080p", width: 1920, height: 1080 },
        "2160": { name: "4K", width: 3840, height: 2160 },
        "4k": { name: "4K", width: 3840, height: 2160 }
    },
    INTERNAL_URL_SCHEME: "spankbang://profile/",
    EXTERNAL_URL_BASE: "https://spankbang.com",
    PORNSTAR_IMG_BASE: "https://spankbang.com/pornstarimg/f/",
    SEARCH_FILTERS: {
        DURATION: {
            ANY: "",
            SHORT: "1",
            MEDIUM: "2",
            LONG: "3"
        },
        QUALITY: {
            ANY: "",
            HD: "1",
            FHD: "2",
            UHD: "3"
        },
        PERIOD: {
            ANY: "",
            TODAY: "1",
            WEEK: "2",
            MONTH: "3",
            YEAR: "4"
        },
        ORDER: {
            RELEVANCE: "",
            NEW: "1",
            TRENDING: "2",
            POPULAR: "3",
            VIEWS: "4",
            RATING: "5",
            LENGTH: "6"
        }
    }
};

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

const REGEX_PATTERNS = {
    urls: {
        videoStandard: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/video\/.+$/,
        videoAlternative: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/embed\/.+$/,
        videoShort: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-zA-Z0-9]+)\/.*$/,
        // Video in playlist format: /PLAYLISTID-VIDEOID/playlist/slug - this is a VIDEO, not a playlist!
        videoInPlaylist: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)-([a-z0-9]+)\/playlist\/([^\/\?]+)/,
        channelProfile: /^https?:\/\/(?:www\.)?spankbang\.com\/profile\/([^\/\?]+)/,
        channelOfficial: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        channelS: /^https?:\/\/(?:www\.)?spankbang\.com\/s\/([^\/\?]+)/,
        pornstar: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        pornstarSimple: /^https?:\/\/(?:www\.)?spankbang\.com\/pornstar\/([^\/\?]+)/,
        // Category/Tag URLs
        categoryS: /^https?:\/\/(?:www\.)?spankbang\.com\/s\/([^\/\?]+)\/?$/,
        categoryTag: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9\-_]+)\/?$/,
        // Playlist URL - note: must NOT have hyphen in first segment (that would be video-in-playlist)
        playlistExternal: /^https?:\/\/(?:www\.)?spankbang\.com\/([a-z0-9]+)\/playlist\/([^\/\?]+)/,
        playlistSimple: /^https?:\/\/(?:www\.)?spankbang\.com\/playlist\/([^\/\?]+)/,
        playlistInternal: /^spankbang:\/\/playlist\/(.+)$/,
        categoryInternal: /^spankbang:\/\/category\/(.+)$/,
        channelInternal: /^spankbang:\/\/channel\/(.+)$/,
        profileInternal: /^spankbang:\/\/profile\/(.+)$/,
        relativeProfile: /^\/profile\/([^\/\?]+)/,
        relativeChannel: /^\/([a-z0-9]+)\/channel\/([^\/\?]+)/,
        relativeS: /^\/s\/([^\/\?]+)/,
        relativePornstar: /^\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        relativePornstarSimple: /^\/pornstar\/([^\/\?]+)/,
        // User playlists page URL patterns
        userPlaylistsPage: /^https?:\/\/(?:www\.)?spankbang\.com\/users\/playlists\/?$/,
        userPlaylistsSubsPage: /^https?:\/\/(?:www\.)?spankbang\.com\/users\/playlists_subs\/?$/,
        // Profile playlists (other user's playlists)
        profilePlaylistsPage: /^https?:\/\/(?:www\.)?spankbang\.com\/profile\/([^\/\?]+)\/playlists\/?/
    },
    extraction: {
        videoId: /\/([a-zA-Z0-9]+)\/(?:video|embed|play)/,
        videoIdShort: /spankbang\.com\/([a-zA-Z0-9]+)\//,
        profileName: /\/(?:profile|s)\/([^\/\?]+)/,
        pornstarName: /\/pornstar\/([^\/\?]+)/,
        pornstarWithId: /\/([a-z0-9]+)\/pornstar\/([^\/\?]+)/,
        streamUrl: /stream_url_([0-9]+p)\s*=\s*'([^']+)'/g,
        m3u8Url: /source\s*src="([^"]+\.m3u8[^"]*)"/,
        title: /<h1[^>]*title="([^"]+)"/,
        duration: /itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/,
        views: /"interactionCount"\s*:\s*"?(\d+)"?/,
        uploadDate: /itemprop="uploadDate"\s*content="([^"]+)"/,
        thumbnail: /itemprop="thumbnailUrl"\s*content="([^"]+)"/,
        uploader: /class="n"\s*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</
    },
    parsing: {
        duration: /(\d+)h|(\d+)m|(\d+)s/g,
        htmlTags: /<[^>]*>/g,
        htmlBreaks: /<br\s*\/?>/gi
    }
};

function getAuthHeaders() {
    const headers = { ...API_HEADERS };
    if (state.authCookies && state.authCookies.length > 0) {
        headers["Cookie"] = state.authCookies;
    }
    return headers;
}

function sleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        // Busy wait (Grayjay environment doesn't have async sleep)
    }
}

function enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - localConfig.lastRequestTime;
    
    if (timeSinceLastRequest < localConfig.requestDelay) {
        const waitTime = localConfig.requestDelay - timeSinceLastRequest;
        log("Rate limiting: waiting " + waitTime + "ms");
        sleep(waitTime);
    }
    
    localConfig.lastRequestTime = Date.now();
}

function makeRequest(url, headers = null, context = 'request', useAuth = false) {
    try {
        // Enforce rate limiting before making the request
        enforceRateLimit();
        
        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, useAuth);
        if (!response.isOk) {
            // If we get 429, add exponential backoff with multiple retries
            if (response.code === 429) {
                localConfig.consecutiveErrors++;
                const waitTime = Math.min(3000 * localConfig.consecutiveErrors, 10000); // 3s, 6s, 9s, max 10s
                log(`Rate limit hit (429), attempt ${localConfig.consecutiveErrors}, waiting ${waitTime}ms before retry...`);
                sleep(waitTime);
                localConfig.requestDelay = Math.min(localConfig.requestDelay * 2, 2000); // Increase delay up to 2s
                
                // Retry up to 3 times
                if (localConfig.consecutiveErrors < 3) {
                    const retryResponse = http.GET(url, requestHeaders, useAuth);
                    if (retryResponse.isOk) {
                        localConfig.consecutiveErrors = 0; // Reset on success
                        localConfig.requestDelay = Math.max(500, localConfig.requestDelay * 0.8); // Slowly decrease
                        return retryResponse.body;
                    }
                }
            }
            throw new ScriptException(`${context} failed with status ${response.code}`);
        }
        
        // Reset on successful request
        localConfig.consecutiveErrors = 0;
        if (localConfig.requestDelay > 500) {
            localConfig.requestDelay = Math.max(500, localConfig.requestDelay * 0.9);
        }
        
        return response.body;
    } catch (error) {
        throw new ScriptException(`Failed to fetch ${context}: ${error.message}`);
    }
}

function makeRequestNoThrow(url, headers = null, context = 'request', useAuth = false) {
    try {
        // Enforce rate limiting before making the request
        enforceRateLimit();
        
        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, useAuth);
        
        // If we get 429, add exponential backoff and retry
        if (!response.isOk && response.code === 429) {
            localConfig.consecutiveErrors++;
            const waitTime = Math.min(3000 * localConfig.consecutiveErrors, 10000); // 3s, 6s, 9s, max 10s
            log(`Rate limit hit (429), attempt ${localConfig.consecutiveErrors}, waiting ${waitTime}ms before retry...`);
            sleep(waitTime);
            localConfig.requestDelay = Math.min(localConfig.requestDelay * 2, 2000); // Increase delay up to 2s
            
            // Retry up to 3 times
            if (localConfig.consecutiveErrors < 3) {
                const retryResponse = http.GET(url, requestHeaders, useAuth);
                if (retryResponse.isOk) {
                    localConfig.consecutiveErrors = 0;
                    localConfig.requestDelay = Math.max(500, localConfig.requestDelay * 0.8);
                }
                return { isOk: retryResponse.isOk, code: retryResponse.code, body: retryResponse.body };
            }
        }
        
        // Reset on successful request
        if (response.isOk) {
            localConfig.consecutiveErrors = 0;
            if (localConfig.requestDelay > 500) {
                localConfig.requestDelay = Math.max(500, localConfig.requestDelay * 0.9);
            }
        }
        
        return { isOk: response.isOk, code: response.code, body: response.body };
    } catch (error) {
        return { isOk: false, code: 0, body: null, error: error.message };
    }
}

function resolvePornstarShortId(slug) {
    if (!localConfig.pornstarShortIds) {
        localConfig.pornstarShortIds = {};
    }
    
    const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '+');
    
    if (localConfig.pornstarShortIds[normalizedSlug]) {
        return localConfig.pornstarShortIds[normalizedSlug];
    }
    
    const simpleUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${normalizedSlug}`;
    log("Resolving pornstar shortId for: " + normalizedSlug + " via " + simpleUrl);
    const response = makeRequestNoThrow(simpleUrl, API_HEADERS, 'pornstar lookup');
    
    if (response.isOk && response.body) {
        const patterns = [
            new RegExp(`href=["']/([a-z0-9]+)/pornstar/${normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
            /<link[^>]*rel="canonical"[^>]*href="[^"]*\/([a-z0-9]+)\/pornstar\//i,
            /href="\/([a-z0-9]+)\/pornstar\/[^"]+"/,
            /data-pornstar-id="([a-z0-9]+)"/i,
            /"pornstar_id"\s*:\s*"?([a-z0-9]+)"?/i
        ];
        
        for (const pattern of patterns) {
            const match = response.body.match(pattern);
            if (match && match[1] && match[1].length >= 3 && match[1].length <= 10) {
                log("Found shortId via pattern: " + match[1]);
                localConfig.pornstarShortIds[normalizedSlug] = match[1];
                return match[1];
            }
        }
    }
    
    try {
        const searchUrl = `${BASE_URL}/s/${normalizedSlug}/`;
        log("Trying search fallback: " + searchUrl);
        const searchResponse = makeRequestNoThrow(searchUrl, API_HEADERS, 'pornstar search');
        if (searchResponse.isOk && searchResponse.body) {
            const escapedSlug = normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`href=["']/([a-z0-9]+)/pornstar/${escapedSlug}`, 'i');
            const searchMatch = searchResponse.body.match(pattern);
            if (searchMatch && searchMatch[1]) {
                log("Found shortId via search: " + searchMatch[1]);
                localConfig.pornstarShortIds[normalizedSlug] = searchMatch[1];
                return searchMatch[1];
            }
        }
    } catch (e) {
        log("Pornstar search fallback failed: " + e.message);
    }
    
    try {
        const pornstarsUrl = `${BASE_URL}/pornstars`;
        log("Trying pornstars listing fallback");
        const listResponse = makeRequestNoThrow(pornstarsUrl, API_HEADERS, 'pornstars list');
        if (listResponse.isOk && listResponse.body) {
            const escapedSlug = normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`href=["']/([a-z0-9]+)/pornstar/${escapedSlug}`, 'i');
            const listMatch = listResponse.body.match(pattern);
            if (listMatch && listMatch[1]) {
                log("Found shortId via pornstars listing: " + listMatch[1]);
                localConfig.pornstarShortIds[normalizedSlug] = listMatch[1];
                return listMatch[1];
            }
        }
    } catch (e) {
        log("Pornstars listing fallback failed: " + e.message);
    }
    
    log("Could not resolve shortId for pornstar: " + normalizedSlug);
    return null;
}

function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    // Check for video-in-playlist URL format FIRST
    // e.g., https://spankbang.com/dqd68-svhe7y/playlist/asmr+joi
    // The video ID is the SECOND part after the hyphen (svhe7y)
    const videoInPlaylistMatch = url.match(REGEX_PATTERNS.urls.videoInPlaylist);
    if (videoInPlaylistMatch && videoInPlaylistMatch[2]) {
        log("Extracted video ID from video-in-playlist URL: " + videoInPlaylistMatch[2]);
        return videoInPlaylistMatch[2];
    }

    const patterns = [
        REGEX_PATTERNS.extraction.videoId,
        REGEX_PATTERNS.extraction.videoIdShort
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    throw new ScriptException(`Could not extract video ID from URL: ${url}`);
}

function extractChannelId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for channel ID extraction");
    }

    const channelInternalMatch = url.match(REGEX_PATTERNS.urls.channelInternal);
    if (channelInternalMatch && channelInternalMatch[1]) {
        return { type: 'channel', id: channelInternalMatch[1] };
    }

    const categoryInternalMatch = url.match(REGEX_PATTERNS.urls.categoryInternal);
    if (categoryInternalMatch && categoryInternalMatch[1]) {
        return { type: 'category', id: categoryInternalMatch[1] };
    }

    const profileInternalMatch = url.match(REGEX_PATTERNS.urls.profileInternal);
    if (profileInternalMatch && profileInternalMatch[1]) {
        if (profileInternalMatch[1].startsWith('pornstar:')) {
            return { type: 'pornstar', id: profileInternalMatch[1].replace('pornstar:', '') };
        }
        return { type: 'profile', id: profileInternalMatch[1] };
    }

    const channelOfficialMatch = url.match(REGEX_PATTERNS.urls.channelOfficial);
    if (channelOfficialMatch && channelOfficialMatch[1] && channelOfficialMatch[2]) {
        return { type: 'channel', id: `${channelOfficialMatch[1]}:${channelOfficialMatch[2]}` };
    }

    const relativeChannelMatch = url.match(REGEX_PATTERNS.urls.relativeChannel);
    if (relativeChannelMatch && relativeChannelMatch[1] && relativeChannelMatch[2]) {
        return { type: 'channel', id: `${relativeChannelMatch[1]}:${relativeChannelMatch[2]}` };
    }

    const pornstarMatch = url.match(REGEX_PATTERNS.urls.pornstar);
    if (pornstarMatch && pornstarMatch[1] && pornstarMatch[2]) {
        return { type: 'pornstar', id: pornstarMatch[2], shortId: pornstarMatch[1] };
    }

    const pornstarSimpleMatch = url.match(REGEX_PATTERNS.urls.pornstarSimple);
    if (pornstarSimpleMatch && pornstarSimpleMatch[1]) {
        return { type: 'pornstar', id: pornstarSimpleMatch[1] };
    }

    const relativePornstarMatch = url.match(REGEX_PATTERNS.urls.relativePornstar);
    if (relativePornstarMatch && relativePornstarMatch[1] && relativePornstarMatch[2]) {
        return { type: 'pornstar', id: relativePornstarMatch[2], shortId: relativePornstarMatch[1] };
    }

    const relativePornstarSimpleMatch = url.match(REGEX_PATTERNS.urls.relativePornstarSimple);
    if (relativePornstarSimpleMatch && relativePornstarSimpleMatch[1]) {
        return { type: 'pornstar', id: relativePornstarSimpleMatch[1] };
    }

    const channelProfileMatch = url.match(REGEX_PATTERNS.urls.channelProfile);
    if (channelProfileMatch && channelProfileMatch[1]) {
        return { type: 'profile', id: channelProfileMatch[1] };
    }

    const relativeProfileMatch = url.match(REGEX_PATTERNS.urls.relativeProfile);
    if (relativeProfileMatch && relativeProfileMatch[1]) {
        return { type: 'profile', id: relativeProfileMatch[1] };
    }

    // Check for category/tag URLs (like /s/japanese/)
    const categorySMatch = url.match(REGEX_PATTERNS.urls.categoryS);
    if (categorySMatch && categorySMatch[1]) {
        return { type: 'category', id: categorySMatch[1] };
    }

    const channelSMatch = url.match(REGEX_PATTERNS.urls.channelS);
    if (channelSMatch && channelSMatch[1]) {
        // This could be a category or tag - treat as category
        return { type: 'category', id: channelSMatch[1] };
    }

    const profileMatch = url.match(REGEX_PATTERNS.extraction.profileName);
    if (profileMatch && profileMatch[1]) {
        return { type: 'profile', id: profileMatch[1] };
    }

    throw new ScriptException(`Could not extract channel ID from URL: ${url}`);
}

function extractProfileId(url) {
    const result = extractChannelId(url);
    if (result.type === 'channel') {
        return `channel:${result.id}`;
    } else if (result.type === 'pornstar') {
        return `pornstar:${result.id}`;
    }
    return result.id;
}

function parseDuration(durationStr) {
    if (!durationStr) return 0;

    let totalSeconds = 0;

    if (typeof durationStr === 'number') {
        return durationStr;
    }
    
    const str = durationStr.toString().trim().toLowerCase();

    // Handle pure numeric strings (seconds only)
    const numericOnly = str.match(/^(\d+)$/);
    if (numericOnly) {
        return parseInt(numericOnly[1]);
    }
    
    // Handle simple formats like "16m", "1h", "45s", "1h 23m", "16m 30s"
    const simpleMatch = str.match(/^(\d+)\s*(h|m|s)(?:\s*(\d+)\s*(h|m|s))?(?:\s*(\d+)\s*(h|m|s))?$/);
    if (simpleMatch) {
        for (let i = 1; i < simpleMatch.length; i += 2) {
            if (simpleMatch[i] && simpleMatch[i + 1]) {
                const num = parseInt(simpleMatch[i]);
                const unit = simpleMatch[i + 1];
                if (unit === 'h') totalSeconds += num * 3600;
                else if (unit === 'm') totalSeconds += num * 60;
                else if (unit === 's') totalSeconds += num;
            }
        }
        if (totalSeconds > 0) return totalSeconds;
    }

    const colonMatch = str.match(/(\d+):(\d+)(?::(\d+))?/);
    if (colonMatch) {
        if (colonMatch[3]) {
            totalSeconds = parseInt(colonMatch[1]) * 3600 + parseInt(colonMatch[2]) * 60 + parseInt(colonMatch[3]);
        } else {
            totalSeconds = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
        }
        return totalSeconds;
    }

    const parts = str.match(REGEX_PATTERNS.parsing.duration);
    if (parts) {
        for (const part of parts) {
            const numericValue = parseInt(part);
            if (!isNaN(numericValue)) {
                if (part.includes('h')) {
                    totalSeconds += numericValue * 3600;
                } else if (part.includes('m')) {
                    totalSeconds += numericValue * 60;
                } else if (part.includes('s')) {
                    totalSeconds += numericValue;
                }
            }
        }
    }

    return totalSeconds;
}

// ===== Shared extraction helpers (duration, views, uploader display) =====

function extractAllDurationCandidatesFromContext(html, opts = {}) {
    const options = {
        excludeProgress: opts.excludeProgress !== false, // default true
        maxSeconds: typeof opts.maxSeconds === 'number' ? opts.maxSeconds : 24 * 60 * 60
    };

    if (!html || typeof html !== 'string') return [];

    const candidates = [];

    // 0) SpankBang NEW: data-testid="video-item-length" pattern (e.g., "16m", "1h 23m")
    const videoItemLengthPattern = /data-testid=["']video-item-length["'][^>]*>[\s\S]*?(\d+(?:h|m|s)[\s\d hms]*)<\/div>/gi;
    let vilMatch;
    while ((vilMatch = videoItemLengthPattern.exec(html)) !== null) {
        if (vilMatch[1]) {
            const parsed = parseDuration(vilMatch[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) {
                candidates.push(parsed);
            }
        }
    }
    
    // Also try simpler pattern for video-item-length
    const vilSimplePattern = /data-testid=["']video-item-length["'][^>]*>\s*(\d+[hms]?\s*\d*[hms]?)\s*<\/div>/gi;
    let vilSimple;
    while ((vilSimple = vilSimplePattern.exec(html)) !== null) {
        if (vilSimple[1]) {
            const parsed = parseDuration(vilSimple[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) {
                candidates.push(parsed);
            }
        }
    }

    // 1) Data attributes (often seconds)
    const dataAttrPatterns = [
        /data-duration=["']([^"']+)["']/gi,
        /data-length=["']([^"']+)["']/gi,
        /data-time=["']([^"']+)["']/gi
    ];

    for (const pattern of dataAttrPatterns) {
        let m;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(html)) !== null) {
            if (!m[1]) continue;
            const parsed = parseDuration(m[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
        }
    }

    // 2) itemprop/meta/JSON-LD PT duration formats
    const ptPattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/gi;
    let pt;
    while ((pt = ptPattern.exec(html)) !== null) {
        const h = parseInt(pt[1] || '0');
        const m = parseInt(pt[2] || '0');
        const s = parseInt(pt[3] || '0');
        const total = h * 3600 + m * 60 + s;
        if (total > 0 && total <= options.maxSeconds) candidates.push(total);
    }

    // 3) Common span patterns
    const spanPatterns = [
        /<span[^>]*class=["'][^"']*\bl\b[^"']*["'][^>]*>([^<]+)<\/span>/gi,
        /<span[^>]*class=["'][^"']*(?:duration|length|time)[^"']*["'][^>]*>([^<]+)<\/span>/gi
    ];

    for (const pattern of spanPatterns) {
        let m;
        pattern.lastIndex = 0;
        while ((m = pattern.exec(html)) !== null) {
            if (!m[1]) continue;
            const text = m[1].replace(/<[^>]*>/g, '').trim();
            const parsed = parseDuration(text);
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
        }
    }

    // 4) Any time-like tokens (MM:SS or HH:MM:SS)
    const timeToken = /\b\d{1,3}:\d{2}(?::\d{2})?\b/g;
    let match;
    while ((match = timeToken.exec(html)) !== null) {
        const token = match[0];
        if (!token) continue;

        if (options.excludeProgress) {
            const start = Math.max(0, match.index - 40);
            const end = Math.min(html.length, match.index + token.length + 40);
            const context = html.substring(start, end);
            if (/watched|progress|viewed|remaining|elapsed/i.test(context)) {
                continue;
            }
        }

        const parsed = parseDuration(token);
        if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
    }
    
    // 5) Short format like "16m" or "1h" standalone
    const shortDurationPattern = />\s*(\d+)\s*(h|m|s)\s*</gi;
    let shortMatch;
    while ((shortMatch = shortDurationPattern.exec(html)) !== null) {
        const num = parseInt(shortMatch[1]);
        const unit = shortMatch[2].toLowerCase();
        let seconds = 0;
        if (unit === 'h') seconds = num * 3600;
        else if (unit === 'm') seconds = num * 60;
        else if (unit === 's') seconds = num;
        
        if (seconds > 0 && seconds <= options.maxSeconds) {
            candidates.push(seconds);
        }
    }

    // De-dupe + basic sanity
    const uniq = Array.from(new Set(candidates)).filter(s => s >= 5);
    return uniq;
}

function extractBestDurationSecondsFromContext(html, opts = {}) {
    const preferLargest = opts.preferLargest !== false; // default true
    const candidates = extractAllDurationCandidatesFromContext(html, opts);
    if (!candidates || candidates.length === 0) return 0;

    if (preferLargest) {
        return candidates.reduce((a, b) => (b > a ? b : a), 0);
    }
    return candidates[0] || 0;
}

function extractViewCountFromContext(html) {
    if (!html) return 0;

    // PRIORITY 0: SpankBang NEW - look for md:text-body-md spans with view counts (playlist/channel pages)
    // Pattern: <span class="md:text-body-md">28K</span> or <span class="md:text-body-md">7.9K</span>
    // We need to find the one that's NOT inside data-testid="rates" (that's the rating %)
    const mdSpanPattern = /<span[^>]*class=["'][^"']*md:text-body-md[^"']*["'][^>]*>(\d+(?:[.,]\d+)?[KMB]?)<\/span>/gi;
    let mdMatch;
    while ((mdMatch = mdSpanPattern.exec(html)) !== null) {
        if (mdMatch[1]) {
            const text = mdMatch[1].trim();
            // Skip if it looks like a percentage (rating)
            if (text.includes('%')) continue;
            // Skip if surrounded by rating context
            const contextStart = Math.max(0, mdMatch.index - 100);
            const contextEnd = Math.min(html.length, mdMatch.index + mdMatch[0].length + 50);
            const context = html.substring(contextStart, contextEnd);
            if (/data-testid=["']rates["']|thumbs-up|rating|like/i.test(context)) continue;
            
            const parsed = parseViewCount(text);
            if (parsed > 0) {
                return parsed;
            }
        }
    }

    // PRIORITY 1: Look for data-testid="views" (SpankBang's new structure)
    // The view count number appears AFTER the icon span, so we need to look past it
    const dataTestIdPattern = /<span[^>]*data-testid=["']views["'][^>]*>[\s\S]*?<\/svg><\/span>[\s\S]*?(\d+(?:[,.]\d+)?[KMB]?)/i;
    const testIdMatch = html.match(dataTestIdPattern);
    if (testIdMatch && testIdMatch[1]) {
        const parsed = parseViewCount(testIdMatch[1].trim());
        if (parsed > 0) {
            return parsed;
        }
    }

    // PRIORITY 2: SpankBang specific - look for spans with class "v" (views) containing numbers
    const spanVPattern = /<span[^>]*class=["'][^"']*\bv\b[^"']*["'][^>]*>([^<]*\d+[^<]*)<\/span>/gi;
    let spanVMatch;
    while ((spanVMatch = spanVPattern.exec(html)) !== null) {
        const text = spanVMatch[1].replace(/<[^>]*>/g, '').trim();
        // Must contain a number
        if (/\d/.test(text)) {
            const parsed = parseViewCount(text);
            if (parsed > 0) {
                return parsed;
            }
        }
    }

    // PRIORITY 3: Simpler pattern - just find numbers near "views" text
    const nearViewsPattern = /(\d+(?:[,.]\d+)?[KMB]?)\s*<\/span>\s*<\/span>\s*<span[^>]*>\s*views?\b/i;
    const nearMatch = html.match(nearViewsPattern);
    if (nearMatch && nearMatch[1]) {
        const parsed = parseViewCount(nearMatch[1].trim());
        if (parsed > 0) {
            return parsed;
        }
    }

    // PRIORITY 4: Look for eye icon followed by number (common video view pattern)
    const eyeIconPattern = /(?:eye|visibility|views?)[^>]*>[\s\S]{0,50}?(\d+(?:[,.]\d+)?[KMB]?)/i;
    const eyeMatch = html.match(eyeIconPattern);
    if (eyeMatch && eyeMatch[1]) {
        const parsed = parseViewCount(eyeMatch[1].trim());
        if (parsed > 0) {
            return parsed;
        }
    }

    // PRIORITY 5: Look for patterns with "views" word
    const patterns = [
        // Class-based patterns
        /<span[^>]*class=["'][^"']*(?:views?|view-count)[^"']*["'][^>]*>([^<]+)<\/span>/i,
        
        // Generic view patterns with word boundaries
        /\b(\d+(?:[,.]\d+)?[KMB]?)\s*views?\b/i,
        /\bviews?\s*:?\s*(\d+(?:[,.]\d+)?[KMB]?)\b/i,
        
        // Common HTML structures
        /<div[^>]*class=["'][^"']*(?:views?|view-count)[^"']*["'][^>]*>[\s\S]*?(\d+(?:[,.]\d+)?[KMB]?)/i,
        /<li[^>]*class=["'][^"']*(?:views?|view-count)[^"']*["'][^>]*>[\s\S]*?(\d+(?:[,.]\d+)?[KMB]?)/i,
        
        // Fallback patterns
        />(\d{1,3}(?:[,.]\d{3})*[KMB]?)\s*views?</i,
        /(\d{1,3}(?:[,.]\d{3})*[KMB]?)\s*views?\s*$/mi
    ];

    for (const pattern of patterns) {
        const m = html.match(pattern);
        if (m && m[1]) {
            const viewStr = m[1].trim();
            const parsed = parseViewCount(viewStr);
            if (parsed > 0) {
                return parsed;
            }
        }
    }

    // Try to find view counts in a more flexible way
    const flexiblePattern = /(?:views?|watched|plays?)\s*:?\s*(\d+(?:[,.]\d+)?[KMB]?)|(\d+(?:[,.]\d+)?[KMB]?)\s*(?:views?|watched|plays?)/gi;
    let flexMatch;
    while ((flexMatch = flexiblePattern.exec(html)) !== null) {
        const viewStr = flexMatch[1] || flexMatch[2];
        if (viewStr) {
            const parsed = parseViewCount(viewStr.trim());
            if (parsed > 0) {
                return parsed;
            }
        }
    }

    return 0;
}

// Extract rating percentage from HTML (e.g., "93%" from data-testid="rates")
function extractRatingFromContext(html) {
    if (!html) return 0;
    
    // PRIORITY 1: Look for data-testid="rates" pattern with thumbs-up icon
    // <span data-testid="rates"...><span>thumbs-up icon</span><span class="md:text-body-md">93%</span></span>
    const ratesPattern = /data-testid=["']rates["'][^>]*>[\s\S]*?(\d+(?:\.\d+)?)\s*%/i;
    const ratesMatch = html.match(ratesPattern);
    if (ratesMatch && ratesMatch[1]) {
        const rating = parseFloat(ratesMatch[1]) / 100;
        if (rating > 0 && rating <= 1) {
            log("extractRatingFromContext: Found rating via data-testid=rates: " + ratesMatch[1] + "%");
            return rating;
        }
    }
    
    // PRIORITY 2: Look for thumbs-up icon followed by percentage
    const thumbsPattern = /thumbs-up[\s\S]{0,100}?(\d+(?:\.\d+)?)\s*%/i;
    const thumbsMatch = html.match(thumbsPattern);
    if (thumbsMatch && thumbsMatch[1]) {
        const rating = parseFloat(thumbsMatch[1]) / 100;
        if (rating > 0 && rating <= 1) {
            log("extractRatingFromContext: Found rating via thumbs-up icon: " + thumbsMatch[1] + "%");
            return rating;
        }
    }
    
    // PRIORITY 3: Look for percentage in span after like/rating text
    const percentPatterns = [
        /like[^>]*>[\s\S]{0,30}?<span[^>]*>(\d+(?:\.\d+)?)\s*%<\/span>/i,
        /<span[^>]*>(\d+(?:\.\d+)?)\s*%<\/span>[\s\S]{0,30}?like/i,
        /(\d+(?:\.\d+)?)\s*%[\s\S]{0,20}?(?:like|rating|approval)/i,
        /(?:like|rating|approval)[\s\S]{0,20}?(\d+(?:\.\d+)?)\s*%/i
    ];
    
    for (const pattern of percentPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            const rating = parseFloat(match[1]) / 100;
            if (rating > 0 && rating <= 1) {
                log("extractRatingFromContext: Found rating via percent pattern: " + match[1] + "%");
                return rating;
            }
        }
    }
    
    // PRIORITY 4: Just look for percentage in md:text-body-md spans (inside rates context)
    const mdSpanPattern = /<span[^>]*class=["'][^"']*md:text-body-md[^"']*["'][^>]*>(\d+(?:\.\d+)?)\s*%<\/span>/gi;
    let mdMatch;
    while ((mdMatch = mdSpanPattern.exec(html)) !== null) {
        if (mdMatch[1]) {
            // Check if it's in a rates context
            const contextStart = Math.max(0, mdMatch.index - 150);
            const context = html.substring(contextStart, mdMatch.index);
            if (/data-testid=["']rates["']|thumbs-up|rating|like/i.test(context)) {
                const rating = parseFloat(mdMatch[1]) / 100;
                if (rating > 0 && rating <= 1) {
                    log("extractRatingFromContext: Found rating via md:text-body-md: " + mdMatch[1] + "%");
                    return rating;
                }
            }
        }
    }
    
    // PRIORITY 5: Look for any standalone percentage that looks like a rating (50-100%)
    const anyPercentPattern = />(\d{2,3})\s*%</g;
    let anyMatch;
    while ((anyMatch = anyPercentPattern.exec(html)) !== null) {
        const percent = parseInt(anyMatch[1]);
        if (percent >= 50 && percent <= 100) {
            // Check context to make sure it's rating-related
            const start = Math.max(0, anyMatch.index - 100);
            const end = Math.min(html.length, anyMatch.index + 100);
            const context = html.substring(start, end).toLowerCase();
            if (context.includes('like') || context.includes('rate') || context.includes('thumb') || context.includes('vote')) {
                log("extractRatingFromContext: Found rating via standalone percent: " + percent + "%");
                return percent / 100;
            }
        }
    }
    
    return 0;
}

function isLikelyBadUploaderName(name, channelSlug = "") {
    if (!name) return true;
    const trimmed = name.toString().replace(/<[^>]*>/g, '').trim();
    if (trimmed.length === 0) return true;

    // Common non-name strings seen in UI
    if (/^\d+\s*videos?$/i.test(trimmed)) return true;
    if (/^\d+\s*views?$/i.test(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;

    // Only filter out the most obvious tags - be more permissive
    const obviouslyBad = [
        'HD', '4K', 'VR', 'POV', 'NEW', 'HOT', 'TOP', 'PREMIUM', 'VERIFIED',
        // Only filter out very generic category terms
        'AMATEUR', 'PROFESSIONAL', 'HOMEMADE', 'WEBCAM', 'CASTING'
    ];
    
    if (obviouslyBad.includes(trimmed.toUpperCase())) return true;

    // Check for very obvious tag patterns only
    if (/^(HD|4K|VR|POV)$/i.test(trimmed)) return true;
    if (/^\d+[KMB]?\s*views?$/i.test(trimmed)) return true;
    if (/^\d+\s*videos?$/i.test(trimmed)) return true;

    // If it's a very short single word that looks generic, might be a tag
    if (trimmed.length <= 2) return true;

    // Be less strict - allow most names through unless they're obviously bad
    return false;
}

function findTitleForChannelLink(html, shortId, channelSlug) {
    if (!html || !shortId || !channelSlug) return "";
    const escapedSlug = channelSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedId = shortId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const pattern = new RegExp(`href=["']\\/${escapedId}\\/channel\\/${escapedSlug}\\/?[^"']*["'][^>]*title=["']([^"']+)["']`, 'i');
    const m = html.match(pattern);
    return m && m[1] ? m[1].trim() : "";
}


function parseViewCount(viewsStr) {
    if (!viewsStr) return 0;

    viewsStr = viewsStr.toString().trim().toLowerCase();

    const multipliers = {
        'k': 1000,
        'm': 1000000,
        'b': 1000000000
    };

    for (const [suffix, multiplier] of Object.entries(multipliers)) {
        if (viewsStr.includes(suffix)) {
            const num = parseFloat(viewsStr.replace(/[^0-9.]/g, ''));
            return Math.floor(num * multiplier);
        }
    }

    return parseInt(viewsStr.replace(/[,.\s]/g, '')) || 0;
}

function parseRelativeDate(dateStr) {
    if (!dateStr) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    const lowerDateStr = dateStr.toLowerCase().trim();
    
    const relativeMatch = lowerDateStr.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
    if (relativeMatch) {
        const num = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2].toLowerCase();
        
        const multipliers = {
            'second': 1,
            'minute': 60,
            'hour': 3600,
            'day': 86400,
            'week': 604800,
            'month': 2592000,
            'year': 31536000
        };
        
        if (multipliers[unit]) {
            return now - (num * multipliers[unit]);
        }
    }
    
    if (lowerDateStr.includes('just now') || lowerDateStr.includes('moments ago')) {
        return now;
    }
    if (lowerDateStr.includes('yesterday')) {
        return now - 86400;
    }
    if (lowerDateStr.includes('today')) {
        return now;
    }
    
    try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return Math.floor(parsed.getTime() / 1000);
        }
    } catch (e) {}
    
    return 0;
}

function extractAvatarFromHtml(html) {
    const avatarPatterns = [
        /src="(https?:\/\/spankbang\.com\/pornstarimg\/[^"]+)"/i,
        /src="(https?:\/\/[^"]*spankbang[^"]*\/avatar\/[^"]+)"/i,
        /src="(\/\/spankbang\.com\/avatar\/[^"]+)"/i,
        /<img[^>]*src="(\/avatar\/[^"]+)"/i,
        /src="(https?:\/\/[^"]+\/pornstarimg\/[^"]+)"/i
    ];

    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let avatarUrl = match[1];
            if (avatarUrl.startsWith('//')) {
                return `https:${avatarUrl}`;
            }
            return avatarUrl.startsWith('http') ? avatarUrl : `https://spankbang.com${avatarUrl}`;
        }
    }
    return "";
}

function extractPornstarAvatarFromHtml(html, pornstarSlug) {
    const patterns = [
        // Look for pornstar images in links or surrounding context
        new RegExp(`href="[^"]*pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]*?<img[^>]*(?:data-src|src)="(https?://[^"]*pornstarimg[^"]+)"`, 'i'),
        new RegExp(`<img[^>]*(?:data-src|src)="(https?://[^"]*pornstarimg[^"]+)"[\\s\\S]*?href="[^"]*pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'),
        // Standard pornstar image patterns
        /src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
        /data-src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
        /<img[^>]*(?:data-src|src)="(https?:\/\/spankbang\.com\/pornstarimg\/[^"]+)"/i,
        // Alternative CDN patterns
        /src="(https?:\/\/[^"]*spankbang[^"]*pornstarimg[^"]+)"/i,
        /data-src="(https?:\/\/[^"]*spankbang[^"]*pornstarimg[^"]+)"/i,
        // Lazy loading patterns
        /data-original="(https?:\/\/[^"]*pornstarimg[^"]+)"/i,
        /data-lazy="(https?:\/\/[^"]*pornstarimg[^"]+)"/i
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let avatarUrl = match[1];
            // Ensure proper protocol
            if (avatarUrl.startsWith('//')) {
                avatarUrl = `https:${avatarUrl}`;
            } else if (!avatarUrl.startsWith('http')) {
                avatarUrl = `https://spankbang.com${avatarUrl}`;
            }
            return avatarUrl;
        }
    }
    
    // Generate fallback pornstar avatar URL if we have a slug
    if (pornstarSlug) {
        // Try to generate a pornstar image URL (this is speculative but follows common patterns)
        return `${CONFIG.PORNSTAR_IMG_BASE}${pornstarSlug.toLowerCase().replace(/[^a-z0-9]/g, '')}-250.jpg`;
    }
    
    return "";
}

function extractUploaderFromVideoToolbar(html) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    // DEBUG: Log what HTML sections we're searching
    const toolbarMatch = html.match(/<ul[^>]*class="[^"]*video_toolbar[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
    const toolbarHtml = toolbarMatch ? toolbarMatch[1] : "";
    
    const infoSectionMatch = html.match(/<div[^>]*class="[^"]*info[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    const infoHtml = infoSectionMatch ? infoSectionMatch[1] : "";

    // NEW: Look for uploader-specific section in SpankBang's new structure
    // The uploader info is in a div with data-testid="uploader" or class containing "uploader"
    const uploaderSectionMatch = html.match(/<div[^>]*(?:data-testid="uploader"|class="[^"]*uploader[^"]*")[^>]*>([\s\S]*?)<\/div>/i);
    const uploaderHtml = uploaderSectionMatch ? uploaderSectionMatch[1] : "";
    
    // Also look for the video info section
    const videoInfoMatch = html.match(/<div[^>]*class="[^"]*video-info[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const videoInfoHtml = videoInfoMatch ? videoInfoMatch[1] : "";
    
    log("extractUploaderFromVideoToolbar: toolbarHtml length=" + toolbarHtml.length + ", infoHtml length=" + infoHtml.length + ", uploaderHtml length=" + uploaderHtml.length);
    
    // DEBUG: Find ALL profile links in the page to understand what's available
    const allProfileLinks = html.match(/href="\/profile\/[^"]+"/gi) || [];
    const allChannelLinks = html.match(/href="\/[a-z0-9]+\/channel\/[^"]+"/gi) || [];
    log("extractUploaderFromVideoToolbar: Found " + allProfileLinks.length + " profile links and " + allChannelLinks.length + " channel links in full HTML");
    if (allProfileLinks.length > 0) {
        log("extractUploaderFromVideoToolbar: First 3 profile links: " + allProfileLinks.slice(0, 3).join(' | '));
    }

    const uploaderPatterns = [
        {
            // PRIORITY 0: Profile with class="ul" and span.name (SpankBang video page structure)
            // <a href="/profile/username" class="ul">...<span class="name">Username</span>...</a>
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*class="[^"]*ul[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'profile_ul'
        },
        {
            // Profile with avatar (MOST ACCURATE for user uploads)
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'profile'
        },
        {
            // Profile with title attribute
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*title="([^"]+)"[^>]*>/i,
            type: 'profile_title'
        },
        {
            // Profile with span.name inside (no trailing slash required)
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'profile_name_span'
        },
        {
            // Profile in uploader/user context
            pattern: /<li[^>]*class="[^"]*(?:uploader|user)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?(?:<img[^>]*(?:data-src|src)="([^"]+)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'profile'
        },
        {
            // Priority: Check for title attribute with channel name
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*title="([^"]+)"[^>]*>/i,
            type: 'channel_title'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<li[^>]*class="[^"]*(?:channel|uploader|user)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?(?:<img[^>]*(?:data-src|src)="([^"]+)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'channel'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            type: 'pornstar'
        },
        {
            pattern: /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i,
            type: 'pornstar'
        },
        {
            // NEW: Simple profile link with span (SpankBang new structure)
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
            type: 'profile_span'
        },
        {
            // NEW: Profile link as the first link in an uploader context
            pattern: /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>([^<]+)<\/a>/i,
            type: 'profile_simple'
        }
    ];

    // IMPORTANT: Search uploader-specific sections FIRST, then general HTML
    // This ensures we find the ACTUAL uploader, not related video channels
    const searchHtmls = [uploaderHtml, videoInfoHtml, toolbarHtml, infoHtml];
    
    // First pass: Search in specific uploader sections
    for (const searchHtml of searchHtmls) {
        if (!searchHtml || searchHtml.length < 10) continue;
        
        for (const { pattern, type } of uploaderPatterns) {
            const match = searchHtml.match(pattern);
            if (match) {
                let avatarUrl = "";
                
                if (type === 'profile_title') {
                    uploader.name = match[2].trim();
                    uploader.url = `spankbang://profile/${match[1]}`;
                    uploader.avatar = extractAvatarFromHtml(searchHtml);
                    log("extractUploaderFromVideoToolbar: Found PROFILE (title): " + uploader.name);
                    return uploader;
                }
                
                // Handle profile_ul and profile_name_span types (new SpankBang video page structure)
                if (type === 'profile_ul' || type === 'profile_name_span') {
                    uploader.name = match[2].replace(/<[^>]*>/g, '').trim();
                    uploader.url = `spankbang://profile/${match[1]}`;
                    uploader.avatar = extractAvatarFromHtml(searchHtml);
                    if (uploader.name && uploader.name.length > 0) {
                        log("extractUploaderFromVideoToolbar: Found PROFILE (" + type + "): " + uploader.name);
                        return uploader;
                    }
                }
                
                if (type === 'profile' || type === 'profile_span' || type === 'profile_simple') {
                    const nameIndex = type === 'profile' ? 3 : 2;
                    uploader.name = (match[nameIndex] || match[1]).replace(/<[^>]*>/g, '').trim();
                    uploader.url = `spankbang://profile/${match[1]}`;
                    if (type === 'profile' && match[2]) {
                        avatarUrl = match[2];
                        if (avatarUrl.startsWith('//')) avatarUrl = `https:${avatarUrl}`;
                        else if (!avatarUrl.startsWith('http')) avatarUrl = `https://spankbang.com${avatarUrl}`;
                    }
                    uploader.avatar = avatarUrl || extractAvatarFromHtml(searchHtml);
                    if (uploader.name && uploader.name.length > 0) {
                        log("extractUploaderFromVideoToolbar: Found PROFILE (" + type + "): " + uploader.name);
                        return uploader;
                    }
                }
                
                if (type === 'channel_title') {
                    uploader.name = match[3].trim();
                    uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
                    uploader.avatar = extractChannelAvatarNearLink(searchHtml, match[1], match[2]) || extractAvatarFromHtml(searchHtml);
                    log("extractUploaderFromVideoToolbar: Found CHANNEL (title): " + uploader.name);
                    return uploader;
                }
                
                avatarUrl = match[3] || "";
                if (avatarUrl.startsWith('//')) {
                    avatarUrl = `https:${avatarUrl}`;
                } else if (avatarUrl && !avatarUrl.startsWith('http')) {
                    avatarUrl = `https://spankbang.com${avatarUrl}`;
                }

                if (type === 'channel') {
                    let channelName = (match[4] || "").replace(/<[^>]*>/g, '').trim();
                    const channelSlug = match[2];
                    
                    // Validate: reject if channelName is likely a tag or count label
                    if (isLikelyBadUploaderName(channelName, channelSlug)) {
                        // Prefer the link title attribute (often holds the real channel name)
                        const titleName = findTitleForChannelLink(html, match[1], channelSlug);
                        if (titleName && !isLikelyBadUploaderName(titleName, channelSlug)) {
                            channelName = titleName;
                        } else {
                            // Use channel slug as fallback
                            channelName = channelSlug.replace(/[+\-_]/g, ' ').trim();
                            channelName = channelName.charAt(0).toUpperCase() + channelName.slice(1);
                        }
                    }
                    
                    uploader.name = channelName;
                    uploader.url = `spankbang://channel/${match[1]}:${match[2]}`;
                    uploader.avatar = avatarUrl;
                } else if (type === 'pornstar') {
                    uploader.name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
                    uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                    uploader.avatar = avatarUrl || extractPornstarAvatarFromHtml(html, match[2]);
                }
                
                if (uploader.name && uploader.name.length > 0) {
                    if (!uploader.avatar) {
                        uploader.avatar = fetchUploaderAvatarIfNeeded(uploader, html);
                    }
                    return uploader;
                }
            }
        }
    }

    // PRIORITY 0: Try profile patterns FIRST (most accurate for user uploads)
    const simpleProfilePatterns = [
        // SpankBang video page: <a href="/profile/username" class="ul"><span class="name">Username</span></a>
        /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*class="[^"]*ul[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
        // Profile with span.name inside
        /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
        /href="\/profile\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*title="([^"]+)"[^>]*href="\/profile\/([^"]+)"/i,
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of simpleProfilePatterns) {
        const match = html.match(pattern);
        if (match) {
            let profileName = "";
            let profileSlug = "";
            
            // Different patterns have different capture group orders
            if (pattern.source.includes('title="([^"]+)"[^>]*href')) {
                // Pattern: title="Name" href="/profile/slug"
                profileName = match[1];
                profileSlug = match[2];
            } else if (pattern.source.includes('href="[^"]*profile.*title="')) {
                // Pattern: href="/profile/slug" title="Name"
                profileSlug = match[1];
                profileName = match[2];
            } else {
                // Pattern: href="/profile/slug">Name</a>
                profileSlug = match[1];
                profileName = match[2];
            }
            
            profileName = profileName.replace(/<[^>]*>/g, '').trim();
            
            if (profileName && profileName.length > 0 && !isLikelyBadUploaderName(profileName)) {
                uploader.name = profileName;
                uploader.url = `spankbang://profile/${profileSlug}`;
                uploader.avatar = extractAvatarFromHtml(html);
                log("extractUploaderFromVideoToolbar: Found PROFILE (simple): " + profileName);
                return uploader;
            }
        }
    }

    // IMPORTANT: Only search for channels in full HTML if no profile was found
    // Profiles take priority because they represent actual uploaders
    // Channels in full HTML are often from related videos, not the actual uploader
    log("extractUploaderFromVideoToolbar: No profile found, checking for channels (may be from related videos)");
    
    const simpleChannelPatterns = [
        // Priority 1: Title attribute (most reliable for channel name)
        /href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*title="([^"]+)"[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"/i,
        // Priority 2: Span inside link (actual displayed name)
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        // Priority 3: Class with name indicator
        /class="[^"]*n[^"]*"[^>]*><a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        // Priority 4: Direct link text (may be tag, so validate)
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of simpleChannelPatterns) {
        const match = html.match(pattern);
        if (match) {
            let channelName = "";
            let shortId = "";
            let channelSlug = "";
            
            // Different patterns have different capture group orders
            if (pattern.source.includes('title="([^"]+)"[^>]*href')) {
                // Pattern: title="Name" href="/id/channel/slug"
                channelName = match[1];
                shortId = match[2];
                channelSlug = match[3];
            } else if (pattern.source.includes('href=".*title="')) {
                // Pattern: href="/id/channel/slug" title="Name"
                shortId = match[1];
                channelSlug = match[2];
                channelName = match[3];
            } else {
                // Pattern: href="/id/channel/slug">Name</a>
                shortId = match[1];
                channelSlug = match[2];
                channelName = match[3];
            }
            
            channelName = channelName.replace(/<[^>]*>/g, '').trim();
            
            // Validate: reject if channelName is likely a tag/count label and fallback cleanly
            if (isLikelyBadUploaderName(channelName, channelSlug)) {
                const titleName = findTitleForChannelLink(html, shortId, channelSlug);
                if (titleName && !isLikelyBadUploaderName(titleName, channelSlug)) {
                    channelName = titleName;
                } else {
                    // Use channel slug as fallback (capitalize first letter)
                    channelName = channelSlug.replace(/[+\-_]/g, ' ').trim();
                    channelName = channelName.charAt(0).toUpperCase() + channelName.slice(1);
                }
            }
            
            if (channelName && channelName.length > 0) {
                uploader.name = channelName;
                uploader.url = `spankbang://channel/${shortId}:${channelSlug}`;
                uploader.avatar = extractChannelAvatarNearLink(html, shortId, channelSlug) || extractAvatarFromHtml(html);
                return uploader;
            }
        }
    }

    const simplePornstarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /class="[^"]*n[^"]*"[^>]*><a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of simplePornstarPatterns) {
        const match = html.match(pattern);
        if (match) {
            uploader.name = match[3].replace(/<[^>]*>/g, '').trim();
            uploader.url = `spankbang://profile/pornstar:${match[2]}`;
            uploader.avatar = extractPornstarAvatarFromHtml(html, match[2]) || extractAvatarFromHtml(html);
            return uploader;
        }
    }

    return uploader;
}

function extractChannelAvatarNearLink(html, shortId, channelName) {
    // First check cache
    const cacheKey = `${shortId}:${channelName}`;
    if (localConfig.channelAvatars && localConfig.channelAvatars[cacheKey]) {
        return localConfig.channelAvatars[cacheKey];
    }
    
    const patterns = [
        // Look for images before channel links
        new RegExp(`<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>[\\s\\S]{0,300}href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'),
        // Look for images after channel links
        new RegExp(`href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,300}<img[^>]*(?:data-src|src)="([^"]+)"`, 'i'),
        // Look for images within channel link containers
        new RegExp(`class="[^"]*(?:thumb|avatar|pic|channel)[^"]*"[^>]*>[\\s\\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>[\\s\\S]*?href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'),
        // Reverse order
        new RegExp(`href="/${shortId}/channel/${channelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*>[\\s\\S]*?class="[^"]*(?:thumb|avatar|pic|channel)[^"]*"`, 'i'),
        // Look for any image near channel context
        new RegExp(`channel[\\s\\S]{0,200}<img[^>]*(?:data-src|src)="([^"]+)"`, 'i'),
        new RegExp(`<img[^>]*(?:data-src|src)="([^"]+)"[\\s\\S]{0,200}channel`, 'i')
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let avatar = match[1];
            
            // Skip obvious non-avatar images
            if (avatar.includes('video') || avatar.includes('thumb') && !avatar.includes('avatar')) {
                continue;
            }
            
            // Ensure proper protocol and domain
            if (avatar.startsWith('//')) {
                avatar = 'https:' + avatar;
            } else if (!avatar.startsWith('http')) {
                avatar = 'https://spankbang.com' + avatar;
            }
            
            // Validate it looks like a reasonable avatar URL
            if (avatar.includes('.jpg') || avatar.includes('.png') || avatar.includes('.webp') || 
                avatar.includes('avatar') || avatar.includes('profile')) {
                // Cache it
                if (localConfig.channelAvatars) {
                    localConfig.channelAvatars[cacheKey] = avatar;
                }
                return avatar;
            }
        }
    }
    
    return "";
}

// Fetch channel avatar from the channel page itself
function fetchChannelAvatar(shortId, channelSlug) {
    const cacheKey = `${shortId}:${channelSlug}`;
    
    // Check cache first
    if (localConfig.channelAvatars && localConfig.channelAvatars[cacheKey]) {
        return localConfig.channelAvatars[cacheKey];
    }
    
    try {
        const channelUrl = `${BASE_URL}/${shortId}/channel/${channelSlug}/`;
        log("fetchChannelAvatar: Fetching avatar from " + channelUrl);
        
        const response = makeRequestNoThrow(channelUrl, API_HEADERS, 'channel avatar');
        
        if (!response.isOk || !response.body) {
            log("fetchChannelAvatar: Failed to fetch channel page");
            return "";
        }
        
        const html = response.body;
        
        // Look for avatar in channel page - multiple patterns
        const avatarPatterns = [
            // data-testid="profile-detail-image" pattern (from user's example)
            /<img[^>]*data-testid=["']profile-detail-image["'][^>]*src=["']([^"']+)["']/i,
            /<img[^>]*src=["']([^"']+)["'][^>]*data-testid=["']profile-detail-image["']/i,
            // Avatar in profile section
            /<img[^>]*class=["'][^"']*(?:profile|avatar)[^"']*["'][^>]*src=["']([^"']+)["']/i,
            // Channel avatar URL pattern
            /src=["']((?:https?:)?\/\/spankbang\.com\/avatar\/\d+\/channel_\d+\.jpg)["']/i,
            /src=["']([^"']*\/avatar\/[^"']+)["']/i,
            // Any image with avatar in URL
            /(?:data-src|src)=["']([^"']*avatar[^"']*\.(?:jpg|png|webp))["']/i
        ];
        
        for (const pattern of avatarPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let avatar = match[1];
                
                // Ensure proper protocol
                if (avatar.startsWith('//')) {
                    avatar = 'https:' + avatar;
                } else if (!avatar.startsWith('http')) {
                    avatar = 'https://spankbang.com' + avatar;
                }
                
                log("fetchChannelAvatar: Found avatar for " + channelSlug + ": " + avatar);
                
                // Cache it
                if (!localConfig.channelAvatars) {
                    localConfig.channelAvatars = {};
                }
                localConfig.channelAvatars[cacheKey] = avatar;
                
                return avatar;
            }
        }
        
        log("fetchChannelAvatar: No avatar found for " + channelSlug);
        return "";
        
    } catch (e) {
        log("fetchChannelAvatar: Error - " + e.message);
        return "";
    }
}

// Fetch pornstar avatar from their page
function fetchPornstarAvatar(pornstarSlug) {
    // Check cache first
    const cacheKey = `pornstar:${pornstarSlug}`;
    if (localConfig.channelAvatars && localConfig.channelAvatars[cacheKey]) {
        return localConfig.channelAvatars[cacheKey];
    }
    
    try {
        // First try to resolve the shortId
        const shortId = resolvePornstarShortId(pornstarSlug);
        
        let pornstarUrl;
        if (shortId) {
            pornstarUrl = `${BASE_URL}/${shortId}/pornstar/${pornstarSlug}/`;
        } else {
            pornstarUrl = `${BASE_URL}/pornstar/${pornstarSlug}/`;
        }
        
        log("fetchPornstarAvatar: Fetching avatar from " + pornstarUrl);
        
        const response = makeRequestNoThrow(pornstarUrl, API_HEADERS, 'pornstar avatar');
        
        if (!response.isOk || !response.body) {
            log("fetchPornstarAvatar: Failed to fetch pornstar page");
            return "";
        }
        
        const html = response.body;
        
        // Look for avatar patterns
        const avatarPatterns = [
            /<img[^>]*data-testid=["']profile-detail-image["'][^>]*src=["']([^"']+)["']/i,
            /<img[^>]*src=["']([^"']+)["'][^>]*data-testid=["']profile-detail-image["']/i,
            /src=["']((?:https?:)?\/\/spankbang\.com\/pornstarimg\/[^"']+)["']/i,
            /src=["']([^"']*pornstarimg[^"']*\.(?:jpg|png|webp))["']/i,
            /<img[^>]*class=["'][^"']*(?:profile|avatar)[^"']*["'][^>]*src=["']([^"']+)["']/i
        ];
        
        for (const pattern of avatarPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let avatar = match[1];
                
                if (avatar.startsWith('//')) {
                    avatar = 'https:' + avatar;
                } else if (!avatar.startsWith('http')) {
                    avatar = 'https://spankbang.com' + avatar;
                }
                
                log("fetchPornstarAvatar: Found avatar for " + pornstarSlug + ": " + avatar);
                
                // Cache it
                if (!localConfig.channelAvatars) {
                    localConfig.channelAvatars = {};
                }
                localConfig.channelAvatars[cacheKey] = avatar;
                
                return avatar;
            }
        }
        
        log("fetchPornstarAvatar: No avatar found for " + pornstarSlug);
        return "";
        
    } catch (e) {
        log("fetchPornstarAvatar: Error - " + e.message);
        return "";
    }
}

function fetchUploaderAvatarIfNeeded(uploader, html) {
    if (uploader.avatar) return uploader.avatar;
    
    if (uploader.url.includes('pornstar:')) {
        const pornstarSlug = uploader.url.split('pornstar:')[1];
        if (pornstarSlug) {
            return extractPornstarAvatarFromHtml(html, pornstarSlug);
        }
    }
    
    if (uploader.url.includes('channel/')) {
        const parts = uploader.url.split('/');
        const channelId = parts[parts.length - 1];
        if (channelId && channelId.includes(':')) {
            const [shortId, channelName] = channelId.split(':');
            // First try to extract from current HTML
            let avatar = extractChannelAvatarNearLink(html, shortId, channelName);
            if (!avatar) {
                // If not found, fetch from channel page
                avatar = fetchChannelAvatar(shortId, channelName);
            }
            return avatar;
        }
    }
    
    return extractAvatarFromHtml(html);
}

// Fetch profile user avatar from their profile page
function fetchProfileAvatar(username) {
    const cacheKey = `profile:${username}`;
    
    // Check cache first
    if (localConfig.channelAvatars && localConfig.channelAvatars[cacheKey]) {
        return localConfig.channelAvatars[cacheKey];
    }
    
    try {
        const profileUrl = `${BASE_URL}/profile/${username}/`;
        log("fetchProfileAvatar: Fetching avatar from " + profileUrl);
        
        const response = makeRequestNoThrow(profileUrl, API_HEADERS, 'profile avatar');
        
        if (!response.isOk || !response.body) {
            log("fetchProfileAvatar: Failed to fetch profile page");
            return "";
        }
        
        const html = response.body;
        
        // Look for avatar patterns
        // Pattern from user: <img class="avatar" src="//spankbang.com/avatar/150/680954.jpg" alt="username">
        const avatarPatterns = [
            /<img[^>]*class=["'][^"']*avatar[^"']*["'][^>]*src=["']([^"']+)["']/i,
            /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*avatar[^"']*["']/i,
            /src=["']((?:https?:)?\/\/spankbang\.com\/avatar\/\d+\/\d+\.jpg)["']/i,
            /src=["']([^"']*\/avatar\/\d+\/[^"']+)["']/i,
            /<img[^>]*data-testid=["']profile-detail-image["'][^>]*src=["']([^"']+)["']/i
        ];
        
        for (const pattern of avatarPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let avatar = match[1];
                
                if (avatar.startsWith('//')) {
                    avatar = 'https:' + avatar;
                } else if (!avatar.startsWith('http')) {
                    avatar = 'https://spankbang.com' + avatar;
                }
                
                log("fetchProfileAvatar: Found avatar for " + username + ": " + avatar);
                
                // Cache it
                if (!localConfig.channelAvatars) {
                    localConfig.channelAvatars = {};
                }
                localConfig.channelAvatars[cacheKey] = avatar;
                
                return avatar;
            }
        }
        
        log("fetchProfileAvatar: No avatar found for " + username);
        return "";
        
    } catch (e) {
        log("fetchProfileAvatar: Error - " + e.message);
        return "";
    }
}

// Fetch the REAL uploader from a video page (not pornstar/tag shown in search)
// This is called when we detect the uploader in search is a pornstar or missing
function fetchRealUploaderFromVideoPage(videoId, videoSlug) {
    const cacheKey = `uploader:${videoId}`;
    
    // Check cache first
    if (localConfig.channelAvatars && localConfig.channelAvatars[cacheKey]) {
        try {
            return JSON.parse(localConfig.channelAvatars[cacheKey]);
        } catch (e) {}
    }
    
    try {
        const videoUrl = `${BASE_URL}/${videoId}/video/${videoSlug}/`;
        log("fetchRealUploaderFromVideoPage: Fetching from " + videoUrl);
        
        const response = makeRequestNoThrow(videoUrl, API_HEADERS, 'video uploader');
        
        if (!response.isOk || !response.body) {
            log("fetchRealUploaderFromVideoPage: Failed to fetch video page");
            return null;
        }
        
        const html = response.body;
        
        // Look for profile link: <a href="/profile/username" class="ul">...<span class="name">Username</span>...</a>
        const profilePatterns = [
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*class="[^"]*ul[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            /<a[^>]*class="[^"]*ul[^"]*"[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i
        ];
        
        for (const pattern of profilePatterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[2]) {
                const username = match[1];
                const name = match[2].replace(/<[^>]*>/g, '').trim();
                
                if (name && name.length > 0) {
                    // Look for avatar
                    const avatarMatch = html.match(/<img[^>]*class=["'][^"']*avatar[^"']*["'][^>]*src=["']([^"']+)["'][^>]*alt=["'][^"']*["']/i);
                    let avatar = "";
                    if (avatarMatch && avatarMatch[1]) {
                        avatar = avatarMatch[1];
                        if (avatar.startsWith('//')) avatar = 'https:' + avatar;
                    }
                    
                    const uploader = {
                        name: name,
                        url: `spankbang://profile/${username}`,
                        avatar: avatar
                    };
                    
                    log("fetchRealUploaderFromVideoPage: Found uploader " + name + " for video " + videoId);
                    
                    // Cache it
                    if (!localConfig.channelAvatars) {
                        localConfig.channelAvatars = {};
                    }
                    localConfig.channelAvatars[cacheKey] = JSON.stringify(uploader);
                    
                    return uploader;
                }
            }
        }
        
        log("fetchRealUploaderFromVideoPage: No profile uploader found for video " + videoId);
        return null;
        
    } catch (e) {
        log("fetchRealUploaderFromVideoPage: Error - " + e.message);
        return null;
    }
}

function extractUploaderFromSearchResult(block) {
    // CRITICAL: SpankBang's home page often shows TAGS instead of uploaders
    // We need to SKIP anything marked with data-badge="tag" or /s/ links
    
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    // FIRST: Check if this block has REAL uploader info (not tags)
    // Real uploaders have channel/profile/pornstar links with specific URL patterns:
    // - /profile/username
    // - /shortId/channel/channelname
    // - /shortId/pornstar/pornstarname
    // Tags use /s/tagname/ format which should NOT be treated as uploaders
    
    // Check for real uploader patterns
    const hasRealUploader = /<a[^>]*href=["']\/(?:profile\/[^"\/]+|[a-z0-9]+\/(?:channel|pornstar)\/[^"]+)["']/i.test(block);
    
    // Check for tag patterns
    const hasTagBadge = /<span[^>]*data-badge=["']tag["'][^>]*>/i.test(block);
    const hasOnlyTagLinks = /<a[^>]*href=["']\/s\/[^"]+["']/i.test(block) && !hasRealUploader;
    
    // Skip if we detect this is a tag-only block (no real uploader links)
    if (!hasRealUploader && (hasTagBadge || hasOnlyTagLinks)) {
        log("extractUploaderFromSearchResult: Block only has tags or /s/ links, no real uploader");
        return uploader; // Return empty - no uploader available
    }
    
    // Additional check: if a block has /s/ links but NO real uploader links, skip it
    if (!hasRealUploader) {
        log("extractUploaderFromSearchResult: No real uploader link patterns found in block");
        return uploader;
    }

    // PRIORITY 0: Look for PROFILE links FIRST (most accurate for user uploads)
    // SpankBang NEW structure: <a href="/profile/username/"><span class="...">Name</span></a>
    // Also check for data-badge="profile" pattern
    const profileWithSpanPatterns = [
        // Profile with data-badge="profile" indicator 
        /<span[^>]*data-badge=["']profile["'][^>]*>[\s\S]*?<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        // Profile with data-testid="title"
        /<a[^>]*data-testid="title"[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*data-testid="title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/i,
        // Profile with text class
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*class="[^"]*text-[^"]*"[^>]*>([^<]+)<\/span>/i,
        // Simple profile with span
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i,
        // Profile with name class span
        /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of profileWithSpanPatterns) {
        const match = block.match(pattern);
        if (match && match[2]) {
            const name = match[2].replace(/<[^>]*>/g, '').trim();
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                uploader.url = `spankbang://profile/${match[1]}`;
                uploader.avatar = extractAvatarFromHtml(block);
                log(`extractUploaderFromSearchResult: Found PROFILE (span pattern): "${name}" -> ${uploader.url}`);
                return uploader;
            }
        }
    }

    const profileWithAvatarPatterns = [
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i
    ];

    for (const pattern of profileWithAvatarPatterns) {
        const match = block.match(pattern);
        if (match && (match[3] || match[2])) {
            const name = (match[3] || match[1]).replace(/<[^>]*>/g, '').trim();
            let avatar = match[2] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
            
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                uploader.url = `spankbang://profile/${match[1]}`;
                uploader.avatar = avatar || extractAvatarFromHtml(block);
                log("extractUploaderFromSearchResult: Found PROFILE uploader: " + name);
                return uploader;
            }
        }
    }

    const profilePatterns = [
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*title="([^"]+)"/i,
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*class="[^"]*(?:name|n)[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of profilePatterns) {
        const match = block.match(pattern);
        if (match && match[2]) {
            const name = match[2].replace(/<[^>]*>/g, '').trim();
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                uploader.url = `spankbang://profile/${match[1]}`;
                uploader.avatar = extractAvatarFromHtml(block);
                log("extractUploaderFromSearchResult: Found PROFILE uploader: " + name);
                return uploader;
            }
        }
    }

    // PRIORITY 1: Look for explicit pornstar links
    // SpankBang NEW structure: <a href="/shortId/pornstar/name/"><span class="...">Name</span></a>
    const pornstarWithSpanPatterns = [
        /<a[^>]*data-testid="title"[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*data-testid="title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*class="[^"]*text-[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of pornstarWithSpanPatterns) {
        const match = block.match(pattern);
        if (match && match[3]) {
            const name = match[3].replace(/<[^>]*>/g, '').trim();
            const pornstarSlug = match[2].replace(/\/$/, '');
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                uploader.url = `spankbang://profile/pornstar:${pornstarSlug}`;
                uploader.avatar = extractPornstarAvatarFromHtml(block, pornstarSlug);
                log(`extractUploaderFromSearchResult: Found PORNSTAR (span pattern): "${name}" -> ${uploader.url}`);
                return uploader;
            }
        }
    }

    const pornstarWithAvatarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i
    ];

    for (const pattern of pornstarWithAvatarPatterns) {
        const match = block.match(pattern);
        if (match && (match[4] || match[3])) {
            const name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
            let avatar = match[3] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
            
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                uploader.avatar = avatar || extractPornstarAvatarFromHtml(block, match[2]);
                return uploader;
            }
        }
    }

    const pornstarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/i
    ];

    for (const pattern of pornstarPatterns) {
        const match = block.match(pattern);
        if (match && match[3]) {
            const name = match[3].replace(/<[^>]*>/g, '').trim();
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                uploader.url = `spankbang://profile/pornstar:${match[2]}`;
                uploader.avatar = extractPornstarAvatarFromHtml(block, match[2]);
                return uploader;
            }
        }
    }

    // PRIORITY 2: Look for channel links (but NOT tag links /s/...)
    // SpankBang NEW structure: <a href="/shortId/channel/name/"><span class="...">Channel Name</span></a>
    const channelWithSpanPatterns = [
        // New SpankBang structure: channel link with name in span
        /<a[^>]*data-testid="title"[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*data-testid="title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/i,
        // Generic channel link with span inside
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<span[^>]*class="[^"]*text-[^"]*"[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of channelWithSpanPatterns) {
        const match = block.match(pattern);
        if (match && match[3]) {
            const name = match[3].replace(/<[^>]*>/g, '').trim();
            const channelSlug = match[2].replace(/\/$/, '');
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name, channelSlug)) {
                uploader.name = name;
                uploader.url = `spankbang://channel/${match[1]}:${channelSlug}`;
                uploader.avatar = ""; // Will be fetched separately
                log(`extractUploaderFromSearchResult: Found CHANNEL (span pattern): "${name}" -> ${uploader.url}`);
                return uploader;
            }
        }
    }

    const channelWithAvatarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<>]+)<\/a>/i
    ];

    for (const pattern of channelWithAvatarPatterns) {
        const match = block.match(pattern);
        if (match && (match[4] || match[3])) {
            const name = (match[4] || "").replace(/<[^>]*>/g, '').trim();
            let avatar = match[3] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
            
            const channelSlug = match[2];
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name, channelSlug)) {
                uploader.name = name;
                uploader.url = `spankbang://channel/${match[1]}:${channelSlug}`;
                uploader.avatar = avatar;
                return uploader;
            }
        }
    }

    const channelPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*title="([^"]+)"/i,
        /<a[^>]*class="[^"]*n[^"]*"[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"]+)"[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?([^<>]+)<\/a>/i
    ];

    for (const pattern of channelPatterns) {
        const match = block.match(pattern);
        if (match && match[3]) {
            const name = match[3].replace(/<[^>]*>/g, '').trim();
            const channelSlug = match[2];
            
            if (name && name.length > 0 && name.length < 100 && !isLikelyBadUploaderName(name, channelSlug)) {
                uploader.name = name;
                uploader.url = `spankbang://channel/${match[1]}:${channelSlug}`;
                uploader.avatar = extractChannelAvatarNearLink(block, match[1], channelSlug) || extractAvatarFromHtml(block);
                return uploader;
            }
        }
    }

    // If we couldn't find any real uploader, return empty (don't use tags)
    log("WARNING: extractUploaderFromSearchResult could not find any uploader");
    return uploader;
}

function extractFeaturedPornstars(html) {
    const pornstars = [];
    const seenSlugs = new Set();
    
    const pornstarPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*title="([^"]+)"/gi,
        /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"]+)"[^>]*>([^<]+)<\/a>/gi
    ];
    
    for (const pattern of pornstarPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const shortId = match[1];
            const slug = match[2].replace(/\/$/, '');
            const name = (match[4] || match[3] || slug).replace(/<[^>]*>/g, '').trim();
            const avatar = match[3] && match[3].includes('pornstarimg') ? match[3] : "";
            
            if (!seenSlugs.has(slug) && name.length > 0 && name.length < 100) {
                seenSlugs.add(slug);
                pornstars.push({
                    shortId: shortId,
                    slug: slug,
                    name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
                    avatar: avatar,
                    url: `spankbang://profile/pornstar:${slug}`
                });
            }
        }
        if (pornstars.length > 0) break;
    }
    
    return pornstars;
}

function parseVideoPage(html, url) {
    const videoData = {
        id: extractVideoId(url),
        url: url,
        title: "Unknown Title",
        description: "",
        duration: 0,
        views: 0,
        uploadDate: 0,
        thumbnail: "",
        uploader: { name: "", url: "", avatar: "" },
        featuredPornstars: [],
        sources: {},
        rating: 0,
        relatedVideos: [],
        relatedPlaylists: []
    };

    const titleMatch = html.match(/<h1[^>]*title="([^"]+)"/);
    if (titleMatch) {
        videoData.title = cleanVideoTitle(titleMatch[1]);
    } else {
        const altTitleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (altTitleMatch) {
            videoData.title = cleanVideoTitle(altTitleMatch[1].replace(/ - SpankBang$/, '').trim());
        }
    }

    const descPatterns = [
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];
    for (const pattern of descPatterns) {
        const descMatch = html.match(pattern);
        if (descMatch && descMatch[1]) {
            videoData.description = descMatch[1].replace(/<[^>]*>/g, '').trim();
            break;
        }
    }

    // Extract duration with multiple fallback patterns
    // Extract duration with multiple fallback patterns
    const durationMatch = html.match(/itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/);
    if (durationMatch) {
        videoData.duration = (parseInt(durationMatch[1]) || 0) * 60 + (parseInt(durationMatch[2]) || 0);
        log("parseVideoPage: Found duration via itemprop: " + videoData.duration + "s");
    } else {
        // Fallback duration patterns - comprehensive list
        const fallbackDurationPatterns = [
            // itemprop with different attribute order
            /content="PT(\d+)M(\d+)?S?"\s*itemprop="duration"/i,
            /<meta[^>]+itemprop="duration"[^>]+content="PT(\d+)M(\d+)?S?"/i,
            /<meta[^>]+content="PT(\d+)M(\d+)?S?"[^>]+itemprop="duration"/i,
            // JSON-LD duration formats
            /"duration"\s*:\s*"PT(\d+)M(\d+)?S?"/i,
            /"duration"\s*:\s*(\d+)/i,  // Duration in seconds
            // yt-dlp pattern: right_side div with span
            /<div[^>]+class="[^"]*right_side[^"]*"[^>]*>\s*<span>([^<]+)<\/span>/i,
            // Data attribute
            /data-duration="(\d+)"/i,
            // Various span patterns for duration display
            /<span[^>]*class="[^"]*(?:duration|length|l|time)[^"]*"[^>]*>(\d{1,3}:\d{2}(?::\d{2})?)<\/span>/i,
            /<span[^>]*class="[^"]*\bl\b[^"]*"[^>]*>([^<]+)<\/span>/i,
            // Generic time format anywhere
            />(\d{1,2}:\d{2}(?::\d{2})?)</
        ];
        
        for (const pattern of fallbackDurationPatterns) {
            const fallbackMatch = html.match(pattern);
            if (fallbackMatch && fallbackMatch[1]) {
                const matchStr = fallbackMatch[1].toString().trim();
                
                // Check if it's PT format (already has minutes/seconds groups)
                if (fallbackMatch[2] !== undefined) {
                    if (fallbackMatch[3]) {
                        // HH:MM:SS
                        videoData.duration = parseInt(fallbackMatch[1]) * 3600 + parseInt(fallbackMatch[2]) * 60 + parseInt(fallbackMatch[3]);
                    } else {
                        // PT format: MM and SS groups
                        videoData.duration = parseInt(fallbackMatch[1]) * 60 + parseInt(fallbackMatch[2] || 0);
                    }
                } else if (matchStr.includes(':')) {
                    // Time format like "12:34" or "1:23:45"
                    videoData.duration = parseDuration(matchStr);
                } else if (/^\d+$/.test(matchStr)) {
                    // Just seconds
                    videoData.duration = parseInt(matchStr);
                }
                
                if (videoData.duration > 0) {
                    log("parseVideoPage: Found duration via fallback: " + videoData.duration + "s from '" + matchStr + "'");
                    break;
                }
            }
        }
    }
    
    if (!videoData.duration || videoData.duration === 0) {
        log("WARNING: parseVideoPage could not extract duration for video " + videoData.id);
    }

    videoData.views = extractViewCountFromContext(html);

    const uploadMatch = html.match(/itemprop="uploadDate"\s*content="([^"]+)"/);
    if (uploadMatch) {
        try {
            videoData.uploadDate = Math.floor(new Date(uploadMatch[1]).getTime() / 1000);
        } catch (e) {}
    }

    // Extract thumbnail with multiple fallback patterns
    // Primary patterns - try various attribute orderings since HTML can vary
    const thumbnailPatterns = [
        // itemprop patterns (various orderings)
        /itemprop="thumbnailUrl"\s+content="([^"]+)"/i,
        /content="([^"]+)"\s+itemprop="thumbnailUrl"/i,
        /<meta[^>]+itemprop="thumbnailUrl"[^>]+content="([^"]+)"/i,
        /<meta[^>]+content="([^"]+)"[^>]+itemprop="thumbnailUrl"/i,
        // og:image patterns (most reliable - used by yt-dlp)
        /<meta\s+property="og:image"\s+content="([^"]+)"/i,
        /<meta\s+content="([^"]+)"\s+property="og:image"/i,
        /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
        /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i,
        // twitter:image patterns
        /<meta\s+name="twitter:image"\s+content="([^"]+)"/i,
        /<meta\s+content="([^"]+)"\s+name="twitter:image"/i,
        /<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i,
        /<meta[^>]+content="([^"]+)"[^>]+name="twitter:image"/i,
        // JSON-LD thumbnailUrl
        /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
        /"thumbnail"\s*:\s*"([^"]+)"/i,
        // Video poster/preview attributes
        /data-preview="([^"]+\.(?:jpg|jpeg|png|webp))"/i,
        /poster="([^"]+\.(?:jpg|jpeg|png|webp))"/i,
        /data-poster="([^"]+\.(?:jpg|jpeg|png|webp))"/i,
        // Image in video player area
        /<img[^>]+class="[^"]*(?:poster|thumb|preview)[^"]*"[^>]+src="([^"]+)"/i,
        /<img[^>]+src="([^"]+)"[^>]+class="[^"]*(?:poster|thumb|preview)[^"]*"/i
    ];
    
    for (const pattern of thumbnailPatterns) {
        const thumbMatch = html.match(pattern);
        if (thumbMatch && thumbMatch[1]) {
            let thumbUrl = thumbMatch[1];
            // Ensure it's a valid image URL
            if (thumbUrl.includes('.jpg') || thumbUrl.includes('.jpeg') || 
                thumbUrl.includes('.png') || thumbUrl.includes('.webp') ||
                thumbUrl.includes('thumb') || thumbUrl.includes('image')) {
                videoData.thumbnail = thumbUrl;
                log("parseVideoPage: Found thumbnail via pattern: " + thumbUrl.substring(0, 80));
                break;
            }
        }
    }
    
    // If still no thumbnail, log warning but don't use broken CDN fallback
    if (!videoData.thumbnail) {
        log("WARNING: parseVideoPage could not extract thumbnail for video " + videoData.id);
        // Try to extract any image URL that might be a thumbnail
        const anyImageMatch = html.match(/https?:\/\/[^"'\s]+(?:thumb|preview|poster)[^"'\s]*\.(?:jpg|jpeg|png|webp)/i);
        if (anyImageMatch) {
            videoData.thumbnail = anyImageMatch[0];
            log("parseVideoPage: Using last-resort image URL: " + videoData.thumbnail);
        }
    }

    // Extract rating (percentage) - try new pattern first, then fallback
    videoData.rating = extractRatingFromContext(html);
    if (!videoData.rating || videoData.rating === 0) {
        const ratingMatch = html.match(/(\d+(?:\.\d+)?)\s*%\s*(?:rating|like)/i);
        if (ratingMatch) {
            videoData.rating = parseFloat(ratingMatch[1]) / 100;
        }
    }

    videoData.uploader = extractUploaderFromVideoToolbar(html);
    
    videoData.featuredPornstars = extractFeaturedPornstars(html);

    const streamRegex = /stream_url_([0-9a-z]+p?)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(html)) !== null) {
        let quality = streamMatch[1].toLowerCase();
        let streamUrl = streamMatch[2];
        if (streamUrl.includes('\\u002F')) {
            streamUrl = streamUrl.replace(/\\u002F/g, '/');
        }
        if (!quality.endsWith('p') && /^\d+$/.test(quality)) {
            quality = quality + 'p';
        }
        videoData.sources[quality] = streamUrl;
    }

    const m3u8Match = html.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/);
    if (m3u8Match) {
        videoData.sources['hls'] = m3u8Match[1];
    }

    if (Object.keys(videoData.sources).length === 0) {
        const streamKeyMatch = html.match(/data-streamkey\s*=\s*['"]([\w]+)['"]/);
        if (streamKeyMatch) {
            const streamKey = streamKeyMatch[1];
            try {
                const streamResponse = http.POST(
                    "https://spankbang.com/api/videos/stream",
                    "id=" + streamKey + "&data=0",
                    {
                        "User-Agent": API_HEADERS["User-Agent"],
                        "Accept": "application/json, text/plain, */*",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Referer": url,
                        "X-Requested-With": "XMLHttpRequest",
                        "Origin": "https://spankbang.com"
                    },
                    false
                );

                if (streamResponse.isOk && streamResponse.body) {
                    const streamData = JSON.parse(streamResponse.body);
                    for (const [quality, streamUrl] of Object.entries(streamData)) {
                        if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
                            let qualityKey = quality.toLowerCase();
                            if (!qualityKey.endsWith('p') && /^\d+$/.test(qualityKey)) {
                                qualityKey = qualityKey + 'p';
                            }
                            videoData.sources[qualityKey] = streamUrl;
                        } else if (Array.isArray(streamUrl) && streamUrl.length > 0 && streamUrl[0].startsWith('http')) {
                            let qualityKey = quality.toLowerCase();
                            if (!qualityKey.endsWith('p') && /^\d+$/.test(qualityKey)) {
                                qualityKey = qualityKey + 'p';
                            }
                            videoData.sources[qualityKey] = streamUrl[0];
                        }
                    }
                }
            } catch (e) {
                log("Stream API request failed: " + e.message);
            }
        }
    }

    videoData.relatedVideos = parseRelatedVideos(html);
    videoData.relatedPlaylists = parseRelatedPlaylists(html);

    // Log the extracted video data for debugging
    log("parseVideoPage complete: id=" + videoData.id + ", duration=" + videoData.duration + "s, thumbnail=" + (videoData.thumbnail ? "present" : "MISSING"));

    return videoData;
}

function parseRelatedPlaylists(html) {
    const playlists = [];
    const seenIds = new Set();
    
    const playlistPatterns = [
        /<a[^>]*href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi,
        /<a[^>]*href="\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi
    ];
    
    for (const pattern of playlistPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && playlists.length < 10) {
            let shortId, slug, titleFromMatch;
            
            if (match[0].includes('/playlist/') && !match[0].match(/\/[a-z0-9]+\/playlist\//)) {
                shortId = "";
                slug = match[1].replace(/\/$/, '');
                titleFromMatch = match[2];
            } else {
                shortId = match[1];
                slug = match[2].replace(/\/$/, '');
                titleFromMatch = match[3];
            }
            
            const playlistId = shortId ? `${shortId}:${slug}` : slug;
            
            if (seenIds.has(playlistId)) continue;
            seenIds.add(playlistId);
            
            const name = titleFromMatch ? titleFromMatch.trim() : slug.replace(/[_+-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            const thumbPattern = new RegExp(`href="[^"]*playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]{0,300}(?:data-src|src)="([^"]+)"`, 'i');
            const thumbMatch = html.match(thumbPattern);
            let thumbnail = thumbMatch ? thumbMatch[1] : "";
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
            
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                url: `spankbang://playlist/${playlistId}`,
                videoCount: 0
            });
        }
    }
    
    log("parseRelatedPlaylists found " + playlists.length + " playlists");
    return playlists;
}

function parseRelatedVideos(html) {
    const relatedVideos = [];
    const seenIds = new Set();

    const relatedSectionPatterns = [
        /<section[^>]*id="[^"]*(?:related|similar|recommended|more)[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
        /<div[^>]*class="[^"]*(?:related|similar|recommended|more_videos|suggestions)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*<(?:section|footer|script)/i,
        /<div[^>]*id="[^"]*(?:related|similar|recommended|more)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*<(?:section|footer|script)/i,
        /<ul[^>]*class="[^"]*(?:video-list|videos|thumbs)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi
    ];

    let relatedHtml = html;
    for (const pattern of relatedSectionPatterns) {
        const sectionMatch = html.match(pattern);
        if (sectionMatch && sectionMatch[1]) {
            relatedHtml = sectionMatch[1];
            break;
        }
    }

    const videoItemPatterns = [
        /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
        /<li[^>]*class="[^"]*video[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        /<a[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    ];

    for (const videoItemRegex of videoItemPatterns) {
        let match;
        while ((match = videoItemRegex.exec(relatedHtml)) !== null && relatedVideos.length < 30) {
            const block = match[0];

            const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
            if (!linkMatch) continue;

            const videoId = linkMatch[1];
            const videoSlug = linkMatch[2];

            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);

            const thumbPatterns = [
                /(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/,
                /style="[^"]*background[^"]*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/
            ];

            let thumbnail = `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
            for (const thumbPattern of thumbPatterns) {
                const thumbMatch = block.match(thumbPattern);
                if (thumbMatch && thumbMatch[1]) {
                    thumbnail = thumbMatch[1];
                    break;
                }
            }

            const titlePatterns = [
                /title="([^"]+)"/,
                /alt="([^"]+)"/,
                /<span[^>]*class="[^"]*(?:name|title)[^"]*"[^>]*>([^<]+)<\/span>/i
            ];

            let title = "Unknown";
            for (const titlePattern of titlePatterns) {
                const titleMatch = block.match(titlePattern);
                if (titleMatch && titleMatch[1]) {
                    title = cleanVideoTitle(titleMatch[1]);
                    break;
                }
            }

            // Unified duration extraction
            const duration = extractBestDurationSecondsFromContext(block, {
                excludeProgress: true,
                preferLargest: true
            });

            const viewsMatch = block.match(/([0-9,.]+[KMB]?)\s*(?:views?|plays?)/i);
            const views = viewsMatch ? parseViewCount(viewsMatch[1]) : 0;

            const uploader = extractUploaderFromSearchResult(block);

            relatedVideos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: views,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: uploader
            });
        }

        if (relatedVideos.length > 0) break;
    }

    if (relatedVideos.length === 0) {
        const altPattern = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*title="([^"]+)"/gi;
        let match;
        while ((match = altPattern.exec(html)) !== null && relatedVideos.length < 30) {
            const videoId = match[1];
            const videoSlug = match[2];

            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            // Enhanced duration extraction from surrounding context
            const contextStart = Math.max(0, match.index - 500);
            const contextEnd = Math.min(html.length, match.index + match[0].length + 500);
            const context = html.substring(contextStart, contextEnd);
            
            const duration = extractBestDurationSecondsFromContext(context, {
                excludeProgress: true,
                preferLargest: true
            });

            relatedVideos.push({
                id: videoId,
                title: cleanVideoTitle(match[3]),
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`,
                duration: duration,
                views: extractViewCountFromContext(context),
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: { name: "", url: "", avatar: "" }
            });
        }
    }

    log("parseRelatedVideos found " + relatedVideos.length + " videos");
    return relatedVideos;
}

function createVideoSources(videoData) {
    const videoSources = [];

    const qualityOrder = ['4k', '2160p', '1080p', '720p', '480p', '360p', '320p', '240p'];

    for (const quality of qualityOrder) {
        if (videoData.sources[quality]) {
            const qualityKey = quality.replace('p', '');
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: videoData.sources[quality],
                name: quality.toUpperCase(),
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    for (const [quality, url] of Object.entries(videoData.sources)) {
        if (quality === 'hls' || quality === 'm3u8') continue;
        const alreadyAdded = qualityOrder.includes(quality);
        if (!alreadyAdded && url && url.startsWith('http')) {
            const qualityKey = quality.replace('p', '');
            const config = CONFIG.VIDEO_QUALITIES[qualityKey] || CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: url,
                name: quality.toUpperCase(),
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    if (videoData.sources.hls || videoData.sources.m3u8) {
        const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
        videoSources.push(new HLSSource({
            url: hlsUrl,
            name: "HLS (Adaptive)",
            priority: true
        }));
    }

    if (videoSources.length === 0) {
        throw new ScriptException("No video sources available for this video");
    }

    return videoSources;
}

function createThumbnails(thumbnail) {
    if (!thumbnail) {
        return new Thumbnails([]);
    }
    return new Thumbnails([
        new Thumbnail(thumbnail, 0)
    ]);
}

function createPlatformAuthor(uploader) {
    let avatar = uploader.avatar || "";
    const authorUrl = uploader.url || "";
    const authorName = uploader.name || "";

    // If no avatar and this is a channel, try to fetch it
    if (!avatar && authorUrl && authorUrl.includes('channel/')) {
        // Extract channel info from URL like "spankbang://channel/zz:mommy+s+boy"
        const channelMatch = authorUrl.match(/channel\/([^:]+):(.+)$/);
        if (channelMatch) {
            const shortId = channelMatch[1];
            const channelSlug = channelMatch[2];
            log(`createPlatformAuthor: Fetching avatar for channel ${channelSlug}`);
            avatar = fetchChannelAvatar(shortId, channelSlug);
        }
    }
    
    // If no avatar and this is a pornstar, try to fetch it
    if (!avatar && authorUrl && authorUrl.includes('pornstar:')) {
        const pornstarMatch = authorUrl.match(/pornstar:(.+)$/);
        if (pornstarMatch) {
            const pornstarSlug = pornstarMatch[1];
            log(`createPlatformAuthor: Fetching avatar for pornstar ${pornstarSlug}`);
            avatar = fetchPornstarAvatar(pornstarSlug);
        }
    }
    
    // If no avatar and this is a profile user, try to fetch it
    if (!avatar && authorUrl && authorUrl.includes('profile/')) {
        const profileMatch = authorUrl.match(/profile\/(.+)$/);
        if (profileMatch) {
            const username = profileMatch[1];
            log(`createPlatformAuthor: Fetching avatar for profile user ${username}`);
            avatar = fetchProfileAvatar(username);
        }
    }

    // Log what we're creating for debugging
    if (authorName && authorUrl) {
        log(`createPlatformAuthor: Creating author "${authorName}" with URL: ${authorUrl}, avatar: ${avatar ? 'YES' : 'NO'}`);
    } else if (authorName) {
        log(`createPlatformAuthor: Creating author "${authorName}" with NO URL (will not be clickable)`);
    } else {
        log(`createPlatformAuthor: Creating EMPTY author (no name, no URL)`);
    }

    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, authorName, plugin.config.id),
        authorName,
        authorUrl,
        avatar
    );
}

function hasValidUploader(uploader) {
    // Check if we have a real uploader with both name AND a valid URL
    // Empty URL or name means no real uploader - don't make it clickable
    if (!uploader) return false;
    if (!uploader.name || uploader.name.trim().length === 0) return false;
    if (!uploader.url || uploader.url.trim().length === 0) return false;
    // Make sure URL is a valid internal scheme (not empty)
    if (!uploader.url.startsWith('spankbang://')) return false;
    return true;
}

function createPlatformVideo(videoData) {
    const uploader = videoData.uploader || {};
    
    // CRITICAL: Only create author if we have a valid uploader with a URL
    // If no real uploader exists, create an author that Grayjay won't make clickable
    let author;
    if (hasValidUploader(uploader)) {
        author = createPlatformAuthor(uploader);
        log(`createPlatformVideo: Video ${videoData.id} has VALID uploader: "${uploader.name}"`);
    } else {
        // No valid uploader - create author with NO URL at all
        // Grayjay should not make this clickable when URL is empty
        // Using PLATFORM as name tells users this is platform content (no specific uploader)
        author = new PlatformAuthorLink(
            new PlatformID(PLATFORM, PLATFORM, plugin.config.id),
            "", // Empty name - should hide the element
            "", // Empty URL - CRITICAL: prevents Grayjay from making this clickable
            ""  // Empty avatar
        );
        log(`createPlatformVideo: Video ${videoData.id} has NO valid uploader - empty author created`);
    }
    
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: author,
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: videoData.url || `${CONFIG.EXTERNAL_URL_BASE}/${videoData.id}/video/`,
        isLive: false
    });
}

function createVideoDetails(videoData, url) {
    const videoSources = createVideoSources(videoData);

    let description = videoData.description || videoData.title || "";
    
    if (videoData.featuredPornstars && videoData.featuredPornstars.length > 0) {
        const pornstarLinks = videoData.featuredPornstars.map(p => {
            // Convert internal pornstar URL to full web URL for clickability
            // Format: spankbang://profile/pornstar:slug -> https://spankbang.com/shortId/pornstar/slug
            let webUrl = p.url;
            if (p.url && p.url.startsWith('spankbang://profile/pornstar:')) {
                const slug = p.url.replace('spankbang://profile/pornstar:', '');
                // Use shortId if available, otherwise resolve it
                const shortId = p.shortId || resolvePornstarShortId(slug);
                if (shortId) {
                    webUrl = `https://spankbang.com/${shortId}/pornstar/${slug}`;
                } else {
                    webUrl = `https://spankbang.com/pornstar/${slug}`;
                }
            }
            return `[${p.name}](${webUrl})`;
        }).join(', ');
        
        if (description.length > 0) {
            description += "\n\n";
        }
        description += "Featuring: " + pornstarLinks;
    }
    
    if (videoData.relatedPlaylists && videoData.relatedPlaylists.length > 0) {
        const playlistLinks = videoData.relatedPlaylists.map(p => {
            // Convert internal playlist URL to full web URL
            // Format: spankbang://playlist/id:slug -> https://spankbang.com/id/playlist/slug
            let webUrl = p.url;
            if (p.url && p.url.startsWith('spankbang://playlist/')) {
                const playlistId = p.url.replace('spankbang://playlist/', '');
                if (playlistId.includes(':')) {
                    const [shortId, slug] = playlistId.split(':');
                    webUrl = `https://spankbang.com/${shortId}/playlist/${slug}`;
                } else {
                    webUrl = `https://spankbang.com/playlist/${playlistId}`;
                }
            }
            return `[${p.name}](${webUrl})`;
        }).join(', ');
        
        if (description.length > 0) {
            description += "\n\n";
        }
        description += "Related Playlists: " + playlistLinks;
    }

    const details = new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: hasValidUploader(videoData.uploader) 
            ? createPlatformAuthor(videoData.uploader) 
            : new PlatformAuthorLink(new PlatformID(PLATFORM, "", plugin.config.id), "", "", ""),
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: url,
        isLive: false,
        description: description,
        video: new VideoSourceDescriptor(videoSources),
        live: null,
        subtitles: [],
        rating: videoData.rating ? new RatingScaler(videoData.rating) : null
    });
    
    log("createVideoDetails: ===== COMPLETE VIDEO DETAILS =====");
    log("createVideoDetails: Video ID: " + videoData.id);
    log("createVideoDetails: Title: " + (videoData.title || "MISSING"));
    log("createVideoDetails: Duration: " + (videoData.duration || 0) + " seconds");
    log("createVideoDetails: Thumbnail extracted: " + (videoData.thumbnail || "NONE"));
    log("createVideoDetails: Total thumbnails in array: " + (details.thumbnails && details.thumbnails.sources ? details.thumbnails.sources.length : 0));
    if (details.thumbnails && details.thumbnails.sources && details.thumbnails.sources.length > 0) {
        const primaryThumb = details.thumbnails.sources[0];
        log("createVideoDetails: Primary thumbnail URL: " + primaryThumb.url);
        log("createVideoDetails: Primary thumbnail width: " + primaryThumb.width);
        log("createVideoDetails: Primary thumbnail height: " + (primaryThumb.height || "not set"));
        
        // Verify the thumbnail object has all required properties
        log("createVideoDetails: Thumbnail object type: " + typeof primaryThumb);
        log("createVideoDetails: Thumbnail object keys: " + Object.keys(primaryThumb).join(", "));
    } else {
        log("createVideoDetails: ERROR - No thumbnails in sources array!");
    }
    log("createVideoDetails: =====================================");

    details.getContentRecommendations = function() {
        return source.getContentRecommendations(url);
    };

    return details;
}

function cleanVideoTitle(title) {
    if (!title) return "Unknown";
    return title
        .replace(/:\s*Porn\s*$/i, '')
        .replace(/\s*-\s*SpankBang\s*$/i, '')
        .replace(/\s*\|\s*SpankBang\s*$/i, '')
        .trim();
}

function parseSearchResults(html) {
    const videos = [];
    const seenIds = new Set();

    // Enhanced video patterns to catch more video formats from different SpankBang pages
    const videoPatterns = [
        // Primary pattern: full video-item divs
        {
            regex: /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*video-item|<\/section|<\/main|$)/gi,
            name: 'video-item'
        },
        // Trending/popular video patterns
        {
            regex: /<div[^>]*class="[^"]*(?:trending|popular|featured)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*(?:trending|popular|featured)|<\/section|$)/gi,
            name: 'trending'
        },
        // Thumb-based patterns (common on home page)
        {
            regex: /<div[^>]*class="[^"]*thumb[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*thumb|<\/section|$)/gi,
            name: 'thumb'
        },
        // Generic video containers
        {
            regex: /<div[^>]*class="[^"]*(?:video|item|media)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*(?:video|item|media)|<\/section|$)/gi,
            name: 'generic'
        },
        // List item patterns
        {
            regex: /<li[^>]*class="[^"]*(?:video|item|thumb)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
            name: 'list-item'
        }
    ];

    // Try each pattern until we find videos
    for (const pattern of videoPatterns) {
        if (videos.length > 0) break; // Use first successful pattern
        
        log(`parseSearchResults: Trying ${pattern.name} pattern...`);
        let itemMatch;
        while ((itemMatch = pattern.regex.exec(html)) !== null) {
            const block = itemMatch[0];

            const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
            if (!linkMatch) continue;

            const videoId = linkMatch[1];
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            const videoSlug = linkMatch[2];

            // Enhanced thumbnail extraction with multiple fallback patterns
            let thumbnail = "";
            const thumbPatterns = [
                // SpankBang CDN patterns (most common)
                /(?:data-src|src)="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
                /(?:data-src|src)="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
                /(?:data-src|src)="(https?:\/\/[^"]*cdn\.spankbang[^"]+)"/i,
                // Generic image patterns with extensions
                /(?:data-src|lazy-src|data-original)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                /src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                // Background image patterns
                /style="[^"]*background[^:]*:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/i
            ];
            
            for (const thumbPattern of thumbPatterns) {
                const thumbMatch = block.match(thumbPattern);
                if (thumbMatch && thumbMatch[1]) {
                    const url = thumbMatch[1];
                    // Skip avatar/profile images
                    if (!url.includes('avatar') && !url.includes('pornstarimg') && !url.includes('icon')) {
                        thumbnail = url;
                        log("parseSearchResults: Found thumbnail for video " + videoId + ": " + thumbnail.substring(0, 80));
                        break;
                    }
                }
            }
            
            // Fallback to default CDN thumbnail if no valid thumbnail found
            if (!thumbnail || thumbnail.length < 10) {
                log("parseSearchResults: WARNING - No thumbnail found for video " + videoId + ", using CDN fallback");
                thumbnail = `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
            }

            // Enhanced title extraction - prioritize VIDEO title over channel/tag names
            let title = "Unknown";
            
            // PRIORITY 1: Look for video link with title attribute (most accurate)
            const videoLinkTitleMatch = block.match(/href="\/[a-zA-Z0-9]+\/video\/[^"]*"[^>]*title="([^"]+)"/i) ||
                                       block.match(/title="([^"]+)"[^>]*href="\/[a-zA-Z0-9]+\/video\//i);
            
            if (videoLinkTitleMatch) {
                title = videoLinkTitleMatch[1];
            } else {
                // PRIORITY 2: Look for span with text-secondary class containing video title
                const spanTitleMatch = block.match(/<span[^>]*class="[^"]*text-secondary[^"]*"[^>]*>([^<]+)<\/span>/i);
                if (spanTitleMatch && spanTitleMatch[1] && spanTitleMatch[1].length > 5) {
                    title = spanTitleMatch[1];
                } else {
                    // PRIORITY 3: Extract from img alt attribute (video thumbnails often have title in alt)
                    const altMatch = block.match(/<img[^>]*alt="([^"]+)"[^>]*>/i);
                    if (altMatch && altMatch[1] && altMatch[1].length > 5) {
                        title = altMatch[1];
                    } else {
                        // FALLBACK: Use any title attribute as last resort
                        const fallbackTitleMatch = block.match(/title="([^"]+)"/);
                        if (fallbackTitleMatch) {
                            title = fallbackTitleMatch[1];
                        }
                    }
                }
            }
            
            title = cleanVideoTitle(title);

            // Unified duration extraction (for consistent thumbnail timecode overlays)
            const durationSeconds = extractBestDurationSecondsFromContext(block, {
                excludeProgress: true,
                preferLargest: true
            });

            const views = extractViewCountFromContext(block);
            
            // Extract rating percentage (e.g., 93% from thumbs-up)
            const rating = extractRatingFromContext(block);

            let uploadDate = 0;
            const datePatterns = [
                /<span[^>]*class="[^"]*(?:age|time|date|when|ago)[^"]*"[^>]*>([^<]+)<\/span>/i,
                /<time[^>]*>([^<]+)<\/time>/i,
                /<span[^>]*class="[^"]*t[^"]*"[^>]*>([^<]+)<\/span>/i,
                /(\d+\s*(?:second|minute|hour|day|week|month|year)s?\s*ago)/i,
                /(yesterday|today|just now)/i
            ];
            
            for (const datePattern of datePatterns) {
                const dateMatch = block.match(datePattern);
                if (dateMatch && dateMatch[1]) {
                    uploadDate = parseRelativeDate(dateMatch[1].trim());
                    if (uploadDate > 0) break;
                }
            }

            const uploader = extractUploaderFromSearchResult(block);
            
            // LOG: Show what uploader was extracted
            if (uploader.name && uploader.name.length > 0) {
                log(`parseSearchResults: Video ${videoId} has uploader: "${uploader.name}", url: "${uploader.url}"`);
            }
            
            // VERBOSE DEBUG: For first 3 videos, dump the ENTIRE block and analyze links
            if (videos.length < 3) {
                log(`parseSearchResults: ===== FULL DEBUG VIDEO ${videoId} =====`);
                log(`Block length: ${block.length} chars`);
                
                // Log the full block in chunks (Grayjay may truncate logs)
                const chunkSize = 1500;
                for (let i = 0; i < Math.min(block.length, 6000); i += chunkSize) {
                    log(`BLOCK CHUNK ${i}-${i+chunkSize}: ${block.substring(i, i + chunkSize).replace(/[\n\r]+/g, ' ')}`);
                }
                
                // Find ALL links in this block
                const allLinks = block.match(/href="[^"]+"/gi) || [];
                log(`ALL LINKS IN BLOCK: ${allLinks.join(' | ')}`);
                
                // Specifically look for channel/profile/pornstar links
                const channelLinks = block.match(/href="\/[a-z0-9]+\/channel\/[^"]+"/gi) || [];
                const profileLinks = block.match(/href="\/profile\/[^"]+"/gi) || [];
                const pornstarLinks = block.match(/href="\/[a-z0-9]+\/pornstar\/[^"]+"/gi) || [];
                const tagLinks = block.match(/href="\/s\/[^"]+"/gi) || [];
                
                log(`CHANNEL LINKS: ${channelLinks.length > 0 ? channelLinks.join(' | ') : 'NONE'}`);
                log(`PROFILE LINKS: ${profileLinks.length > 0 ? profileLinks.join(' | ') : 'NONE'}`);
                log(`PORNSTAR LINKS: ${pornstarLinks.length > 0 ? pornstarLinks.join(' | ') : 'NONE'}`);
                log(`TAG LINKS (/s/): ${tagLinks.length > 0 ? tagLinks.join(' | ') : 'NONE'}`);
                
                log(`parseSearchResults: ===== END FULL DEBUG =====`);
            }
            
            // LOG extracted data for debugging
            if (videos.length < 5) {
                log(`parseSearchResults: Video ${videoId}: title="${title}", duration=${durationSeconds}s, views=${views}, rating=${rating}, uploader="${uploader.name || 'NONE'}", uploaderUrl="${uploader.url || 'NONE'}"`);
            }

            videos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: durationSeconds,
                views: views,
                rating: rating,
                uploadDate: uploadDate,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: uploader
            });
        }
        
        if (videos.length > 0) {
            log(`parseSearchResults: ${pattern.name} pattern found ${videos.length} videos`);
        }
    }

    // Final fallback: Direct link extraction for any remaining videos
    if (videos.length === 0) {
        log("parseSearchResults: No videos found with patterns, trying direct link extraction...");
        const altVideoRegex = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*title="([^"]+)"/gi;
        let altMatch;
        while ((altMatch = altVideoRegex.exec(html)) !== null) {
            const videoId = altMatch[1];
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            const videoSlug = altMatch[2];
            let title = cleanVideoTitle(altMatch[3]);
            
            // Get a larger context around this video link for better extraction
            const linkStart = Math.max(0, altMatch.index - 500);
            const linkEnd = Math.min(html.length, altMatch.index + altMatch[0].length + 500);
            const context = html.substring(linkStart, linkEnd);
            
            const thumbMatch = context.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/);
            const thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
            
            // Enhanced duration extraction from surrounding context
            const duration = extractBestDurationSecondsFromContext(context, {
                excludeProgress: true,
                preferLargest: true
            });
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: extractViewCountFromContext(context),
                rating: extractRatingFromContext(context),
                uploadDate: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: extractUploaderFromSearchResult(context)
            });
        }
        log(`parseSearchResults: Direct link extraction found ${videos.length} videos`);
    }

    log(`parseSearchResults: Total videos extracted: ${videos.length}`);
    return videos;
}

function parsePornstarsPage(html) {
    const pornstars = [];

    const pornstarPattern = /<a[^>]*href="\/([a-z0-9]+)\/pornstar\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi;
    let match;

    while ((match = pornstarPattern.exec(html)) !== null) {
        const shortId = match[1];
        const pornstarSlug = match[2].replace(/\/$/, '');
        let avatar = match[3];

        if (avatar.startsWith('//')) {
            avatar = `https:${avatar}`;
        } else if (!avatar.startsWith('http')) {
            avatar = `https://spankbang.com${avatar}`;
        }

        let name = pornstarSlug.replace(/\+/g, ' ').replace(/-/g, ' ');
        name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
        if (existingIndex === -1) {
            let subscribersStr = "";
            let videoCountStr = "";

            const statsPattern = new RegExp(`href="/${shortId}/pornstar/${pornstarSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>[\\s\\S]*?(\\d[\\d,.]*)\\s*[\\s\\S]*?(\\d+)`, 'i');
            const statsMatch = html.match(statsPattern);

            if (statsMatch) {
                subscribersStr = statsMatch[1] || "0";
                videoCountStr = statsMatch[2] || "0";
            }

            pornstars.push({
                id: `pornstar:${pornstarSlug}`,
                shortId: shortId,
                name: name,
                avatar: avatar,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/pornstar/${pornstarSlug}`,
                subscribers: parseViewCount(subscribersStr),
                videoCount: parseInt(videoCountStr) || 0
            });
        }
    }

    if (pornstars.length === 0) {
        const simplePattern = /<a[^>]*href="\/pornstar\/([^"]+)"[^>]*title="([^"]+)"[^>]*>/gi;
        while ((match = simplePattern.exec(html)) !== null) {
            const pornstarSlug = match[1].replace(/\/$/, '');
            const name = match[2].trim();

            const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
            if (existingIndex === -1) {
                pornstars.push({
                    id: `pornstar:${pornstarSlug}`,
                    shortId: "",
                    name: name,
                    avatar: "",
                    url: `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${pornstarSlug}`,
                    subscribers: 0,
                    videoCount: 0
                });
            }
        }
    }

    return pornstars;
}

function parseProfilesPage(html) {
    const profiles = [];
    const seenIds = new Set();

    // Pattern to match profile links
    const profilePatterns = [
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi,
        /<a[^>]*href="\/profile\/([^"\/]+)\/?\"[^>]*title="([^"]+)"[^>]*>/gi
    ];

    for (const pattern of profilePatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(html)) !== null) {
            const profileSlug = match[1].replace(/\/$/, '');
            
            if (seenIds.has(profileSlug)) continue;
            seenIds.add(profileSlug);

            let avatar = match[2] || "";
            let name = match[2] || profileSlug;

            // Check if match[2] is an image URL or a name
            if (name.startsWith('http') || name.startsWith('//') || name.includes('.jpg') || name.includes('.png')) {
                avatar = name;
                // Extract name from nearby HTML or use slug
                const contextStart = Math.max(0, match.index - 200);
                const contextEnd = Math.min(html.length, match.index + match[0].length + 200);
                const context = html.substring(contextStart, contextEnd);
                
                const nameMatch = context.match(/<span[^>]*class="[^"]*(?:name|title|n)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                                 context.match(/title="([^"]+)"/i);
                if (nameMatch && nameMatch[1] && !nameMatch[1].includes('http') && !nameMatch[1].includes('.jpg')) {
                    name = nameMatch[1].trim();
                } else {
                    name = profileSlug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                }
            }

            // Normalize avatar URL
            if (avatar.startsWith('//')) {
                avatar = `https:${avatar}`;
            } else if (avatar && !avatar.startsWith('http')) {
                avatar = `https://spankbang.com${avatar}`;
            }

            // Format name if it's still the slug
            if (name === profileSlug) {
                name = profileSlug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }

            profiles.push({
                id: profileSlug,
                name: name,
                avatar: avatar,
                url: `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileSlug}`,
                subscribers: 0,
                videoCount: 0
            });
        }
    }

    return profiles;
}

function parseChannelsPage(html) {
    const channels = [];
    const seenIds = new Set();

    // Pattern to match channel links: /shortId/channel/channelname
    const channelPatterns = [
        // Full channel link with image
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi,
        // Channel link with title attribute
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*title="([^"]+)"[^>]*>/gi,
        // Basic channel link
        /<a[^>]*href="\/([a-z0-9]+)\/channel\/([^"\/]+)\/?\"[^>]*>([^<]+)<\/a>/gi
    ];

    for (const pattern of channelPatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(html)) !== null) {
            const shortId = match[1];
            const channelSlug = match[2].replace(/\/$/, '');
            const channelId = `${shortId}:${channelSlug}`;
            
            if (seenIds.has(channelId)) continue;
            seenIds.add(channelId);

            let avatar = "";
            let name = match[3] || channelSlug;

            // Check if match[3] is an image URL or a name
            if (name && (name.startsWith('http') || name.startsWith('//') || name.includes('.jpg') || name.includes('.png'))) {
                avatar = name;
                // Use slug as name, properly formatted
                name = channelSlug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            } else {
                // Extract avatar from nearby context
                const contextStart = Math.max(0, match.index - 300);
                const contextEnd = Math.min(html.length, match.index + match[0].length + 300);
                const context = html.substring(contextStart, contextEnd);
                
                const avatarMatch = context.match(/<img[^>]*(?:data-src|src)="([^"]+(?:avatar|channel|thumb)[^"]*)"/i);
                if (avatarMatch && avatarMatch[1]) {
                    avatar = avatarMatch[1];
                }
            }

            // Normalize avatar URL
            if (avatar.startsWith('//')) {
                avatar = `https:${avatar}`;
            } else if (avatar && !avatar.startsWith('http')) {
                avatar = `https://spankbang.com${avatar}`;
            }

            // Clean up name - remove HTML tags and trim
            name = name.replace(/<[^>]*>/g, '').trim();
            
            // Format name if it's still the slug
            if (name === channelSlug || name.length === 0) {
                name = channelSlug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }

            channels.push({
                id: channelId,
                shortId: shortId,
                slug: channelSlug,
                name: name,
                avatar: avatar,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelSlug}`,
                subscribers: 0,
                videoCount: 0
            });
        }
    }

    log("parseChannelsPage: Found " + channels.length + " channels");
    return channels;
}

function parsePlaylistsPage(html) {
    const playlists = [];
    
    log("parsePlaylistsPage: Starting to parse HTML (length: " + html.length + ")");
    
    // Enhanced patterns to match SpankBang's playlist structure
    // Added pattern for <a> tags with class="playlist-item"
    const playlistBlockPatterns = [
        /<a[^>]*class="[^"]*playlist-item[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
        /<div[^>]*class="[^"]*(?:playlist-item|playlist|video-item|item|thumb|card)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|\s*<div)/gi,
        /<article[^>]*class="[^"]*(?:playlist|item)[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
        /<li[^>]*class="[^"]*(?:playlist|item)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        /<div[^>]*class="[^"]*(?:thumb|item)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];
    
    for (const playlistBlockPattern of playlistBlockPatterns) {
        let blockMatch;
        while ((blockMatch = playlistBlockPattern.exec(html)) !== null) {
            // Use full match for <a> tags to include href, use capture group for others
            const fullMatch = blockMatch[0];
            const block = blockMatch[1] || blockMatch[0];
            if (!block || block.trim().length < 10) continue;
            
            // Check for href in both full match and block (for different pattern types)
            const hrefMatch = fullMatch.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i) ||
                              block.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
            if (hrefMatch) {
                const shortId = hrefMatch[1];
                const playlistId = `${shortId}:${hrefMatch[2]}`;
                
                // Enhanced name extraction - also look for <p class="inf">
                const nameMatch = block.match(/<p[^>]*class="[^"]*inf[^"]*"[^>]*>([^<]+)<\/p>/i) ||
                                  block.match(/title="([^"]+)"/i) || 
                                  block.match(/<span[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                                  block.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) ||
                                  block.match(/<div[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/div>/i);
                const name = nameMatch ? (nameMatch[1] || nameMatch[2] || "").trim() : hrefMatch[2].replace(/[+_-]/g, ' ');
                
                const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i) ||
                                   block.match(/(?:data-src|src)="([^"]+)"/i);
                let thumbnail = thumbMatch ? thumbMatch[1] : "";
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
                
                // Enhanced video count extraction with multiple patterns
                // Added specific pattern for <span class="len">
                const countPatterns = [
                    /<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)\s*videos?/i,
                    /<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)\s*/i,
                    /(\d+)\s*videos?/i,
                    /<span[^>]*class="[^"]*(?:count|videos|video-count|vid|length)[^"]*"[^>]*>\s*(\d+)\s*(?:videos?)?/i,
                    /<div[^>]*class="[^"]*(?:count|videos|video-count|vid|length)[^"]*"[^>]*>\s*(\d+)\s*(?:videos?)?/i,
                    /<p[^>]*class="[^"]*(?:count|videos|video-count|vid|length)[^"]*"[^>]*>\s*(\d+)\s*(?:videos?)?/i,
                    />\s*(\d+)\s*(?:videos?|vids?)\s*</i,
                    />\s*(\d+)\s*<\/span>/i,
                    />\s*(\d+)\s*<\/div>/i,
                    />\s*(\d+)\s*<\/p>/i
                ];
                
                let videoCount = 0;
                for (const pattern of countPatterns) {
                    const countMatch = block.match(pattern);
                    if (countMatch && countMatch[1]) {
                        const parsedCount = parseInt(countMatch[1]);
                        if (!isNaN(parsedCount) && parsedCount > 0) {
                            videoCount = parsedCount;
                            break;
                        }
                    }
                }
                
                // If we still can't find count in block, search in nearby context
                if (videoCount === 0) {
                    const contextStart = Math.max(0, playlistBlockPattern.lastIndex - 600);
                    const contextEnd = Math.min(html.length, playlistBlockPattern.lastIndex + 200);
                    const context = html.substring(contextStart, contextEnd);
                    
                    const contextPattern = new RegExp(`/${shortId}/playlist/${hrefMatch[2]}[^>]*>[\\s\\S]{0,150}?(\\d+)\\s*videos?`, 'i');
                    const contextMatch = context.match(contextPattern);
                    if (contextMatch && contextMatch[1]) {
                        videoCount = parseInt(contextMatch[1]);
                    }
                }
                
                if (!playlists.find(p => p.id === playlistId) && name.length > 0) {
                    // Try to extract author from the block
                    let author = "";
                    const authorPatterns = [
                        /(?:by|from)\s+<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i,
                        /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i
                    ];
                    for (const pattern of authorPatterns) {
                        const authorMatch = block.match(pattern);
                        if (authorMatch && authorMatch[2]) {
                            const authorName = authorMatch[2].trim();
                            if (authorName && authorName.length > 0 && authorName.length < 50) {
                                author = authorName;
                                break;
                            }
                        }
                    }
                    
                    if (videoCount === 0) {
                        log(`WARNING: Found playlist with 0 videos: ${name} (ID: ${playlistId})${author ? ' by ' + author : ''}`);
                        log(`  Block sample (first 300 chars): ${block.substring(0, 300)}`);
                    } else {
                        log(`Found playlist: ${name} (ID: ${playlistId}) with ${videoCount} videos${author ? ' by ' + author : ''}`);
                    }
                    playlists.push({
                        id: playlistId,
                        name: name,
                        thumbnail: thumbnail,
                        author: author,
                        videoCount: videoCount,
                        url: `spankbang://playlist/${playlistId}`
                    });
                }
            }
        }
        if (playlists.length > 0) break;
    }
    
    // Fallback: broader link pattern search
    const linkPattern = /<a[^>]*href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?\"[^>]*(?:title="([^"]+)")?/gi;
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
        const shortId = match[1];
        const slug = match[2];
        const playlistId = `${shortId}:${slug}`;
        const name = match[3] ? match[3].trim() : slug.replace(/[+_-]/g, ' ');
        
        if (!playlists.find(p => p.id === playlistId)) {
            let thumbnail = "";
            const thumbPattern = new RegExp(`href="/${shortId}/playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]{0,500}?(?:data-src|src)="([^"]+)"`, 'i');
            const thumbMatch = html.match(thumbPattern);
            if (thumbMatch && thumbMatch[1]) {
                thumbnail = thumbMatch[1];
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            }
            
            // Enhanced context search for video count - look for both patterns
            // Pattern 1: <span class="len"> 7 videos </span>
            // Pattern 2: general (\d+) videos
            const countPattern1 = new RegExp(`href="/${shortId}/playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]{0,500}?<span[^>]*class="[^"]*len[^"]*"[^>]*>\\s*(\\d+)\\s*videos?`, 'i');
            const countPattern2 = new RegExp(`href="/${shortId}/playlist/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[\\s\\S]{0,500}?(\\d+)\\s*videos?`, 'i');
            
            let videoCount = 0;
            let countMatch = html.match(countPattern1);
            if (countMatch && countMatch[1]) {
                videoCount = parseInt(countMatch[1]);
            } else {
                countMatch = html.match(countPattern2);
                if (countMatch && countMatch[1]) {
                    videoCount = parseInt(countMatch[1]);
                }
            }
            
            log(`Found playlist (fallback): ${name} (ID: ${playlistId}) with ${videoCount} videos`);
            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                author: "",
                videoCount: videoCount,
                url: `spankbang://playlist/${playlistId}`
            });
        }
    }
    
    if (playlists.length === 0) {
        const simplePattern = /<a[^>]*href="\/playlist\/([^"]+)"[^>]*>[\s\S]*?(?:<img[^>]*(?:data-src|src)="([^"]+)")?[\s\S]*?([^<>]{3,50})<\/a>/gi;
        while ((match = simplePattern.exec(html)) !== null) {
            const playlistId = match[1].replace(/\/$/, '');
            const thumbnail = match[2] || "";
            const name = match[3] ? match[3].replace(/<[^>]*>/g, '').trim() : playlistId;
            
            if (name.length > 2 && name.length < 100) {
                if (!playlists.find(p => p.id === playlistId)) {
                    playlists.push({
                        id: playlistId,
                        name: name,
                        thumbnail: thumbnail.startsWith('//') ? 'https:' + thumbnail : thumbnail,
                        author: "",
                        videoCount: 0,
                        url: `spankbang://playlist/${playlistId}`
                    });
                }
            }
        }
    }
    
    log(`parsePlaylistsPage: Found total ${playlists.length} playlists`);
    return playlists;
}

// Enhanced user playlists page parser for https://spankbang.com/users/playlists
function parseUserPlaylistsPageEnhanced(html) {
    const playlists = [];
    const seenIds = new Set();
    
    log("parseUserPlaylistsPageEnhanced: Starting to parse HTML (length: " + html.length + ")");
    
    // SpankBang's user playlists page typically has <a class="playlist-item"> elements
    // Pattern 1: <a class="playlist-item" href="/xxx/playlist/yyy/">
    const playlistItemPattern = /<a[^>]*class="[^"]*playlist-item[^"]*"[^>]*href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?\"[^>]*>([\s\S]*?)<\/a>/gi;
    
    let match;
    while ((match = playlistItemPattern.exec(html)) !== null) {
        const shortId = match[1];
        const slug = match[2].replace(/["']/g, '');
        const playlistId = `${shortId}:${slug}`;
        const innerHtml = match[3] || "";
        
        if (seenIds.has(playlistId) || shortId === 'users' || shortId === 'search') continue;
        seenIds.add(playlistId);
        
        // Extract name from title attribute or inner content
        const nameMatch = match[0].match(/title="([^"]+)"/i) ||
                          innerHtml.match(/<p[^>]*class="[^"]*inf[^"]*"[^>]*>([^<]+)<\/p>/i) ||
                          innerHtml.match(/<span[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                          innerHtml.match(/<div[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/div>/i);
        const name = nameMatch ? nameMatch[1].trim() : slug.replace(/[+_-]/g, ' ');
        
        // Extract thumbnail
        const thumbMatch = innerHtml.match(/(?:data-src|src)="([^"]+)"/i) ||
                          match[0].match(/(?:data-src|src)="([^"]+)"/i);
        let thumbnail = thumbMatch ? thumbMatch[1] : "";
        if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
        else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
        
        // Extract video count - look for <span class="len">X videos</span> pattern
        const countPatterns = [
            /<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)\s*videos?\s*<\/span>/i,
            /<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)\s*<\/span>/i,
            /(\d+)\s*videos?/i,
            /<span[^>]*>\s*(\d+)\s*<\/span>/i
        ];
        
        let videoCount = 0;
        for (const pattern of countPatterns) {
            const countMatch = innerHtml.match(pattern);
            if (countMatch && countMatch[1]) {
                const parsed = parseInt(countMatch[1]);
                if (!isNaN(parsed) && parsed > 0) {
                    videoCount = parsed;
                    break;
                }
            }
        }
        
        // Try to extract author from the block
        let author = "";
        const authorPatterns = [
            /(?:by|from)\s+<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i,
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i
        ];
        for (const authorPattern of authorPatterns) {
            const authorMatch = innerHtml.match(authorPattern) || match[0].match(authorPattern);
            if (authorMatch && authorMatch[2]) {
                const authorName = authorMatch[2].trim();
                if (authorName && authorName.length > 0 && authorName.length < 50) {
                    author = authorName;
                    break;
                }
            }
        }
        
        log(`Found user playlist: ${name} (ID: ${playlistId}) with ${videoCount} videos${author ? ' by ' + author : ''}`);
        playlists.push({
            id: playlistId,
            name: name,
            thumbnail: thumbnail,
            author: author,
            videoCount: videoCount,
            url: `spankbang://playlist/${playlistId}`
        });
    }
    
    // Pattern 2: Generic div-based patterns if the above didn't work
    if (playlists.length === 0) {
        log("parseUserPlaylistsPageEnhanced: Pattern 1 found 0, trying generic patterns...");
        
        const genericPatterns = [
            /<div[^>]*class="[^"]*(?:playlist|item|card|thumb)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|\s*<\/section)/gi,
            /<article[^>]*>([\s\S]*?)<\/article>/gi
        ];
        
        for (const pattern of genericPatterns) {
            while ((match = pattern.exec(html)) !== null) {
                const block = match[1] || match[0];
                if (!block || block.trim().length < 10) continue;
                
                const hrefMatch = block.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
                if (!hrefMatch) continue;
                
                const shortId = hrefMatch[1];
                const slug = hrefMatch[2].replace(/["']/g, '');
                const playlistId = `${shortId}:${slug}`;
                
                if (seenIds.has(playlistId) || shortId === 'users' || shortId === 'search') continue;
                seenIds.add(playlistId);
                
                const nameMatch = block.match(/title="([^"]+)"/i) ||
                                  block.match(/<p[^>]*class="[^"]*inf[^"]*"[^>]*>([^<]+)<\/p>/i) ||
                                  block.match(/<span[^>]*>([^<]{3,50})<\/span>/i);
                const name = nameMatch ? nameMatch[1].trim() : slug.replace(/[+_-]/g, ' ');
                
                const thumbMatch = block.match(/(?:data-src|src)="([^"]+)"/i);
                let thumbnail = thumbMatch ? thumbMatch[1] : "";
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
                
                const countMatch = block.match(/(\d+)\s*videos?/i) || block.match(/<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)/i);
                const videoCount = countMatch ? parseInt(countMatch[1] || countMatch[2]) : 0;
                
                log(`Found user playlist (generic): ${name} (ID: ${playlistId}) with ${videoCount} videos`);
                playlists.push({
                    id: playlistId,
                    name: name,
                    thumbnail: thumbnail,
                    author: "",
                    videoCount: videoCount,
                    url: `spankbang://playlist/${playlistId}`
                });
            }
            if (playlists.length > 0) break;
        }
    }
    
    log(`parseUserPlaylistsPageEnhanced: Found total ${playlists.length} playlists`);
    return playlists;
}

// Direct link extraction for playlists when other parsers fail
function extractPlaylistLinksFromHtml(html) {
    const playlists = [];
    const seenIds = new Set();
    
    log("extractPlaylistLinksFromHtml: Extracting raw playlist links...");
    
    // Find all playlist links
    const linkPattern = /href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
        const shortId = match[1];
        const slug = match[2].replace(/["']/g, '');
        const playlistId = `${shortId}:${slug}`;
        
        if (seenIds.has(playlistId) || shortId === 'users' || shortId === 'search') continue;
        seenIds.add(playlistId);
        
        // Try to find title nearby (within 500 characters before/after)
        const matchIndex = match.index;
        const contextStart = Math.max(0, matchIndex - 300);
        const contextEnd = Math.min(html.length, matchIndex + 500);
        const context = html.substring(contextStart, contextEnd);
        
        const titleMatch = context.match(/title="([^"]+)"/i);
        const name = titleMatch ? titleMatch[1].trim() : slug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        // Try to find video count nearby
        const countMatch = context.match(/(\d+)\s*videos?/i) || context.match(/<span[^>]*class="[^"]*len[^"]*"[^>]*>\s*(\d+)/i);
        const videoCount = countMatch ? parseInt(countMatch[1] || countMatch[2]) : 0;
        
        // Try to find thumbnail nearby
        const thumbMatch = context.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
        let thumbnail = thumbMatch ? thumbMatch[1] : "";
        
        // Try to find author nearby
        let author = "";
        const authorMatch = context.match(/(?:by|from)\s+<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i) ||
                           context.match(/<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i);
        if (authorMatch && authorMatch[2]) {
            const authorName = authorMatch[2].trim();
            if (authorName && authorName.length > 0 && authorName.length < 50) {
                author = authorName;
            }
        }
        
        log(`Found playlist link: ${name} (ID: ${playlistId}) with ${videoCount} videos${author ? ' by ' + author : ''}`);
        playlists.push({
            id: playlistId,
            name: name,
            thumbnail: thumbnail,
            author: author,
            videoCount: videoCount,
            url: `spankbang://playlist/${playlistId}`
        });
    }
    
    log(`extractPlaylistLinksFromHtml: Found ${playlists.length} playlists`);
    return playlists;
}

// Parse videos from a playlist page - handles playlist-specific video URL formats
function parsePlaylistVideos(html) {
    const videos = [];
    const seenIds = new Set();
    
    log("parsePlaylistVideos: Starting to parse...");
    
    // Pattern 1: Playlist video URLs with format /{playlistId}-{videoId}/playlist/{playlistSlug}
    // CRITICAL FIX: Keep the playlist context URL format for proper playback
    const playlistVideoPattern = /<a[^>]*href="\/([a-z0-9]+)-([a-z0-9]+)\/playlist\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    
    let match;
    while ((match = playlistVideoPattern.exec(html)) !== null) {
        const playlistId = match[1];
        const videoId = match[2];
        const playlistSlug = match[3];  // This is the PLAYLIST slug
        const innerHtml = match[4] || "";
        const fullMatch = match[0];
        
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);
        
        // CRITICAL FIX: Extract title from broader context, not just the link
        // Get surrounding context to find the actual video title
        const contextStart = Math.max(0, match.index - 500);
        const contextEnd = Math.min(html.length, match.index + fullMatch.length + 500);
        const context = html.substring(contextStart, contextEnd);
        
        // Try multiple title extraction patterns with priority
        let title = null;
        const titlePatterns = [
            // Priority 1: title attribute on the link itself
            /title="([^"]+)"/i,
            // Priority 2: alt attribute on images
            /alt="([^"]+)"/i,
            // Priority 3: span with title/name class inside the link
            /<span[^>]*class="[^"]*(?:title|name|n)[^"]*"[^>]*>([^<]+)<\/span>/i,
            // Priority 4: div with title class near the link
            /<div[^>]*class="[^"]*(?:title|name|n)[^"]*"[^>]*>([^<]+)<\/div>/i,
            // Priority 5: p tag with name/title class
            /<p[^>]*class="[^"]*(?:n|name|title)[^"]*"[^>]*>([^<]+)<\/p>/i
        ];
        
        for (const pattern of titlePatterns) {
            const titleMatch = fullMatch.match(pattern) || context.match(pattern);
            if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 0) {
                const candidateTitle = titleMatch[1].trim();
                // Make sure we didn't just grab the playlist name again
                // Check if title is substantially different from playlist slug
                if (candidateTitle.length > 2 && 
                    candidateTitle.toLowerCase() !== playlistSlug.toLowerCase().replace(/[+_-]/g, ' ')) {
                    title = candidateTitle;
                    break;
                }
            }
        }
        
        // If still no title, use a generic format with video ID
        if (!title) {
            title = `Video ${videoId}`;
            log(`WARNING: Could not extract title for video ${videoId}, using fallback`);
        }
        
        title = cleanVideoTitle(title);
        
        // Extract thumbnail - look in broader context
        const thumbPatterns = [
            // Priority 1: data-src with image extensions
            /(?:data-src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
            // Priority 2: src with CDN domains
            /(?:src)="(https?:\/\/[^"]*(?:tbi\.sb-cd\.com|cdn[0-9]?\.spankbang\.com)[^"]+)"/i,
            // Priority 3: any data-src
            /(?:data-src)="(https?:\/\/[^"]+)"/i,
            // Priority 4: any src with image extension
            /(?:src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
            // Priority 5: relative URLs
            /(?:data-src|src)="(\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i
        ];
        
        let thumbnail = "";
        for (const thumbPattern of thumbPatterns) {
            const thumbMatch = innerHtml.match(thumbPattern) || fullMatch.match(thumbPattern) || context.match(thumbPattern);
            if (thumbMatch && thumbMatch[1]) {
                thumbnail = thumbMatch[1];
                // Skip if it's an avatar or icon
                if (!thumbnail.includes('avatar') && !thumbnail.includes('icon') && !thumbnail.includes('pornstarimg')) {
                    break;
                }
                thumbnail = "";
            }
        }
        
        // Default thumbnail if none found
        if (!thumbnail || thumbnail.length < 5) {
            thumbnail = `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
        }
        
        // Normalize thumbnail URL
        if (thumbnail.startsWith('//')) {
            thumbnail = 'https:' + thumbnail;
        } else if (thumbnail && thumbnail.startsWith('/') && !thumbnail.startsWith('//')) {
            thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
        } else if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = CONFIG.EXTERNAL_URL_BASE + '/' + thumbnail;
        }
        
        // Extract duration
        const durationMatch = innerHtml.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                             innerHtml.match(/>(\d+:\d+(?::\d+)?)</);
        const duration = durationMatch ? parseDuration(durationMatch[1].trim()) : 0;
        
        // Extract views - improved patterns with more flexibility
        const viewsMatch = context.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                          context.match(/([0-9,.]+[KMB]?)\s*(?:views?|plays?)/i) ||
                          fullMatch.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                          innerHtml.match(/([0-9,.]+[KMB]?)\s*(?:views?|plays?)/i);
        const views = viewsMatch ? parseViewCount(viewsMatch[1].trim()) : 0;
        
        // Extract uploader info from the video block - try multiple sources
        let uploader = extractUploaderFromSearchResult(context);
        // If not found in context, try the full match
        if (!uploader.name || uploader.name.length === 0) {
            uploader = extractUploaderFromSearchResult(fullMatch);
        }
        // If still not found, try inner HTML
        if (!uploader.name || uploader.name.length === 0) {
            uploader = extractUploaderFromSearchResult(innerHtml);
        }
        
        // CRITICAL FIX: Keep playlist context URL format {playlistId}-{videoId}/playlist/{playlistSlug}
        // This matches the actual SpankBang URL structure for videos in playlists
        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: duration,
            views: views,
            uploadDate: 0,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${playlistId}-${videoId}/playlist/${playlistSlug}`,
            uploader: uploader
        });
    }
    
    log(`parsePlaylistVideos: Pattern 1 (playlist video URLs) found ${videos.length} videos`);
    
    // Pattern 2: Standard video URLs (fallback)
    if (videos.length === 0) {
        log("parsePlaylistVideos: Pattern 1 found 0, trying standard video URLs...");
        const thumbLinkPattern = /<a[^>]*class="[^"]*thumb[^"]*"[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        
        while ((match = thumbLinkPattern.exec(html)) !== null) {
            const videoId = match[1];
            const videoSlug = match[2];
            const innerHtml = match[3] || "";
            const fullMatch = match[0];
            
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            // Get context for better extraction
            const contextStart = Math.max(0, match.index - 300);
            const contextEnd = Math.min(html.length, match.index + fullMatch.length + 300);
            const context = html.substring(contextStart, contextEnd);
            
            // Try multiple title patterns
            let title = null;
            const titlePatterns = [
                /title="([^"]+)"/i,
                /alt="([^"]+)"/i,
                /<span[^>]*class="[^"]*(?:title|name|n)[^"]*"[^>]*>([^<]+)<\/span>/i,
                /<p[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/p>/i
            ];
            
            for (const pattern of titlePatterns) {
                const titleMatch = fullMatch.match(pattern) || context.match(pattern);
                if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 0) {
                    title = titleMatch[1].trim();
                    break;
                }
            }
            
            if (!title) {
                title = videoSlug.replace(/[_-]/g, ' ');
            }
            title = cleanVideoTitle(title);
            
            // Better thumbnail extraction
            const thumbPatterns = [
                /(?:data-src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                /(?:src)="(https?:\/\/[^"]*(?:tbi\.sb-cd\.com|cdn[0-9]?\.spankbang\.com)[^"]+)"/i,
                /(?:data-src|src)="(https?:\/\/[^"]+)"/i
            ];
            
            let thumbnail = "";
            for (const thumbPattern of thumbPatterns) {
                const thumbMatch = innerHtml.match(thumbPattern) || fullMatch.match(thumbPattern);
                if (thumbMatch && thumbMatch[1]) {
                    thumbnail = thumbMatch[1];
                    if (!thumbnail.includes('avatar') && !thumbnail.includes('icon')) {
                        break;
                    }
                    thumbnail = "";
                }
            }
            
            if (!thumbnail) {
                thumbnail = `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
            }
            if (thumbnail.startsWith('//')) {
                thumbnail = 'https:' + thumbnail;
            } else if (thumbnail && thumbnail.startsWith('/') && !thumbnail.startsWith('//')) {
                thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
            }
            
            const durationMatch = innerHtml.match(/<span[^>]*class="[^"]*(?:l|length|duration)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                                 innerHtml.match(/>(\d+:\d+(?::\d+)?)</);
            const duration = durationMatch ? parseDuration(durationMatch[1].trim()) : 0;
            
            // Extract views - improved patterns with more flexibility
            const viewsMatch = context.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                              context.match(/([0-9,.]+[KMB]?)\s*(?:views?|plays?)/i) ||
                              fullMatch.match(/<span[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                              innerHtml.match(/([0-9,.]+[KMB]?)\s*(?:views?|plays?)/i);
            const views = viewsMatch ? parseViewCount(viewsMatch[1].trim()) : 0;
            
            // Extract uploader info from the video block - try multiple sources
            let uploader = extractUploaderFromSearchResult(context);
            // If not found in context, try the full match
            if (!uploader.name || uploader.name.length === 0) {
                uploader = extractUploaderFromSearchResult(fullMatch);
            }
            // If still not found, try inner HTML
            if (!uploader.name || uploader.name.length === 0) {
                uploader = extractUploaderFromSearchResult(innerHtml);
            }
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: views,
                uploadDate: 0,
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: uploader
            });
        }
        
        log(`parsePlaylistVideos: Pattern 2 (standard video URLs) found ${videos.length} videos`);
    }
    
    // Pattern 3: Look for video-item divs (broadest fallback)
    if (videos.length === 0) {
        log("parsePlaylistVideos: Pattern 2 found 0, trying video-item divs...");
        const videoItemPattern = /<div[^>]*class="[^"]*(?:video-item|item|video)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
        
        while ((match = videoItemPattern.exec(html)) !== null) {
            const block = match[0];
            
            // First try playlist video format - KEEP playlist context!
            let linkMatch = block.match(/href="\/([a-z0-9]+)-([a-z0-9]+)\/playlist\/([^"]+)"/);
            let isPlaylistVideo = false;
            let playlistId, videoId, playlistSlug;
            
            if (linkMatch) {
                isPlaylistVideo = true;
                playlistId = linkMatch[1];
                videoId = linkMatch[2];
                playlistSlug = linkMatch[3];
            } else {
                // Try standard video format
                linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/);
                if (!linkMatch) continue;
                videoId = linkMatch[1];
                playlistSlug = linkMatch[2];
            }
            
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            const titleMatch = block.match(/title="([^"]+)"/i);
            let title = titleMatch ? cleanVideoTitle(titleMatch[1]) : playlistSlug.replace(/[+_-]/g, ' ');
            
            const thumbMatch = block.match(/(?:data-src|src)="([^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
            let thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
            if (thumbnail.startsWith('//')) {
                thumbnail = 'https:' + thumbnail;
            } else if (thumbnail && thumbnail.startsWith('/') && !thumbnail.startsWith('//')) {
                thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
            } else if (thumbnail && !thumbnail.startsWith('http')) {
                thumbnail = CONFIG.EXTERNAL_URL_BASE + '/' + thumbnail;
            }
            
            const duration = extractBestDurationSecondsFromContext(block, {
                excludeProgress: true,
                preferLargest: true
            });
            
            const views = extractViewCountFromContext(block);
            
            // Extract uploader info from the video block - enhanced extraction
            let uploader = extractUploaderFromSearchResult(block);
            // If empty, try a fallback with broader context
            if (!uploader.name || uploader.name.length === 0) {
                // Look for uploader info anywhere in the block
                const uploaderFallback = { name: "", url: "", avatar: "" };
                
                // Try to find any user/channel link
                const anyUploaderMatch = block.match(/href="\/([a-z0-9]+)\/(channel|pornstar|profile)\/([^"]+)"[^>]*(?:title="([^"]+)"|>([^<]+)<)/i);
                if (anyUploaderMatch) {
                    const type = anyUploaderMatch[2];
                    const slug = anyUploaderMatch[3];
                    const name = anyUploaderMatch[4] || anyUploaderMatch[5] || slug;
                    
                    uploaderFallback.name = name.replace(/<[^>]*>/g, '').trim();
                    if (type === 'channel') {
                        uploaderFallback.url = `spankbang://channel/${anyUploaderMatch[1]}:${slug}`;
                    } else if (type === 'pornstar') {
                        uploaderFallback.url = `spankbang://profile/pornstar:${slug}`;
                    } else {
                        uploaderFallback.url = `spankbang://profile/${slug}`;
                    }
                }
                uploader = uploaderFallback;
            }
            
            // CRITICAL FIX: Keep playlist context if available
            let videoUrl;
            if (isPlaylistVideo) {
                videoUrl = `${CONFIG.EXTERNAL_URL_BASE}/${playlistId}-${videoId}/playlist/${playlistSlug}`;
            } else {
                videoUrl = `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${playlistSlug}`;
            }
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: views,
                uploadDate: 0,
                url: videoUrl,
                uploader: uploader
            });
        }
        
        log(`parsePlaylistVideos: Pattern 3 (video-item divs) found ${videos.length} videos`);
    }
    
    log(`parsePlaylistVideos: Total found ${videos.length} videos`);
    return videos;
}

// Direct video link extraction as ultimate fallback
function extractVideoLinksFromHtml(html) {
    const videos = [];
    const seenIds = new Set();
    
    log("extractVideoLinksFromHtml: Extracting all video links...");
    
    // Pattern 1: Playlist video links - KEEP playlist context!
    const playlistVideoLinks = /<a[^>]*href="\/([a-z0-9]+)-([a-z0-9]+)\/playlist\/([^"]+)"[^>]*(?:title="([^"]+)")?/gi;
    
    let match;
    while ((match = playlistVideoLinks.exec(html)) !== null) {
        const playlistId = match[1];
        const videoId = match[2];
        const playlistSlug = match[3];
        const titleFromAttr = match[4];
        
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);
        
        // Get context for better title extraction
        const contextStart = Math.max(0, match.index - 400);
        const contextEnd = Math.min(html.length, match.index + 400);
        const context = html.substring(contextStart, contextEnd);
        
        // Try to find the actual video title
        let title = null;
        if (titleFromAttr && titleFromAttr.trim().length > 0) {
            title = titleFromAttr;
        } else {
            // Look for title in nearby context
            const titlePatterns = [
                /title="([^"]+)"/i,
                /alt="([^"]+)"/i,
                /<span[^>]*class="[^"]*(?:title|name|n)[^"]*"[^>]*>([^<]+)<\/span>/i,
                /<p[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/p>/i
            ];
            
            for (const pattern of titlePatterns) {
                const titleMatch = context.match(pattern);
                if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 0) {
                    const candidate = titleMatch[1].trim();
                    // Avoid using playlist name as video title
                    if (candidate.toLowerCase() !== playlistSlug.toLowerCase().replace(/[+_-]/g, ' ')) {
                        title = candidate;
                        break;
                    }
                }
            }
        }
        
        if (!title) {
            title = `Video ${videoId}`;
        }
        title = cleanVideoTitle(title);
        
        // Look for thumbnail near this link
        const thumbPatterns = [
            /(?:data-src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
            /(?:src)="(https?:\/\/[^"]*(?:tbi\.sb-cd\.com|cdn[0-9]?\.spankbang\.com)[^"]+)"/i,
            /(?:data-src|src)="(https?:\/\/[^"]+)"/i
        ];
        
        let thumbnail = "";
        for (const thumbPattern of thumbPatterns) {
            const thumbMatch = context.match(thumbPattern);
            if (thumbMatch && thumbMatch[1]) {
                thumbnail = thumbMatch[1];
                if (!thumbnail.includes('avatar') && !thumbnail.includes('icon')) {
                    break;
                }
                thumbnail = "";
            }
        }
        
        if (!thumbnail) {
            thumbnail = `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
        }
        
        if (thumbnail.startsWith('//')) {
            thumbnail = 'https:' + thumbnail;
        } else if (thumbnail && thumbnail.startsWith('/') && !thumbnail.startsWith('//')) {
            thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
        } else if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = CONFIG.EXTERNAL_URL_BASE + '/' + thumbnail;
        }
        
        // Extract duration from nearby context
        const duration = extractBestDurationSecondsFromContext(context, {
            excludeProgress: true,
            preferLargest: true
        });
        
        // CRITICAL FIX: Keep playlist context URL
        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: duration,
            views: extractViewCountFromContext(context),
            uploadDate: 0,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${playlistId}-${videoId}/playlist/${playlistSlug}`,
            uploader: extractUploaderFromSearchResult(context)
        });
    }
    
    log(`extractVideoLinksFromHtml: Pattern 1 (playlist videos) found ${videos.length} videos`);
    
    // Pattern 2: Standard video links
    const standardVideoLinks = /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"(?:[^>]*title="([^"]+)")?/gi;
    
    while ((match = standardVideoLinks.exec(html)) !== null) {
        const videoId = match[1];
        const videoSlug = match[2];
        let title = match[3];
        
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);
        
        // Try to get better title if not in attribute
        if (!title) {
            const contextStart = Math.max(0, match.index - 200);
            const contextEnd = Math.min(html.length, match.index + 200);
            const context = html.substring(contextStart, contextEnd);
            
            const titleMatch = context.match(/title="([^"]+)"/i) || context.match(/alt="([^"]+)"/i);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1];
            } else {
                title = videoSlug.replace(/[_-]/g, ' ');
            }
        }
        
        title = cleanVideoTitle(title);
        
        // Extract duration from nearby context (unified)
        const contextStart2 = Math.max(0, match.index - 200);
        const contextEnd2 = Math.min(html.length, match.index + 200);
        const context2 = html.substring(contextStart2, contextEnd2);
        
        const duration = extractBestDurationSecondsFromContext(context2, {
            excludeProgress: true,
            preferLargest: true
        });
        
        videos.push({
            id: videoId,
            title: title,
            thumbnail: `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`,
            duration: duration,
            views: extractViewCountFromContext(context2),
            uploadDate: 0,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: { name: "", url: "", avatar: "" }
        });
    }
    
    log(`extractVideoLinksFromHtml: Total found ${videos.length} videos (${seenIds.size} unique)`);
    return videos;
}


// Fetch playlist info (name, thumbnail, video count) from a playlist URL
function fetchPlaylistInfo(playlistUrl, playlistId, slug) {
    const result = {
        name: slug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        thumbnail: "",
        videoCount: 0,
        author: ""
    };
    
    try {
        log("fetchPlaylistInfo: Fetching " + playlistUrl);
        const response = makeRequestNoThrow(playlistUrl, getAuthHeaders(), 'playlist info', true);
        
        if (!response.isOk || !response.body || response.body.length < 100) {
            log("fetchPlaylistInfo: Failed to fetch playlist page (status: " + response.code + ")");
            return result;
        }
        
        const html = response.body;
        
        // Extract title
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                          html.match(/<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            result.name = titleMatch[1].trim();
        }
        
        // Count videos by finding video links - multiple patterns for better accuracy
        const videoLinkPatterns = [
            /href="\/[a-zA-Z0-9]+\/video\//gi,
            /<a[^>]*class="[^"]*thumb[^"]*"[^>]*href="\/[a-zA-Z0-9]+\/video\//gi,
            /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>[\s\S]*?href="\/[a-zA-Z0-9]+\/video\//gi
        ];
        
        let videoCount = 0;
        for (const pattern of videoLinkPatterns) {
            const matches = html.match(pattern);
            if (matches && matches.length > videoCount) {
                videoCount = matches.length;
            }
        }
        
        // Also try to parse videos using existing parsers for more accurate count
        if (videoCount === 0) {
            log("fetchPlaylistInfo: No video links found via regex, trying parsers...");
            let videos = parseSearchResults(html);
            if (videos.length === 0) {
                videos = parsePlaylistVideos(html);
            }
            if (videos.length === 0) {
                videos = extractVideoLinksFromHtml(html);
            }
            videoCount = videos.length;
        }
        
        result.videoCount = videoCount;
        
        // Get first thumbnail - look for video thumbnails
        const thumbMatch = html.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:tbi\.sb-cd\.com|cdn[0-9]?\.spankbang\.com)[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i) ||
                          html.match(/(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
        if (thumbMatch) {
            result.thumbnail = thumbMatch[1];
        }
        
        // Try to get author/creator
        const authorPatterns = [
            /(?:by|from|creator?:?)\s*<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i,
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*class="[^"]*(?:user|creator|author|uploader)[^"]*"[^>]*>([^<]+)<\/a>/i,
            /<div[^>]*class="[^"]*(?:info|creator|owner)[^"]*"[^>]*>[\s\S]{0,300}?<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i,
            /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/i
        ];
        
        for (const pattern of authorPatterns) {
            const authorMatch = html.match(pattern);
            if (authorMatch && authorMatch[2]) {
                const authorName = authorMatch[2].replace(/<[^>]*>/g, '').trim();
                if (authorName && authorName.length > 0 && authorName.length < 50 &&
                    !authorName.match(/^(home|search|login|upload|all|videos?)$/i)) {
                    result.author = authorName;
                    break;
                }
            }
        }
        
        log(`fetchPlaylistInfo: Found - name: ${result.name}, videos: ${result.videoCount}, author: ${result.author || 'none'}, thumbnail: ${result.thumbnail ? 'yes' : 'no'}`);
    } catch (error) {
        log("fetchPlaylistInfo error: " + error.message);
    }
    
    return result;
}

// Parse videos specifically from playlist pages

function parseComments(html, videoId) {
    const comments = [];

    const commentPatterns = [
        /<div[^>]*class="[^"]*comment\s[^"]*"[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
        /<div[^>]*class="[^"]*comment[^"]*"[^>]*(?:data-id="(\d+)")?[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)?\s*(?:<\/div>)?/gi,
        /<li[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        /<div[^>]*class="[^"]*cmnt[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of commentPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const commentId = match[1] || `comment_${comments.length}`;
            const block = match[2] || match[1] || match[0];

            const userPatterns = [
                /<a[^>]*href="\/profile\/([^"]+)"[^>]*>([^<]+)<\/a>/,
                /<a[^>]*class="[^"]*(?:username|author|user|name|n)[^"]*"[^>]*>([^<]+)<\/a>/,
                /<span[^>]*class="[^"]*(?:username|author|user|name|n)[^"]*"[^>]*>([^<]+)<\/span>/,
                /<strong[^>]*class="[^"]*(?:name|user)[^"]*"[^>]*>([^<]+)<\/strong>/,
                /<strong[^>]*>([^<]+)<\/strong>/,
                /<b[^>]*>([^<]+)<\/b>/
            ];

            let username = "Anonymous";
            let userProfile = "";
            for (const userPattern of userPatterns) {
                const userMatch = block.match(userPattern);
                if (userMatch) {
                    if (userMatch[2]) {
                        userProfile = `/profile/${userMatch[1]}`;
                        username = userMatch[2].trim();
                    } else if (userMatch[1]) {
                        username = userMatch[1].trim();
                    }
                    if (username && username !== "Anonymous") break;
                }
            }

            const avatarPatterns = [
                /(?:data-src|src)="(https?:\/\/[^"]*avatar[^"]*(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/i,
                /(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/,
                /(?:data-src|src)="(\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.gif|\.webp)[^"]*)"/
            ];
            
            let avatar = "";
            for (const avatarPattern of avatarPatterns) {
                const avatarMatch = block.match(avatarPattern);
                if (avatarMatch && avatarMatch[1]) {
                    avatar = avatarMatch[1];
                    if (avatar.startsWith('//')) {
                        avatar = 'https:' + avatar;
                    }
                    break;
                }
            }

            const textPatterns = [
                /<div[^>]*class="[^"]*(?:comment-text|text|body|message|cnt|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/,
                /<p[^>]*class="[^"]*(?:comment-text|text|cnt)[^"]*"[^>]*>([\s\S]*?)<\/p>/,
                /<span[^>]*class="[^"]*(?:text|cnt|msg)[^"]*"[^>]*>([\s\S]*?)<\/span>/,
                /<p[^>]*>([\s\S]*?)<\/p>/
            ];

            let text = "";
            for (const textPattern of textPatterns) {
                const textMatch = block.match(textPattern);
                if (textMatch && textMatch[1]) {
                    text = textMatch[1].replace(/<[^>]*>/g, '').trim();
                    if (text.length > 0) break;
                }
            }

            if (!text) {
                const plainTextMatch = block.match(/>([^<]{10,500})</);
                if (plainTextMatch && plainTextMatch[1]) {
                    const candidate = plainTextMatch[1].trim();
                    if (candidate.length > 10 && !candidate.includes('ago') && !candidate.match(/^\d+$/)) {
                        text = candidate;
                    }
                }
            }

            if (!text || text.length < 2) continue;

            const likesPatterns = [
                /(\d+)\s*(?:likes?|thumbs?\s*up|up)/i,
                /class="[^"]*(?:likes?|up)[^"]*"[^>]*>(\d+)/i,
                /data-likes="(\d+)"/i
            ];
            
            let likes = 0;
            for (const likesPattern of likesPatterns) {
                const likesMatch = block.match(likesPattern);
                if (likesMatch && likesMatch[1]) {
                    likes = parseInt(likesMatch[1]) || 0;
                    break;
                }
            }

            const datePatterns = [
                /(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i,
                /class="[^"]*(?:time|date|ago)[^"]*"[^>]*>([^<]+)</i
            ];
            
            let timestamp = Math.floor(Date.now() / 1000);
            for (const datePattern of datePatterns) {
                const dateMatch = block.match(datePattern);
                if (dateMatch) {
                    if (dateMatch[2]) {
                        const num = parseInt(dateMatch[1]);
                        const unit = dateMatch[2].toLowerCase();
                        const multipliers = {
                            'second': 1,
                            'minute': 60,
                            'hour': 3600,
                            'day': 86400,
                            'week': 604800,
                            'month': 2592000,
                            'year': 31536000
                        };
                        timestamp -= num * (multipliers[unit] || 0);
                    }
                    break;
                }
            }

            comments.push({
                contextUrl: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/`,
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, username, plugin.config.id),
                    username,
                    userProfile ? `${CONFIG.EXTERNAL_URL_BASE}${userProfile}` : "",
                    avatar
                ),
                message: text,
                rating: new RatingLikes(likes),
                date: timestamp,
                replyCount: 0,
                context: { id: commentId }
            });
        }

        if (comments.length > 0) break;
    }

    return comments;
}

function fetchCommentsFromApi(videoId) {
    const comments = [];
    
    try {
        const commentsApiUrl = `${BASE_URL}/api/video/comments`;
        const response = http.POST(
            commentsApiUrl,
            `id=${videoId}&page=1`,
            {
                "User-Agent": API_HEADERS["User-Agent"],
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": `${BASE_URL}/${videoId}/video/`,
                "X-Requested-With": "XMLHttpRequest",
                "Origin": BASE_URL
            },
            false
        );
        
        if (response.isOk && response.body) {
            try {
                const data = JSON.parse(response.body);
                if (data.html) {
                    return parseComments(data.html, videoId);
                }
                if (Array.isArray(data.comments)) {
                    for (const c of data.comments) {
                        comments.push({
                            contextUrl: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/`,
                            author: new PlatformAuthorLink(
                                new PlatformID(PLATFORM, c.username || c.user || "Anonymous", plugin.config.id),
                                c.username || c.user || "Anonymous",
                                c.profile_url || "",
                                c.avatar || c.thumb || ""
                            ),
                            message: c.text || c.message || c.comment || "",
                            rating: new RatingLikes(parseInt(c.likes) || 0),
                            date: c.timestamp || Math.floor(Date.now() / 1000),
                            replyCount: 0,
                            context: { id: c.id || `comment_${comments.length}` }
                        });
                    }
                }
            } catch (e) {
                log("Failed to parse comments API response: " + e.message);
            }
        }
    } catch (e) {
        log("Comments API request failed: " + e.message);
    }
    
    return comments;
}

function hasValidAuthCookie(cookies) {
    if (!cookies) return false;
    
    const validCookieNames = ['sb_session', 'session_token', 'remember_token', 'user_id', 'logged_in'];
    
    if (typeof cookies === 'string') {
        if (cookies.length === 0) return false;
        for (const name of validCookieNames) {
            if (cookies.includes(name + '=')) {
                return true;
            }
        }
        return false;
    }
    
    if (Array.isArray(cookies)) {
        for (const cookie of cookies) {
            if (cookie && typeof cookie === 'object') {
                if (validCookieNames.includes(cookie.name)) {
                    if (cookie.value && cookie.value.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    if (typeof cookies === 'object' && cookies !== null) {
        for (const name of validCookieNames) {
            if (cookies[name]) {
                return true;
            }
        }
        return false;
    }
    
    return false;
}

function cookiesToString(cookies) {
    if (!cookies) return "";
    
    if (typeof cookies === 'string') {
        return cookies;
    }
    
    if (Array.isArray(cookies)) {
        return cookies
            .filter(c => c && c.name && c.value)
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
    }
    
    if (typeof cookies === 'object') {
        return Object.entries(cookies)
            .filter(([k, v]) => v)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
    }
    
    return "";
}

function loadAuthCookies() {
    try {
        if (typeof http.getCookies === 'function') {
            const cookies = http.getCookies(BASE_URL);
            if (hasValidAuthCookie(cookies)) {
                state.authCookies = cookiesToString(cookies);
                log("Loaded auth cookies from http.getCookies");
                return true;
            }
        }
        
        if (typeof bridge !== 'undefined') {
            if (typeof bridge.getCookieString === 'function') {
                const cookieStr = bridge.getCookieString(BASE_URL);
                if (hasValidAuthCookie(cookieStr)) {
                    state.authCookies = cookieStr;
                    log("Loaded auth cookies from bridge.getCookieString");
                    return true;
                }
            }
            
            if (typeof bridge.getAuthCookies === 'function') {
                const authCookies = bridge.getAuthCookies();
                if (hasValidAuthCookie(authCookies)) {
                    state.authCookies = cookiesToString(authCookies);
                    log("Loaded auth cookies from bridge.getAuthCookies");
                    return true;
                }
            }
            
            if (typeof bridge.getCookies === 'function') {
                try {
                    const cookies = bridge.getCookies("spankbang.com");
                    if (hasValidAuthCookie(cookies)) {
                        state.authCookies = cookiesToString(cookies);
                        log("Loaded auth cookies from bridge.getCookies");
                        return true;
                    }
                } catch (e) {
                    log("bridge.getCookies failed: " + e);
                }
            }
        }
        
        log("No valid auth cookies found (looking for sb_session, session_token, remember_token, user_id, logged_in)");
    } catch (e) {
        log("Failed to load auth cookies: " + e);
    }
    return false;
}

function validateSession() {
    try {
        const headers = getAuthHeaders();
        const response = makeRequestNoThrow(`${BASE_URL}/users/profile`, headers, 'validate session', false);
        
        if (response.code === 200 && response.body) {
            const isValid = response.body.includes('/users/logout') || 
                           response.body.includes('class="logout"') ||
                           response.body.includes('Edit Account') ||
                           response.body.includes('data-user-id') ||
                           response.body.includes('users/account') ||
                           response.body.includes('logged_in = 1') ||
                           response.body.includes('"isLoggedIn": true') ||
                           response.body.includes('site_user_id') ||
                           response.body.includes('var logged_in = 1');
            
            if (isValid) {
                const usernamePatterns = [
                    /<input[^>]*name="username"[^>]*value="([^"]+)"/i,
                    /class="[^"]*username[^"]*"[^>]*>([^<]+)</i,
                    /data-username="([^"]+)"/i,
                    /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</i,
                    /Welcome[,\s]+([^<\n]+)/i
                ];
                
                for (const pattern of usernamePatterns) {
                    const match = response.body.match(pattern);
                    if (match && match[1] && match[1].trim().length > 0) {
                        state.username = match[1].trim();
                        log("Found username: " + state.username);
                        break;
                    }
                }
                
                const userIdMatch = response.body.match(/data-user-id="(\d+)"/i) ||
                                   response.body.match(/user_id['":\s]+(\d+)/i);
                if (userIdMatch && userIdMatch[1]) {
                    state.userId = userIdMatch[1];
                    log("Found userId: " + state.userId);
                }
            }
            
            return isValid;
        }
        
        return response.code !== 302 && response.code !== 301;
    } catch (e) {
        log("Session validation failed: " + e);
        return false;
    }
}

function fetchUserInfo() {
    try {
        const headers = getAuthHeaders();
        const response = makeRequestNoThrow(`${BASE_URL}/users/account`, headers, 'fetch user info', false);
        
        if (response.code === 200 && response.body) {
            const emailMatch = response.body.match(/<input[^>]*name="email"[^>]*value="([^"]+)"/i) ||
                              response.body.match(/Email address[\s\S]*?<[^>]*>([^<]+@[^<]+)</i);
            if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1].trim();
                if (!state.username || state.username.length === 0) {
                    state.username = email.split('@')[0];
                }
                log("Found email/username: " + email);
            }
            
            const usernameMatch = response.body.match(/<input[^>]*name="username"[^>]*value="([^"]+)"/i);
            if (usernameMatch && usernameMatch[1]) {
                state.username = usernameMatch[1].trim();
                log("Found username from account page: " + state.username);
            }
            
            return true;
        }
    } catch (e) {
        log("Failed to fetch user info: " + e);
    }
    return false;
}

var pluginSettings = {
    syncRemoteHistory: true
};

source.getCapabilities = function() {
    return {
        hasSyncRemoteWatchHistory: pluginSettings.syncRemoteHistory
    };
};

source.enable = function(conf, settings, savedStateStr) {
    config = conf ?? {};
    
    log("===== PLUGIN ENABLE CALLED =====");
    
    if (settings) {
        log("enable: Received settings object");
        if (typeof settings.syncRemoteHistory !== 'undefined') {
            log("enable: syncRemoteHistory setting found, value=" + settings.syncRemoteHistory);
            if (typeof settings.syncRemoteHistory === 'boolean') {
                pluginSettings.syncRemoteHistory = settings.syncRemoteHistory;
            } else if (typeof settings.syncRemoteHistory === 'string') {
                pluginSettings.syncRemoteHistory = settings.syncRemoteHistory.toLowerCase() === 'true';
            } else {
                pluginSettings.syncRemoteHistory = !!settings.syncRemoteHistory;
            }
            log("enable: syncRemoteHistory is now " + (pluginSettings.syncRemoteHistory ? "ENABLED" : "DISABLED"));
            log("enable: hasSyncRemoteWatchHistory capability = " + pluginSettings.syncRemoteHistory);
        } else {
            log("enable: syncRemoteHistory setting NOT found in settings object");
        }
    } else {
        log("enable: No settings object provided");
    }
    
    if (!localConfig.pornstarShortIds) {
        localConfig.pornstarShortIds = {};
    }

    if (savedStateStr) {
        try {
            const savedState = JSON.parse(savedStateStr);
            state.sessionCookie = savedState.sessionCookie || "";
            state.isAuthenticated = savedState.isAuthenticated || false;
            state.authCookies = savedState.authCookies || "";
            state.username = savedState.username || "";
            state.userId = savedState.userId || "";
            
            if (savedState.pornstarShortIds) {
                localConfig.pornstarShortIds = savedState.pornstarShortIds;
            }
            
            log("State loaded: authenticated=" + state.isAuthenticated + ", username=" + state.username);
        } catch (e) {
            log("Failed to parse saved state: " + e);
        }
    }
    
    if (typeof bridge !== 'undefined' && bridge.isLoggedIn && bridge.isLoggedIn()) {
        loadAuthCookies();
        state.isAuthenticated = true;
        
        if (!state.username || state.username.length === 0) {
            try {
                fetchUserInfo();
            } catch (e) {
                log("Could not fetch user info on enable: " + e);
            }
        }
    }
};

source.disable = function() {
    state.sessionCookie = "";
    state.isAuthenticated = false;
    state.authCookies = "";
};

source.saveState = function() {
    return JSON.stringify({
        sessionCookie: state.sessionCookie,
        isAuthenticated: state.isAuthenticated,
        authCookies: state.authCookies,
        username: state.username,
        userId: state.userId,
        pornstarShortIds: localConfig.pornstarShortIds
    });
};

source.getLoggedInUser = function() {
    try {
        if (!source.isLoggedIn()) {
            return null;
        }
        
        if (!state.username || state.username.length === 0) {
            fetchUserInfo();
        }
        
        if (state.username && state.username.length > 0) {
            return state.username;
        }
        
        return "Logged In";
    } catch (e) {
        log("getLoggedInUser error: " + e);
        return null;
    }
};

source.isLoggedIn = function() {
    try {
        if (typeof bridge !== 'undefined' && bridge.isLoggedIn && bridge.isLoggedIn()) {
            log("bridge.isLoggedIn() returned true");
            if (!state.authCookies || state.authCookies.length === 0 || !hasValidAuthCookie(state.authCookies)) {
                loadAuthCookies();
            }
            
            if (hasValidAuthCookie(state.authCookies)) {
                if (validateSession()) {
                    state.isAuthenticated = true;
                    log("isLoggedIn: Session validated successfully");
                    return true;
                }
            }
        }
        
        if (!state.authCookies || !hasValidAuthCookie(state.authCookies)) {
            loadAuthCookies();
        }
        
        if (!state.authCookies || !hasValidAuthCookie(state.authCookies)) {
            log("isLoggedIn: No valid auth cookies found");
            return false;
        }
        
        const isValid = validateSession();
        state.isAuthenticated = isValid;
        log("isLoggedIn: Session validation result = " + isValid);
        return isValid;
    } catch (e) {
        log("isLoggedIn check failed: " + e);
        return false;
    }
};

source.login = function(code) {
    try {
        loadAuthCookies();
        state.isAuthenticated = true;
        log("Login triggered - authentication cookies captured");
        
        if (validateSession()) {
            log("Login successful - session validated");
            return true;
        } else {
            log("Login may have issues - session validation uncertain");
            return true;
        }
    } catch (e) {
        log("Login failed: " + e);
        return false;
    }
};

function clearSpankBangCookies() {
    try {
        if (typeof bridge !== 'undefined' && bridge.clearCookies) {
            bridge.clearCookies("spankbang.com");
            bridge.clearCookies("www.spankbang.com");
            log("Cleared cookies via bridge");
            return true;
        }
        if (typeof http !== 'undefined' && http.clearCookies) {
            http.clearCookies("spankbang.com");
            http.clearCookies("www.spankbang.com");
            log("Cleared cookies via http");
            return true;
        }
        log("No cookie clearing API available");
        return false;
    } catch (e) {
        log("clearSpankBangCookies error: " + e);
        return false;
    }
}

source.logout = function() {
    try {
        state.sessionCookie = "";
        state.isAuthenticated = false;
        state.authCookies = "";
        clearSpankBangCookies();
        log("Logged out - cleared all auth state and cookies");
    } catch (e) {
        log("Logout error: " + e);
    }
};

source.prepareLogin = function() {
    try {
        log("prepareLogin called - clearing stale cookies before login");
        state.sessionCookie = "";
        state.isAuthenticated = false;
        state.authCookies = "";
        clearSpankBangCookies();
        return true;
    } catch (e) {
        log("prepareLogin error: " + e);
        return false;
    }
};

function parseSubscriptionsPage(html) {
    const subscriptions = [];
    const seenIds = new Set();

    // Multiple parsing strategies to catch all subscription formats

    // Strategy 1: Parse user subscriptions with profile links
    const userSubPatterns = [
        /<a[^>]*href="\/profile\/([^"\/\?]+)"[^>]*>[\s\S]{0,500}?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]+)")?/gi,
        /<div[^>]*class="[^"]*(?:profile|subscription|user-item)[^"]*"[^>]*>[\s\S]{0,800}?<a[^>]*href="\/profile\/([^"\/]+)"[\s\S]{0,300}?<img[^>]*(?:data-src|src)="([^"]+)"/gi,
        /<div[^>]*data-user="([^"]+)"[^>]*>[\s\S]{0,500}?href="\/profile\/([^"\/]+)"[\s\S]{0,300}?(?:data-src|src)="([^"]+)"/gi
    ];

    for (const pattern of userSubPatterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex
        while ((match = pattern.exec(html)) !== null) {
            let profileSlug, avatar, name;

            // Handle different capture group orders
            if (match[1] && match[1].includes('/profile/')) {
                continue; // Skip malformed matches
            }

            profileSlug = (match[1] || match[2] || "").replace(/\/$/, '');
            avatar = match[2] || match[3] || "";
            name = match[3] || match[1] || profileSlug;

            if (!profileSlug || seenIds.has(profileSlug)) continue;
            seenIds.add(profileSlug);

            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;

            name = (name || profileSlug.replace(/-/g, ' ')).trim();

            subscriptions.push({
                id: profileSlug,
                name: name,
                url: `spankbang://profile/${profileSlug}`,
                avatar: avatar,
                type: 'user'
            });
        }
    }

    // Strategy 2: Find all profile links and extract from surrounding context
    const allProfileLinks = /href="\/profile\/([^"\/\?]+)"/gi;
    let linkMatch;
    while ((linkMatch = allProfileLinks.exec(html)) !== null) {
        const profileSlug = linkMatch[1].replace(/\/$/, '');
        if (seenIds.has(profileSlug)) continue;

        // Extract context around the link
        const contextStart = Math.max(0, linkMatch.index - 400);
        const contextEnd = Math.min(html.length, linkMatch.index + 400);
        const context = html.substring(contextStart, contextEnd);

        // Look for avatar in context
        let avatar = "";
        const avatarMatch = context.match(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i);
        if (avatarMatch && avatarMatch[1]) {
            avatar = avatarMatch[1];
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (!avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
        }

        // Look for name in context
        let name = profileSlug.replace(/-/g, ' ');
        const nameMatch = context.match(/alt="([^"]+)"|title="([^"]+)"|>([^<]{3,30})</);
        if (nameMatch && (nameMatch[1] || nameMatch[2] || nameMatch[3])) {
            const foundName = (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim();
            if (foundName.length > 2 && foundName.length < 50) {
                name = foundName;
            }
        }

        seenIds.add(profileSlug);
        subscriptions.push({
            id: profileSlug,
            name: name,
            url: `spankbang://profile/${profileSlug}`,
            avatar: avatar,
            type: 'user'
        });
    }

    return subscriptions;
}

function parsePornstarSubscriptionsPage(html) {
    const subscriptions = [];
    const seenIds = new Set();

    // Multiple parsing strategies for pornstar subscriptions
    const pornstarSubPatterns = [
        /<a[^>]*href="\/pornstar\/([^"\/\?]+)"[^>]*>[\s\S]{0,500}?<img[^>]*(?:data-src|src)="([^"]+)"[^>]*(?:alt="([^"]+)")?/gi,
        /<div[^>]*class="[^"]*(?:pornstar|model)[^"]*"[^>]*>[\s\S]{0,800}?<a[^>]*href="\/pornstar\/([^"\/]+)"[\s\S]{0,300}?<img[^>]*(?:data-src|src)="([^"]+)"/gi
    ];

    for (const pattern of pornstarSubPatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(html)) !== null) {
            const pornstarSlug = (match[1] || "").replace(/\/$/, '');
            if (!pornstarSlug || seenIds.has(`pornstar:${pornstarSlug}`)) continue;
            seenIds.add(`pornstar:${pornstarSlug}`);

            let avatar = match[2] || "";
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (avatar && !avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;

            let name = match[3] || pornstarSlug.replace(/-/g, ' ');
            name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            subscriptions.push({
                id: `pornstar:${pornstarSlug}`,
                name: name,
                url: `spankbang://profile/pornstar:${pornstarSlug}`,
                avatar: avatar,
                type: 'pornstar'
            });
        }
    }

    // Strategy 2: Find all pornstar links
    const allPornstarLinks = /href="\/pornstar\/([^"\/\?]+)"/gi;
    let linkMatch;
    while ((linkMatch = allPornstarLinks.exec(html)) !== null) {
        const pornstarSlug = linkMatch[1].replace(/\/$/, '');
        if (seenIds.has(`pornstar:${pornstarSlug}`)) continue;

        const contextStart = Math.max(0, linkMatch.index - 400);
        const contextEnd = Math.min(html.length, linkMatch.index + 400);
        const context = html.substring(contextStart, contextEnd);

        let avatar = "";
        const avatarMatch = context.match(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i);
        if (avatarMatch && avatarMatch[1]) {
            avatar = avatarMatch[1];
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            else if (!avatar.startsWith('http')) avatar = 'https://spankbang.com' + avatar;
        }

        let name = pornstarSlug.replace(/-/g, ' ');
        name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const nameMatch = context.match(/alt="([^"]+)"|title="([^"]+)"/);
        if (nameMatch && (nameMatch[1] || nameMatch[2])) {
            const foundName = (nameMatch[1] || nameMatch[2]).trim();
            if (foundName.length > 2 && foundName.length < 50) {
                name = foundName;
            }
        }

        seenIds.add(`pornstar:${pornstarSlug}`);
        subscriptions.push({
            id: `pornstar:${pornstarSlug}`,
            name: name,
            url: `spankbang://profile/pornstar:${pornstarSlug}`,
            avatar: avatar,
            type: 'pornstar'
        });
    }

    return subscriptions;
}


source.getUserSubscriptions = function() {
    log("Getting user subscriptions");
    
    const subscriptions = [];
    
    try {
        // Fetch user subscriptions using authenticated client with rate limiting
        log("Fetching user subscriptions from /users/subscriptions");
        const userSubsHtml = makeRequestNoThrow(`${BASE_URL}/users/subscriptions`, API_HEADERS, 'user subscriptions', true);
        
        if (!userSubsHtml.isOk) {
            log("Failed to fetch user subscriptions, user may not be logged in");
            return [];
        }
        
        const userSubs = parseSubscriptionsPage(userSubsHtml.body);
        subscriptions.push(...userSubs);
        log(`Found ${userSubs.length} user subscriptions`);
    } catch (error) {
        log("Failed to fetch user subscriptions: " + error.message);
    }
    
    try {
        // Fetch pornstar subscriptions using authenticated client with rate limiting
        log("Fetching pornstar subscriptions from /users/subscriptions_pornstars");
        const pornstarSubsHtml = makeRequestNoThrow(`${BASE_URL}/users/subscriptions_pornstars`, API_HEADERS, 'pornstar subscriptions', true);
        
        if (!pornstarSubsHtml.isOk) {
            log("Failed to fetch pornstar subscriptions");
            return subscriptions.map(sub => sub.url);
        }
        
        const pornstarSubs = parsePornstarSubscriptionsPage(pornstarSubsHtml.body);
        subscriptions.push(...pornstarSubs);
        log(`Found ${pornstarSubs.length} pornstar subscriptions`);
    } catch (error) {
        log("Failed to fetch pornstar subscriptions: " + error.message);
    }
    
    log(`Total subscriptions found: ${subscriptions.length}`);
    return subscriptions.map(sub => sub.url);
};

source.getSubscriptions = function() {
    return source.getUserSubscriptions();
};

source.getWatchHistory = function() {
    try {
        // Use authenticated request directly (same pattern as getUserSubscriptions)
        // Don't check isLoggedIn() as it may fail even with valid cookies in the http client
        const historyUrl = USER_URLS.HISTORY;
        log("Fetching watch history from: " + historyUrl);
        
        const response = makeRequestNoThrow(historyUrl, API_HEADERS, 'watch history', true);
        
        if (!response.isOk) {
            log("getWatchHistory: Failed with status " + response.code + ", user may not be logged in");
            return [];
        }
        
        const html = response.body;
        
        if (!html || html.length < 100) {
            log("getWatchHistory: Empty or invalid HTML response (length: " + (html ? html.length : 0) + ")");
            return [];
        }
        
        log("getWatchHistory: HTML length = " + html.length);
        
        let videos = parseSearchResults(html);
        
        if (videos.length === 0) {
            videos = parseHistoryPage(html);
        }
        
        if (videos.length === 0) {
            log("getWatchHistory: No videos found. HTML snippet (first 500 chars): " + html.substring(0, 500).replace(/[\n\r]/g, ' '));
        }
        
        log("getWatchHistory found " + videos.length + " videos");
        
        // Return full video objects (PlatformVideo) instead of just URLs
        // This ensures thumbnails, duration, and other metadata are preserved in history
        return videos.map(v => createPlatformVideo(v));

    } catch (error) {
        log("getWatchHistory error: " + error.message);
        return [];
    }
};

function parseHistoryPage(html) {
    const videos = [];
    const seenIds = new Set();
    
    log("parseHistoryPage: Starting parse, HTML length = " + html.length);
    
    // SpankBang history page specific patterns - they use "video-item" and "thumb" classes
    const videoItemPatterns = [
        // Pattern for SpankBang's history page structure: <a class="thumb">...<span class="l">duration</span>...</a>
        /<a[^>]*class="[^"]*thumb[^"]*"[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        // Standard video-item div pattern
        /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
        /<div[^>]*class="[^"]*(?:video-list-item|thumb|media-item|item|results)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
        /<div[^>]*class="[^"]*(?:video-item|video-list-item|thumb|media-item|item)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
        /<article[^>]*class="[^"]*(?:video|thumb)[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
        /<li[^>]*class="[^"]*(?:video|thumb)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
        /<div[^>]*class="[^"]*thumb[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    ];
    
    // First try the <a class="thumb"> pattern which directly captures video ID
    const thumbAnchorPattern = /<a[^>]*class="[^"]*thumb[^"]*"[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let thumbMatch;
    while ((thumbMatch = thumbAnchorPattern.exec(html)) !== null && videos.length < 200) {
        const videoId = thumbMatch[1];
        const videoSlug = thumbMatch[2].replace(/["']/g, '');
        const innerContent = thumbMatch[3] || "";
        
        if (seenIds.has(videoId)) continue;
        if (videoId === 'users' || videoId === 'search' || videoId === 'playlists') continue;
        seenIds.add(videoId);
        
        // Get title from nearby context - EXPANDED to capture sibling thumbnail elements
        const fullMatch = thumbMatch[0];
        const matchIndex = thumbMatch.index;
        // Expand context window to 2000 chars before/after to ensure we capture the entire parent container
        // with sibling <a class="thumb"> elements that contain the actual thumbnail images
        const contextStart = Math.max(0, matchIndex - 2000);
        const contextEnd = Math.min(html.length, matchIndex + fullMatch.length + 2000);
        const fullContext = html.substring(contextStart, contextEnd);
        
        const titleMatch = fullMatch.match(/title="([^"]+)"/i) || 
                          fullMatch.match(/alt="([^"]+)"/i) ||
                          fullContext.match(/title="([^"]+)"/i) ||
                          fullContext.match(/<span[^>]*class="[^"]*(?:title|name|n)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                          fullContext.match(/<p[^>]*class="[^"]*n[^"]*"[^>]*>([^<]+)<\/p>/i);
        let title = titleMatch ? cleanVideoTitle(titleMatch[1]) : videoSlug.replace(/[_+-]/g, ' ');
        
        // Extract thumbnail - CRITICAL: Look in fullContext (parent container) not just video link
        // SpankBang history has thumbnails in SIBLING <a class="thumb"> elements, not in the video link itself
        let thumbnail = "";
        const thumbPatterns = [
            // Try data-src with image extensions first (most reliable)
            /data-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
            // Try CDN URLs specifically  
            /data-src="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
            /data-src="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
            // Try src with CDN
            /src="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
            /src="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
            // Try lazy-src attribute
            /lazy-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
            // Generic data-src
            /data-src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
            // Generic src with image extensions
            /src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
            // Background image style
            /style="[^"]*background[^:]*:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/i,
            // Catch any data-src as last resort
            /data-src="([^"]+)"/i
        ];
        
        // IMPORTANT: Search in fullContext (parent container) FIRST, then innerContent, then fullMatch
        // This is because SpankBang's history page has thumbnails in sibling elements
        for (const thumbPattern of thumbPatterns) {
            const tMatch = fullContext.match(thumbPattern) || innerContent.match(thumbPattern) || fullMatch.match(thumbPattern);
            if (tMatch && tMatch[1]) {
                thumbnail = tMatch[1];
                if (!thumbnail.includes('avatar') && !thumbnail.includes('icon') && !thumbnail.includes('pornstarimg')) {
                    log("parseHistoryPage: Found thumbnail for video " + videoId + ": " + thumbnail.substring(0, 80));
                    break;
                }
                thumbnail = "";
            }
        }
        
        // Log if no thumbnail found - DO NOT use fake CDN URLs as they use different IDs
        if (!thumbnail || thumbnail.length < 10) {
            log("parseHistoryPage: WARNING - No thumbnail found for video " + videoId + ", will use CDN fallback");
            // Use CDN fallback as last resort, but it may not work due to ID mismatch
            thumbnail = `https://tbi.sb-cd.com/t/${videoId}/1/6/w:500/default.jpg`;
        }
        if (thumbnail.startsWith('//')) {
            thumbnail = 'https:' + thumbnail;
        }
        
        // Extract duration - FIXED to prioritize data attributes and actual video duration
        // History pages can have BOTH watch progress AND video duration - we need the video duration!
        let duration = 0;
        
        // PRIORITY 1: Check data attributes (most reliable for actual video duration)
        const dataAttrMatch = fullContext.match(/data-duration=["'](\d+)["']/i) || 
                             fullContext.match(/data-length=["'](\d+)["']/i) ||
                             fullContext.match(/data-time=["'](\d+)["']/i);
        if (dataAttrMatch && dataAttrMatch[1]) {
            duration = parseInt(dataAttrMatch[1]);
            log("parseHistoryPage: Found duration from data attribute: " + duration + "s");
        }
        
        // PRIORITY 2: Look for <span class="l"> which typically shows video duration
        if (duration === 0) {
            const spanLMatch = fullContext.match(/<span[^>]*class=["'][^"']*\bl\b[^"']*["'][^>]*>([^<]+)<\/span>/i);
            if (spanLMatch && spanLMatch[1]) {
                const durStr = spanLMatch[1].trim();
                // Make sure it's a time format (not text)
                if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(durStr)) {
                    duration = parseDuration(durStr);
                    log("parseHistoryPage: Found duration from <span class='l'>: " + duration + "s (" + durStr + ")");
                }
            }
        }
        
        // PRIORITY 3: Look for duration/length class that's NOT near "watched" or "progress" text
        if (duration === 0) {
            const durationSpans = fullContext.match(/<span[^>]*class=["'][^"']*(?:duration|length|dur)[^"']*["'][^>]*>([^<]+)<\/span>/gi);
            if (durationSpans) {
                for (const span of durationSpans) {
                    const durMatch = span.match(/>([^<]+)</);
                    if (durMatch && durMatch[1]) {
                        const durStr = durMatch[1].trim();
                        // Get context around this span to check if it's watch progress
                        const spanIndex = fullContext.indexOf(span);
                        const contextAround = fullContext.substring(
                            Math.max(0, spanIndex - 100),
                            Math.min(fullContext.length, spanIndex + span.length + 100)
                        );
                        // Skip if near watch progress indicators
                        if (/watched|progress|viewed|ago/i.test(contextAround)) {
                            continue;
                        }
                        // Validate it's a time format
                        if (/^\d{1,3}:\d{2}(?::\d{2})?$/.test(durStr)) {
                            duration = parseDuration(durStr);
                            log("parseHistoryPage: Found duration from duration/length class: " + duration + "s (" + durStr + ")");
                            break;
                        }
                    }
                }
            }
        }
        
        // PRIORITY 4: Last resort - look for any time format, but validate it's reasonable
        if (duration === 0) {
            const timeMatches = fullContext.match(/>\s*(\d{1,3}:\d{2}(?::\d{2})?)\s*</g);
            if (timeMatches) {
                for (const timeMatch of timeMatches) {
                    const durMatch = timeMatch.match(/(\d{1,3}:\d{2}(?::\d{2})?)/);
                    if (durMatch && durMatch[1]) {
                        const durStr = durMatch[1];
                        const testDuration = parseDuration(durStr);
                        // Videos are usually at least 30 seconds - helps filter out false positives
                        if (testDuration >= 30) {
                            duration = testDuration;
                            log("parseHistoryPage: Found duration from time pattern: " + duration + "s (" + durStr + ")");
                            break;
                        }
                    }
                }
            }
        }
        
        // Extract views if available - enhanced patterns
        let views = 0;
        const viewsPatterns = [
            // Primary pattern - class="v" or "views"
            /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>([^<]+)<\/span>/i,
            /<span[^>]*class="[^"]*views[^"]*"[^>]*>([^<]+)<\/span>/i,
            // Div with views
            /<div[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/div>/i,
            // Data attribute
            /data-views="([^"]+)"/i,
            // Views text pattern
            /(\d+(?:[,.]\d+)?[KMB]?)\s*views?/i,
            // Generic number with K/M/B suffix
            />([0-9,.]+[KMB]?)\s*<\/span>/i
        ];
        for (const viewPattern of viewsPatterns) {
            const viewsMatch = fullContext.match(viewPattern);
            if (viewsMatch && viewsMatch[1]) {
                views = parseViewCount(viewsMatch[1].trim());
                if (views > 0) break;
            }
        }
        
        // Extract uploader information from the context
        const uploader = extractUploaderFromSearchResult(fullContext);
        
        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: duration,
            views: views,
            url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
            uploader: uploader
        });
    }
    
    log("parseHistoryPage: After thumb anchor pattern, found " + videos.length + " videos");
    
    // If thumb anchor pattern didn't work, try div-based patterns
    if (videos.length === 0) {
        for (const itemPattern of videoItemPatterns.slice(1)) { // Skip first pattern which we already tried
            let itemMatch;
            while ((itemMatch = itemPattern.exec(html)) !== null && videos.length < 200) {
                const block = itemMatch[1] || itemMatch[0];
                if (!block || block.trim().length < 10) continue;
                
                const linkMatch = block.match(/href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/i);
                if (!linkMatch) continue;
                
                const videoId = linkMatch[1];
                const videoSlug = linkMatch[2].replace(/["']/g, '');
                
                if (seenIds.has(videoId)) continue;
                if (videoId === 'users' || videoId === 'search' || videoId === 'playlists') continue;
                seenIds.add(videoId);
                
                const titleMatch = block.match(/title="([^"]+)"/i) || 
                                  block.match(/alt="([^"]+)"/i) ||
                                  block.match(/<span[^>]*class="[^"]*(?:title|name|n)[^"]*"[^>]*>([^<]+)<\/span>/i);
                let title = titleMatch ? cleanVideoTitle(titleMatch[1]) : videoSlug.replace(/[_+-]/g, ' ');
                
                // Enhanced thumbnail patterns
                const thumbPatterns = [
                    /data-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                    /data-src="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
                    /data-src="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
                    /src="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
                    /src="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
                    /src="(https?:\/\/[^"]*spankbang[^"]*\/t\/[^"]+)"/i,
                    /lazy-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                    /data-src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
                    /src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                    /data-src="([^"]+)"/i,
                    /style="[^"]*background[^:]*:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/i
                ];
                let thumbnail = "";
                for (const thumbPattern of thumbPatterns) {
                    const thumbMatch = block.match(thumbPattern);
                    if (thumbMatch && thumbMatch[1]) {
                        thumbnail = thumbMatch[1];
                        if (!thumbnail.includes('avatar') && !thumbnail.includes('icon') && !thumbnail.includes('pornstarimg')) {
                            break;
                        }
                        thumbnail = "";
                    }
                }
                if (!thumbnail || thumbnail.length < 10) {
                    thumbnail = `https://tbi.sb-cd.com/t/${videoId}/1/6/w:500/default.jpg`;
                    log("parseHistoryPage (div pattern): Using CDN fallback thumbnail for video " + videoId);
                }
                if (thumbnail.startsWith('//')) {
                    thumbnail = 'https:' + thumbnail;
                }
                
                // Enhanced duration patterns with watch progress filtering
                const durationPatterns = [
                    // Data attributes (most reliable - seconds)
                    /data-duration="([^"]+)"/i,
                    /data-length="([^"]+)"/i,
                    /data-time="([^"]+)"/i,
                    // Specific duration containers (not progress indicators)
                    /<div[^>]*class="[^"]*(?:duration|time)[^"]*"[^>]*>(\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})<\/div>/i,
                    /<span[^>]*class="[^"]*(?:duration|time)[^"]*"[^>]*>(\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})<\/span>/i,
                    // Class-based patterns (validate to avoid watch progress)
                    /<span[^>]*class="[^"]*\bl\b[^"]*"[^>]*>(\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})<\/span>/i,
                    /<span[^>]*class="[^"]*(?:length|dur)[^"]*"[^>]*>([^<]+)<\/span>/i,
                    /<div[^>]*class="[^"]*(?:l|length|dur)[^"]*"[^>]*>([^<]+)<\/div>/i,
                    // Generic patterns
                    /<span[^>]*>(\d{1,2}:\d{2}:\d{2})<\/span>/i,
                    /<span[^>]*>(\d{1,3}:\d{2})<\/span>/i,
                    />(\d{1,2}:\d{2}:\d{2})</,
                    />(\d{1,3}:\d{2})</,
                    /(\d{1,2}:\d{2}:\d{2})/,
                    /(\d{1,3}:\d{2})/
                ];
                let duration = 0;
                for (const durationPattern of durationPatterns) {
                    const durationMatch = block.match(durationPattern);
                    if (durationMatch && durationMatch[1]) {
                        const durStr = durationMatch[1].trim();
                        
                        // Skip if this looks like watch progress
                        const contextAroundMatch = block.substring(
                            Math.max(0, block.indexOf(durStr) - 50),
                            Math.min(block.length, block.indexOf(durStr) + durStr.length + 50)
                        );
                        
                        if (contextAroundMatch && (
                            /watched|progress|viewed|ago|minutes?\s+ago|hours?\s+ago/i.test(contextAroundMatch)
                        )) {
                            continue;
                        }
                        
                        duration = parseDuration(durStr);
                        if (duration > 0) {
                            log("parseHistoryPage (div pattern): Found duration " + duration + "s from '" + durStr + "'");
                            break;
                        }
                    }
                }
                
                // Extract views with enhanced patterns
                let views = 0;
                const viewsPatterns = [
                    /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>([^<]+)<\/span>/i,
                    /<span[^>]*class="[^"]*views[^"]*"[^>]*>([^<]+)<\/span>/i,
                    /<div[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/div>/i,
                    /data-views="([^"]+)"/i,
                    /(\d+(?:[,.]\d+)?[KMB]?)\s*views?/i,
                    />([0-9,.]+[KMB]?)\s*<\/span>/i
                ];
                for (const viewPattern of viewsPatterns) {
                    const viewsMatch = block.match(viewPattern);
                    if (viewsMatch && viewsMatch[1]) {
                        views = parseViewCount(viewsMatch[1].trim());
                        if (views > 0) break;
                    }
                }
                
                // Extract uploader information
                const uploader = extractUploaderFromSearchResult(block);
                
                videos.push({
                    id: videoId,
                    title: title,
                    thumbnail: thumbnail,
                    duration: duration,
                    views: views,
                    url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                    uploader: uploader
                });
            }
            if (videos.length > 0) break;
        }
    }
    
    // Final fallback: extract any video links and get surrounding context
    if (videos.length === 0) {
        log("parseHistoryPage: Trying direct video link extraction fallback");
        const videoPatterns = [
            /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/gi,
            /href='\/([a-zA-Z0-9]+)\/video\/([^']+)'/gi
        ];
        
        for (const pattern of videoPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && videos.length < 200) {
                const videoId = match[1];
                const videoSlug = match[2].replace(/["']/g, '');
                
                if (seenIds.has(videoId)) continue;
                if (videoId === 'users' || videoId === 'search' || videoId === 'playlists') continue;
                seenIds.add(videoId);
                
                // Expand context to capture sibling thumbnail elements
                const contextStart = Math.max(0, match.index - 2000);
                const contextEnd = Math.min(html.length, match.index + 2000);
                const context = html.substring(contextStart, contextEnd);
                
                const titleMatch = context.match(/title="([^"]+)"/i) || context.match(/alt="([^"]+)"/i);
                let title = titleMatch ? cleanVideoTitle(titleMatch[1]) : videoSlug.replace(/[_+-]/g, ' ');
                
                // Enhanced thumbnail patterns for fallback
                const thumbPatterns = [
                    /data-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                    /data-src="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
                    /data-src="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
                    /src="(https?:\/\/[^"]*tbi\.sb-cd\.com[^"]+)"/i,
                    /src="(https?:\/\/[^"]*sb-cd\.com[^"]+)"/i,
                    /src="(https?:\/\/[^"]*spankbang[^"]*\/t\/[^"]+)"/i,
                    /lazy-src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                    /data-src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
                    /src="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i,
                    /data-src="([^"]+)"/i,
                    /style="[^"]*background[^:]*:\s*url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/i
                ];
                let thumbnail = "";
                for (const thumbPattern of thumbPatterns) {
                    const thumbMatch = context.match(thumbPattern);
                    if (thumbMatch && thumbMatch[1]) {
                        thumbnail = thumbMatch[1];
                        if (!thumbnail.includes('avatar') && !thumbnail.includes('icon') && !thumbnail.includes('pornstarimg')) {
                            break;
                        }
                        thumbnail = "";
                    }
                }
                if (!thumbnail || thumbnail.length < 10) {
                    thumbnail = `https://tbi.sb-cd.com/t/${videoId}/1/6/w:500/default.jpg`;
                    log("parseHistoryPage (fallback pattern): Using CDN fallback thumbnail for video " + videoId);
                }
                if (thumbnail.startsWith('//')) {
                    thumbnail = 'https:' + thumbnail;
                }
                
                // Enhanced duration patterns for fallback with watch progress filtering
                const durationPatterns = [
                    // Data attributes first (most reliable)
                    /data-duration="([^"]+)"/i,
                    /data-length="([^"]+)"/i,
                    /data-time="([^"]+)"/i,
                    // Specific duration containers
                    /<div[^>]*class="[^"]*(?:duration|time)[^"]*"[^>]*>(\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})<\/div>/i,
                    /<span[^>]*class="[^"]*(?:duration|time)[^"]*"[^>]*>(\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})<\/span>/i,
                    // Class-based patterns with validation
                    /<span[^>]*class="[^"]*\bl\b[^"]*"[^>]*>(\d{1,2}:\d{2}:\d{2}|\d{1,3}:\d{2})<\/span>/i,
                    /<span[^>]*class="[^"]*(?:length|dur)[^"]*"[^>]*>([^<]+)<\/span>/i,
                    /<div[^>]*class="[^"]*(?:l|length|dur)[^"]*"[^>]*>([^<]+)<\/div>/i,
                    // Generic patterns
                    /<span[^>]*>(\d{1,2}:\d{2}:\d{2})<\/span>/i,
                    /<span[^>]*>(\d{1,3}:\d{2})<\/span>/i,
                    />(\d{1,2}:\d{2}:\d{2})</,
                    />(\d{1,3}:\d{2})</,
                    /(\d{1,2}:\d{2}:\d{2})/,
                    /(\d{1,3}:\d{2})/
                ];
                let duration = 0;
                for (const durationPattern of durationPatterns) {
                    const durationMatch = context.match(durationPattern);
                    if (durationMatch && durationMatch[1]) {
                        const durStr = durationMatch[1].trim();
                        
                        // Skip if this looks like watch progress
                        const contextAroundMatch = context.substring(
                            Math.max(0, context.indexOf(durStr) - 50),
                            Math.min(context.length, context.indexOf(durStr) + durStr.length + 50)
                        );
                        
                        if (contextAroundMatch && (
                            /watched|progress|viewed|ago|minutes?\s+ago|hours?\s+ago/i.test(contextAroundMatch)
                        )) {
                            continue;
                        }
                        
                        duration = parseDuration(durStr);
                        if (duration > 0) {
                            log("parseHistoryPage (fallback): Found duration " + duration + "s from '" + durStr + "'");
                            break;
                        }
                    }
                }
                
                // Extract views and uploader information with enhanced patterns
                let views = 0;
                const viewsPatterns = [
                    /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>([^<]+)<\/span>/i,
                    /<span[^>]*class="[^"]*views[^"]*"[^>]*>([^<]+)<\/span>/i,
                    /<div[^>]*class="[^"]*(?:v|views)[^"]*"[^>]*>([^<]+)<\/div>/i,
                    /data-views="([^"]+)"/i,
                    /(\d+(?:[,.]\d+)?[KMB]?)\s*views?/i,
                    />([0-9,.]+[KMB]?)\s*<\/span>/i
                ];
                for (const viewPattern of viewsPatterns) {
                    const viewsMatch = context.match(viewPattern);
                    if (viewsMatch && viewsMatch[1]) {
                        views = parseViewCount(viewsMatch[1].trim());
                        if (views > 0) break;
                    }
                }
                
                const uploader = extractUploaderFromSearchResult(context);
                
                videos.push({
                    id: videoId,
                    title: title,
                    thumbnail: thumbnail,
                    duration: duration,
                    views: views,
                    url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                    uploader: uploader
                });
            }
        }
    }
    
    if (videos.length === 0) {
        const anyVideoLinks = html.match(/href="[^"]*\/video\/[^"]+"/gi);
        log("parseHistoryPage: Fallback check - found " + (anyVideoLinks ? anyVideoLinks.length : 0) + " video links in HTML");
        // Log a sample of the HTML structure
        log("parseHistoryPage: HTML sample (chars 0-2000): " + html.substring(0, 2000).replace(/[\n\r]/g, ' ').substring(0, 500));
    }
    
    log("parseHistoryPage: Found " + videos.length + " videos");
    return videos;
}

function fetchVideoBasicInfo(videoId) {
    try {
        const videoUrl = `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/`;
        const response = makeRequestNoThrow(videoUrl, API_HEADERS, 'video basic info');
        if (!response.isOk || !response.body) {
            return null;
        }
        
        const html = response.body;
        
        const thumbMatch = html.match(/itemprop="thumbnailUrl"\s*content="([^"]+)"/i) ||
                          html.match(/property="og:image"\s*content="([^"]+)"/i) ||
                          html.match(/name="twitter:image"\s*content="([^"]+)"/i);
        let thumbnail = thumbMatch ? thumbMatch[1] : `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`;
        
        const durationMatch = html.match(/itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/i);
        let duration = 0;
        if (durationMatch) {
            duration = (parseInt(durationMatch[1]) || 0) * 60 + (parseInt(durationMatch[2]) || 0);
        }
        
        const titleMatch = html.match(/<h1[^>]*title="([^"]+)"/i) ||
                          html.match(/property="og:title"\s*content="([^"]+)"/i);
        const title = titleMatch ? cleanVideoTitle(titleMatch[1]) : "";
        
        return {
            thumbnail: thumbnail,
            duration: duration,
            title: title
        };
    } catch (e) {
        log("fetchVideoBasicInfo error for " + videoId + ": " + e.message);
        return null;
    }
}

// Helper function to create history video with proper watched timestamp
// GrayJay requires datetime to be set for history import to work
// Also sets playbackDate and playbackTime for proper history tracking
function createHistoryPlatformVideo(videoData, watchedTimestamp) {
    const uploader = videoData.uploader || {};
    
    let author;
    if (hasValidUploader(uploader)) {
        author = createPlatformAuthor(uploader);
    } else {
        author = new PlatformAuthorLink(
            new PlatformID(PLATFORM, PLATFORM, plugin.config.id),
            "",
            "",
            ""
        );
    }
    
    // CRITICAL: For history items, datetime must be the WATCHED timestamp, not upload date
    // GrayJay uses this to determine when the video was watched for history import
    const datetime = watchedTimestamp || Math.floor(Date.now() / 1000);
    
    // Ensure URL is valid and has proper format (with slug for isContentDetailsUrl to match)
    // If videoData.url exists and is valid, use it; otherwise construct a fallback
    let url = videoData.url;
    if (!url || !url.includes('/video/')) {
        // Create a fallback URL with a slug derived from title or use 'video' as default
        const slug = videoData.title ? encodeURIComponent(videoData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)) : 'video';
        url = `${CONFIG.EXTERNAL_URL_BASE}/${videoData.id}/video/${slug}`;
    }
    
    // CRITICAL FIX: GrayJay requires playbackTime > 0 for history import!
    // From StateHistory.cs: if(video.PlaybackTime > 0) { toSync.Add(video); }
    // If playbackTime is 0, GrayJay silently skips the video!
    // Use duration * 0.5 (50% watched) or at least 60 seconds as fallback
    const duration = videoData.duration || 300; // Default 5 min if unknown
    const playbackTime = Math.max(60, Math.floor(duration * 0.5)); // At least 60s or 50% of video
    
    log(`createHistoryPlatformVideo: ID=${videoData.id}, URL=${url}, Title=${(videoData.title || '').substring(0, 30)}, playbackDate=${datetime}, playbackTime=${playbackTime}`);
    
    // Create PlatformVideo with history-specific fields
    // CRITICAL: playbackDate and playbackTime MUST be passed in constructor for GrayJay to recognize them
    const video = new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail),
        author: author,
        datetime: datetime, // Use watched timestamp, NOT upload date
        duration: duration,
        viewCount: videoData.views || 0,
        url: url,
        isLive: false,
        // CRITICAL: These fields MUST be in constructor for history import
        // playbackTime MUST be > 0 for GrayJay to import (see StateHistory.cs line ~240)
        playbackDate: datetime,  // When the video was watched (Unix timestamp)
        playbackTime: playbackTime  // Playback position in seconds (MUST BE > 0!)
    });
    
    return video;
}

// Add getUserHistory function for GrayJay plugin testing
source.getUserHistory = function() {
    try {
        log("getUserHistory: Starting to fetch user history");
        
        // Use the same authenticated request pattern as other user functions
        const historyUrl = USER_URLS.HISTORY;
        log("getUserHistory: Fetching from " + historyUrl);
        
        const response = makeRequestNoThrow(historyUrl, API_HEADERS, 'user history', true);
        
        if (!response.isOk) {
            log("getUserHistory: Failed with status " + response.code + ", user may not be logged in");
            // Return empty pager, not array
            return new SpankBangHistoryPager([], false, { continuationToken: null });
        }
        
        const html = response.body;
        
        if (!html || html.length < 100) {
            log("getUserHistory: Empty or invalid HTML response (length: " + (html ? html.length : 0) + ")");
            // Return empty pager, not array
            return new SpankBangHistoryPager([], false, { continuationToken: null });
        }
        
        log("getUserHistory: HTML length = " + html.length);
        
        // Parse history using both parseSearchResults and parseHistoryPage
        log("getUserHistory: Attempting parseSearchResults first...");
        let videos = parseSearchResults(html);
        
        if (videos.length === 0) {
            log("getUserHistory: parseSearchResults found 0 videos, trying parseHistoryPage");
            videos = parseHistoryPage(html);
        } else {
            log("getUserHistory: parseSearchResults found " + videos.length + " videos, skipping parseHistoryPage");
        }
        
        if (videos.length === 0) {
            log("getUserHistory: No videos found. HTML snippet (first 500 chars): " + html.substring(0, 500).replace(/[\n\r]/g, ' '));
            // Return empty pager, not array
            return new SpankBangHistoryPager([], false, { continuationToken: null });
        }
        
        log("getUserHistory: Found " + videos.length + " videos");
        
        // CRITICAL FIX: Assign watched timestamps to history items
        // SpankBang history page shows most recently watched first
        // Since the page doesn't show exact watched times, we assign timestamps
        // in descending order (most recent = now, older items = further back)
        const now = Math.floor(Date.now() / 1000);
        const ONE_HOUR = 3600;
        
        // Create platform videos with proper watched timestamps
        const platformVideos = videos.map((v, index) => {
            // Each item is assumed to be watched 1 hour apart (most recent first)
            // This ensures GrayJay gets valid timestamps for history import
            const watchedTimestamp = now - (index * ONE_HOUR);
            return createHistoryPlatformVideo(v, watchedTimestamp);
        });
        
        // Log first video for debugging
        if (platformVideos.length > 0) {
            const firstVideo = platformVideos[0];
            const videoIdValue = firstVideo.id && firstVideo.id.value ? firstVideo.id.value : String(firstVideo.id);
            log("getUserHistory: First video - ID: " + videoIdValue + 
                ", Title: " + (firstVideo.name || '').substring(0, 50) + 
                ", Datetime: " + firstVideo.datetime +
                ", Thumbnail: " + (firstVideo.thumbnails && firstVideo.thumbnails.sources && firstVideo.thumbnails.sources.length > 0 ? firstVideo.thumbnails.sources[0].url : 'NO THUMBNAIL'));
        }
        
        // CRITICAL FIX: Detect if there are more pages by checking for pagination links
        // SpankBang shows pagination like: ?page=2, ?page=3, etc.
        let hasMore = false;
        
        // Pattern 1: Look for next page link (page 2 since we're on page 1)
        if (/[?&]page=2/i.test(html)) {
            hasMore = true;
            log("getUserHistory: Found page 2 link in HTML");
        }
        
        // Pattern 2: Fallback to video count check
        if (!hasMore && videos.length >= 24) {
            hasMore = true;
            log("getUserHistory: Full page detected (" + videos.length + " videos), assuming more pages");
        }
        
        const nextToken = hasMore ? "2" : null;
        
        log("getUserHistory: Returning pager with " + platformVideos.length + " videos, hasMore=" + hasMore);
        return new SpankBangHistoryPager(platformVideos, hasMore, { continuationToken: nextToken });
        
    } catch (error) {
        log("getUserHistory error: " + error.message);
        // Return empty pager, not array
        return new SpankBangHistoryPager([], false, { continuationToken: null });
    }
};

source.syncRemoteWatchHistory = function(continuationToken) {
    try {
        log("===== SYNC REMOTE WATCH HISTORY START =====");
        log("syncRemoteWatchHistory: Has auth cookies = " + (state.authCookies && state.authCookies.length > 0));
        
        // CRITICAL FIX: Fetch ALL history pages at once
        // GrayJay's pager mechanism only calls nextPage() a limited number of times
        // So we fetch everything in one call to ensure complete history import
        
        let allVideos = [];
        let currentPage = 1;
        const MAX_PAGES = 100; // Safety limit to prevent infinite loops
        
        while (currentPage <= MAX_PAGES) {
            // IMPORTANT: Always use ?page=X format, even for page 1
            const historyUrl = `${USER_URLS.HISTORY}?page=${currentPage}`;
            
            log("syncRemoteWatchHistory: Fetching page " + currentPage + " from " + historyUrl);
            
            const response = makeRequestNoThrow(historyUrl, API_HEADERS, 'remote watch history', true);
            
            log("syncRemoteWatchHistory: Page " + currentPage + " response code: " + response.code);
            
            if (!response.isOk) {
                if (currentPage === 1) {
                    log("syncRemoteWatchHistory: FAILED on first page - Status " + response.code);
                    log("syncRemoteWatchHistory: This usually means you're not logged into SpankBang in Grayjay");
                    return new SpankBangHistoryPager([], false, { continuationToken: null });
                } else {
                    log("syncRemoteWatchHistory: Page " + currentPage + " failed with status " + response.code + ", stopping pagination");
                    break;
                }
            }
            
            const html = response.body;
            const htmlLen = html ? html.length : 0;
            log("syncRemoteWatchHistory: Page " + currentPage + " HTML length: " + htmlLen);
            
            if (!html || htmlLen < 100) {
                log("syncRemoteWatchHistory: Page " + currentPage + " returned empty/short HTML, stopping");
                break;
            }
            
            // Parse videos from this page
            let pageVideos = parseSearchResults(html);
            log("syncRemoteWatchHistory: Page " + currentPage + " parseSearchResults found " + pageVideos.length + " videos");
            
            if (pageVideos.length === 0) {
                pageVideos = parseHistoryPage(html);
                log("syncRemoteWatchHistory: Page " + currentPage + " parseHistoryPage found " + pageVideos.length + " videos");
            }
            
            if (pageVideos.length === 0) {
                log("syncRemoteWatchHistory: No videos on page " + currentPage + ", reached end of history");
                break;
            }
            
            allVideos = allVideos.concat(pageVideos);
            log("syncRemoteWatchHistory: Total videos so far: " + allVideos.length);
            
            // SIMPLE CHECK: If we got videos, try the next page
            // Only stop when a page returns 0 videos
            currentPage++;
            
            // Small delay between requests to avoid rate limiting
            sleep(500);
        }
        
        log("syncRemoteWatchHistory: Finished fetching. Total pages checked: " + currentPage + ", Total videos: " + allVideos.length);
        
        if (allVideos.length === 0) {
            log("syncRemoteWatchHistory: No history videos found");
            return new SpankBangHistoryPager([], false, { continuationToken: null });
        }
        
        // Assign watched timestamps to all history items
        const now = Math.floor(Date.now() / 1000);
        const ONE_HOUR = 3600;
        
        const platformVideos = allVideos.map((v, index) => {
            const watchedTimestamp = now - (index * ONE_HOUR);
            return createHistoryPlatformVideo(v, watchedTimestamp);
        });
        
        log("syncRemoteWatchHistory: Returning " + platformVideos.length + " total history videos");
        log("===== SYNC REMOTE WATCH HISTORY END =====");
        
        // Return all videos at once, no more pages needed
        return new SpankBangHistoryPager(platformVideos, false, { continuationToken: null });

    } catch (error) {
        log("syncRemoteWatchHistory: EXCEPTION - " + error.message);
        log("syncRemoteWatchHistory: Stack trace: " + (error.stack || "No stack trace"));
        return new SpankBangHistoryPager([], false, { continuationToken: null });
    }
};

source.getUserPlaylists = function() {
    log("Getting user playlists");

    try {
        // Fetch playlists using authenticated client with rate limiting
        log("Fetching playlists from /users/playlists");
        const playlistsResp = makeRequestNoThrow(`${BASE_URL}/users/playlists`, API_HEADERS, 'user playlists', true);
        
        if (!playlistsResp.isOk) {
            log("Failed to fetch playlists, user may not be logged in");
            return [];
        }
        
        // Use parsePlaylistsPage directly - simpler and more reliable (branch 5 approach)
        const playlists = parsePlaylistsPage(playlistsResp.body);
        log(`getUserPlaylists found ${playlists.length} playlists`);
        return playlists.map(pl => pl.url);
    } catch (error) {
        log("Failed to fetch playlists: " + error.message);
        return [];
    }
};

function parseUserPlaylistsPage(html) {
    const playlists = [];
    const seenIds = new Set();
    
    const playlistBlockPatterns = [
        /<div[^>]*class="[^"]*(?:playlist|item|card|thumb)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
        /<article[^>]*>([\s\S]*?)<\/article>/gi,
        /<li[^>]*class="[^"]*(?:playlist|item)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    ];
    
    for (const blockPattern of playlistBlockPatterns) {
        let blockMatch;
        while ((blockMatch = blockPattern.exec(html)) !== null) {
            const block = blockMatch[1];
            if (!block || block.trim().length < 10) continue;
            
            const hrefMatch = block.match(/href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/i);
            if (!hrefMatch) continue;
            
            const shortId = hrefMatch[1];
            const slug = hrefMatch[2].replace(/["']/g, '');
            const playlistId = `${shortId}:${slug}`;
            
            if (seenIds.has(playlistId)) continue;
            if (shortId === 'users' || shortId === 'search') continue;
            seenIds.add(playlistId);
            
            const nameMatch = block.match(/title="([^"]+)"/i) || 
                              block.match(/<span[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                              block.match(/<span[^>]*>([^<]{3,50})<\/span>/i);
            const name = nameMatch ? (nameMatch[1] || "").replace(/<[^>]*>/g, '').trim() : slug.replace(/[_-]/g, ' ');
            
            const thumbMatch = block.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i) ||
                               block.match(/(?:data-src|src)="([^"]+)"/i);
            let thumbnail = thumbMatch ? thumbMatch[1] : "";
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
            
            const countMatch = block.match(/(\d+)\s*videos?/i);
            const videoCount = countMatch ? parseInt(countMatch[1]) : 0;
            
            if (name.length > 1) {
                playlists.push({
                    id: playlistId,
                    name: name,
                    thumbnail: thumbnail,
                    author: "",
                    videoCount: videoCount,
                    url: `spankbang://playlist/${playlistId}`
                });
            }
        }
        if (playlists.length > 0) break;
    }
    
    if (playlists.length === 0) {
        const playlistPatterns = [
            /href="\/([a-z0-9]+)\/playlist\/([^"\/]+)\/?"/gi,
            /href='\/([a-z0-9]+)\/playlist\/([^'\/]+)\/?'/gi
        ];
        
        for (const pattern of playlistPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const shortId = match[1];
                const slug = match[2].replace(/["']/g, '');
                const playlistId = `${shortId}:${slug}`;
                
                if (seenIds.has(playlistId)) continue;
                if (shortId === 'users' || shortId === 'search') continue;
                seenIds.add(playlistId);
                
                const contextStart = Math.max(0, match.index - 400);
                const contextEnd = Math.min(html.length, match.index + 400);
                const context = html.substring(contextStart, contextEnd);
                
                const nameMatch = context.match(/title="([^"]+)"/i) || 
                                  context.match(/<span[^>]*>([^<]{3,50})<\/span>/i);
                const name = nameMatch ? (nameMatch[1] || "").replace(/<[^>]*>/g, '').trim() : slug.replace(/[_-]/g, ' ');
                
                const thumbMatch = context.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
                let thumbnail = thumbMatch ? thumbMatch[1] : "";
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                else if (thumbnail && !thumbnail.startsWith('http')) thumbnail = CONFIG.EXTERNAL_URL_BASE + thumbnail;
                
                const countMatch = context.match(/(\d+)\s*videos?/i);
                const videoCount = countMatch ? parseInt(countMatch[1]) : 0;
                
                if (name.length > 1) {
                    playlists.push({
                        id: playlistId,
                        name: name,
                        thumbnail: thumbnail,
                        author: "",
                        videoCount: videoCount,
                        url: `spankbang://playlist/${playlistId}`
                    });
                }
            }
        }
    }
    
    if (playlists.length === 0) {
        const anyPlaylistLinks = html.match(/href="[^"]*\/playlist\/[^"]+"/gi);
        log("parseUserPlaylistsPage: Fallback check - found " + (anyPlaylistLinks ? anyPlaylistLinks.length : 0) + " playlist links in HTML");
    }
    
    return playlists;
}

source.getPlaylists = function() {
    return source.getUserPlaylists();
};

source.getFavorites = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getFavorites: Not logged in");
            return [];
        }

        const likedUrl = `${BASE_URL}/users/liked`;
        const html = makeRequest(likedUrl, null, 'user liked videos', true);
        
        let videos = parseSearchResults(html);
        
        if (videos.length === 0) {
            videos = parseFavoritesPage(html);
        }
        
        log("getFavorites found " + videos.length + " videos");
        return videos.map(v => v.url);

    } catch (error) {
        log("getFavorites error: " + error.message);
        return [];
    }
};

function parseFavoritesPage(html) {
    const videos = [];
    const seenIds = new Set();
    
    const videoPatterns = [
        /href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*(?:title="([^"]+)")?/gi,
        /<a[^>]*class="[^"]*thumb[^"]*"[^>]*href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"[^>]*>[\s\S]*?(?:title="([^"]+)")?/gi,
        /<div[^>]*class="[^"]*(?:favorite|fav)[^"]*"[^>]*>[\s\S]*?href="\/([a-zA-Z0-9]+)\/video\/([^"]+)"/gi
    ];
    
    for (const pattern of videoPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && videos.length < 100) {
            const videoId = match[1];
            const videoSlug = match[2];
            
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            let title = match[3] ? cleanVideoTitle(match[3]) : videoSlug.replace(/[_+-]/g, ' ');
            
            // Try to extract duration from surrounding context - FIXED patterns
            const contextStart = Math.max(0, match.index - 300);
            const contextEnd = Math.min(html.length, match.index + match[0].length + 300);
            const context = html.substring(contextStart, contextEnd);
            
            const duration = extractBestDurationSecondsFromContext(context, {
                excludeProgress: true,
                preferLargest: true
            });
            
            videos.push({
                id: videoId,
                title: title,
                thumbnail: `https://tbi.sb-cd.com/t/${videoId}/def/1/default.jpg`,
                duration: duration,
                views: extractViewCountFromContext(context),
                url: `${CONFIG.EXTERNAL_URL_BASE}/${videoId}/video/${videoSlug}`,
                uploader: extractUploaderFromSearchResult(context)
            });
        }
        if (videos.length > 0) break;
    }
    
    return videos;
}

source.getUserPlaylistsSubs = function() {
    try {
        if (!source.isLoggedIn()) {
            log("getUserPlaylistsSubs: Not logged in");
            return [];
        }

        const playlistsSubsUrl = `${BASE_URL}/users/playlists_subs`;
        const html = makeRequest(playlistsSubsUrl, null, 'subscribed playlists', true);
        
        const playlists = parsePlaylistsPage(html);
        
        const platformPlaylists = playlists.map(p => new PlatformPlaylist({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.thumbnail || "",
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, p.author || "Unknown", plugin.config.id),
                p.author || "Unknown",
                "",
                ""
            ),
            videoCount: p.videoCount || 0,
            url: p.url
        }));
        
        log("getUserPlaylistsSubs found " + platformPlaylists.length + " subscribed playlists");
        return platformPlaylists;

    } catch (error) {
        log("getUserPlaylistsSubs error: " + error.message);
        return [];
    }
};

source.getLikedVideos = function() {
    return source.getFavorites();
};

source.getHome = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        // Use main page (recommended) instead of trending
        // Page 1: https://spankbang.com/
        // Page 2+: https://spankbang.com/2/
        const url = page > 1 ? `${BASE_URL}/${page}/` : BASE_URL;

        log("getHome: Fetching recommended videos from " + url);
        const html = makeRequest(url, API_HEADERS, 'home content');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        log("getHome: Found " + platformVideos.length + " videos on page " + page);
        
        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangHomeContentPager(platformVideos, hasMore, { continuationToken: nextToken });

    } catch (error) {
        throw new ScriptException("Failed to get home content: " + error.message);
    }
};

source.searchSuggestions = function(query) {
    try {
        const suggestUrl = `${BASE_URL}/api/search/suggestions?q=${encodeURIComponent(query)}`;
        const response = makeRequestNoThrow(suggestUrl, API_HEADERS, 'search suggestions', false);

        if (response.isOk && response.body) {
            try {
                const data = JSON.parse(response.body);
                if (Array.isArray(data)) {
                    return data.slice(0, 10);
                }
                if (data.suggestions && Array.isArray(data.suggestions)) {
                    return data.suggestions.slice(0, 10);
                }
            } catch (e) {}
        }
    } catch (e) {}

    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: ["Trending", "New", "Popular", "Featured"],
        filters: [
            {
                id: "quality",
                name: "Quality",
                isMultiSelect: false,
                filters: [
                    { name: "All", value: "" },
                    { name: "720p", value: "hd" },
                    { name: "1080p", value: "fhd" },
                    { name: "4K", value: "uhd" }
                ]
            },
            {
                id: "duration",
                name: "Duration",
                isMultiSelect: false,
                filters: [
                    { name: "All", value: "" },
                    { name: "10+ min", value: "10" },
                    { name: "20+ min", value: "20" },
                    { name: "40+ min", value: "40" }
                ]
            },
            {
                id: "period",
                name: "Date",
                isMultiSelect: false,
                filters: [
                    { name: "All time", value: "" },
                    { name: "Today", value: "d" },
                    { name: "This week", value: "w" },
                    { name: "This month", value: "m" },
                    { name: "This year", value: "y" }
                ]
            },
            {
                id: "tag",
                name: "Category",
                isMultiSelect: false,
                filters: [
                    { name: "All", value: "" },
                    { name: "Amateur", value: "amateur" },
                    { name: "Anal", value: "anal" },
                    { name: "Asian", value: "asian" },
                    { name: "Babe", value: "babe" },
                    { name: "BBW", value: "bbw" },
                    { name: "Big Ass", value: "big+ass" },
                    { name: "Big Cock", value: "big+cock" },
                    { name: "Big Tits", value: "big+tits" },
                    { name: "Blonde", value: "blonde" },
                    { name: "Blowjob", value: "blowjob" },
                    { name: "Bondage", value: "bondage" },
                    { name: "Brunette", value: "brunette" },
                    { name: "Casting", value: "casting" },
                    { name: "Compilation", value: "compilation" },
                    { name: "Cosplay", value: "cosplay" },
                    { name: "Creampie", value: "creampie" },
                    { name: "Cumshot", value: "cumshot" },
                    { name: "Deepthroat", value: "deepthroat" },
                    { name: "Double Penetration", value: "double+penetration" },
                    { name: "Ebony", value: "ebony" },
                    { name: "Facesitting", value: "facesitting" },
                    { name: "Facial", value: "facial" },
                    { name: "Feet", value: "feet" },
                    { name: "Gangbang", value: "gangbang" },
                    { name: "Gay", value: "gay" },
                    { name: "Hairy", value: "hairy" },
                    { name: "Handjob", value: "handjob" },
                    { name: "Hardcore", value: "hardcore" },
                    { name: "Hentai", value: "hentai" },
                    { name: "Indian", value: "indian" },
                    { name: "Interracial", value: "interracial" },
                    { name: "Japanese", value: "japanese" },
                    { name: "Korean", value: "korean" },
                    { name: "Latina", value: "latina" },
                    { name: "Lesbian", value: "lesbian" },
                    { name: "Massage", value: "massage" },
                    { name: "Masturbation", value: "masturbation" },
                    { name: "Mature", value: "mature" },
                    { name: "MILF", value: "milf" },
                    { name: "Orgy", value: "orgy" },
                    { name: "Outdoor", value: "outdoor" },
                    { name: "Petite", value: "petite" },
                    { name: "POV", value: "pov" },
                    { name: "Public", value: "public" },
                    { name: "Redhead", value: "redhead" },
                    { name: "Rough", value: "rough" },
                    { name: "Small Tits", value: "small+tits" },
                    { name: "Squirt", value: "squirt" },
                    { name: "Stepmom", value: "stepmom" },
                    { name: "Stepsister", value: "stepsister" },
                    { name: "Stockings", value: "stockings" },
                    { name: "Teen", value: "teen" },
                    { name: "Threesome", value: "threesome" },
                    { name: "Trans", value: "trans" },
                    { name: "Vintage", value: "vintage" },
                    { name: "VR", value: "vr" },
                    { name: "Webcam", value: "webcam" }
                ]
            }
        ]
    };
};

source.search = function(query, type, order, filters, continuationToken) {
    try {
        // Check if the query is a playlist URL - if so, redirect to searchPlaylists
        if (query && typeof query === 'string') {
            const playlistExternalMatch = query.match(REGEX_PATTERNS.urls.playlistExternal);
            const playlistSimpleMatch = query.match(REGEX_PATTERNS.urls.playlistSimple);
            const userPlaylistsMatch = query.match(REGEX_PATTERNS.urls.userPlaylistsPage);
            const userPlaylistsSubsMatch = query.match(REGEX_PATTERNS.urls.userPlaylistsSubsPage);
            const profilePlaylistsMatch = query.match(REGEX_PATTERNS.urls.profilePlaylistsPage);
            
            if (playlistExternalMatch || playlistSimpleMatch || userPlaylistsMatch || userPlaylistsSubsMatch || profilePlaylistsMatch) {
                log("Detected playlist URL in search, redirecting to searchPlaylists");
                return source.searchPlaylists(query, type, order, filters, continuationToken);
            }
        }
        
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchQuery = query ? query.trim().replace(/\s+/g, '+') : '';
        
        if (filters && typeof filters === 'object' && filters.tag && filters.tag.length > 0) {
            const tagVal = filters.tag[0];
            if (tagVal && tagVal !== "") {
                if (searchQuery) {
                    searchQuery = `${searchQuery}+${tagVal}`;
                } else {
                    searchQuery = tagVal;
                }
            }
        }
        
        if (!searchQuery) {
            return new SpankBangSearchPager([], false, {
                query: query,
                continuationToken: null
            });
        }

        let searchUrl = `${BASE_URL}/s/${encodeURIComponent(searchQuery)}/${page}/`;

        const params = [];

        if (filters && typeof filters === 'object') {
            if (filters.duration && filters.duration.length > 0) {
                const durationVal = filters.duration[0];
                if (durationVal && durationVal !== "") {
                    params.push(`d=${durationVal}`);
                }
            }
            if (filters.quality && filters.quality.length > 0) {
                const qualityVal = filters.quality[0];
                if (qualityVal && qualityVal !== "") {
                    params.push(`q=${qualityVal}`);
                }
            }
            if (filters.period && filters.period.length > 0) {
                const periodVal = filters.period[0];
                if (periodVal && periodVal !== "") {
                    params.push(`p=${periodVal}`);
                }
            }
        }

        log("Search order value: " + order + " (type: " + typeof order + ")");
        
        const orderStr = String(order);
        log("Search order normalized to string: '" + orderStr + "'");
        
        // FIX: Differentiate between "no selection/default" and "Trending"
        // Default (no parameter) should show mixed/popular content
        // Trending should explicitly request trending
        if (orderStr === "" || orderStr === "0" || orderStr === "null" || orderStr === "undefined" || order === null || order === undefined) {
            // Default: Use Popular as default (most relevant for searches)
            log("Order: Default (using Popular) - adding o=popular");
            params.push("o=popular");
        } else if (orderStr === "Trending" || orderStr === "trending" || order === Type.Order.Trending || orderStr === "2") {
            // Explicit Trending selection - use trending parameter
            log("Order: Trending - adding o=trending");
            params.push("o=trending");
        } else if (orderStr === "1" || orderStr === "new" || order === "New" || order === Type.Order.Chronological) {
            log("Order: New - adding o=new");
            params.push("o=new");
        } else if (orderStr === "Popular" || orderStr === "popular" || orderStr === "3") {
            log("Order: Popular - adding o=popular");
            params.push("o=popular");
        } else if (orderStr === "4" || orderStr === "Featured" || order === "Featured" || orderStr === "featured") {
            log("Order: Featured - adding o=featured");
            params.push("o=featured");
        } else if (orderStr === "5" || orderStr === "views") {
            log("Order: Views - adding o=views");
            params.push("o=views");
        } else if (orderStr === "6" || orderStr === "rating" || order === Type.Order.Rating) {
            log("Order: Rating - adding o=top");
            params.push("o=top");
        } else if (orderStr === "7" || orderStr === "length") {
            log("Order: Length - adding o=length");
            params.push("o=length");
        } else {
            log("Order: Unknown value '" + orderStr + "' - using popular as default");
            params.push("o=popular");
        }

        if (params.length > 0) {
            searchUrl += "?" + params.join("&");
        }

        log("Search URL: " + searchUrl);

        const html = makeRequest(searchUrl, API_HEADERS, 'search');
        const videos = parseSearchResults(html);
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangSearchPager(platformVideos, hasMore, {
            query: query,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to search: " + error.message);
    }
};

source.searchChannels = function(query, continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchUrl;

        if (!query || query.trim().length === 0) {
            searchUrl = `${BASE_URL}/pornstars`;
            if (page > 1) {
                searchUrl += `/${page}`;
            }
        } else {
            // Use + for spaces to match SpankBang's URL encoding format
            const searchQuery = query.trim().replace(/\s+/g, '+');
            searchUrl = `${BASE_URL}/s/${encodeURIComponent(searchQuery)}/`;
            if (page > 1) {
                searchUrl += `${page}/`;
            }
        }

        log("searchChannels: Fetching URL: " + searchUrl);
        const html = makeRequest(searchUrl, API_HEADERS, 'channel search');
        
        // Parse pornstars, profiles, AND channels from the page
        const pornstars = parsePornstarsPage(html);
        const profiles = parseProfilesPage(html);
        const channels = parseChannelsPage(html);
        
        log("searchChannels: Found " + pornstars.length + " pornstars, " + profiles.length + " profiles, and " + channels.length + " channels");

        // Combine all into platform channels
        const platformChannels = [];
        const seenIds = new Set();
        
        // Add channels first (studios like "Evil Angel" are usually channels)
        channels.forEach(c => {
            if (seenIds.has(c.id)) return;
            seenIds.add(c.id);
            platformChannels.push(new PlatformChannel({
                id: new PlatformID(PLATFORM, c.id, plugin.config.id),
                name: c.name,
                thumbnail: c.avatar,
                banner: "",
                subscribers: c.subscribers || 0,
                description: `${c.videoCount || 0} videos`,
                url: `spankbang://channel/${c.id}`,
                links: {}
            }));
        });
        
        // Add pornstars
        pornstars.forEach(p => {
            if (seenIds.has(p.id)) return;
            seenIds.add(p.id);
            platformChannels.push(new PlatformChannel({
                id: new PlatformID(PLATFORM, p.id, plugin.config.id),
                name: p.name,
                thumbnail: p.avatar,
                banner: "",
                subscribers: p.subscribers,
                description: `${p.videoCount} videos`,
                url: `spankbang://profile/${p.id}`,
                links: {}
            }));
        });
        
        // Add profiles
        profiles.forEach(p => {
            if (seenIds.has(p.id)) return;
            seenIds.add(p.id);
            platformChannels.push(new PlatformChannel({
                id: new PlatformID(PLATFORM, p.id, plugin.config.id),
                name: p.name,
                thumbnail: p.avatar,
                banner: "",
                subscribers: p.subscribers,
                description: `${p.videoCount} videos`,
                url: `spankbang://profile/${p.id}`,
                links: {}
            }));
        });

        const hasMore = platformChannels.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangChannelPager(platformChannels, hasMore, {
            query: query,
            continuationToken: nextToken
        });

    } catch (error) {
        log("searchChannels error: " + error.message);
        return new SpankBangChannelPager([], false, { query: query });
    }
};

source.getCreators = function(continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let url = `${BASE_URL}/pornstars`;
        if (page > 1) {
            url += `/${page}`;
        }

        const html = makeRequest(url, API_HEADERS, 'pornstars');
        const pornstars = parsePornstarsPage(html);

        const platformChannels = pornstars.map(p => new PlatformChannel({
            id: new PlatformID(PLATFORM, p.id, plugin.config.id),
            name: p.name,
            thumbnail: p.avatar,
            banner: "",
            subscribers: p.subscribers,
            description: `${p.videoCount} videos`,
            url: `spankbang://profile/${p.id}`,
            links: {}
        }));

        const hasMore = pornstars.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangCreatorPager(platformChannels, hasMore, {
            continuationToken: nextToken
        });

    } catch (error) {
        log("getCreators error: " + error.message);
        return new SpankBangCreatorPager([], false, { continuationToken: null });
    }
};

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    if (REGEX_PATTERNS.urls.channelInternal.test(url)) return true;
    if (REGEX_PATTERNS.urls.profileInternal.test(url)) return true;
    if (REGEX_PATTERNS.urls.categoryInternal.test(url)) return true;
    if (REGEX_PATTERNS.urls.categoryS.test(url)) return true;

    if (REGEX_PATTERNS.urls.relativeProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativeChannel.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstar.test(url)) return true;
    if (REGEX_PATTERNS.urls.relativePornstarSimple.test(url)) return true;

    if (REGEX_PATTERNS.urls.channelProfile.test(url)) return true;
    if (REGEX_PATTERNS.urls.channelOfficial.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstar.test(url)) return true;
    if (REGEX_PATTERNS.urls.pornstarSimple.test(url)) return true;
    if (REGEX_PATTERNS.urls.channelS.test(url)) return true;

    return false;
};

source.getChannel = function(url) {
    try {
        // CRITICAL: Early return for empty/invalid URLs
        // This prevents errors when Grayjay tries to open empty author links
        if (!url || url.trim().length === 0) {
            log("getChannel: Empty URL received - returning null");
            throw new ScriptException("No channel URL provided");
        }
        
        log("getChannel: Called with URL: " + url);
        
        const result = extractChannelId(url);
        let profileUrl;
        let internalUrl;
        let resolvedShortId = result.shortId;
        
        const normalizedId = result.id.toLowerCase().replace(/\s+/g, '+');

        if (result.type === 'category') {
            // Handle categories/tags (like /s/japanese/)
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/s/${normalizedId}/`;
            internalUrl = `spankbang://category/${normalizedId}`;
        } else if (result.type === 'pornstar') {
            if (!resolvedShortId) {
                resolvedShortId = resolvePornstarShortId(normalizedId);
                log("Resolved pornstar shortId for " + normalizedId + ": " + resolvedShortId);
            }
            
            if (resolvedShortId) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${resolvedShortId}/pornstar/${normalizedId}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${normalizedId}`;
            }
            internalUrl = `spankbang://profile/pornstar:${normalizedId}`;
        } else if (result.type === 'channel') {
            const [shortId, channelName] = result.id.split(':');
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}`;
            internalUrl = `spankbang://channel/${result.id}`;
        } else {
            profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}`;
            internalUrl = `spankbang://profile/${result.id}`;
        }

        log("Fetching channel from: " + profileUrl);
        const html = makeRequest(profileUrl, API_HEADERS, 'channel');

        const namePatterns = [
            /<h1[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/h1>/i,
            /<h1[^>]*>([^<]+)<\/h1>/,
            /<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/
        ];

        let name = result.id.replace(/\+/g, ' ');
        for (const pattern of namePatterns) {
            const nameMatch = html.match(pattern);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1].trim();
                break;
            }
        }

        let avatar = "";
        const avatarPatterns = [
            /src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
            /data-src="(https?:\/\/[^"]*pornstarimg\/f\/\d+-\d+\.jpg)"/i,
            /src="(https?:\/\/[^"]*pornstarimg[^"]+)"/i,
            /"(\/\/[^"]*pornstarimg[^"]+)"/i,
            /src="(https?:\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /src="(\/\/spankbang\.com\/avatar\/[^"]+)"/i,
            /<img[^>]*src="(\/avatar\/[^"]+)"/i,
            /class="[^"]*avatar[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*profile-pic[^"]*"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*image[^"]*"[^>]*src="([^"]+)"/i,
            /<div[^>]*class="[^"]*(?:pic|photo|thumb)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i
        ];

        for (const pattern of avatarPatterns) {
            const avatarMatch = html.match(pattern);
            if (avatarMatch && avatarMatch[1]) {
                avatar = avatarMatch[1];
                if (avatar.startsWith('//')) {
                    avatar = `https:${avatar}`;
                } else if (!avatar.startsWith('http')) {
                    avatar = `${CONFIG.EXTERNAL_URL_BASE}${avatar}`;
                }
                if (avatar.includes('pornstarimg') || avatar.includes('avatar')) {
                    break;
                }
            }
        }

        if (!avatar && result.type === 'pornstar' && resolvedShortId) {
            const shortIdNum = resolvedShortId.charCodeAt(0) * 256 + (resolvedShortId.charCodeAt(1) || 0);
            avatar = `https://spankbang.com/pornstarimg/f/${shortIdNum}-250.jpg`;
        }

        const bannerPatterns = [
            /class="[^"]*cover[^"]*"[^>]*style="[^"]*url\(['"]?([^'")\s]+)['"]?\)/,
            /class="[^"]*banner[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i,
            /class="[^"]*profile[_-]?header[^"]*"[^>]*style="[^"]*background[^:]*:[^;]*url\(['"]?([^'")\s]+)['"]?\)/i,
            /style="[^"]*background-image:\s*url\(['"]?([^'")\s]+)['"]?\)[^"]*"[^>]*class="[^"]*(?:cover|header|banner)[^"]*"/i,
            /<div[^>]*class="[^"]*(?:header|top|hero)[^"]*"[^>]*>[^<]*<img[^>]*src="([^"]+)"/i
        ];

        let banner = "";
        for (const pattern of bannerPatterns) {
            const bannerMatch = html.match(pattern);
            if (bannerMatch && bannerMatch[1]) {
                let bannerUrl = bannerMatch[1];
                if (bannerUrl.startsWith('//')) {
                    bannerUrl = `https:${bannerUrl}`;
                } else if (!bannerUrl.startsWith('http')) {
                    bannerUrl = `${CONFIG.EXTERNAL_URL_BASE}${bannerUrl}`;
                }
                banner = bannerUrl;
                break;
            }
        }

        if (!banner && avatar && result.type === 'pornstar') {
            banner = avatar;
        }

        const subscriberPatterns = [
            />([0-9,]+)\s*<\/em>/i,
            /<em[^>]*>([0-9,]+)<\/em>/i,
            /(\d+(?:[,.\d]*)?[KMB]?)\s*(?:subscribers?|followers?|views?)/i,
            /class="[^"]*subscribers[^"]*"[^>]*>([^<]+)</i
        ];

        let subscribers = 0;
        for (const pattern of subscriberPatterns) {
            const subMatch = html.match(pattern);
            if (subMatch && subMatch[1]) {
                const subStr = subMatch[1].replace(/<[^>]*>/g, '').trim();
                subscribers = parseViewCount(subStr);
                if (subscribers > 0) break;
            }
        }

        const videoCountMatch = html.match(/(\d+)\s*videos?/i);
        const videoCount = videoCountMatch ? parseInt(videoCountMatch[1]) : 0;

        const descPatterns = [
            /<div[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
            /<p[^>]*class="[^"]*(?:bio|about|description)[^"]*"[^>]*>([\s\S]*?)<\/p>/i
        ];

        let description = videoCount > 0 ? `${videoCount} videos` : "";
        for (const pattern of descPatterns) {
            const descMatch = html.match(pattern);
            if (descMatch && descMatch[1]) {
                const descText = descMatch[1].replace(/<[^>]*>/g, '').trim();
                if (descText) {
                    description = descText;
                }
                break;
            }
        }

        const channelThumbnail = banner || avatar;
        
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, result.type === 'pornstar' ? `pornstar:${result.id}` : result.id, plugin.config.id),
            name: name,
            thumbnail: channelThumbnail,
            banner: banner,
            subscribers: subscribers,
            description: description,
            url: internalUrl,
            links: {}
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel: " + error.message);
    }
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    try {
        log("getChannelContents called with URL: " + url + ", page: " + (continuationToken || "1"));
        const result = extractChannelId(url);
        log("Extracted channel type: " + result.type + ", id: " + result.id);
        
        const page = continuationToken ? parseInt(continuationToken) : 1;

        let profileUrl;
        if (result.type === 'category') {
            // Handle categories/tags
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/s/${result.id}/${page}/`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/s/${result.id}/`;
            }
        } else if (result.type === 'pornstar') {
            let resolvedShortId = result.shortId;
            if (!resolvedShortId) {
                resolvedShortId = resolvePornstarShortId(result.id);
            }
            
            if (resolvedShortId) {
                if (page > 1) {
                    profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${resolvedShortId}/pornstar/${result.id}/${page}/`;
                } else {
                    profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${resolvedShortId}/pornstar/${result.id}/`;
                }
            } else {
                if (page > 1) {
                    profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${result.id}/${page}/`;
                } else {
                    profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/pornstar/${result.id}/`;
                }
            }
        } else if (result.type === 'channel') {
            const [shortId, channelName] = result.id.split(':');
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}/${page}/`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/${shortId}/channel/${channelName}/`;
            }
        } else {
            // For user profiles - SpankBang does NOT want trailing slashes for profile URLs
            // Correct format: /profile/username or /profile/username/videos (no trailing slash!)
            if (page > 1) {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/videos/${page}`;
            } else {
                profileUrl = `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/videos`;
            }
        }

        if (order === Type.Order.Views) {
            profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'o=4';
        } else if (order === Type.Order.Rating) {
            profileUrl += (profileUrl.includes('?') ? '&' : '?') + 'o=5';
        }

        log("Fetching channel contents from: " + profileUrl);
        
        // Use makeRequestNoThrow to get more details about failures
        let response = makeRequestNoThrow(profileUrl, API_HEADERS, 'channel contents', false);
        
        // If first request fails with 404 for profile type, try alternative URL formats
        if (!response.isOk && response.code === 404 && result.type === 'profile') {
            log("Profile URL failed, trying alternative formats...");
            
            // Try without /videos/ suffix (just /profile/username)
            const altUrl1 = page > 1 
                ? `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}/${page}`
                : `${CONFIG.EXTERNAL_URL_BASE}/profile/${result.id}`;
            log("Trying alternative URL: " + altUrl1);
            response = makeRequestNoThrow(altUrl1, API_HEADERS, 'channel contents alt1', false);
            
            // If still fails, try /s/ URL format (search-style profile)
            if (!response.isOk && response.code === 404) {
                const altUrl2 = page > 1
                    ? `${CONFIG.EXTERNAL_URL_BASE}/s/${result.id}/${page}`
                    : `${CONFIG.EXTERNAL_URL_BASE}/s/${result.id}`;
                log("Trying /s/ URL: " + altUrl2);
                response = makeRequestNoThrow(altUrl2, API_HEADERS, 'channel contents alt2', false);
            }
        }
        
        if (!response.isOk) {
            log("Channel contents request failed with status: " + response.code);
            log("Error details: " + (response.error || "No error message"));
            
            // If page > 1 and we get 404, it might mean no more content
            if (response.code === 404 && page > 1) {
                log("404 on page " + page + " - assuming no more content");
                return new SpankBangChannelContentPager([], false, {
                    url: url,
                    type: type,
                    order: order,
                    filters: filters,
                    continuationToken: null
                });
            }
            
            throw new ScriptException(`Failed to fetch channel contents: channel contents failed with status ${response.code}`);
        }
        
        const html = response.body;
        const videos = parseSearchResults(html);
        log("Parsed " + videos.length + " videos from channel contents");
        
        const platformVideos = videos.map(v => createPlatformVideo(v));

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangChannelContentPager(platformVideos, hasMore, {
            url: url,
            type: type,
            order: order,
            filters: filters,
            continuationToken: nextToken
        });

    } catch (error) {
        throw new ScriptException("Failed to get channel contents: " + error.message);
    }
};

source.getChannelVideos = function(url, continuationToken) {
    return source.getChannelContents(url, Type.Feed.Videos, Type.Order.Chronological, [], continuationToken);
};

source.isContentDetailsUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    // Check for video-in-playlist format FIRST (before playlist check would catch it)
    if (REGEX_PATTERNS.urls.videoInPlaylist.test(url)) {
        return true;
    }

    return REGEX_PATTERNS.urls.videoStandard.test(url) ||
           REGEX_PATTERNS.urls.videoAlternative.test(url) ||
           REGEX_PATTERNS.urls.videoShort.test(url);
};

source.getContentDetails = function(url) {
    try {
        log("getContentDetails called with URL: " + url);
        
        // Handle video-in-playlist URLs - convert to standard video URL
        // e.g., https://spankbang.com/dqd68-svhe7y/playlist/asmr+joi -> https://spankbang.com/svhe7y/video/...
        const videoInPlaylistMatch = url.match(REGEX_PATTERNS.urls.videoInPlaylist);
        if (videoInPlaylistMatch) {
            const videoId = videoInPlaylistMatch[2]; // Second part after hyphen is the video ID
            const playlistSlug = videoInPlaylistMatch[3];
            // We can use the playlist URL as-is since SpankBang serves video details
            // Or convert to standard video URL format
            log("Detected video-in-playlist URL, video ID: " + videoId);
        }
        
        const html = makeRequest(url, API_HEADERS, 'video details');
        log("getContentDetails: Received HTML length: " + html.length);
        
        const videoData = parseVideoPage(html, url);
        
        // Log critical metadata for debugging history issues
        log("getContentDetails: Parsed video - id=" + videoData.id + 
            ", duration=" + videoData.duration + "s" +
            ", thumbnail=" + (videoData.thumbnail ? "present (" + videoData.thumbnail.substring(0, 50) + "...)" : "MISSING") +
            ", title=" + (videoData.title ? videoData.title.substring(0, 30) : "MISSING"));
        
        return createVideoDetails(videoData, url);

    } catch (error) {
        log("getContentDetails ERROR: " + error.message);
        throw new ScriptException("Failed to get video details: " + error.message);
    }
};

source.getContentRecommendations = function(url) {
    try {
        const html = makeRequest(url, API_HEADERS, 'recommendations');
        const videoData = parseVideoPage(html, url);

        if (videoData.relatedVideos && videoData.relatedVideos.length > 0) {
            const platformVideos = videoData.relatedVideos.map(v => createPlatformVideo(v));
            return new SpankBangSearchPager(platformVideos, false, { url: url });
        }

        return new SpankBangSearchPager([], false, { url: url });

    } catch (error) {
        log("getContentRecommendations error: " + error.message);
        return new SpankBangSearchPager([], false, { url: url });
    }
};

source.getComments = function(url) {
    try {
        const videoId = extractVideoId(url);
        let comments = [];
        
        comments = fetchCommentsFromApi(videoId);
        
        if (comments.length === 0) {
            try {
                const commentsUrl = `${BASE_URL}/${videoId}/comments/`;
                const html = makeRequestNoThrow(commentsUrl, API_HEADERS, 'comments');
                if (html.isOk && html.body) {
                    comments = parseComments(html.body, videoId);
                }
            } catch (e) {
                log("Comments page request failed: " + e.message);
            }
        }
        
        if (comments.length === 0) {
            try {
                const videoPageHtml = makeRequest(url, API_HEADERS, 'video page for comments');
                const commentsSection = videoPageHtml.match(/<div[^>]*id="[^"]*comments[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i);
                if (commentsSection && commentsSection[1]) {
                    comments = parseComments(commentsSection[1], videoId);
                } else {
                    comments = parseComments(videoPageHtml, videoId);
                }
            } catch (e) {
                log("Video page comments extraction failed: " + e.message);
            }
        }

        log("getComments found " + comments.length + " comments for video " + videoId);
        const platformComments = comments.map(c => new Comment(c));

        return new SpankBangCommentPager(platformComments, comments.length >= 20, { url: url, videoId: videoId, page: 1 });

    } catch (error) {
        log("getComments error: " + error.message);
        return new SpankBangCommentPager([], false, { url: url });
    }
};

source.getSubComments = function(comment) {
    return new SpankBangCommentPager([], false, {});
};

source.isPlaylistUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    // IMPORTANT: Video-in-playlist URLs should NOT be treated as playlists
    // e.g., https://spankbang.com/dqd68-svhe7y/playlist/asmr+joi is a VIDEO, not a playlist
    if (REGEX_PATTERNS.urls.videoInPlaylist.test(url)) {
        return false;
    }

    return REGEX_PATTERNS.urls.playlistInternal.test(url) ||
           REGEX_PATTERNS.urls.categoryInternal.test(url) ||
           REGEX_PATTERNS.urls.playlistExternal.test(url) ||
           REGEX_PATTERNS.urls.playlistSimple.test(url) ||
           REGEX_PATTERNS.urls.userPlaylistsPage.test(url) ||
           REGEX_PATTERNS.urls.userPlaylistsSubsPage.test(url) ||
           REGEX_PATTERNS.urls.profilePlaylistsPage.test(url);
};

source.searchPlaylists = function(query, type, order, filters, continuationToken) {
    try {
        const page = continuationToken ? parseInt(continuationToken) : 1;
        let searchUrl;

        // Check if query is a playlist URL
        if (query && typeof query === 'string') {
            const playlistExternalMatch = query.match(REGEX_PATTERNS.urls.playlistExternal);
            const playlistSimpleMatch = query.match(REGEX_PATTERNS.urls.playlistSimple);
            const userPlaylistsMatch = query.match(REGEX_PATTERNS.urls.userPlaylistsPage);
            const userPlaylistsSubsMatch = query.match(REGEX_PATTERNS.urls.userPlaylistsSubsPage);
            const profilePlaylistsMatch = query.match(REGEX_PATTERNS.urls.profilePlaylistsPage);
            
            // Handle user's own playlists page URL
            if (userPlaylistsMatch || userPlaylistsSubsMatch) {
                log("Detected user playlists page URL, fetching playlists list...");
                
                const playlistsUrl = userPlaylistsSubsMatch ? `${BASE_URL}/users/playlists_subs` : `${BASE_URL}/users/playlists`;
                log("Fetching playlists from: " + playlistsUrl);
                
                const response = makeRequestNoThrow(playlistsUrl, getAuthHeaders(), 'user playlists search', true);
                
                if (!response.isOk) {
                    log("Failed to fetch user playlists: HTTP " + response.code);
                    throw new ScriptException("Failed to fetch user playlists. Please make sure you are logged in.");
                }
                
                const html = response.body;
                if (!html || html.length < 100) {
                    log("Empty response from user playlists page");
                    return new SpankBangPlaylistPager([], false, { query: query });
                }
                
                log("User playlists page HTML length: " + html.length);
                
                // Parse playlists from user page
                let playlists = parseUserPlaylistsPageEnhanced(html);
                
                if (playlists.length === 0) {
                    log("parseUserPlaylistsPageEnhanced found 0, trying parsePlaylistsPage...");
                    playlists = parsePlaylistsPage(html);
                }
                
                if (playlists.length === 0) {
                    log("Still 0 playlists, trying direct link extraction...");
                    playlists = extractPlaylistLinksFromHtml(html);
                }
                
                log(`Found ${playlists.length} playlists from user playlists page`);
                
                const platformPlaylists = playlists.map(p => {
                    // Create proper author URL if author is present
                    let authorUrl = "";
                    let authorId = p.author || "User";
                    if (p.author && p.author.length > 0) {
                        authorUrl = `${BASE_URL}/profile/${p.author}/`;
                    }
                    
                    return new PlatformPlaylist({
                        id: new PlatformID(PLATFORM, p.id, plugin.config.id),
                        name: p.name,
                        thumbnail: p.thumbnail || "",
                        author: new PlatformAuthorLink(
                            new PlatformID(PLATFORM, authorId, plugin.config.id),
                            authorId,
                            authorUrl,
                            ""
                        ),
                        videoCount: p.videoCount || 0,
                        url: p.url
                    });
                });
                
                return new SpankBangPlaylistPager(platformPlaylists, false, {
                    query: query,
                    continuationToken: null
                });
            }
            
            // Handle profile playlists page (other user's playlists)
            if (profilePlaylistsMatch) {
                const profileName = profilePlaylistsMatch[1];
                log("Detected profile playlists page URL for: " + profileName);
                
                const profilePlaylistsUrl = `${BASE_URL}/profile/${profileName}/playlists/`;
                if (page > 1) {
                    profilePlaylistsUrl += `${page}/`;
                }
                
                log("Fetching profile playlists from: " + profilePlaylistsUrl);
                
                const html = makeRequest(profilePlaylistsUrl, API_HEADERS, 'profile playlists', true);
                const playlists = parsePlaylistsPage(html);
                
                const platformPlaylists = playlists.map(p => new PlatformPlaylist({
                    id: new PlatformID(PLATFORM, p.id, plugin.config.id),
                    name: p.name,
                    thumbnail: p.thumbnail || "",
                    author: new PlatformAuthorLink(
                        new PlatformID(PLATFORM, profileName, plugin.config.id),
                        profileName,
                        `${BASE_URL}/profile/${profileName}/`,
                        ""
                    ),
                    videoCount: p.videoCount || 0,
                    url: p.url
                }));
                
                const hasMore = playlists.length >= 20;
                const nextToken = hasMore ? (page + 1).toString() : null;
                
                return new SpankBangPlaylistPager(platformPlaylists, hasMore, {
                    query: query,
                    continuationToken: nextToken
                });
            }
            
            if (playlistExternalMatch) {
                // Direct URL match: https://spankbang.com/dqcr2/playlist/feet+joi/
                const shortId = playlistExternalMatch[1];
                const slug = playlistExternalMatch[2];
                const playlistId = `${shortId}:${slug}`;
                const internalUrl = `spankbang://playlist/${playlistId}`;
                
                log("Detected playlist URL, fetching playlist details: " + query);
                
                // Fetch the actual playlist to get video count and thumbnail
                const playlistUrl = `${BASE_URL}/${shortId}/playlist/${slug}/`;
                const playlistInfo = fetchPlaylistInfo(playlistUrl, playlistId, slug);
                
                // Create proper author URL
                let authorUrl = "";
                let authorId = playlistInfo.author || "Unknown";
                if (playlistInfo.author && playlistInfo.author.length > 0) {
                    authorUrl = `${BASE_URL}/profile/${playlistInfo.author}/`;
                }
                
                const playlist = new PlatformPlaylist({
                    id: new PlatformID(PLATFORM, playlistId, plugin.config.id),
                    name: playlistInfo.name,
                    thumbnail: playlistInfo.thumbnail,
                    author: new PlatformAuthorLink(
                        new PlatformID(PLATFORM, authorId, plugin.config.id),
                        authorId,
                        authorUrl,
                        ""
                    ),
                    videoCount: playlistInfo.videoCount,
                    url: internalUrl
                });
                
                return new SpankBangPlaylistPager([playlist], false, {
                    query: query,
                    continuationToken: null
                });
            } else if (playlistSimpleMatch) {
                // Simple URL: https://spankbang.com/playlist/something/
                const slug = playlistSimpleMatch[1];
                const internalUrl = `spankbang://playlist/${slug}`;
                
                log("Detected simple playlist URL, fetching playlist details: " + query);
                
                const playlistUrl = `${BASE_URL}/playlist/${slug}/`;
                const playlistInfo = fetchPlaylistInfo(playlistUrl, slug, slug);
                
                // Create proper author URL
                let authorUrl = "";
                let authorId = playlistInfo.author || "Unknown";
                if (playlistInfo.author && playlistInfo.author.length > 0) {
                    authorUrl = `${BASE_URL}/profile/${playlistInfo.author}/`;
                }
                
                const playlist = new PlatformPlaylist({
                    id: new PlatformID(PLATFORM, slug, plugin.config.id),
                    name: playlistInfo.name,
                    thumbnail: playlistInfo.thumbnail,
                    author: new PlatformAuthorLink(
                        new PlatformID(PLATFORM, authorId, plugin.config.id),
                        authorId,
                        authorUrl,
                        ""
                    ),
                    videoCount: playlistInfo.videoCount,
                    url: internalUrl
                });
                
                return new SpankBangPlaylistPager([playlist], false, {
                    query: query,
                    continuationToken: null
                });
            }
        }

        // Regular keyword search
        if (!query || query.trim().length === 0) {
            searchUrl = `${BASE_URL}/playlists/`;
            if (page > 1) {
                searchUrl += `${page}/`;
            }
        } else {
            const searchQuery = encodeURIComponent(query.trim().replace(/\s+/g, '+'));
            if (page > 1) {
                searchUrl = `${BASE_URL}/s/${searchQuery}/${page}/?t=playlist`;
            } else {
                searchUrl = `${BASE_URL}/s/${searchQuery}/?t=playlist`;
            }
        }
        
        log("Playlist search URL: " + searchUrl);

        const html = makeRequest(searchUrl, API_HEADERS, 'playlist search', true);
        const playlists = parsePlaylistsPage(html);

        const platformPlaylists = playlists.map(p => {
            // Create proper author URL if author is present
            let authorUrl = "";
            if (p.author && p.author.length > 0) {
                // Check if author looks like a profile name (no special URL prefix)
                authorUrl = `${BASE_URL}/profile/${p.author}/`;
            }
            
            return new PlatformPlaylist({
                id: new PlatformID(PLATFORM, p.id, plugin.config.id),
                name: p.name,
                thumbnail: p.thumbnail || "",
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, p.author || "Unknown", plugin.config.id),
                    p.author || "Unknown",
                    authorUrl,
                    ""
                ),
                videoCount: p.videoCount || 0,
                url: p.url
            });
        });

        const hasMore = playlists.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new SpankBangPlaylistPager(platformPlaylists, hasMore, {
            query: query,
            continuationToken: nextToken
        });

    } catch (error) {
        log("searchPlaylists error: " + error.message);
        return new SpankBangPlaylistPager([], false, { query: query });
    }
};

source.getPlaylist = function(url) {
    try {
        log("getPlaylist called with URL: " + url);
        
        // Check if this is an external playlist URL and convert to internal
        const playlistExternalMatch = url.match(REGEX_PATTERNS.urls.playlistExternal);
        const playlistSimpleMatch = url.match(REGEX_PATTERNS.urls.playlistSimple);
        
        if (playlistExternalMatch) {
            const shortId = playlistExternalMatch[1];
            const slug = playlistExternalMatch[2];
            const internalUrl = `spankbang://playlist/${shortId}:${slug}`;
            log("Converting external playlist URL to internal: " + internalUrl);
            url = internalUrl;
        } else if (playlistSimpleMatch) {
            const slug = playlistSimpleMatch[1];
            const internalUrl = `spankbang://playlist/${slug}`;
            log("Converting simple playlist URL to internal: " + internalUrl);
            url = internalUrl;
        }
        
        const categoryMatch = url.match(REGEX_PATTERNS.urls.categoryInternal);
        const playlistMatch = url.match(REGEX_PATTERNS.urls.playlistInternal);
        
        let playlistUrl;
        let playlistId;
        let playlistName;

        if (categoryMatch) {
            const category = categoryMatch[1];
            playlistUrl = `${BASE_URL}/${category}/`;
            playlistId = category;
            playlistName = category.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        } else if (playlistMatch) {
            const id = playlistMatch[1];
            if (id.includes(':')) {
                const [shortId, slug] = id.split(':');
                playlistUrl = `${BASE_URL}/${shortId}/playlist/${slug}/`;
                playlistId = id;
                playlistName = slug.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                log(`Parsed playlist ID: ${playlistId} (shortId: ${shortId}, slug: ${slug})`);
            } else {
                playlistUrl = `${BASE_URL}/playlist/${id}/`;
                playlistId = id;
                playlistName = id.replace(/[+_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }
        } else {
            throw new ScriptException("Invalid playlist URL format: " + url);
        }

        log("Fetching playlist from: " + playlistUrl);
        
        // Use authenticated request for playlist pages with rate limiting
        const authHeaders = getAuthHeaders();
        log("Using authenticated request with headers and cookies");
        
        const response = makeRequestNoThrow(playlistUrl, authHeaders, 'playlist', true);
        
        if (!response.isOk) {
            log(`Playlist fetch failed with status ${response.code}`);
            throw new ScriptException(`Failed to fetch playlist: HTTP ${response.code}`);
        }
        
        const html = response.body;
        
        if (!html || html.length < 100) {
            throw new ScriptException("Failed to fetch playlist page or page is empty");
        }
        
        log("Successfully fetched playlist HTML, length: " + html.length);
        
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                          html.match(/<title>([^<]+?)(?:\s*-\s*SpankBang)?<\/title>/i) ||
                          html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i);
        if (titleMatch && titleMatch[1]) {
            playlistName = titleMatch[1].trim();
            log("Extracted playlist name from HTML: " + playlistName);
        }
        
        // Extract playlist creator/owner from HTML
        log("Extracting playlist creator/owner...");
        let playlistAuthor = {
            name: "SpankBang",
            url: CONFIG.EXTERNAL_URL_BASE,
            avatar: "",
            id: "spankbang"
        };
        
        // Try to find the creator/owner - look for profile links near "by" or "created by" text
        const creatorPatterns = [
            // Pattern 1: "by <a href="/profile/username">Username</a>"
            /(?:by|from|creator?:?)\s*<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i,
            // Pattern 2: Direct profile link near playlist info
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*class="[^"]*(?:user|creator|author|uploader)[^"]*"[^>]*>([^<]+)<\/a>/i,
            // Pattern 3: Profile link with avatar
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?([^<]+)<\/a>/i,
            // Pattern 4: Any profile link in playlist header/info area
            /<div[^>]*class="[^"]*(?:info|head|meta|creator|owner)[^"]*"[^>]*>[\s\S]{0,500}?<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i,
            // Pattern 5: Simple profile link
            /<a[^>]*href="\/profile\/([^"\/]+)"[^>]*>([^<]+)<\/a>/i
        ];
        
        for (const pattern of creatorPatterns) {
            const creatorMatch = html.match(pattern);
            if (creatorMatch && creatorMatch[1] && creatorMatch[2]) {
                const profileName = creatorMatch[1].trim();
                const displayName = creatorMatch[2].replace(/<[^>]*>/g, '').trim();
                
                // Skip if this looks like a generic link (common patterns to avoid)
                if (profileName && displayName && 
                    profileName.length > 0 && profileName.length < 50 &&
                    displayName.length > 0 && displayName.length < 50 &&
                    !displayName.match(/^(home|search|login|upload|all|videos?)$/i)) {
                    
                    playlistAuthor.name = displayName;
                    playlistAuthor.url = `${CONFIG.EXTERNAL_URL_BASE}/profile/${profileName}/`;
                    playlistAuthor.id = profileName;
                    
                    // Try to find avatar nearby
                    const avatarContext = html.substring(Math.max(0, creatorMatch.index - 300), Math.min(html.length, creatorMatch.index + 300));
                    const avatarMatch = avatarContext.match(/(?:data-src|src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
                    if (avatarMatch) {
                        playlistAuthor.avatar = avatarMatch[1];
                    }
                    
                    log(`Found playlist creator: ${playlistAuthor.name} (profile: ${profileName})`);
                    break;
                }
            }
        }
        
        log("Parsing videos from playlist page...");
        let videos = parseSearchResults(html);
        log(`parseSearchResults found ${videos.length} videos`);
        
        // If parseSearchResults found nothing, try alternative extraction
        if (videos.length === 0) {
            log("parseSearchResults found 0 videos, trying parsePlaylistVideos...");
            videos = parsePlaylistVideos(html);
            log(`parsePlaylistVideos found ${videos.length} videos`);
        }
        
        // If still nothing, try the most permissive extraction
        if (videos.length === 0) {
            log("Still 0 videos, trying direct video link extraction...");
            videos = extractVideoLinksFromHtml(html);
            log(`extractVideoLinksFromHtml found ${videos.length} videos`);
        }
        
        if (videos.length === 0) {
            log("WARNING: No videos found in playlist. This might indicate:");
            log("  1. Playlist is actually empty");
            log("  2. HTML structure doesn't match parsing patterns");
            log("  3. Authentication issue preventing access to videos");
            // Log a sample of the HTML for debugging
            log("HTML sample (first 2000 chars): " + html.substring(0, 2000));
            
            // Check if we can see any video links at all
            const anyVideoLinks = html.match(/href="\/[a-zA-Z0-9]+\/video\//g);
            log("Raw video links found in HTML: " + (anyVideoLinks ? anyVideoLinks.length : 0));
        }
        
        const platformVideos = videos.map(v => createPlatformVideo(v));
        
        // Get thumbnail URL from first video if available
        const thumbnailUrl = videos.length > 0 && videos[0].thumbnail ? videos[0].thumbnail : "";

        // Check if there's pagination (more videos on subsequent pages)
        const hasMore = html.match(/class="[^"]*pagination[^"]*"/) !== null || 
                       html.match(/href="[^"]*\/\d+\/?[^"]*"[^>]*>\s*(?:Next|>|&gt;|→)/i) !== null;

        const playlistDetails = new PlatformPlaylistDetails({
            id: new PlatformID(PLATFORM, playlistId, plugin.config.id),
            name: playlistName,
            thumbnail: thumbnailUrl,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, playlistAuthor.id, plugin.config.id),
                playlistAuthor.name,
                playlistAuthor.url,
                playlistAuthor.avatar
            ),
            datetime: 0,
            url: url,
            videoCount: platformVideos.length,
            contents: new SpankBangPlaylistVideosPager(platformVideos, hasMore, { 
                playlistUrl: playlistUrl,
                playlistId: playlistId,
                page: 1
            })
        });
        
        log(`Successfully created playlist details: ${playlistName} with ${platformVideos.length} videos (creator: ${playlistAuthor.name})`);
        return playlistDetails;

    } catch (error) {
        log("getPlaylist ERROR: " + error.message);
        log("Error stack: " + (error.stack || "No stack trace available"));
        throw new ScriptException("Failed to get playlist: " + error.message);
    }
};

class SpankBangHomeContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

class SpankBangSearchPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.search(
            this.context.query,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

class SpankBangChannelPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.searchChannels(this.context.query, this.context.continuationToken);
    }
}

class SpankBangCreatorPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.getCreators(this.context.continuationToken);
    }
}

class SpankBangChannelContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.getChannelContents(
            this.context.url,
            this.context.type,
            this.context.order,
            this.context.filters,
            this.context.continuationToken
        );
    }
}

class SpankBangPlaylistPager extends PlaylistPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        // Support pagination for playlist search
        if (this.context.continuationToken) {
            return source.searchPlaylists(
                this.context.query,
                null,
                null,
                null,
                this.context.continuationToken
            );
        }
        return new SpankBangPlaylistPager([], false, this.context);
    }
}

// Pager for videos inside a playlist
class SpankBangPlaylistVideosPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        try {
            const nextPage = (this.context.page || 1) + 1;
            let nextUrl = this.context.playlistUrl;
            
            // Add page number to URL
            if (nextUrl.endsWith('/')) {
                nextUrl = nextUrl + nextPage + '/';
            } else {
                nextUrl = nextUrl + '/' + nextPage + '/';
            }
            
            log("SpankBangPlaylistVideosPager: Fetching next page: " + nextUrl);
            
            const response = makeRequestNoThrow(nextUrl, getAuthHeaders(), 'playlist videos page', true);
            
            if (!response.isOk || !response.body || response.body.length < 100) {
                log("SpankBangPlaylistVideosPager: No more pages or fetch failed");
                return new SpankBangPlaylistVideosPager([], false, this.context);
            }
            
            const html = response.body;
            
            // Try multiple parsing strategies
            let videos = parseSearchResults(html);
            if (videos.length === 0) {
                videos = parsePlaylistVideos(html);
            }
            if (videos.length === 0) {
                videos = extractVideoLinksFromHtml(html);
            }
            
            log(`SpankBangPlaylistVideosPager: Found ${videos.length} videos on page ${nextPage}`);
            
            const platformVideos = videos.map(v => createPlatformVideo(v));
            
            // Check if there are more pages
            const hasMore = videos.length >= 20 || 
                           html.match(/href="[^"]*\/\d+\/?[^"]*"[^>]*>\s*(?:Next|>|&gt;|→)/i) !== null;
            
            return new SpankBangPlaylistVideosPager(platformVideos, hasMore, {
                playlistUrl: this.context.playlistUrl,
                playlistId: this.context.playlistId,
                page: nextPage
            });
            
        } catch (error) {
            log("SpankBangPlaylistVideosPager error: " + error.message);
            return new SpankBangPlaylistVideosPager([], false, this.context);
        }
    }
}

class SpankBangCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return new SpankBangCommentPager([], false, this.context);
    }
}

class SpankBangHistoryPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.syncRemoteWatchHistory(this.context.continuationToken);
    }
}

log("SpankBang plugin loaded - v97");
