const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');
const { EventEmitter } = require('events');

const NEXUS_API_BASE = 'https://api.nexusmods.com/v1';
const GAME_DOMAIN = 'baldursgate3';
const downloadsDir = path.join(__dirname, '..', '..', 'Downloads');

// Global download queue and status
let downloadQueue = [];
let isDownloading = false;
const downloadEmitter = new EventEmitter();

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
 * Get mod files
 * @param {string} apiKey - Nexus Mods API key
 * @param {number} modId - Mod ID (game-scoped)
 * @returns {Promise<Array>} Array of file objects
 */
async function getNexusModFiles(apiKey, modId) {
	if (!modId) {
		throw new Error('Please provide modId');
	}

	const endpoint = `/games/${GAME_DOMAIN}/mods/${modId}/files`;
	const result = await makeNexusApiRequest(apiKey, endpoint);

	if (!result || !Array.isArray(result.files)) {
		throw new Error('Failed to obtain files from Nexus Mods API');
	}

	return result.files;
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
 * Decode URL-encoded filename
 * @param {string} encodedName - URL-encoded filename
 * @returns {string} Decoded filename
 */
function decodeURLFilename(encodedName) {
	try {
		const decoded = decodeURIComponent(encodedName);
		return decoded;
	} catch (error) {
		return encodedName;
	}
}

/**
 * Download a mod from Nexus Mods
 * @param {Object} options - Download options
 * @param {string} options.apiKey - Nexus Mods API key
 * @param {number} options.modId - Mod ID (game-scoped ID from URL)
 * @param {number} options.fileId - File ID (optional - uses primary if not provided)
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

		// Get or find file ID
		let targetFileId = fileId;
		if (!targetFileId) {
			// Get list of files and use the primary one
			const files = await getNexusModFiles(apiKey, modId);
			
			if (!files || files.length === 0) {
				throw new Error('No files found for this mod');
			}

			// Find the primary file (marked as is_primary or MAIN category)
			const primaryFile = files.find(f => f.is_primary) ||
								 files.find(f => f.category_name === 'MAIN') ||
								 files[0];

			if (!primaryFile) {
				throw new Error('Could not determine which file to download');
			}

			targetFileId = primaryFile.file_id;
		}

		// Get download link
		const linkInfo = await getNexusDownloadLink(apiKey, modId, targetFileId);

		if (!linkInfo?.URI) {
			throw new Error('Failed to obtain download link');
		}

		// Extract filename from URI or use mod name
		const uriPath = new URL(linkInfo.URI).pathname;
		const fileNameFromUri = uriPath.split('/').pop() || `${modName}.zip`;
		
		// Decode URL-encoded filename
		const decodedFileName = decodeURLFilename(fileNameFromUri);
		const sanitizedForDownload = sanitizeFileName(decodedFileName);

		// Check if file already exists before downloading
		const potentialFilePath = path.join(downloadsDir, sanitizedForDownload);
		if (fs.existsSync(potentialFilePath)) {
			const fileSize = fs.statSync(potentialFilePath).size;
			return {
				success: true,
				modId,
				modName,
				fileId: targetFileId,
				downloadPath: potentialFilePath,
				fileName: path.basename(potentialFilePath),
				fileSize,
				alreadyExists: true,
			};
		}

		// Download the file - use decoded filename
		const downloadPath = await downloadFile(linkInfo.URI, decodedFileName);

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
		console.error(`[Nexus Download Error] Failed to download mod from Nexus: ${error.message}`);
		throw new Error(`Failed to download mod from Nexus: ${error.message}`);
	}
}

/**
 * Extract mod ID from Nexus Mods URL
 * @param {string} url - URL like https://www.nexusmods.com/baldursgate3/mods/944
 * @returns {number|null} Mod ID or null if not found
 */
function extractModIdFromNexusUrl(url) {
	if (!url || typeof url !== 'string') {
		return null;
	}
	const match = url.match(/\/mods\/(\d+)/);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Update modToInstallList.json with filename for a mod entry
 * @param {string} modName - ModName to find
 * @param {string} fileName - Filename to set
 * @param {string} modToInstallListPath - Path to modToInstallList.json
 * @returns {boolean} Success status
 */
function updateModToInstallListFilename(modName, fileName, modToInstallListPath) {
	try {
		if (!fs.existsSync(modToInstallListPath)) {
			console.warn(`modToInstallList.json not found at ${modToInstallListPath}`);
			return false;
		}

		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(data.ModList)) {
			console.warn('Invalid modToInstallList.json format');
			return false;
		}

		// Find the mod entry by ModName
		const modIndex = data.ModList.findIndex((mod) => mod.ModName === modName);

		if (modIndex === -1) {
			console.warn(`Mod with name "${modName}" not found in modToInstallList.json`);
			return false;
		}

			// Update the filename field
		data.ModList[modIndex].filename = fileName;

		// Write back to file
		fs.writeFileSync(modToInstallListPath, JSON.stringify(data, null, 2), 'utf8');
		return true;
	} catch (error) {
		console.error(`Failed to update modToInstallList.json: ${error.message}`);
		return false;
	}
}

/**
 * Process the download queue one mod at a time
 * @private
 */
async function processDownloadQueue() {
	if (isDownloading || downloadQueue.length === 0) {
		return;
	}

	isDownloading = true;

	while (downloadQueue.length > 0) {
		const queueItem = downloadQueue.shift();

		try {
			
			downloadEmitter.emit('progress', {
				status: 'downloading',
				current: queueItem.modName,
				remaining: downloadQueue.length,
				total: queueItem.total,
			});

				// Extract mod ID from URL
			const modId = extractModIdFromNexusUrl(queueItem.modPage);
			if (!modId) {
				queueItem.result.failed.push({
					modName: queueItem.modName,
					reason: 'Could not extract mod ID from ModPage URL',
				});
				continue;
			}

			// Check if file already exists
			if (queueItem.filename) {
				// Decode the filename first
				const decodedFilename = decodeURLFilename(queueItem.filename);
				const sanitizedQueueFilename = sanitizeFileName(decodedFilename);
				const existingFilePath = path.join(downloadsDir, sanitizedQueueFilename);
				
				if (fs.existsSync(existingFilePath)) {
					queueItem.result.skipped.push({
						modName: queueItem.modName,
						fileName: queueItem.filename,
						reason: 'File already exists in Downloads folder',
					});
					continue;
				}
			}

			// Download the mod
			const downloadResult = await downloadModFromNexus({
				apiKey: queueItem.apiKey,
				modId,
				fileId: queueItem.fileId,
			});

			if (downloadResult.success) {
				// Update modToInstallList.json with the filename
				const fileName = downloadResult.fileName;
				updateModToInstallListFilename(queueItem.modName, fileName, queueItem.modToInstallListPath);
				}

				queueItem.result.downloaded.push({
					modName: queueItem.modName,
					fileName,
					fileSize: downloadResult.fileSize,
				});

				downloadEmitter.emit('completed', {
					modName: queueItem.modName,
					fileName,
				});
			} else {

				queueItem.result.failed.push({
					modName: queueItem.modName,
					reason: 'Download failed',
				});
			}
		} catch (error) {
			queueItem.result.failed.push({
				modName: queueItem.modName,
				reason: error.message,
			});

			downloadEmitter.emit('error', {
				modName: queueItem.modName,
				error: error.message,
			});
		}
	}

	isDownloading = false;
	downloadEmitter.emit('queueComplete');
}

