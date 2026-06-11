const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');

const NEXUS_API_BASE = 'https://api.nexusmods.com/v1';
const GAME_DOMAIN = 'baldursgate3';
const downloadsDir = path.join(__dirname, '..', '..', 'Downloads');

// Ensure Downloads directory exists
function ensureDownloadsDir() {
	if (!fs.existsSync(downloadsDir)) {
		fs.mkdirSync(downloadsDir, { recursive: true });
	}
}

/**
 * Make an HTTPS request to Nexus Mods API
 * @param {string} apiKey - Nexus Mods API key
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {string} method - HTTP method (default: 'GET')
 * @returns {Promise<Object>} Response data
 */
function makeNexusApiRequest(apiKey, endpoint, method = 'GET') {
	return new Promise((resolve, reject) => {
		if (!apiKey || typeof apiKey !== 'string') {
			return reject(new Error('Invalid or missing API key'));
		}

		const url = new URL(endpoint.startsWith('http') ? endpoint : `${NEXUS_API_BASE}${endpoint}`);
		const options = {
			hostname: url.hostname,
			path: url.pathname + url.search,
			method,
			headers: {
				'apikey': apiKey,
				'User-Agent': 'BG3-Ad-Fundamenta-Redire/1.0',
				'Accept': 'application/json',
			},
		};

		const req = https.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					if (res.statusCode >= 400) {
						return reject(new Error(`Nexus API error (${res.statusCode}): ${data}`));
					}
					const parsed = JSON.parse(data);
					resolve(parsed);
				} catch (error) {
					reject(new Error(`Failed to parse API response: ${error.message}`));
				}
			});
		});

		req.on('error', (error) => {
			reject(new Error(`Request failed: ${error.message}`));
		});

		req.end();
	});
}

/**
 * Get file download link from Nexus Mods (v1 API)
 * @param {string} apiKey - Nexus Mods API key
 * @param {number} modId - Mod ID (game-scoped)
 * @param {number} fileId - File ID
 * @returns {Promise<Object>} Download link info
 */
async function getNexusDownloadLink(apiKey, modId, fileId) {
	if (!modId || !fileId) {
		throw new Error('Please provide both modId and fileId');
	}

	const endpoint = `/games/${GAME_DOMAIN}/mods/${modId}/files/${fileId}/download_link`;
	const result = await makeNexusApiRequest(apiKey, endpoint);

	if (!result || !result[0]?.URI) {
		throw new Error('Failed to obtain download link from Nexus Mods API');
	}

	return result[0];
}

/**
 * Get mod information from Nexus Mods
 * @param {string} apiKey - Nexus Mods API key
 * @param {number} modId - Mod ID (game-scoped)
 * @returns {Promise<Object>} Mod information
 */
async function getNexusModInfo(apiKey, modId) {
	if (!modId) {
		throw new Error('Please provide modId');
	}

	const endpoint = `/games/${GAME_DOMAIN}/mods/${modId}`;
	const result = await makeNexusApiRequest(apiKey, endpoint);

	if (!result) {
		throw new Error('Failed to obtain mod info from Nexus Mods API');
	}

	return result;
}

/**
 * Get latest file for a mod
 * @param {string} apiKey - Nexus Mods API key
 * @param {number} modId - Mod ID (game-scoped)
 * @returns {Promise<Object>} Latest file info
 */
async function getNexusLatestModFile(apiKey, modId) {
	if (!modId) {
		throw new Error('Please provide modId');
	}

	const endpoint = `/games/${GAME_DOMAIN}/mods/${modId}/files/latest`;
	const result = await makeNexusApiRequest(apiKey, endpoint);

	if (!result) {
		throw new Error('Failed to obtain latest file from Nexus Mods API');
	}

	return result;
}

/**
 * Download file from URI
 * @param {string} uri - Download URI
 * @param {string} fileName - Target filename
 * @returns {Promise<string>} Path to downloaded file
 */
async function downloadFile(uri, fileName) {
	ensureDownloadsDir();

	return new Promise((resolve, reject) => {
		const sanitized = sanitizeFileName(fileName);
		const filePath = path.join(downloadsDir, sanitized);

		const options = {
			headers: {
				'User-Agent': 'BG3-Ad-Fundamenta-Redire/1.0',
			},
		};

		const req = https.get(uri, options, async (res) => {
			// Handle redirects
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				try {
					const redirectedPath = await downloadFile(res.headers.location, fileName);
					return resolve(redirectedPath);
				} catch (error) {
					return reject(error);
				}
			}

			if (res.statusCode !== 200) {
				return reject(new Error(`Download failed with status ${res.statusCode}`));
			}

			const writeStream = fs.createWriteStream(filePath);

			pipeline(res, writeStream)
				.then(() => {
					// Verify file was created
					if (fs.existsSync(filePath)) {
						resolve(filePath);
					} else {
						reject(new Error('File download completed but file not found'));
					}
				})
				.catch((error) => {
					// Clean up partial file
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
					reject(error);
				});
		});

		req.on('error', (error) => {
			reject(new Error(`Download request failed: ${error.message}`));
		});
	});
}

/**
 * Sanitize filename to remove illegal characters
 * @param {string} name - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFileName(name) {
	return String(name || 'nexus-mod')
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Download a mod from Nexus Mods
 * @param {Object} options - Download options
 * @param {string} options.apiKey - Nexus Mods API key
 * @param {number} options.modId - Mod ID (game-scoped ID from URL)
 * @param {number} options.fileId - File ID (optional - uses latest if not provided)
 * @returns {Promise<Object>} Download result with file info
 */
async function downloadModFromNexus(options) {
	const { apiKey, modId, fileId } = options;

	if (!apiKey) {
		throw new Error('API key is required');
	}

	if (!modId) {
		throw new Error('Mod ID is required');
	}

	try {
		// Get mod information
		const modInfo = await getNexusModInfo(apiKey, modId);
		const modName = modInfo.name || `Mod_${modId}`;

		// Get latest file or use specified fileId
		let targetFileId = fileId;
		let fileInfo;

		if (!targetFileId) {
			// Get latest file
			fileInfo = await getNexusLatestModFile(apiKey, modId);
			targetFileId = fileInfo.file_id;

			if (!targetFileId) {
				throw new Error('Could not determine file ID for this mod');
			}
		}

		// Get download link
		const linkInfo = await getNexusDownloadLink(apiKey, modId, targetFileId);

		if (!linkInfo?.URI) {
			throw new Error('Failed to obtain download link');
		}

		// Extract filename from URI or use mod name
		const uriPath = new URL(linkInfo.URI).pathname;
		const fileNameFromUri = uriPath.split('/').pop() || `${modName}.zip`;

		// Download the file
		const downloadPath = await downloadFile(linkInfo.URI, fileNameFromUri);

		return {
			success: true,
			modId,
			modName,
			fileId: targetFileId,
			downloadPath,
			fileName: path.basename(downloadPath),
			fileSize: fs.statSync(downloadPath).size,
		};
	} catch (error) {
		throw new Error(`Failed to download mod from Nexus: ${error.message}`);
	}
}

module.exports = {
	downloadModFromNexus,
	getNexusDownloadLink,
	getNexusModInfo,
	makeNexusApiRequest,
};
