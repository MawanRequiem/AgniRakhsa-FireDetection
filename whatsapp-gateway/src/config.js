import 'dotenv/config'

const config = {
    port: process.env.PORT || 3001,
    backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:8000',
}

export default config