/**
 * Download all Nexus Mods entries from modToInstallList.json using a queue
 * @param {string} apiKey - Nexus Mods API key
 * @param {string} modToInstallListPath - Path to modToInstallList.json
 * @returns {Promise<Object>} Queue information
 */
async function downloadNexusModsFromList(apiKey, modToInstallListPath) {
	if (!apiKey) {
		throw new Error('API key is required');
	}

	if (!fs.existsSync(modToInstallListPath)) {
		throw new Error(`modToInstallList.json not found at ${modToInstallListPath}`);
	}

	try {
		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(data.ModList)) {
			throw new Error('Invalid modToInstallList.json format: expected ModList array');
		}

		// Filter for nexusmods.com entries
		const nexusModsEntries = data.ModList.filter((mod) => mod.source === 'nexusmods.com');

		if (nexusModsEntries.length === 0) {
			return {
				success: true,
				queued: 0,
				message: 'No Nexus Mods entries found in modToInstallList.json',
			};
		}

		// Create result object that will be shared with queue items
		const sharedResult = {
			downloaded: [],
			skipped: [],
			failed: [],
		};

		// Add each mod to the queue
		const total = nexusModsEntries.length;
		for (const modEntry of nexusModsEntries) {
			downloadQueue.push({
				modName: modEntry.ModName,
				modPage: modEntry.ModPage,
				fileId: modEntry.NexusFileId,
				filename: modEntry.filename,
				apiKey,
				modToInstallListPath,
				result: sharedResult,
				total,
			});
		}

		// Start processing the queue (non-blocking)
		setImmediate(processDownloadQueue);

		return {
			success: true,
			queued: nexusModsEntries.length,
			message: `${nexusModsEntries.length} mod(s) added to download queue`,
		};
	} catch (error) {
		throw new Error(`Failed to queue Nexus Mods for download: ${error.message}`);
	}
}

