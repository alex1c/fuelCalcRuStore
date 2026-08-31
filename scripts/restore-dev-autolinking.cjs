/**
 * Restores package.json after a production release build that kept
 * KEEP_PRODUCTION_AUTOLINKING=1 (see prebuild-android-production.cjs).
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const packageJsonPath = path.join(root, 'package.json')
const backupPath = path.join(root, '.package.json.pre-production-backup')

if (!fs.existsSync(backupPath)) {
	console.log('No production autolinking backup found — nothing to restore.')
	process.exit(0)
}

fs.writeFileSync(packageJsonPath, fs.readFileSync(backupPath, 'utf8'), 'utf8')
fs.unlinkSync(backupPath)
console.log('Restored package.json from .package.json.pre-production-backup')
