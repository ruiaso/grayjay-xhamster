const BASE_URL = "https://xhamster.com";
const PLATFORM = "xHamster";
const PLATFORM_CLAIMTYPE = 3;

var config = {};
let localConfig = {
    modelIds: {}
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
    THUMB_BASE: "https://thumb-p3.xhcdn.com"
};

const API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
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
        profileInternal: /^xhamster:\/\/profile\/(.+)$/
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

function getAuthHeaders() {
    const headers = { ...API_HEADERS };
    if (state.authCookies && state.authCookies.length > 0) {
        headers["Cookie"] = state.authCookies;
    }
    return headers;
}

function makeRequest(url, headers = null, context = 'request') {
    try {
        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, false);
        if (!response.isOk) {
            throw new ScriptException(`${context} failed with status ${response.code}`);
        }
        return response.body;
    } catch (error) {
        throw new ScriptException(`Failed to fetch ${context}: ${error.message}`);
    }
}

function makeRequestNoThrow(url, headers = null, context = 'request') {
    try {
        const requestHeaders = headers || getAuthHeaders();
        const response = http.GET(url, requestHeaders, false);
        return { isOk: response.isOk, code: response.code, body: response.body };
    } catch (error) {
        return { isOk: false, code: 0, body: null, error: error.message };
    }
}

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

    // Handle xhamster:// protocol URLs
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

    // Handle direct URLs - check in this order
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

    // Default fallback
    return { type: 'user', id: 'unknown' };
}

function parseDuration(durationStr) {
    if (!durationStr) return 0;

    let totalSeconds = 0;

    if (typeof durationStr === 'number') {
        return durationStr;
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

function createThumbnails(thumbnail) {
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
    const authorName = uploader.name || "";

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
        thumbnails: createThumbnails(videoData.thumbnail),
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
        thumbnails: createThumbnails(videoData.thumbnail),
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

function parseVideoPage(html) {
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
        rating: null
    };

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

    const durationPatterns = [
        /"duration"\s*:\s*"?PT?(\d+)M?(\d*)S?"?/i,
        /itemprop="duration"\s*content="PT(\d+)M(\d+)?S?"/i,
        /"duration"\s*:\s*(\d+)/
    ];

    for (const pattern of durationPatterns) {
        const match = html.match(pattern);
        if (match) {
            if (match[2] !== undefined) {
                videoData.duration = (parseInt(match[1]) || 0) * 60 + (parseInt(match[2]) || 0);
            } else {
                videoData.duration = parseInt(match[1]) || 0;
            }
            break;
        }
    }

    const viewsPatterns = [
        /"interactionCount"\s*:\s*"?(\d+)"?/,
        /(\d[\d,]*)\s*(?:views?|plays?)/i
    ];

    for (const pattern of viewsPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            videoData.views = parseViewCount(match[1]);
            break;
        }
    }

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

    const uploaderPatterns = [
        /<a[^>]*href="\/channels\/([^"\/]+)"[^>]*>[\s\S]*?(?:<img[^>]*(?:data-src|src)="([^"]+)")?[\s\S]*?([^<]+)<\/a>/i,
        /<a[^>]*href="\/users\/([^"\/]+)"[^>]*class="[^"]*user[^"]*"[^>]*>[\s\S]*?(?:<img[^>]*src="([^"]+)")?[\s\S]*?([^<]+)<\/a>/i,
        /<a[^>]*href="\/pornstars\/([^"\/]+)"[^>]*>[\s\S]*?(?:<img[^>]*src="([^"]+)")?[\s\S]*?<span[^>]*>([^<]+)<\/span>/i,
        /<a[^>]*class="[^"]*uploader[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i,
        /"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"url"\s*:\s*"([^"]+)"/
    ];

    for (const pattern of uploaderPatterns) {
        const match = html.match(pattern);
        if (match) {
            if (pattern.source.includes('author')) {
                videoData.uploader.name = match[1] || "";
                videoData.uploader.url = match[2] || "";
            } else if (match[0].includes('/channels/')) {
                videoData.uploader.name = (match[3] || match[1] || "").trim();
                videoData.uploader.url = `xhamster://channel/${match[1]}`;
                videoData.uploader.avatar = match[2] || "";
            } else if (match[0].includes('/users/')) {
                videoData.uploader.name = (match[3] || match[1] || "").trim();
                videoData.uploader.url = `xhamster://profile/${match[1]}`;
                videoData.uploader.avatar = match[2] || "";
            } else if (match[0].includes('/pornstars/')) {
                videoData.uploader.name = (match[3] || match[1] || "").trim();
                videoData.uploader.url = `xhamster://profile/pornstar:${match[1]}`;
                videoData.uploader.avatar = match[2] || "";
            } else {
                videoData.uploader.name = (match[2] || "").trim();
                videoData.uploader.url = match[1] || "";
            }
            if (videoData.uploader.name) break;
        }
    }

    videoData.sources = extractVideoSources(html);

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

    return videoData;
}

function parseSearchResults(html) {
    const videos = [];
    const seenIds = new Set();

    // Find all video containers/items
    const containerPatterns = [
        /<div[^>]*class="[^"]*thumb[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(?:div|li)>/gi,
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
                containers.push(html.substring(Math.max(0, idx - 300), Math.min(html.length, idx + 400)));
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

        // Extract channel/uploader name
        let uploaderName = "";
        const uploaderPatterns = [
            /href="\/users\/([^"\/]+)"/,
            /href="\/pornstars\/([^"\/]+)"/,
            /class="[^"]*uploader[^"]*"[^>]*>([^<]+)<\/[^>]*>/
        ];
        for (const pattern of uploaderPatterns) {
            const uploaderMatch = container.match(pattern);
            if (uploaderMatch && uploaderMatch[1]) {
                uploaderName = uploaderMatch[1].replace(/-/g, ' ');
                break;
            }
        }

        let uploaderUrl = "";
        const uploaderUrlMatch = container.match(/href="(\/(?:users|pornstars)\/[^"\/]+)"/);
        if (uploaderUrlMatch) {
            uploaderUrl = `xhamster://profile/${uploaderUrlMatch[1].split('/').pop()}`;
        }

        videos.push({
            id: videoId,
            title: title || "Unknown",
            thumbnail: thumbnail,
            duration: 0,
            views: 0,
            uploadDate: 0,
            url: videoUrl,
            uploader: { name: uploaderName, url: uploaderUrl, avatar: "" }
        });
    }

    return videos;
}

