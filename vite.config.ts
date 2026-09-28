import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const precacheManifest: Plugin = {
	name: 'folio-precache-manifest',
	generateBundle(_options, bundle) {
		const assets = Object.keys(bundle)
			.filter((fileName) => /\.(js|css)$/.test(fileName))
			.map((fileName) => `/${fileName}`)
		this.emitFile({ type: 'asset', fileName: 'precache-manifest.json', source: JSON.stringify(assets) })
	},
}

export default defineConfig({ plugins: [react(), precacheManifest] })