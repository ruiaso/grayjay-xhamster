const BASE_URL = "https://xhamster.com";
const PLATFORM = "xHamster";
const PLATFORM_CLAIMTYPE = 3;

const USER_URLS = {
    PLAYLISTS: "https://xhamster.com/my/collections",
    HISTORY: "https://xhamster.com/my/history",
    SUBSCRIPTIONS: "https://xhamster.com/my/subscriptions",
    FAVORITES: "https://xhamster.com/my/favorites",
    PROFILE: "https://xhamster.com/my/profile"
};

var config = {};
let localConfig = {
    modelIds: {},
    lastRequestTime: 0,
    requestDelay: 500,
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
        "240": { name: "240p", width: 426, height: 240 },
        "480": { name: "480p", width: 854, height: 480 },
        "720": { name: "720p", width: 1280, height: 720 },
        "1080": { name: "1080p", width: 1920, height: 1080 },
        "2160": { name: "4K", width: 3840, height: 2160 },
        "4k": { name: "4K", width: 3840, height: 2160 }
    },
    INTERNAL_URL_SCHEME: "xhamster://",
    EXTERNAL_URL_BASE: "https://xhamster.com",
    THUMB_BASE: "https://thumb-p3.xhcdn.com",
    SEARCH_FILTERS: {
        DURATION: {
            ANY: "",
            SHORT: "1-5min",
            MEDIUM: "5-20min",
            LONG: "20min_plus"
        },
        QUALITY: {
            ANY: "",
            HD: "hd",
            FHD: "1080p",
            UHD: "4k"
        },
        PERIOD: {
            ANY: "",
            TODAY: "today",
            WEEK: "week",
            MONTH: "month",
            YEAR: "year"
        },
        ORDER: {
            RELEVANCE: "",
            NEW: "newest",
            TRENDING: "relevance",
            POPULAR: "views",
            RATING: "rating",
            LENGTH: "duration"
        }
    }
};

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5"
};

const REGEX_PATTERNS = {
    urls: {
        videoStandard: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/videos\/([^\/\?]+)-(\d+)$/,
        videoAlt: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/videos\/([^\/\?]+)$/,
        channelUser: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/users\/([^\/\?]+)/,
        channelCreator: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/creators\/([^\/\?]+)/,
        channelChannel: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/channels\/([^\/\?]+)/,
        pornstar: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/pornstars\/([^\/\?]+)/,
        channelInternal: /^xhamster:\/\/channel\/(.+)$/,
        profileInternal: /^xhamster:\/\/profile\/(.+)$/,
        playlistExternal: /^https?:\/\/(?:www\.)?xhamster[0-9]*\.com\/my\/collections\/([^\/\?]+)/,
        playlistInternal: /^xhamster:\/\/playlist\/(.+)$/,
        categoryInternal: /^xhamster:\/\/category\/(.+)$/
    },
    extraction: {
        videoId: /videos\/[^\/]+-(\d+)/,
        videoIdAlt: /videos\/(\d+)/,
        streamUrl: /"(https?:\/\/[^"]+\.mp4[^"]*)"/g,
        title: /<h1[^>]*>([^<]+)<\/h1>/,
        duration: /"duration"\s*:\s*"?(\d+)"?/,
        views: /"interactionCount"\s*:\s*"?(\d+)"?/
    }
};

// ===== Authentication Functions =====

function getAuthHeaders() {
    const headers = { ...API_HEADERS };
    if (state.authCookies && state.authCookies.length > 0) {
        headers["Cookie"] = state.authCookies;
    }
    return headers;
}

function hasValidAuthCookie() {
    if (!state.authCookies || state.authCookies.length === 0) {
        return false;
    }
    const authCookieNames = ["xh_session", "xh_auth", "remember_me", "logged_in", "session", "auth_token"];
    for (const cookieName of authCookieNames) {
        if (state.authCookies.includes(cookieName + "=")) {
            return true;
        }
    }
    return false;
}

function isLoggedIn() {
    return hasValidAuthCookie() && state.isAuthenticated;
}

// ===== Rate Limiting =====

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

// ===== HTTP Request Functions =====

function makeRequest(url, headers = null, context = 'request', useAuth = false) {
    try {
        enforceRateLimit();

        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, useAuth);
        if (!response.isOk) {
            if (response.code === 429) {
                localConfig.consecutiveErrors++;
                const waitTime = Math.min(3000 * localConfig.consecutiveErrors, 10000);
                log(`Rate limit hit (429), attempt ${localConfig.consecutiveErrors}, waiting ${waitTime}ms before retry...`);
                sleep(waitTime);
                localConfig.requestDelay = Math.min(localConfig.requestDelay * 2, 2000);

                if (localConfig.consecutiveErrors < 3) {
                    const retryResponse = http.GET(url, requestHeaders, useAuth);
                    if (retryResponse.isOk) {
                        localConfig.consecutiveErrors = 0;
                        localConfig.requestDelay = Math.max(500, localConfig.requestDelay * 0.8);
                        return retryResponse.body;
                    }
                }
            }
            throw new ScriptException(`${context} failed with status ${response.code}`);
        }

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
        enforceRateLimit();

        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, useAuth);

        if (!response.isOk && response.code === 429) {
            localConfig.consecutiveErrors++;
            const waitTime = Math.min(3000 * localConfig.consecutiveErrors, 10000);
            log(`Rate limit hit (429), attempt ${localConfig.consecutiveErrors}, waiting ${waitTime}ms before retry...`);
            sleep(waitTime);
            localConfig.requestDelay = Math.min(localConfig.requestDelay * 2, 2000);

            if (localConfig.consecutiveErrors < 3) {
                const retryResponse = http.GET(url, requestHeaders, useAuth);
                if (retryResponse.isOk) {
                    localConfig.consecutiveErrors = 0;
                    localConfig.requestDelay = Math.max(500, localConfig.requestDelay * 0.8);
                }
                return { isOk: retryResponse.isOk, code: retryResponse.code, body: retryResponse.body };
            }
        }

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

// ===== ID Extraction Functions =====