/**
 * Get the current download queue status
 * @returns {Object} Queue status information
 */
function getDownloadQueueStatus() {
	return {
		isDownloading,
		queueLength: downloadQueue.length,
		queue: downloadQueue.map((item) => ({
			modName: item.modName,
			status: 'pending',
		})),
	};
}

/**
 * Listen to download events
 * @param {string} event - Event name ('progress', 'completed', 'error', 'queueComplete')
 * @param {Function} callback - Callback function
 */
function onDownloadEvent(event, callback) {
	downloadEmitter.on(event, callback);
}

/**
 * Remove download event listener
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
function offDownloadEvent(event, callback) {
	downloadEmitter.off(event, callback);
}

/**
 * Download all Nexus Mods entries from modToInstallList.json using a queue
 * @param {string} apiKey - Nexus Mods API key
 * @param {string} modToInstallListPath - Path to modToInstallList.json
 * @returns {Promise<Object>} Queue information
 */
async function downloadNexusModsFromList(apiKey, modToInstallListPath) {
	if (!apiKey) {
		throw new Error('API key is required');
	}

	if (!fs.existsSync(modToInstallListPath)) {
		throw new Error(`modToInstallList.json not found at ${modToInstallListPath}`);
	}

	try {
		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(data.ModList)) {
			throw new Error('Invalid modToInstallList.json format: expected ModList array');
		}

		// Filter for nexusmods.com entries
		const nexusModsEntries = data.ModList.filter((mod) => mod.source === 'nexusmods.com');

		if (nexusModsEntries.length === 0) {
			return {
				success: true,
				queued: 0,
				message: 'No Nexus Mods entries found in modToInstallList.json',
			};
		}

		// Create result object that will be shared with queue items
		const sharedResult = {
			downloaded: [],
			skipped: [],
			failed: [],
		};

		// Add each mod to the queue
		const total = nexusModsEntries.length;
		for (const modEntry of nexusModsEntries) {
			downloadQueue.push({
				modName: modEntry.ModName,
				modPage: modEntry.ModPage,
				fileId: modEntry.NexusFileId,
				filename: modEntry.filename,
				apiKey,
				modToInstallListPath,
				result: sharedResult,
				total,
			});
		}

		// Start processing the queue (non-blocking)
		setImmediate(processDownloadQueue);

		return {
			success: true,
			queued: nexusModsEntries.length,
			message: `${nexusModsEntries.length} mod(s) added to download queue`,
		};
	} catch (error) {
		throw new Error(`Failed to queue Nexus Mods for download: ${error.message}`);
	}
}

module.exports = {
	downloadModFromNexus,
	downloadNexusModsFromList,
	getDownloadQueueStatus,
	onDownloadEvent,
	offDownloadEvent,
	getNexusDownloadLink,
	getNexusModInfo,
	getNexusModFiles,
	makeNexusApiRequest,
	extractModIdFromNexusUrl,
	updateModToInstallListFilename,
	decodeURLFilename,
};
