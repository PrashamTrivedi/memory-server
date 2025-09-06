export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to main worker
    if (url.pathname.startsWith('/api/')) {
      const apiUrl = `${env.API_BASE_URL}${url.pathname}${url.search}`;
      
      console.log(`Proxying API request to: ${apiUrl} (Environment: ${env.ENVIRONMENT})`);
      
      // Create headers without host header to avoid issues
      const headers = new Headers(request.headers);
      headers.delete('host');
      
      return fetch(apiUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });
    }
    
    // Serve static assets for everything else
    // This will automatically serve files from the assets directory
    // and handle SPA routing with not_found_handling: "single-page-application"
    return env.ASSETS.fetch(request);
  },
};