function extractVideoId(url) {
    if (!url || typeof url !== 'string') {
        throw new ScriptException("Invalid URL provided for video ID extraction");
    }

    const patterns = [
        /-(\d+)$/,
        /videos\/[^\/]+-(\d+)/,
        /xvideos\/(\d+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    const slugMatch = url.match(/videos\/([^\/\?]+)/);
    if (slugMatch && slugMatch[1]) {
        return slugMatch[1];
    }

    throw new ScriptException(`Could not extract video ID from URL: ${url}`);
}

function extractChannelId(url) {
    if (!url || typeof url !== 'string') {
        return { type: 'user', id: 'unknown' };
    }

    const channelInternalMatch = url.match(REGEX_PATTERNS.urls.channelInternal);
    if (channelInternalMatch && channelInternalMatch[1]) {
        return { type: 'channel', id: channelInternalMatch[1] };
    }

    const profileInternalMatch = url.match(REGEX_PATTERNS.urls.profileInternal);
    if (profileInternalMatch && profileInternalMatch[1]) {
        if (profileInternalMatch[1].startsWith('pornstar:')) {
            return { type: 'pornstar', id: profileInternalMatch[1].replace('pornstar:', '') };
        }
        return { type: 'user', id: profileInternalMatch[1] };
    }

    const channelMatch = url.match(/\/channels\/([^\/\?]+)/);
    if (channelMatch && channelMatch[1]) {
        return { type: 'channel', id: channelMatch[1].replace(/\/$/, '') };
    }

    const pornstarMatch = url.match(/\/pornstars\/([^\/\?]+)/);
    if (pornstarMatch && pornstarMatch[1]) {
        return { type: 'pornstar', id: pornstarMatch[1].replace(/\/$/, '') };
    }

    const creatorMatch = url.match(/\/creators\/([^\/\?]+)/);
    if (creatorMatch && creatorMatch[1]) {
        return { type: 'creator', id: creatorMatch[1].replace(/\/$/, '') };
    }

    const userMatch = url.match(/\/users\/([^\/\?]+)/);
    if (userMatch && userMatch[1]) {
        return { type: 'user', id: userMatch[1].replace(/\/$/, '') };
    }

    return { type: 'user', id: 'unknown' };
}

// ===== Parsing Utility Functions =====

function parseDuration(durationStr) {
    if (!durationStr) return 0;

    let totalSeconds = 0;

    if (typeof durationStr === 'number') {
        return durationStr;
    }

    const numericOnly = durationStr.toString().trim().match(/^(\d+)$/);
    if (numericOnly) {
        return parseInt(numericOnly[1]);
    }

    const colonMatch = durationStr.match(/(\d+):(\d+)(?::(\d+))?/);
    if (colonMatch) {
        if (colonMatch[3]) {
            totalSeconds = parseInt(colonMatch[1]) * 3600 + parseInt(colonMatch[2]) * 60 + parseInt(colonMatch[3]);
        } else {
            totalSeconds = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
        }
        return totalSeconds;
    }

    const ptMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (ptMatch) {
        totalSeconds = (parseInt(ptMatch[1]) || 0) * 3600 +
                       (parseInt(ptMatch[2]) || 0) * 60 +
                       (parseInt(ptMatch[3]) || 0);
        return totalSeconds;
    }

    return parseInt(durationStr) || 0;
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

function cleanVideoTitle(title) {
    if (!title) return "Unknown";
    return title
        .replace(/\s*-\s*xHamster\.com\s*$/i, '')
        .replace(/\s*\|\s*xHamster\s*$/i, '')
        .replace(/\s*-\s*xHamster\s*$/i, '')
        .trim();
}

// ===== Duration Extraction Helpers =====

function extractAllDurationCandidatesFromContext(html, opts = {}) {
    const options = {
        excludeProgress: opts.excludeProgress !== false,
        maxSeconds: typeof opts.maxSeconds === 'number' ? opts.maxSeconds : 24 * 60 * 60
    };

    if (!html || typeof html !== 'string') return [];

    const candidates = [];

    // xHamster specific: <div data-role="video-duration"><div class="tiny-8643e invert-8643e">29:22</div></div>
    const xhDurationPattern = /<div[^>]*data-role="video-duration"[^>]*>[\s\S]*?<div[^>]*class="[^"]*tiny-[^"]*"[^>]*>(\d+:\d+(?::\d+)?)<\/div>/gi;
    let xhMatch;
    while ((xhMatch = xhDurationPattern.exec(html)) !== null) {
        if (xhMatch[1]) {
            const parsed = parseDuration(xhMatch[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
        }
    }

    // Alternative xHamster pattern - just the tiny class with time
    const tinyPattern = /<div[^>]*class="[^"]*tiny-[^"]*"[^>]*>(\d+:\d+(?::\d+)?)<\/div>/gi;
    let tinyMatch;
    while ((tinyMatch = tinyPattern.exec(html)) !== null) {
        if (tinyMatch[1]) {
            const parsed = parseDuration(tinyMatch[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
        }
    }

    // thumb-image-container__duration pattern
    const thumbDurationPattern = /<div[^>]*class="[^"]*thumb-image-container__duration[^"]*"[^>]*>[\s\S]*?(\d+:\d+(?::\d+)?)/gi;
    let thumbMatch;
    while ((thumbMatch = thumbDurationPattern.exec(html)) !== null) {
        if (thumbMatch[1]) {
            const parsed = parseDuration(thumbMatch[1].trim());
            if (parsed > 0 && parsed <= options.maxSeconds) candidates.push(parsed);
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

    // 3) Common span patterns for xHamster
    const spanPatterns = [
        /<span[^>]*class="[^"]*\bduration[^"]*"[^>]*>([^<]+)<\/span>/gi,
        /<span[^>]*class="[^"]*\btime[^"]*"[^>]*>([^<]+)<\/span>/gi,
        /<div[^>]*class="[^"]*thumb-image-container__duration[^"]*"[^>]*>([^<]+)<\/div>/gi
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

    const uniq = Array.from(new Set(candidates)).filter(s => s >= 5);
    return uniq;
}

function extractBestDurationSecondsFromContext(html, opts = {}) {
    const preferLargest = opts.preferLargest !== false;
    const candidates = extractAllDurationCandidatesFromContext(html, opts);
    if (!candidates || candidates.length === 0) return 0;

    if (preferLargest) {
        return candidates.reduce((a, b) => (b > a ? b : a), 0);
    }
    return candidates[0] || 0;
}

// ===== View Count Extraction =====

function extractViewCountFromContext(html) {
    if (!html) return 0;

    const patterns = [
        // xHamster specific pattern: <div class="video-thumb-views">5.6M views</div>
        /<div[^>]*class="video-thumb-views"[^>]*>([^<]+)<\/div>/i,
        /<span[^>]*class="video-thumb-views"[^>]*>([^<]+)<\/span>/i,
        // With aria-hidden
        /<div[^>]*class="video-thumb-views"[^>]*aria-hidden="[^"]*"[^>]*>([^<]+)<\/div>/i,
        // Generic views patterns
        /<span[^>]*class="[^"]*views[^"]*"[^>]*>([^<]+)<\/span>/i,
        /class="[^"]*entity-info-views[^"]*"[^>]*>([^<]+)</i,
        // Patterns with views word
        /(\d+(?:[,.]\d+)?[KMB]?)\s*views?\b/i,
        /\bviews?\s*:?\s*(\d+(?:[,.]\d+)?[KMB]?)\b/i,
        // JSON-LD
        /"interactionCount"\s*:\s*"?(\d+)"?/,
        />(\d{1,3}(?:[,.]\d{3})*[KMB]?)\s*views?</i
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

    return 0;
}

// ===== Uploader Extraction =====

function extractUploaderFromContext(html) {
    const uploader = {
        name: "",
        url: "",
        avatar: ""
    };

    if (!html || typeof html !== 'string') return uploader;

    // EXACT xHamster pattern from console output:
    // <a class="video-uploader__name" href="https://xhamster.com/channels/my-pervy-family" data-role="video-uploader-link">My pervy family</a>
    
    // Pattern 1: Look for video-uploader__name class - simplest approach
    const nameMatch = html.match(/<a\s+class="video-uploader__name"\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (nameMatch && nameMatch[1] && nameMatch[2]) {
        const href = nameMatch[1];
        const name = nameMatch[2].trim();
        
        if (name.length > 0 && name.length < 100) {
            uploader.name = name;
            
            // Parse the href to get type and slug
            const channelMatch = href.match(/\/channels\/([^\/\?"]+)/);
            const userMatch = href.match(/\/users\/([^\/\?"]+)/);
            const pornstarMatch = href.match(/\/pornstars\/([^\/\?"]+)/);
            const creatorMatch = href.match(/\/creators\/([^\/\?"]+)/);
            
            if (channelMatch) {
                uploader.url = `xhamster://channel/${channelMatch[1]}`;
            } else if (pornstarMatch) {
                uploader.url = `xhamster://profile/pornstar:${pornstarMatch[1]}`;
            } else if (userMatch) {
                uploader.url = `xhamster://profile/${userMatch[1]}`;
            } else if (creatorMatch) {
                uploader.url = `xhamster://profile/${creatorMatch[1]}`;
            } else {
                uploader.url = href;
            }
            
            // Extract avatar from video-uploader-logo
            const avatarMatch = html.match(/<a\s+class="video-uploader-logo"\s+data-background-image="([^"]+)"/i);
            if (avatarMatch && avatarMatch[1]) {
                uploader.avatar = avatarMatch[1];
            }
            
            return uploader;
        }
    }
    
    // Pattern 2: Alternative - attributes in different order
    const altMatch = html.match(/<a[^>]*class="video-uploader__name"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (altMatch && altMatch[1] && altMatch[2]) {
        const href = altMatch[1];
        const name = altMatch[2].trim();
        
        if (name.length > 0 && name.length < 100) {
            uploader.name = name;
            
            const channelMatch = href.match(/\/channels\/([^\/\?"]+)/);
            const userMatch = href.match(/\/users\/([^\/\?"]+)/);
            const pornstarMatch = href.match(/\/pornstars\/([^\/\?"]+)/);
            
            if (channelMatch) {
                uploader.url = `xhamster://channel/${channelMatch[1]}`;
            } else if (pornstarMatch) {
                uploader.url = `xhamster://profile/pornstar:${pornstarMatch[1]}`;
            } else if (userMatch) {
                uploader.url = `xhamster://profile/${userMatch[1]}`;
            } else {
                uploader.url = href;
            }
            
            const avatarMatch = html.match(/class="video-uploader-logo"[^>]*data-background-image="([^"]+)"/i);
            if (avatarMatch && avatarMatch[1]) {
                uploader.avatar = avatarMatch[1];
            }
            
            return uploader;
        }
    }
    
    // Pattern 3: data-role="video-uploader-link" with name (not logo)
    const dataRoleMatch = html.match(/<a[^>]*href="([^"]+)"[^>]*data-role="video-uploader-link"[^>]*>([^<]+)<\/a>/i);
    if (dataRoleMatch && dataRoleMatch[1] && dataRoleMatch[2]) {
        const href = dataRoleMatch[1];
        const name = dataRoleMatch[2].trim();
        
        // Make sure it's not the logo (which has aria-hidden)
        if (name.length > 0 && name.length < 100 && !html.match(new RegExp('href="' + href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*aria-hidden'))) {
            uploader.name = name;
            
            const channelMatch = href.match(/\/channels\/([^\/\?"]+)/);
            const userMatch = href.match(/\/users\/([^\/\?"]+)/);
            const pornstarMatch = href.match(/\/pornstars\/([^\/\?"]+)/);
            
            if (channelMatch) {
                uploader.url = `xhamster://channel/${channelMatch[1]}`;
            } else if (pornstarMatch) {
                uploader.url = `xhamster://profile/pornstar:${pornstarMatch[1]}`;
            } else if (userMatch) {
                uploader.url = `xhamster://profile/${userMatch[1]}`;
            } else {
                uploader.url = href;
            }
            
            return uploader;
        }
    }
    
    // Pattern 4: Fallback - find any channel/user/pornstar link with text content
    const linkPatterns = [
        { regex: /<a[^>]*href="[^"]*\/channels\/([^"\/\?]+)"[^>]*>([^<]{2,50})<\/a>/gi, type: 'channel' },
        { regex: /<a[^>]*href="[^"]*\/pornstars\/([^"\/\?]+)"[^>]*>([^<]{2,50})<\/a>/gi, type: 'pornstar' },
        { regex: /<a[^>]*href="[^"]*\/users\/([^"\/\?]+)"[^>]*>([^<]{2,50})<\/a>/gi, type: 'user' }
    ];
    
    for (const { regex, type } of linkPatterns) {
        let match;
        while ((match = regex.exec(html)) !== null) {
            const slug = match[1];
            const name = match[2].trim();
            
            if (name.length > 1 && name.length < 100 && !isLikelyBadUploaderName(name)) {
                uploader.name = name;
                
                if (type === 'channel') {
                    uploader.url = `xhamster://channel/${slug}`;
                } else if (type === 'pornstar') {
                    uploader.url = `xhamster://profile/pornstar:${slug}`;
                } else {
                    uploader.url = `xhamster://profile/${slug}`;
                }
                
                return uploader;
            }
        }
    }

    return uploader;
}

function isLikelyBadUploaderName(name) {
    if (!name) return true;
    const trimmed = name.toString().replace(/<[^>]*>/g, '').trim();
    if (trimmed.length === 0) return true;

    if (/^\d+\s*videos?$/i.test(trimmed)) return true;
    if (/^\d+\s*views?$/i.test(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;

    const obviouslyBad = [
        'HD', '4K', 'VR', 'POV', 'NEW', 'HOT', 'TOP', 'PREMIUM', 'VERIFIED',
        'AMATEUR', 'PROFESSIONAL', 'HOMEMADE', 'WEBCAM', 'CASTING'
    ];

    if (obviouslyBad.includes(trimmed.toUpperCase())) return true;
    if (trimmed.length <= 2) return true;

    return false;
}

// ===== Platform Object Creation =====

function createThumbnails(thumbnail, videoId) {
    if (!thumbnail && videoId) {
        // Generate CDN URL if we have video ID
        thumbnail = `https://thumb-p3.xhcdn.com/a/${videoId}/000/000/000/000.jpg`;
    }
    if (!thumbnail) {
        return new Thumbnails([]);
    }
    return new Thumbnails([
        new Thumbnail(thumbnail, 0)
    ]);
}

function createPlatformAuthor(uploader) {
    const avatar = uploader.avatar || "";
    const authorUrl = uploader.url || "";
    const authorName = uploader.name || "Unknown";

    return new PlatformAuthorLink(
        new PlatformID(PLATFORM, authorName, plugin.config.id),
        authorName,
        authorUrl,
        avatar
    );
}

function createPlatformVideo(videoData) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail, videoData.id),
        author: createPlatformAuthor(videoData.uploader || {}),
        datetime: videoData.uploadDate || 0,
        duration: videoData.duration || 0,
        viewCount: videoData.views || 0,
        url: videoData.url || `${CONFIG.EXTERNAL_URL_BASE}/videos/${videoData.id}`,
        isLive: false
    });
}

function createVideoSources(videoData) {
    const videoSources = [];

    // Add HLS first (highest priority for playback)
    if (videoData.sources && (videoData.sources.hls || videoData.sources.m3u8)) {
        const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
        if (hlsUrl && hlsUrl.startsWith('http')) {
            videoSources.push(new HLSSource({
                url: hlsUrl,
                name: "HLS (Adaptive)",
                priority: true
            }));
        }
    }

    const qualityOrder = ['2160', '1080', '720', '480', '240'];

    for (const quality of qualityOrder) {
        if (videoData.sources && videoData.sources[quality] && videoData.sources[quality].startsWith('http')) {
            const config = CONFIG.VIDEO_QUALITIES[quality] || { width: 854, height: 480 };
            videoSources.push(new VideoUrlSource({
                url: videoData.sources[quality],
                name: quality + "p",
                container: "video/mp4",
                width: config.width,
                height: config.height
            }));
        }
    }

    if (videoData.sources) {
        for (const [quality, url] of Object.entries(videoData.sources)) {
            if (quality === 'hls' || quality === 'm3u8') continue;
            const alreadyAdded = qualityOrder.includes(quality);
            if (!alreadyAdded && url && url.startsWith('http')) {
                const qualityKey = quality.replace('p', '');
                const configQ = CONFIG.VIDEO_QUALITIES[qualityKey] || { width: 854, height: 480 };
                videoSources.push(new VideoUrlSource({
                    url: url,
                    name: quality.toUpperCase(),
                    container: "video/mp4",
                    width: configQ.width,
                    height: configQ.height
                }));
            }
        }
    }

    if (videoSources.length === 0) {
        throw new ScriptException("No video sources available for this video");
    }

    return videoSources;
}

function createVideoDetails(videoData, url) {
    const videoSources = createVideoSources(videoData);

    let description = videoData.description || videoData.title || "";

    const details = new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, videoData.id || "", plugin.config.id),
        name: videoData.title || "Untitled",
        thumbnails: createThumbnails(videoData.thumbnail, videoData.id),
        author: createPlatformAuthor(videoData.uploader || {}),
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

    details.getContentRecommendations = function() {
        return source.getContentRecommendations(url);
    };

    return details;
}

// ===== Video Source Extraction =====

function extractVideoSources(html) {
    const sources = {};

    // Try to extract HLS stream first (most reliable)
    const hlsPatterns = [
        /"hls"\s*:\s*"([^"]+)"/i,
        /"sources"\s*:\s*\[\s*\{[^}]*"type"\s*:\s*"application\/x-mpegURL"[^}]*"src"\s*:\s*"([^"]+)"/i,
        /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /"(https?:\/\/[^"]+\.m3u8[^"]*)"/,
        /https?:\/\/[^\s"<>]+\.m3u8[^\s"<>]*/
    ];

    for (const pattern of hlsPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let hlsUrl = match[1].replace(/\\/g, '');
            if (hlsUrl.startsWith('//')) hlsUrl = 'https:' + hlsUrl;
            if (hlsUrl.startsWith('http') && hlsUrl.includes('.m3u8')) {
                sources.hls = hlsUrl;
                sources.m3u8 = hlsUrl;
                break;
            }
        }
    }

    // If no HLS found, try MP4 sources
    if (!sources.hls) {
        const mp4Patterns = [
            /"(\d+)p?"\s*:\s*\{\s*[^}]*"url"\s*:\s*"([^"]+\.mp4[^"]*)"/gi,
            /"quality"\s*:\s*"?(\d+)p?"?\s*[^}]*"url"\s*:\s*"([^"]+)"/gi,
            /"(\d+)"\s*:\s*"(https?:\/\/[^"]+\.mp4[^"]*)"/gi,
            /https?:\/\/[^\s"<>]+\.mp4[^\s"<>]*/g
        ];

        for (const pattern of mp4Patterns) {
            let match;
            const localPattern = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
            while ((match = localPattern.exec(html)) !== null) {
                let quality = match[1];
                let url = match[2] ? match[2].replace(/\\/g, '') : match[0].replace(/\\/g, '');

                if (url.startsWith('//')) url = 'https:' + url;
                if (url && url.startsWith('http') && url.includes('.mp4')) {
                    if (!quality) quality = '720';
                    if (!sources[quality] || url.length > sources[quality].length) {
                        sources[quality] = url;
                    }
                }
            }
        }
    }

    return sources;
}

// ===== Page Parsing Functions =====

function parseVideoPage(html, url) {
    const videoData = {
        id: "",
        title: "Unknown",
        description: "",
        thumbnail: "",
        duration: 0,
        views: 0,
        uploadDate: 0,
        uploader: {
            name: "",
            url: "",
            avatar: ""
        },
        sources: {},
        rating: null,
        relatedVideos: []
    };

    // Extract video ID from URL
    const idMatch = url.match(/-(\d+)$/) || url.match(/\/videos\/([^\/-]+)/);
    videoData.id = idMatch ? idMatch[1] : "";

    // Title extraction
    const titlePatterns = [
        /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<meta\s+property="og:title"\s+content="([^"]+)"/i,
        /<title>([^<]+)<\/title>/i,
        /"name"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of titlePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.title = cleanVideoTitle(match[1].trim());
            break;
        }
    }

    // Thumbnail extraction
    const thumbPatterns = [
        /<meta\s+property="og:image"\s+content="([^"]+)"/i,
        /"thumbnailUrl"\s*:\s*"([^"]+)"/,
        /"thumbnail"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of thumbPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.thumbnail = match[1].replace(/\\/g, '');
            break;
        }
    }

    // Duration extraction
    videoData.duration = extractBestDurationSecondsFromContext(html);

    // View count extraction
    videoData.views = extractViewCountFromContext(html);

    // Upload date extraction
    const datePatterns = [
        /"uploadDate"\s*:\s*"([^"]+)"/,
        /itemprop="uploadDate"\s*content="([^"]+)"/i,
        /"datePublished"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of datePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.uploadDate = parseRelativeDate(match[1]);
            break;
        }
    }

    // Uploader extraction
    videoData.uploader = extractUploaderFromContext(html);

    // Video sources extraction
    videoData.sources = extractVideoSources(html);

    // Description extraction
    const descPatterns = [
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<meta\s+property="og:description"\s+content="([^"]+)"/i,
        /"description"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of descPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.description = match[1].replace(/\\n/g, '\n').trim();
            break;
        }
    }

    // Related videos extraction
    videoData.relatedVideos = parseRelatedVideos(html);

    return videoData;
}

function parseSearchResults(html) {
    const videos = [];
    const seenIds = new Set();

    // Find all video containers/items
    const containerPatterns = [
        /<div[^>]*class="[^"]*thumb-list__item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*thumb-list__item|$)/gi,
        /<div[^>]*class="[^"]*video-thumb[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(?:div|li|article)>/gi,
        /<article[^>]*class="[^"]*video[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
        /<li[^>]*class="[^"]*thumb[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    ];

    let containers = [];
    for (const pattern of containerPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && containers.length < 100) {
            containers.push(match[0]);
        }
        if (containers.length > 0) break;
    }

    // If not enough containers found, collect all video links with context
    if (containers.length < 5) {
        const allLinksPattern = /href="([^"]*\/videos\/[^"]+)"/gi;
        let linkMatch;
        while ((linkMatch = allLinksPattern.exec(html)) !== null) {
            const url = linkMatch[1];
            const idx = html.indexOf(linkMatch[0]);
            if (idx >= 0) {
                containers.push(html.substring(Math.max(0, idx - 500), Math.min(html.length, idx + 600)));
            }
        }
    }

    // Process containers
    for (const container of containers) {
        if (videos.length >= 100) break;

        // Extract video URL
        const urlMatch = container.match(/href="([^"]*\/videos\/[^"]+)"/);
        if (!urlMatch) continue;

        const videoUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : BASE_URL + urlMatch[1];
        const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/videos\/([^\/\?-]+)/);
        const videoId = idMatch ? idMatch[1] : generateVideoId();

        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        // Extract title
        let title = "Unknown";
        const titlePatterns = [
            /title="([^"]+)"/,
            /alt="([^"]+)"/,
            /<a[^>]*class="[^"]*video-thumb-info__name[^"]*"[^>]*>([^<]+)<\/a>/i,
            /<(?:h\d|span)[^>]*class="[^"]*title[^"]*"[^>]*>([^<]{5,150})<\/(?:h\d|span)>/,
            /<(?:h\d|span)[^>]*>([^<]{5,150})<\/(?:h\d|span)>/
        ];
        for (const pattern of titlePatterns) {
            const titleMatch = container.match(pattern);
            if (titleMatch && titleMatch[1] && titleMatch[1].length > 3) {
                title = cleanVideoTitle(titleMatch[1]);
                if (title !== "Unknown") break;
            }
        }

        // Extract thumbnail
        let thumbnail = "";
        const thumbPatterns = [
            /(?:data-src|src)="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/,
            /poster="([^"]+)"/
        ];
        for (const pattern of thumbPatterns) {
            const thumbMatch = container.match(pattern);
            if (thumbMatch && thumbMatch[1] && (thumbMatch[1].includes('.xh') || thumbMatch[1].includes('thumb') || thumbMatch[1].includes('cdn'))) {
                thumbnail = thumbMatch[1];
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
                if (!thumbnail.startsWith('http')) thumbnail = 'https:' + thumbnail;
                break;
            }
        }

        // Extract duration
        let duration = extractBestDurationSecondsFromContext(container);

        // Extract view count
        let views = extractViewCountFromContext(container);

        // Extract uploader
        let uploader = extractUploaderFromContext(container);

        // Extract upload date
        let uploadDate = 0;
        const dateMatch = container.match(/(\d+\s*(?:second|minute|hour|day|week|month|year)s?\s*ago)/i);
        if (dateMatch) {
            uploadDate = parseRelativeDate(dateMatch[1]);
        }

        videos.push({
            id: videoId,
            title: title || "Unknown",
            thumbnail: thumbnail,
            duration: duration,
            views: views,
            uploadDate: uploadDate,
            url: videoUrl,
            uploader: uploader
        });
    }

    return videos;
}

function parseRelatedVideos(html) {
    const relatedVideos = [];
    const seenIds = new Set();

    if (!html || typeof html !== 'string') return relatedVideos;

    // xHamster uses .thumb-list--related class for related videos
    // Find the related section first
    let relatedHtml = html;
    
    // Try to isolate the related videos section
    const relatedSectionMatch = html.match(/class="[^"]*thumb-list--related[^"]*"[^>]*>([\s\S]*?)(?:<\/div>\s*<div[^>]*class="[^"]*container|<script|$)/i);
    if (relatedSectionMatch && relatedSectionMatch[0]) {
        relatedHtml = relatedSectionMatch[0];
    }

    // Find all thumb-list__item containers with data-role="related-item"
    // Pattern from console: <div class="thumb-list__item video-thumb video-thumb--type-video page-1" data-role="related-item" ...>
    const containerRegex = /<div[^>]*class="thumb-list__item[^"]*video-thumb[^"]*"[^>]*data-role="related-item"[^>]*>([\s\S]*?)(?=<div[^>]*class="thumb-list__item|<\/div>\s*<\/div>\s*<div[^>]*class="container|$)/gi;
    
    let match;
    while ((match = containerRegex.exec(relatedHtml)) !== null && relatedVideos.length < 30) {
        const container = match[0];
        
        // Extract video ID from data-video-id attribute
        const videoIdMatch = container.match(/data-video-id="(\d+)"/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;
        
        if (!videoId || seenIds.has(videoId)) continue;
        seenIds.add(videoId);
        
        // Extract video URL
        const urlMatch = container.match(/href="([^"]*\/videos\/[^"]+)"/);
        if (!urlMatch) continue;
        const videoUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : BASE_URL + urlMatch[1];
        
        // Extract title from title attribute or aria-label
        let title = "Unknown";
        const titleMatch = container.match(/title="([^"]+)"/) || 
                          container.match(/aria-label="([^"]+)"/);
        if (titleMatch && titleMatch[1]) {
            title = cleanVideoTitle(titleMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        }
        
        // Extract thumbnail from src or srcset
        let thumbnail = "";
        const thumbMatch = container.match(/src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/);
        if (thumbMatch && thumbMatch[1]) {
            thumbnail = thumbMatch[1];
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
        }
        
        // Extract duration
        let duration = extractBestDurationSecondsFromContext(container);
        
        // Extract views
        let views = extractViewCountFromContext(container);
        
        // Extract uploader
        let uploader = extractUploaderFromContext(container);
        
        relatedVideos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: duration,
            views: views,
            url: videoUrl,
            uploader: uploader
        });
    }
    
    // Fallback: if no containers found with data-role, try simpler approach
    if (relatedVideos.length === 0) {
        // Look for any video thumb in related section
        const simpleContainerRegex = /<div[^>]*class="[^"]*thumb-list__item[^"]*video-thumb[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*thumb-list__item|$)/gi;
        
        while ((match = simpleContainerRegex.exec(relatedHtml)) !== null && relatedVideos.length < 30) {
            const container = match[0];
            
            const videoIdMatch = container.match(/data-video-id="(\d+)"/);
            const videoId = videoIdMatch ? videoIdMatch[1] : generateVideoId();
            
            if (seenIds.has(videoId)) continue;
            seenIds.add(videoId);
            
            const urlMatch = container.match(/href="([^"]*\/videos\/[^"]+)"/);
            if (!urlMatch) continue;
            const videoUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : BASE_URL + urlMatch[1];
            
            let title = "Unknown";
            const titleMatch = container.match(/title="([^"]+)"/) || 
                              container.match(/aria-label="([^"]+)"/);
            if (titleMatch && titleMatch[1]) {
                title = cleanVideoTitle(titleMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
            }
            
            let thumbnail = "";
            const thumbMatch = container.match(/src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/);
            if (thumbMatch && thumbMatch[1]) {
                thumbnail = thumbMatch[1];
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            }
            
            let duration = extractBestDurationSecondsFromContext(container);
            let views = extractViewCountFromContext(container);
            let uploader = extractUploaderFromContext(container);
            
            relatedVideos.push({
                id: videoId,
                title: title,
                thumbnail: thumbnail,
                duration: duration,
                views: views,
                url: videoUrl,
                uploader: uploader
            });
        }
    }

    return relatedVideos;
}

function generateVideoId() {
    return 'unknown_' + Math.random().toString(36).substr(2, 9);
}

// ===== Channel Parsing =====

function parseChannelPage(html, channelUrl) {
    const channelData = {
        id: "",
        name: "Unknown",
        description: "",
        thumbnail: "",
        banner: "",
        subscribers: 0,
        videoCount: 0,
        url: channelUrl
    };

    const namePatterns = [
        /<h1[^>]*class="[^"]*(?:user-name|title|name)[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /<meta\s+property="og:title"\s+content="([^"]+)"/i,
        /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i
    ];

    for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].trim().length > 0) {
            channelData.name = match[1].trim();
            break;
        }
    }

    const avatarPatterns = [
        /<img[^>]*class="[^"]*(?:user-avatar|avatar|profile-picture)[^"]*"[^>]*(?:src|data-src)="([^"]+)"/i,
        /<img[^>]*(?:src|data-src)="([^"]+)"[^>]*class="[^"]*(?:user-avatar|avatar|profile-picture)[^"]*"/i,
        /<meta\s+property="og:image"\s+content="([^"]+)"/i
    ];

    for (const pattern of avatarPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].length > 0) {
            let avatar = match[1];
            if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            if (!avatar.startsWith('http')) avatar = 'https:' + avatar;
            channelData.thumbnail = avatar;
            break;
        }
    }

    // Banner extraction
    const bannerPatterns = [
        /<div[^>]*class="[^"]*(?:cover|banner|hero)[^"]*"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")\]]+)['"]?\)/i,
        /<img[^>]*class="[^"]*(?:cover|banner)[^"]*"[^>]*(?:src|data-src)="([^"]+)"/i
    ];

    for (const pattern of bannerPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let banner = match[1];
            if (banner.startsWith('//')) banner = 'https:' + banner;
            channelData.banner = banner;
            break;
        }
    }

    const subscribersPatterns = [
        /(\d[\d,]*)\s*(?:subscribers?|followers?)/i,
        /class="[^"]*subscribers?[^"]*"[^>]*>[\s\S]*?(\d[\d,]*)/i
    ];

    for (const pattern of subscribersPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            channelData.subscribers = parseViewCount(match[1]);
            break;
        }
    }

    const videoCountPatterns = [
        /(\d[\d,]*)\s*videos?/i,
        /class="[^"]*video-count[^"]*"[^>]*>[\s\S]*?(\d[\d,]*)/i
    ];

    for (const pattern of videoCountPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            channelData.videoCount = parseViewCount(match[1]);
            break;
        }
    }

    const descPatterns = [
        /<div[^>]*class="[^"]*(?:user-about|description|bio)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<meta\s+name="description"\s+content="([^"]+)"/i,
        /<p[^>]*class="[^"]*(?:description|bio)[^"]*"[^>]*>([^<]+)<\/p>/i
    ];

    for (const pattern of descPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            channelData.description = match[1].replace(/<[^>]*>/g, '').trim();
            if (channelData.description.length > 10) break;
        }
    }

    return channelData;
}