function generateVideoId() {
    return 'unknown_' + Math.random().toString(36).substr(2, 9);
}

function parseRelatedVideos(html) {
    const relatedVideos = [];
    const seenIds = new Set();

    // Find all video links and get them with surrounding context
    const allVideoLinks = [];
    const videoPattern = /href="([^"]*\/videos\/[^"]+)"/gi;
    let match;
    while ((match = videoPattern.exec(html)) !== null) {
        allVideoLinks.push({
            url: match[1],
            pos: match.index
        });
    }

    // If no links found, return empty
    if (allVideoLinks.length === 0) {
        return relatedVideos;
    }

    // Try to find related section, or just use the last 30 videos on page
    let startIdx = 0;
    
    // Look for related/recommended section markers
    const relatedMarkers = ['related', 'recommended', 'you might like', 'similar', 'more like'];
    for (const marker of relatedMarkers) {
        const idx = html.toLowerCase().indexOf(marker);
        if (idx > 0) {
            // Find first video link after this marker
            for (let i = 0; i < allVideoLinks.length; i++) {
                if (allVideoLinks[i].pos > idx) {
                    startIdx = i;
                    break;
                }
            }
            if (startIdx > 0) break;
        }
    }

    // If no section found, use links from halfway through page onward
    if (startIdx === 0 && allVideoLinks.length > 2) {
        startIdx = Math.max(1, Math.floor(allVideoLinks.length / 2));
    }

    // Extract videos starting from found position
    for (let i = startIdx; i < allVideoLinks.length && relatedVideos.length < 50; i++) {
        const videoUrl = allVideoLinks[i].url.startsWith('http') ? allVideoLinks[i].url : BASE_URL + allVideoLinks[i].url;
        const idMatch = videoUrl.match(/-(\d+)$/) || videoUrl.match(/\/videos\/([^\/-]+)/);
        const videoId = idMatch ? idMatch[1] : generateVideoId();

        if (seenIds.has(videoId) || !videoId) continue;
        seenIds.add(videoId);

        // Try to find title near this link
        const linkContext = html.substring(Math.max(0, allVideoLinks[i].pos - 200), Math.min(html.length, allVideoLinks[i].pos + 300));
        let title = "Unknown";
        const titleMatch = linkContext.match(/(?:title|alt)="([^"]+)"/);
        if (titleMatch && titleMatch[1]) {
            title = cleanVideoTitle(titleMatch[1]);
        }

        relatedVideos.push({
            id: videoId,
            title: title,
            thumbnail: "",
            duration: 0,
            views: 0,
            url: videoUrl,
            uploader: { name: "", url: "", avatar: "" }
        });
    }

    return relatedVideos;
}

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
        /<h1[^>]*class="[^"]*(?:user-name|title)[^"]*"[^>]*>([^<]+)<\/h1>/i,
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
        /<meta\s+property="og:image"\s+content="([^"]+)"/i,
        /<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i
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
    return true;
};

