import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
	throw new Error('Missing DATABASE_URL in backend environment')
}

if (connectionString.includes('[YOUR-PASSWORD]')) {
	throw new Error('DATABASE_URL still has placeholder [YOUR-PASSWORD]. Replace it with your real Supabase DB password.')
}

const sql = postgres(connectionString, {
	ssl: 'require',
})

export default sql