// ===== Subscriptions Parsing =====

function parseSubscriptionsPage(html) {
    const subscriptions = [];
    const seenIds = new Set();

    // Look for subscription items
    const subscriptionPatterns = [
        /<a[^>]*href="\/(?:users|channels|pornstars|creators)\/([^"\/]+)"[^>]*class="[^"]*subscription[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
        /<div[^>]*class="[^"]*subscription-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<li[^>]*class="[^"]*subscription[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    ];

    for (const pattern of subscriptionPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const container = match[0];

            // Extract profile URL
            const urlMatch = container.match(/href="\/(?:users|channels|pornstars|creators)\/([^"\/]+)"/);
            if (!urlMatch) continue;

            const profileSlug = urlMatch[1];
            if (seenIds.has(profileSlug)) continue;
            seenIds.add(profileSlug);

            // Determine type
            let type = 'user';
            if (container.includes('/channels/')) type = 'channel';
            else if (container.includes('/pornstars/')) type = 'pornstar';
            else if (container.includes('/creators/')) type = 'creator';

            // Extract name
            let name = profileSlug.replace(/-/g, ' ');
            const nameMatch = container.match(/<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                             container.match(/title="([^"]+)"/);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1].trim();
            }

            // Extract avatar
            let avatar = "";
            const avatarMatch = container.match(/(?:src|data-src)="([^"]+(?:jpg|jpeg|png|webp)[^"]*)"/);
            if (avatarMatch && avatarMatch[1]) {
                avatar = avatarMatch[1];
                if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            }

            // Build internal URL
            let internalUrl = "";
            switch (type) {
                case 'channel':
                    internalUrl = `xhamster://channel/${profileSlug}`;
                    break;
                case 'pornstar':
                    internalUrl = `xhamster://profile/pornstar:${profileSlug}`;
                    break;
                default:
                    internalUrl = `xhamster://profile/${profileSlug}`;
            }

            subscriptions.push({
                id: profileSlug,
                name: name,
                type: type,
                url: internalUrl,
                avatar: avatar
            });
        }
        if (subscriptions.length > 0) break;
    }

    // Fallback: look for any profile links
    if (subscriptions.length === 0) {
        const linkPatterns = [
            /<a[^>]*href="\/users\/([^"\/]+)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<a[^>]*href="\/channels\/([^"\/]+)"[^>]*>([\s\S]*?)<\/a>/gi,
            /<a[^>]*href="\/pornstars\/([^"\/]+)"[^>]*>([\s\S]*?)<\/a>/gi
        ];

        for (const pattern of linkPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && subscriptions.length < 100) {
                const slug = match[1];
                if (seenIds.has(slug)) continue;
                seenIds.add(slug);

                let type = 'user';
                if (pattern.source.includes('channels')) type = 'channel';
                else if (pattern.source.includes('pornstars')) type = 'pornstar';

                let name = slug.replace(/-/g, ' ');
                const nameMatch = match[2].match(/>([^<]+)</);
                if (nameMatch) name = nameMatch[1].trim();

                let internalUrl = type === 'channel' ? `xhamster://channel/${slug}` : `xhamster://profile/${slug}`;

                subscriptions.push({
                    id: slug,
                    name: name,
                    type: type,
                    url: internalUrl,
                    avatar: ""
                });
            }
        }
    }

    return subscriptions;
}

