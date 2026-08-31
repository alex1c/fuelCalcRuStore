/**
 * Production Android CNG prebuild for RuStore release preparation.
 *
 * Patches package.json so Expo autolinking excludes expo-dev-* packages.
 * The exclude MUST remain in place through the subsequent Gradle release
 * build — Gradle re-resolves autolinking from package.json at configure time.
 *
 * Release signing is injected by `./scripts/with-release-signing.js` when
 * APP_VARIANT=production (fail-closed without credentials/keystore.properties).
 *
 * Usage (PowerShell):
 *   $env:APP_VARIANT='production'
 *   $env:GRADLE_USER_HOME='D:\g'
 *   node scripts/prebuild-android-production.cjs
 *   cd android && .\gradlew.bat bundleRelease
 *   node scripts/restore-dev-autolinking.cjs
 *
 * Or set KEEP_PRODUCTION_AUTOLINKING=1 to skip auto-restore (recommended for
 * release builds on a short-path work copy such as D:\aj).
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const packageJsonPath = path.join(root, 'package.json')
const backupPath = path.join(root, '.package.json.pre-production-backup')
const DEV_CLIENT_PACKAGES = [
	'expo-dev-client',
	'expo-dev-launcher',
	'expo-dev-menu',
	'expo-dev-menu-interface',
]

function readPackageJson() {
	return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
}

function writePackageJson(pkg) {
	fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

function ensureProductionVariant() {
	if (process.env.APP_VARIANT !== 'production') {
		console.error('Set APP_VARIANT=production before running this script.')
		process.exit(1)
	}
}

function applyDevClientExclude() {
	const original = fs.readFileSync(packageJsonPath, 'utf8')
	fs.writeFileSync(backupPath, original, 'utf8')
	const pkg = readPackageJson()
	pkg.expo = pkg.expo ?? {}
	pkg.expo.autolinking = {
		...(pkg.expo.autolinking ?? {}),
		exclude: DEV_CLIENT_PACKAGES,
	}
	writePackageJson(pkg)
	console.log(
		'Applied expo.autolinking.exclude for expo-dev-* (backup: .package.json.pre-production-backup)',
	)
}

function restorePackageJson() {
	if (!fs.existsSync(backupPath)) {
		return
	}
	fs.writeFileSync(packageJsonPath, fs.readFileSync(backupPath, 'utf8'), 'utf8')
	fs.unlinkSync(backupPath)
	console.log('Restored package.json autolinking from backup.')
}

ensureProductionVariant()
applyDevClientExclude()

const result = spawnSync('npx', ['expo', 'prebuild', '--platform', 'android', '--clean'], {
	cwd: root,
	stdio: 'inherit',
	env: {
		...process.env,
		APP_VARIANT: 'production',
	},
	shell: true,
})

const keep = process.env.KEEP_PRODUCTION_AUTOLINKING === '1'
if (!keep) {
	restorePackageJson()
} else {
	console.log('KEEP_PRODUCTION_AUTOLINKING=1 — leaving exclude in package.json for Gradle.')
}

if (result.status !== 0) {
	if (keep) {
		restorePackageJson()
	}
	process.exit(result.status ?? 1)
}

const keystorePropertiesPath = path.join(root, 'credentials', 'keystore.properties')
if (fs.existsSync(keystorePropertiesPath)) {
	console.log(
		'credentials/keystore.properties present — release signing wired via with-release-signing.js.',
	)
} else {
	console.log(
		'No credentials/keystore.properties — bundleRelease will fail closed until a production keystore is configured.',
	)
}

console.log('Production prebuild complete.')
