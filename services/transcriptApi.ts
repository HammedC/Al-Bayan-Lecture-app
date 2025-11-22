
const API_BASE = 'https://transcriptapi.com/api/v2/youtube/transcript';
const API_KEY = process.env.YOUTUBE_TRANSCRIPT_API_KEY;

export async function fetchYoutubeTranscript(videoUrl: string): Promise<string | null> {
  if (!API_KEY) {
    console.warn("YouTube Transcript API Key is missing. Ensure process.env.YOUTUBE_TRANSCRIPT_API_KEY is set to use the external transcript service.");
    return null;
  }

  try {
    const url = new URL(API_BASE);
    url.searchParams.append('video_url', videoUrl);
    url.searchParams.append('format', 'text'); // Request concatenated text
    url.searchParams.append('include_timestamp', 'false'); // Pure text for summarization

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.warn(`Transcript API failed with status ${response.status}: ${errorBody}`);
      return null;
    }

    const data = await response.json();
    
    // According to spec, format=text returns JSON with a 'transcript' string field
    if (data && typeof data.transcript === 'string') {
      return data.transcript;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching YouTube transcript:", error);
    return null;
  }
}