// ===== Playlists Parsing =====

function parsePlaylistsPage(html) {
    const playlists = [];
    const seenIds = new Set();

    // Look for playlist items
    const playlistPatterns = [
        /<a[^>]*href="\/my\/collections\/([^"\/]+)"[^>]*>([\s\S]*?)<\/a>/gi,
        /<div[^>]*class="[^"]*(?:playlist|collection)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of playlistPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && playlists.length < 100) {
            const container = match[0];

            // Extract playlist URL/ID
            const urlMatch = container.match(/href="\/my\/collections\/([^"\/]+)"/);
            if (!urlMatch) continue;

            const playlistId = urlMatch[1];
            if (seenIds.has(playlistId)) continue;
            seenIds.add(playlistId);

            // Extract name
            let name = playlistId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const nameMatch = container.match(/<span[^>]*class="[^"]*(?:name|title)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                             container.match(/title="([^"]+)"/);
            if (nameMatch && nameMatch[1]) {
                name = nameMatch[1].trim();
            }

            // Extract thumbnail
            let thumbnail = "";
            const thumbMatch = container.match(/(?:src|data-src)="([^"]+(?:jpg|jpeg|png|webp)[^"]*)"/);
            if (thumbMatch && thumbMatch[1]) {
                thumbnail = thumbMatch[1];
                if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
            }

            // Extract video count
            let videoCount = 0;
            const countMatch = container.match(/(\d+)\s*videos?/i);
            if (countMatch) {
                videoCount = parseInt(countMatch[1]);
            }

            playlists.push({
                id: playlistId,
                name: name,
                thumbnail: thumbnail,
                videoCount: videoCount,
                url: `xhamster://playlist/${playlistId}`
            });
        }
        if (playlists.length > 0) break;
    }

    return playlists;
}

