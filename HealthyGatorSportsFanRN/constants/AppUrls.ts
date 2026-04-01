export const AppUrls = {
  /** The base URL for the API. Make sure to update this if the ngrok URL changes and put https at the beginning   */
  url: 'https://nannie-halogenous-tidily.ngrok-free.dev',
  /** Required for ngrok free tier: skip the "Visit Site" HTML page so API returns JSON */
  apiHeaders: { 'ngrok-skip-browser-warning': 'true' as const },
};
