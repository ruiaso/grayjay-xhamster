export default {
  async search(query) {
    const url = `https://xhamster.com/search/${encodeURIComponent(query)}`;
    const html = await (await fetch(url)).text();

    const results = [];
    const regex =
      /<a[^>]+href=\"(\/videos\/[^\"]+)\"[^>]*>[\s\S]*?<img[^>]+src=\"([^\"]+)/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push({
        id: match[1],
        title: match[1].split("/").pop().replace(/-/g, " "),
        thumbnail: match[2],
        url: "https://xhamster.com" + match[1],
        type: "video"
      });
    }

    return results;
  },

  async getVideo(videoId) {
    const url = `https://xhamster.com${videoId}`;
    const html = await (await fetch(url)).text();

    const jsonMatch = html.match(/window\.initials\s*=\s*(\{[\s\S]*?\});/);
    if (!jsonMatch) return { id: videoId, title: "Video", streams: [] };

    let data;
    try {
      data = JSON.parse(jsonMatch[1]);
    } catch {
      return { id: videoId, title: "Video", streams: [] };
    }

    const sources = data?.video?.sources || [];
    const streams = sources.map(src => ({
      url: src.url,
      quality: src.quality
    }));

    return {
      id: videoId,
      title: data?.video?.title || "Video",
      thumbnail: data?.video?.thumb || null,
      streams
    };
  },

  async getPlaylist(playlistUrl) {
    const html = await (await fetch(playlistUrl)).text();
    const videoRegex = /<a[^>]+href="(\/videos\/[^\"]+)"/g;

    const videos = [];
    let match;
    while ((match = videoRegex.exec(html)) !== null) {
      videos.push({
        id: match[1],
        url: "https://xhamster.com" + match[1],
        type: "video"
      });
    }

    return videos;
  }
};
