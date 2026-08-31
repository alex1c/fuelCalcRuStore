/**
 * Verifies a built APK/AAB is production-signed, not Android Debug.
 *
 * Prints certificate owner and SHA-256. Never prints keystore passwords.
 *
 * Usage:
 *   node scripts/verify-release-signing.cjs <path-to-apk-or-aab>
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const artifact = process.argv[2]
if (!artifact) {
	console.error('Usage: node scripts/verify-release-signing.cjs <path-to-apk-or-aab>')
	process.exit(1)
}

const resolved = path.resolve(artifact)
if (!fs.existsSync(resolved)) {
	console.error(`Artifact not found: ${resolved}`)
	process.exit(1)
}

const stat = fs.statSync(resolved)
const sha = spawnSync('certutil', ['-hashfile', resolved, 'SHA256'], {
	encoding: 'utf8',
	windowsHide: true,
})

function firstSha256(output) {
	const match = output.match(/[a-fA-F0-9]{64}/)
	return match ? match[0].toUpperCase() : '(hash unavailable)'
}

const keytool = spawnSync(
	'keytool',
	['-printcert', '-jarfile', resolved],
	{ encoding: 'utf8', windowsHide: true },
)

const certOut = `${keytool.stdout ?? ''}\n${keytool.stderr ?? ''}`
const ownerMatch = certOut.match(/Owner:\s*(.+)/)
const sha256Match = certOut.match(/SHA256:\s*([0-9A-F:]+)/i)
const owner = ownerMatch ? ownerMatch[1].trim() : '(certificate owner unavailable)'
const certSha = sha256Match ? sha256Match[1].trim() : '(certificate SHA-256 unavailable)'

const isDebug = /CN=Android Debug/i.test(certOut)
const looksProduction = keytool.status === 0 && !isDebug

console.log(`Artifact: ${resolved}`)
console.log(`Size bytes: ${stat.size}`)
console.log(`File SHA-256: ${firstSha256(sha.stdout ?? '')}`)
console.log(`Certificate owner: ${owner}`)
console.log(`Certificate SHA-256: ${certSha}`)

if (keytool.status !== 0) {
	console.error('keytool -printcert failed. Is JDK 17 on PATH?')
	process.exit(1)
}

if (isDebug) {
	console.error('FAIL: certificate is Android Debug. This artifact must not be uploaded to RuStore.')
	process.exit(1)
}

if (!looksProduction) {
	console.error('FAIL: could not confirm a non-debug production certificate.')
	process.exit(1)
}

console.log('PASS: certificate is not CN=Android Debug.')
