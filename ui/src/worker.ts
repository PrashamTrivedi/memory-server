export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle API requests - use service binding or fallback to HTTP
    if (url.pathname.startsWith('/api/')) {
      console.log(`=== API REQUEST DEBUG ===`)
      console.log(`Original URL: ${request.url}`)
      console.log(`Environment: ${env.ENVIRONMENT}`)
      console.log(`API_SERVICE available: ${!!env.API_SERVICE}`)
      console.log(`============================`)

      let response: Response

      // In production, use service binding; in development, fallback to HTTP fetch
      if (env.API_SERVICE) {
        console.log('Using service binding')
        response = await env.API_SERVICE.fetch(request)
      } else {
        console.log('Using HTTP fallback')
        const apiUrl = `${env.API_BASE_URL}${url.pathname}${url.search}`
        
        // Create headers without problematic headers
        const headers = new Headers(request.headers)
        headers.delete('host')
        headers.delete('cf-ray')
        headers.delete('cf-connecting-ip')
        headers.delete('cf-visitor')
        
        response = await fetch(apiUrl, {
          method: request.method,
          headers: headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        })
      }

      console.log(`Got Response: OK: ${response.ok}, status: ${response.status}, statusText: ${response.statusText}`)

      return response
    }

    // Serve static assets for everything else
    // This will automatically serve files from the assets directory
    // and handle SPA routing with not_found_handling: "single-page-application"
    return env.ASSETS.fetch(request)
  },
}