function parsePlaylistVideos(html) {
    // Use the same parsing as search results
    return parseSearchResults(html);
}

// ===== History Parsing =====

function parseHistoryPage(html) {
    const videos = [];
    const seenIds = new Set();

    // Look for history video items
    const videoLinkPattern = /href="([^"]*\/videos\/[^"]+)"/gi;
    let match;

    while ((match = videoLinkPattern.exec(html)) !== null && videos.length < 100) {
        const videoUrl = match[1].startsWith('http') ? match[1] : BASE_URL + match[1];
        const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/videos\/([^\/\?-]+)/);
        const videoId = idMatch ? idMatch[1] : generateVideoId();

        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);

        // Get context around the link
        const contextStart = Math.max(0, match.index - 500);
        const contextEnd = Math.min(html.length, match.index + 600);
        const context = html.substring(contextStart, contextEnd);

        // Extract title
        let title = "Unknown";
        const titleMatch = context.match(/(?:title|alt)="([^"]+)"/) ||
                          context.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/);
        if (titleMatch && titleMatch[1]) {
            title = cleanVideoTitle(titleMatch[1]);
        }

        // Extract thumbnail
        let thumbnail = "";
        const thumbMatch = context.match(/(?:data-src|src)="([^"]*(?:jpg|jpeg|png|webp)[^"]*)"/);
        if (thumbMatch && thumbMatch[1]) {
            thumbnail = thumbMatch[1];
            if (thumbnail.startsWith('//')) thumbnail = 'https:' + thumbnail;
        }

        // Extract duration
        let duration = extractBestDurationSecondsFromContext(context);

        // Extract views
        let views = extractViewCountFromContext(context);

        videos.push({
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            duration: duration,
            views: views,
            uploadDate: Math.floor(Date.now() / 1000) - (videos.length * 3600),
            url: videoUrl,
            uploader: { name: "", url: "", avatar: "" }
        });
    }

    return videos;
}