source.disable = function() {
    log("xHamster plugin disabled");
};

source.saveState = function() {
    return JSON.stringify(state);
};

source.getHome = function() {
    return new ContentPager(getHomeResults(1), true, { page: 1 });
};

function getHomeResults(page) {
    // Parse the homepage directly - most reliable
    let url = BASE_URL + "/";
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

source.getHomePager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const videos = getHomeResults(nextPage);
    return new ContentPager(videos, videos.length > 0, { page: nextPage });
};

source.searchSuggestions = function(query) {
    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.search = function(query, type, order, filters) {
    return new ContentPager(getSearchResults(query, 1), true, { query: query, page: 1 });
};

function getSearchResults(query, page) {
    const encodedQuery = encodeURIComponent(query);
    const url = page > 1 
        ? `${BASE_URL}/search/${encodedQuery}?page=${page}`
        : `${BASE_URL}/search/${encodedQuery}`;
    
    log("Searching: " + url);
    
    const html = makeRequest(url, API_HEADERS, 'search');
    const videos = parseSearchResults(html);
    
    return videos.map(v => createPlatformVideo(v));
}

source.getSearchPager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const videos = getSearchResults(context.query, nextPage);
    return new ContentPager(videos, videos.length > 0, { query: context.query, page: nextPage });
};

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.searchChannelContents = function(channelUrl, query, type, order, filters) {
    return new VideoPager([]);
};

source.searchChannels = function(query) {
    return new ChannelPager([]);
};

source.isContentDetailsUrl = function(url) {
    return url.includes('/videos/');
};

source.getContentDetails = function(url) {
    log("Getting video details for: " + url);
    
    const html = makeRequest(url, API_HEADERS, 'video details');
    const videoData = parseVideoPage(html);
    
    const idMatch = url.match(/-(\d+)$/) || url.match(/\/videos\/([^\/-]+)/);
    videoData.id = idMatch ? idMatch[1] : "";
    
    return createVideoDetails(videoData, url);
};

source.getContentRecommendations = function(url) {
    log("Getting recommendations for: " + url);
    
    try {
        const html = makeRequest(url, API_HEADERS, 'recommendations');
        const relatedVideos = parseRelatedVideos(html);
        const platformVideos = relatedVideos.map(v => createPlatformVideo(v));
        return new ContentPager(platformVideos, false, {});
    } catch (e) {
        log("Failed to get recommendations: " + e.message);
        return new ContentPager([], false, {});
    }
};

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

source.getChannelContents = function(url, type, order, filters) {
    return new ContentPager(getChannelVideos(url, 1), true, { url: url, page: 1 });
};

function getChannelVideos(url, page) {
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
    
    log("Fetching channel videos: " + channelUrl);
    
    const html = makeRequest(channelUrl, API_HEADERS, 'channel videos');
    const videos = parseSearchResults(html);
    
    return videos.map(v => createPlatformVideo(v));
}

source.getChannelContentsPager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const videos = getChannelVideos(context.url, nextPage);
    return new ContentPager(videos, videos.length > 0, { url: context.url, page: nextPage });
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: [Type.Order.Chronological],
        filters: []
    };
};

source.getCreators = function(query, options) {
    return new CreatorPager(getCreatorResults(query, 1), true, { query: query, page: 1 });
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

source.getCreatorsPager = function(context) {
    const nextPage = (context.page || 1) + 1;
    const creators = getCreatorResults(context.query, nextPage);
    return new CreatorPager(creators, creators.length > 0, { query: context.query, page: nextPage });
};

source.getComments = function(url) {
    return new CommentPager([], false, {});
};

source.getSubComments = function(comment) {
    return new CommentPager([], false, {});
};

source.getUserSubscriptions = function() {
    return [];
};

source.getUserPlaylists = function() {
    return [];
};

source.getPlaylist = function(url) {
    throw new ScriptException("Playlists not implemented");
};

source.canDownload = function(video) {
    return true;
};

source.getDownloadables = function(video) {
    try {
        const url = video.url.value || video.url;
        const html = makeRequest(url, API_HEADERS, 'video download');
        const videoData = parseVideoPage(html);
        
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

log("xHamster plugin loaded");
