#!/usr/bin/env node

/**
 * Generate Release Hash Script
 *
 * This script generates SHA256 hashes for your release builds
 * and creates a latest.json file for the auto-updater.
 *
 * Usage:
 *   node scripts/generate-release-hash.js
 *
 * Or after building:
 *   npm run electron:build && npm run release:hash
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Configuration
const RELEASE_DIR = path.join(__dirname, '..', 'release')
const OUTPUT_FILE = path.join(RELEASE_DIR, 'latest.json')

// Your release server base URL (update this!)
const RELEASE_BASE_URL = process.env.RELEASE_BASE_URL || 'https://releases.nexspace.app'

/**
 * Calculate SHA256 hash of a file
 */
function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Get file size in human-readable format
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * Find release files by platform
 */
function findReleaseFiles() {
  if (!fs.existsSync(RELEASE_DIR)) {
    console.error(`Error: Release directory not found: ${RELEASE_DIR}`)
    console.error('Run "npm run electron:build" first to create release builds.')
    process.exit(1)
  }

  const files = fs.readdirSync(RELEASE_DIR)
  const releases = {
    mac: null,
    win: null,
    linux: null
  }

  for (const file of files) {
    const filePath = path.join(RELEASE_DIR, file)
    const stat = fs.statSync(filePath)

    if (!stat.isFile()) continue

    const ext = path.extname(file).toLowerCase()

    // macOS: .dmg or .zip
    if (ext === '.dmg' || (ext === '.zip' && file.includes('mac'))) {
      if (!releases.mac || ext === '.dmg') { // Prefer DMG over ZIP
        releases.mac = { file, path: filePath }
      }
    }
    // Windows: .exe (NSIS installer)
    else if (ext === '.exe' && !file.includes('Setup')) {
      releases.win = { file, path: filePath }
    }
    else if (file.includes('Setup') && ext === '.exe') {
      releases.win = { file, path: filePath }
    }
    // Linux: .AppImage
    else if (ext === '.appimage') {
      releases.linux = { file, path: filePath }
    }
  }

  return releases
}

/**
 * Read version from package.json
 */
function getVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  return packageJson.version
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  NexSpace Release Hash Generator')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')

  const version = getVersion()
  console.log(`Version: ${version}`)
  console.log(`Release Base URL: ${RELEASE_BASE_URL}`)
  console.log('')

  const releases = findReleaseFiles()

  // Check if any releases were found
  const hasReleases = Object.values(releases).some(r => r !== null)
  if (!hasReleases) {
    console.error('No release files found!')
    console.error('Expected file types:')
    console.error('  - macOS: .dmg or .zip')
    console.error('  - Windows: .exe')
    console.error('  - Linux: .AppImage')
    process.exit(1)
  }

  console.log('Found release files:')
  console.log('───────────────────────────────────────────────────────────')

  const hashes = {}
  const releaseInfo = {
    version,
    releaseDate: new Date().toISOString(),
    releaseNotes: 'Bug fixes and improvements.',
    platforms: {}
  }

  // Process each platform
  for (const [platform, release] of Object.entries(releases)) {
    if (!release) {
      console.log(`  ${platform.padEnd(8)}: (not found)`)
      continue
    }

    const stat = fs.statSync(release.path)
    const hash = await calculateHash(release.path)

    console.log(`  ${platform.padEnd(8)}: ${release.file}`)
    console.log(`           Size: ${formatFileSize(stat.size)}`)
    console.log(`           SHA256: ${hash}`)
    console.log('')

    hashes[platform] = {
      file: release.file,
      hash,
      size: stat.size
    }

    releaseInfo.platforms[platform] = {
      url: `${RELEASE_BASE_URL}/${version}/${release.file}`,
      sha256: hash,
      size: stat.size
    }
  }

  // Determine primary download URL (prefer mac, then win, then linux)
  const primaryPlatform = releases.mac ? 'mac' : releases.win ? 'win' : 'linux'
  const primaryRelease = releases[primaryPlatform]

  if (primaryRelease) {
    releaseInfo.url = releaseInfo.platforms[primaryPlatform].url
    releaseInfo.sha256 = releaseInfo.platforms[primaryPlatform].sha256
  }

  // Write latest.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(releaseInfo, null, 2))

  console.log('───────────────────────────────────────────────────────────')
  console.log('')
  console.log(`Created: ${OUTPUT_FILE}`)
  console.log('')
  console.log('Contents:')
  console.log(JSON.stringify(releaseInfo, null, 2))
  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('')
  console.log('Next steps:')
  console.log('1. Upload release files to your server:')
  for (const [platform, release] of Object.entries(releases)) {
    if (release) {
      console.log(`   ${RELEASE_BASE_URL}/${version}/${release.file}`)
    }
  }
  console.log('')
  console.log('2. Upload latest.json to:')
  console.log(`   ${RELEASE_BASE_URL}/latest.json`)
  console.log('')
  console.log('3. Users will automatically see the update popup!')
  console.log('')

  // Also write a simple hashes.txt for manual verification
  const hashesPath = path.join(RELEASE_DIR, 'hashes.txt')
  let hashesContent = `NexSpace v${version} - Release Hashes\n`
  hashesContent += `Generated: ${new Date().toISOString()}\n`
  hashesContent += `───────────────────────────────────────────────────────────\n\n`

  for (const [platform, info] of Object.entries(hashes)) {
    hashesContent += `${info.hash}  ${info.file}\n`
  }

  fs.writeFileSync(hashesPath, hashesContent)
  console.log(`Also created: ${hashesPath}`)
}

main().catch(console.error)