// ===== Comments Parsing =====

function parseComments(html, videoId) {
    const comments = [];

    const commentPatterns = [
        /<div[^>]*class="[^"]*comment[^"]*"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
        /<li[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
    ];

    for (const pattern of commentPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && comments.length < 50) {
            const container = match[0];

            // Extract comment text
            const textMatch = container.match(/<(?:p|div|span)[^>]*class="[^"]*(?:comment-text|text|body)[^"]*"[^>]*>([^<]+)<\//) ||
                             container.match(/<p[^>]*>([^<]+)<\/p>/);
            if (!textMatch) continue;

            const text = textMatch[1].trim();
            if (text.length === 0) continue;

            // Extract author
            let author = "Anonymous";
            const authorMatch = container.match(/<a[^>]*class="[^"]*(?:user|author)[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                               container.match(/<span[^>]*class="[^"]*(?:user|author)[^"]*"[^>]*>([^<]+)<\/span>/i);
            if (authorMatch && authorMatch[1]) {
                author = authorMatch[1].trim();
            }

            // Extract author URL
            let authorUrl = "";
            const authorUrlMatch = container.match(/<a[^>]*href="(\/users\/[^"]+)"/);
            if (authorUrlMatch) {
                authorUrl = BASE_URL + authorUrlMatch[1];
            }

            // Extract avatar
            let avatar = "";
            const avatarMatch = container.match(/(?:src|data-src)="([^"]+(?:jpg|jpeg|png|webp)[^"]*)"/);
            if (avatarMatch) {
                avatar = avatarMatch[1];
                if (avatar.startsWith('//')) avatar = 'https:' + avatar;
            }

            // Extract likes
            let likes = 0;
            const likesMatch = container.match(/(\d+)\s*(?:likes?|thumbs?\s*up)/i);
            if (likesMatch) {
                likes = parseInt(likesMatch[1]);
            }

            // Extract date
            let date = 0;
            const dateMatch = container.match(/(\d+\s*(?:second|minute|hour|day|week|month|year)s?\s*ago)/i);
            if (dateMatch) {
                date = parseRelativeDate(dateMatch[1]);
            }

            comments.push({
                contextUrl: `${BASE_URL}/videos/${videoId}`,
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, author, plugin.config.id),
                    author,
                    authorUrl,
                    avatar
                ),
                message: text,
                rating: new RatingLikes(likes),
                date: date,
                replyCount: 0
            });
        }
        if (comments.length > 0) break;
    }

    return comments;
}

// ===== Pornstars Parsing =====

function parsePornstarsPage(html) {
    const pornstars = [];

    const pornstarPatterns = [
        /<a[^>]*href="\/pornstars\/([^"\/]+)"[^>]*>[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/a>/gi,
        /<div[^>]*class="[^"]*pornstar[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/pornstars\/([^"\/]+)"[\s\S]*?<img[^>]*(?:data-src|src)="([^"]+)"[\s\S]*?<\/div>/gi
    ];

    for (const pattern of pornstarPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const pornstarSlug = match[1].replace(/\/$/, '');
            let avatar = match[2];

            if (avatar.startsWith('//')) {
                avatar = `https:${avatar}`;
            } else if (!avatar.startsWith('http')) {
                avatar = `https://xhamster.com${avatar}`;
            }

            let name = pornstarSlug.replace(/-/g, ' ');
            name = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            const existingIndex = pornstars.findIndex(p => p.id === `pornstar:${pornstarSlug}`);
            if (existingIndex === -1) {
                pornstars.push({
                    id: `pornstar:${pornstarSlug}`,
                    name: name,
                    avatar: avatar,
                    url: `${CONFIG.EXTERNAL_URL_BASE}/pornstars/${pornstarSlug}`,
                    subscribers: 0,
                    videoCount: 0
                });
            }
        }

        if (pornstars.length > 0) break;
    }

    return pornstars;
}

// ===== Plugin Interface Functions =====

source.enable = function(conf, settings, savedState) {
    config = conf ?? {};

    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            state = { ...state, ...parsed };
        } catch (e) {
            log("Failed to parse saved state: " + e.message);
        }
    }

    log("xHamster plugin enabled");
    log("Auth cookies present: " + (state.authCookies ? "yes" : "no"));
    return true;
};

source.disable = function() {
    log("xHamster plugin disabled");
};

source.saveState = function() {
    return JSON.stringify(state);
};

// ===== Home Feed =====

source.getHome = function(continuationToken) {
    const page = continuationToken ? parseInt(continuationToken) : 1;
    const results = getHomeResults(page);
    const hasMore = results.length >= 20;
    const nextToken = hasMore ? (page + 1).toString() : null;

    return new XHamsterContentPager(results, hasMore, {
        page: page,
        continuationToken: nextToken
    });
};

function getHomeResults(page) {
    let url = BASE_URL + "/";
    if (page > 1) {
        url = `${BASE_URL}/newest/${page}`;
    }
    log("Fetching home page: " + url);

    try {
        const html = makeRequest(url, API_HEADERS, 'home page');
        const videos = parseSearchResults(html);
        return videos.map(v => createPlatformVideo(v));
    } catch (error) {
        log("Home page error: " + error.message);
        throw error;
    }
}

// ===== Search =====

source.searchSuggestions = function(query) {
    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological, Type.Order.Views, Type.Order.Rating],
        filters: [
            {
                id: "duration",
                name: "Duration",
                isMultiSelect: false,
                filters: [
                    { id: "", name: "Any", value: "" },
                    { id: "1-5min", name: "Short (1-5 min)", value: "1-5min" },
                    { id: "5-20min", name: "Medium (5-20 min)", value: "5-20min" },
                    { id: "20min_plus", name: "Long (20+ min)", value: "20min_plus" }
                ]
            },
            {
                id: "quality",
                name: "Quality",
                isMultiSelect: false,
                filters: [
                    { id: "", name: "Any", value: "" },
                    { id: "hd", name: "HD", value: "hd" },
                    { id: "1080p", name: "Full HD", value: "1080p" },
                    { id: "4k", name: "4K", value: "4k" }
                ]
            },
            {
                id: "date",
                name: "Upload Date",
                isMultiSelect: false,
                filters: [
                    { id: "", name: "Any time", value: "" },
                    { id: "today", name: "Today", value: "today" },
                    { id: "week", name: "This week", value: "week" },
                    { id: "month", name: "This month", value: "month" },
                    { id: "year", name: "This year", value: "year" }
                ]
            }
        ]
    };
};

source.search = function(query, type, order, filters, continuationToken) {
    const page = continuationToken ? parseInt(continuationToken) : 1;
    const results = getSearchResults(query, page, order, filters);
    const hasMore = results.length >= 20;
    const nextToken = hasMore ? (page + 1).toString() : null;

    return new XHamsterSearchPager(results, hasMore, {
        query: query,
        type: type,
        order: order,
        filters: filters,
        continuationToken: nextToken
    });
};

function getSearchResults(query, page, order, filters) {
    const encodedQuery = encodeURIComponent(query);
    let url = `${BASE_URL}/search/${encodedQuery}`;

    // Add filters
    const params = [];

    if (filters) {
        for (const filter of filters) {
            if (filter.id === "duration" && filter.value) {
                params.push(`duration=${filter.value}`);
            }
            if (filter.id === "quality" && filter.value) {
                params.push(`quality=${filter.value}`);
            }
            if (filter.id === "date" && filter.value) {
                params.push(`date=${filter.value}`);
            }
        }
    }

    // Add sort order
    if (order === Type.Order.Views) {
        params.push("o=mv");
    } else if (order === Type.Order.Rating) {
        params.push("o=mr");
    } else if (order === Type.Order.Chronological) {
        params.push("o=mr");
    }

    // Add page
    if (page > 1) {
        params.push(`page=${page}`);
    }

    if (params.length > 0) {
        url += "?" + params.join("&");
    }

    log("Searching: " + url);

    const html = makeRequest(url, API_HEADERS, 'search');
    const videos = parseSearchResults(html);

    return videos.map(v => createPlatformVideo(v));
}

// ===== Channel Search =====

source.searchChannels = function(query, continuationToken) {
    const page = continuationToken ? parseInt(continuationToken) : 1;
    const results = getChannelSearchResults(query, page);
    const hasMore = results.length >= 20;
    const nextToken = hasMore ? (page + 1).toString() : null;

    return new XHamsterChannelPager(results, hasMore, {
        query: query,
        continuationToken: nextToken
    });
};

function getChannelSearchResults(query, page) {
    const encodedQuery = encodeURIComponent(query);
    let url = `${BASE_URL}/pornstars/search/${encodedQuery}`;
    if (page > 1) {
        url += `?page=${page}`;
    }

    log("Searching channels: " + url);

    const html = makeRequest(url, API_HEADERS, 'channel search');
    const pornstars = parsePornstarsPage(html);

    return pornstars.map(p => {
        return new PlatformAuthorLink(
            new PlatformID(PLATFORM, p.id, plugin.config.id),
            p.name,
            `xhamster://profile/pornstar:${p.id.replace('pornstar:', '')}`,
            p.avatar,
            p.subscribers
        );
    });
}

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.searchChannelContents = function(channelUrl, query, type, order, filters) {
    // xHamster doesn't have per-channel search, return empty
    return new XHamsterContentPager([], false, {});
};

// ===== Video Details =====

source.isContentDetailsUrl = function(url) {
    return url.includes('/videos/');
};

source.getContentDetails = function(url) {
    log("Getting video details for: " + url);

    const html = makeRequest(url, API_HEADERS, 'video details');
    const videoData = parseVideoPage(html, url);

    return createVideoDetails(videoData, url);
};

source.getContentRecommendations = function(url) {
    log("Getting recommendations for: " + url);

    try {
        const html = makeRequest(url, API_HEADERS, 'recommendations');
        const videoData = parseVideoPage(html, url);

        if (videoData.relatedVideos && videoData.relatedVideos.length > 0) {
            const platformVideos = videoData.relatedVideos.map(v => createPlatformVideo(v));
            return new XHamsterContentPager(platformVideos, false, {});
        }

        return new XHamsterContentPager([], false, {});
    } catch (e) {
        log("Failed to get recommendations: " + e.message);
        return new XHamsterContentPager([], false, {});
    }
};

// ===== Channel Functions =====

source.isChannelUrl = function(url) {
    return url.includes('/users/') || url.includes('/pornstars/') || url.includes('/creators/') ||
           url.includes('/channels/') || url.includes('xhamster://profile/') || url.includes('xhamster://channel/');
};

source.getChannel = function(url) {
    log("Getting channel: " + url);

    let channelUrl = url;

    if (url.startsWith('xhamster://')) {
        const channelInfo = extractChannelId(url);
        if (channelInfo.type === 'pornstar') {
            channelUrl = `${BASE_URL}/pornstars/${channelInfo.id}`;
        } else if (channelInfo.type === 'user') {
            channelUrl = `${BASE_URL}/users/${channelInfo.id}`;
        } else if (channelInfo.type === 'creator') {
            channelUrl = `${BASE_URL}/creators/${channelInfo.id}`;
        } else if (channelInfo.type === 'channel') {
            channelUrl = `${BASE_URL}/channels/${channelInfo.id}`;
        }
    }

    const html = makeRequest(channelUrl, API_HEADERS, 'channel page');
    const channelData = parseChannelPage(html, channelUrl);

    const channelInfo = extractChannelId(url);
    channelData.id = channelInfo.id;

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channelData.id, plugin.config.id),
        name: channelData.name,
        thumbnail: channelData.thumbnail,
        banner: channelData.banner,
        subscribers: channelData.subscribers,
        description: channelData.description,
        url: channelUrl,
        links: {}
    });
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological, Type.Order.Views],
        filters: []
    };
};

source.getChannelContents = function(url, type, order, filters, continuationToken) {
    const page = continuationToken ? parseInt(continuationToken) : 1;
    const videos = getChannelVideos(url, page, order);
    const hasMore = videos.length >= 20;
    const nextToken = hasMore ? (page + 1).toString() : null;

    return new XHamsterChannelContentPager(videos, hasMore, {
        url: url,
        type: type,
        order: order,
        filters: filters,
        continuationToken: nextToken
    });
};

function getChannelVideos(url, page, order) {
    let channelUrl = url;

    if (url.startsWith('xhamster://')) {
        const channelInfo = extractChannelId(url);
        if (channelInfo.type === 'pornstar') {
            channelUrl = `${BASE_URL}/pornstars/${channelInfo.id}/videos`;
        } else if (channelInfo.type === 'user') {
            channelUrl = `${BASE_URL}/users/${channelInfo.id}/videos`;
        } else if (channelInfo.type === 'creator') {
            channelUrl = `${BASE_URL}/creators/${channelInfo.id}/videos`;
        } else if (channelInfo.type === 'channel') {
            channelUrl = `${BASE_URL}/channels/${channelInfo.id}/videos`;
        }
    } else if (!url.includes('/videos')) {
        channelUrl = url.replace(/\/$/, '') + '/videos';
    }

    if (page > 1) {
        channelUrl = channelUrl + `/${page}`;
    }

    // Add sort order
    if (order === Type.Order.Views) {
        channelUrl += (channelUrl.includes('?') ? '&' : '?') + 'o=mv';
    }

    log("Fetching channel videos: " + channelUrl);

    const html = makeRequest(channelUrl, API_HEADERS, 'channel videos');
    const videos = parseSearchResults(html);

    return videos.map(v => createPlatformVideo(v));
}

// ===== Creators/Pornstars =====

source.getCreators = function(query, continuationToken) {
    const page = continuationToken ? parseInt(continuationToken) : 1;
    const creators = getCreatorResults(query, page);
    const hasMore = creators.length >= 20;
    const nextToken = hasMore ? (page + 1).toString() : null;

    return new XHamsterCreatorPager(creators, hasMore, {
        query: query,
        continuationToken: nextToken
    });
};

function getCreatorResults(query, page) {
    const encodedQuery = encodeURIComponent(query);
    const url = page > 1
        ? `${BASE_URL}/pornstars/search/${encodedQuery}?page=${page}`
        : `${BASE_URL}/pornstars/search/${encodedQuery}`;

    log("Searching creators: " + url);

    const html = makeRequest(url, API_HEADERS, 'creator search');
    const pornstars = parsePornstarsPage(html);

    return pornstars.map(p => {
        return new PlatformAuthorLink(
            new PlatformID(PLATFORM, p.id, plugin.config.id),
            p.name,
            `xhamster://profile/pornstar:${p.id.replace('pornstar:', '')}`,
            p.avatar,
            p.subscribers
        );
    });
}

// ===== Comments =====

source.getComments = function(url) {
    try {
        const videoId = extractVideoId(url);
        const html = makeRequest(url, API_HEADERS, 'video page for comments');
        const comments = parseComments(html, videoId);

        log("getComments found " + comments.length + " comments");
        const platformComments = comments.map(c => new Comment(c));

        return new XHamsterCommentPager(platformComments, comments.length >= 20, {
            url: url,
            videoId: videoId,
            page: 1
        });

    } catch (error) {
        log("getComments error: " + error.message);
        return new XHamsterCommentPager([], false, { url: url });
    }
};

source.getSubComments = function(comment) {
    return new XHamsterCommentPager([], false, {});
};

// ===== User Subscriptions =====

source.getUserSubscriptions = function() {
    log("getUserSubscriptions called");

    if (!hasValidAuthCookie()) {
        log("Not logged in - returning empty subscriptions");
        return [];
    }

    try {
        const response = makeRequestNoThrow(USER_URLS.SUBSCRIPTIONS, getAuthHeaders(), 'subscriptions', true);

        if (!response.isOk) {
            log("Failed to fetch subscriptions: HTTP " + response.code);
            return [];
        }

        const html = response.body;
        const subscriptions = parseSubscriptionsPage(html);

        log("Found " + subscriptions.length + " subscriptions");

        return subscriptions.map(sub => {
            return new PlatformAuthorLink(
                new PlatformID(PLATFORM, sub.id, plugin.config.id),
                sub.name,
                sub.url,
                sub.avatar
            );
        });

    } catch (error) {
        log("getUserSubscriptions error: " + error.message);
        return [];
    }
};

// ===== User Playlists =====

source.getUserPlaylists = function() {
    log("getUserPlaylists called");

    if (!hasValidAuthCookie()) {
        log("Not logged in - returning empty playlists");
        return [];
    }

    try {
        const response = makeRequestNoThrow(USER_URLS.PLAYLISTS, getAuthHeaders(), 'playlists', true);

        if (!response.isOk) {
            log("Failed to fetch playlists: HTTP " + response.code);
            return [];
        }

        const html = response.body;
        const playlists = parsePlaylistsPage(html);

        log("Found " + playlists.length + " playlists");

        return playlists.map(pl => {
            return new PlatformPlaylist({
                id: new PlatformID(PLATFORM, pl.id, plugin.config.id),
                name: pl.name,
                thumbnail: pl.thumbnail,
                author: new PlatformAuthorLink(
                    new PlatformID(PLATFORM, state.username || "User", plugin.config.id),
                    state.username || "User",
                    "",
                    ""
                ),
                videoCount: pl.videoCount,
                url: pl.url
            });
        });

    } catch (error) {
        log("getUserPlaylists error: " + error.message);
        return [];
    }
};

// ===== Playlist Functions =====

source.isPlaylistUrl = function(url) {
    if (!url || typeof url !== 'string') return false;

    return REGEX_PATTERNS.urls.playlistInternal.test(url) ||
           REGEX_PATTERNS.urls.playlistExternal.test(url) ||
           url.includes('/my/collections/');
};

source.searchPlaylists = function(query, type, order, filters, continuationToken) {
    // xHamster doesn't have public playlist search
    // Return user's playlists if logged in
    const playlists = source.getUserPlaylists();
    return new XHamsterPlaylistPager(playlists, false, { query: query });
};

source.getPlaylist = function(url) {
    log("getPlaylist called with URL: " + url);

    let playlistUrl;
    let playlistId;
    let playlistName;

    const playlistMatch = url.match(REGEX_PATTERNS.urls.playlistInternal);
    const externalMatch = url.match(REGEX_PATTERNS.urls.playlistExternal);

    if (playlistMatch) {
        playlistId = playlistMatch[1];
        playlistUrl = `${BASE_URL}/my/collections/${playlistId}`;
        playlistName = playlistId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } else if (externalMatch) {
        playlistId = externalMatch[1];
        playlistUrl = url;
        playlistName = playlistId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } else if (url.includes('/my/collections/')) {
        const idMatch = url.match(/\/my\/collections\/([^\/\?]+)/);
        playlistId = idMatch ? idMatch[1] : "unknown";
        playlistUrl = url;
        playlistName = playlistId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    } else {
        throw new ScriptException("Invalid playlist URL format: " + url);
    }

    log("Fetching playlist from: " + playlistUrl);

    const response = makeRequestNoThrow(playlistUrl, getAuthHeaders(), 'playlist', true);

    if (!response.isOk) {
        throw new ScriptException(`Failed to fetch playlist: HTTP ${response.code}`);
    }

    const html = response.body;

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/<title>([^<]+?)(?:\s*-\s*xHamster)?<\/title>/i);
    if (titleMatch && titleMatch[1]) {
        playlistName = titleMatch[1].trim();
    }

    // Parse videos
    let videos = parsePlaylistVideos(html);
    log(`Found ${videos.length} videos in playlist`);

    const platformVideos = videos.map(v => createPlatformVideo(v));
    const thumbnailUrl = videos.length > 0 && videos[0].thumbnail ? videos[0].thumbnail : "";

    const hasMore = html.match(/class="[^"]*pagination[^"]*"/) !== null ||
                   html.match(/href="[^"]*\/\d+\/?[^"]*"[^>]*>\s*(?:Next|>|&gt;|→)/i) !== null;

    return new PlatformPlaylistDetails({
        id: new PlatformID(PLATFORM, playlistId, plugin.config.id),
        name: playlistName,
        thumbnail: thumbnailUrl,
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, state.username || "User", plugin.config.id),
            state.username || "User",
            "",
            ""
        ),
        datetime: 0,
        url: url,
        videoCount: platformVideos.length,
        contents: new XHamsterPlaylistVideosPager(platformVideos, hasMore, {
            playlistUrl: playlistUrl,
            playlistId: playlistId,
            page: 1
        })
    });
};

// ===== History Sync =====

source.syncRemoteWatchHistory = function(continuationToken) {
    log("syncRemoteWatchHistory called, token: " + continuationToken);

    if (!hasValidAuthCookie()) {
        log("Not logged in - cannot sync history");
        return new XHamsterHistoryPager([], false, {});
    }

    const page = continuationToken ? parseInt(continuationToken) : 1;

    try {
        let historyUrl = USER_URLS.HISTORY;
        if (page > 1) {
            historyUrl += `/${page}`;
        }

        log("Fetching history from: " + historyUrl);

        const response = makeRequestNoThrow(historyUrl, getAuthHeaders(), 'history', true);

        if (!response.isOk) {
            log("Failed to fetch history: HTTP " + response.code);
            return new XHamsterHistoryPager([], false, {});
        }

        const html = response.body;
        const videos = parseHistoryPage(html);

        log("History page " + page + " found " + videos.length + " videos");

        const platformVideos = videos.map((v, index) => {
            // Set datetime for history items
            const datetime = Math.floor(Date.now() / 1000) - ((page - 1) * 100 + index) * 3600;
            return new PlatformVideo({
                id: new PlatformID(PLATFORM, v.id || "", plugin.config.id),
                name: v.title || "Untitled",
                thumbnails: createThumbnails(v.thumbnail, v.id),
                author: createPlatformAuthor(v.uploader || {}),
                datetime: datetime,
                duration: v.duration || 0,
                viewCount: v.views || 0,
                url: v.url,
                isLive: false
            });
        });

        const hasMore = videos.length >= 20;
        const nextToken = hasMore ? (page + 1).toString() : null;

        return new XHamsterHistoryPager(platformVideos, hasMore, {
            continuationToken: nextToken
        });

    } catch (error) {
        log("syncRemoteWatchHistory error: " + error.message);
        return new XHamsterHistoryPager([], false, {});
    }
};

// ===== Download Functions =====

source.canDownload = function(video) {
    return true;
};

source.getDownloadables = function(video) {
    try {
        const url = video.url.value || video.url;
        const html = makeRequest(url, API_HEADERS, 'video download');
        const videoData = parseVideoPage(html, url);

        const downloads = [];

        if (videoData.sources) {
            const qualityOrder = ['2160', '1080', '720', '480', '240'];
            for (const quality of qualityOrder) {
                if (videoData.sources[quality] && videoData.sources[quality].startsWith('http')) {
                    const name = quality + "p";
                    downloads.push(new Downloadable({
                        name: name,
                        url: videoData.sources[quality],
                        mimeType: "video/mp4"
                    }));
                }
            }
        }

        if (videoData.sources && (videoData.sources.hls || videoData.sources.m3u8)) {
            const hlsUrl = videoData.sources.hls || videoData.sources.m3u8;
            downloads.push(new Downloadable({
                name: "HLS Stream",
                url: hlsUrl,
                mimeType: "application/x-mpegURL"
            }));
        }

        if (downloads.length === 0) {
            log("No downloads available for video: " + url);
            return [];
        }

        return downloads;
    } catch (error) {
        log("Failed to get downloadables: " + error.message);
        return [];
    }
};

// ===== Pager Classes =====

class XHamsterContentPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

class XHamsterSearchPager extends ContentPager {
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

class XHamsterChannelPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.searchChannels(this.context.query, this.context.continuationToken);
    }
}

class XHamsterCreatorPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.getCreators(this.context.query, this.context.continuationToken);
    }
}

class XHamsterChannelContentPager extends ContentPager {
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

class XHamsterPlaylistPager extends PlaylistPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return new XHamsterPlaylistPager([], false, this.context);
    }
}

class XHamsterPlaylistVideosPager extends ContentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        try {
            const nextPage = (this.context.page || 1) + 1;
            let nextUrl = this.context.playlistUrl;

            if (nextUrl.endsWith('/')) {
                nextUrl = nextUrl + nextPage;
            } else {
                nextUrl = nextUrl + '/' + nextPage;
            }

            log("XHamsterPlaylistVideosPager: Fetching next page: " + nextUrl);

            const response = makeRequestNoThrow(nextUrl, getAuthHeaders(), 'playlist videos page', true);

            if (!response.isOk || !response.body || response.body.length < 100) {
                return new XHamsterPlaylistVideosPager([], false, this.context);
            }

            const html = response.body;
            const videos = parsePlaylistVideos(html);
            const platformVideos = videos.map(v => createPlatformVideo(v));

            const hasMore = videos.length >= 20;

            return new XHamsterPlaylistVideosPager(platformVideos, hasMore, {
                playlistUrl: this.context.playlistUrl,
                playlistId: this.context.playlistId,
                page: nextPage
            });

        } catch (error) {
            log("XHamsterPlaylistVideosPager error: " + error.message);
            return new XHamsterPlaylistVideosPager([], false, this.context);
        }
    }
}

class XHamsterCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return new XHamsterCommentPager([], false, this.context);
    }
}

class XHamsterHistoryPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore);
        this.context = context;
    }

    nextPage() {
        return source.syncRemoteWatchHistory(this.context.continuationToken);
    }
}

log("xHamster plugin loaded - v4");
