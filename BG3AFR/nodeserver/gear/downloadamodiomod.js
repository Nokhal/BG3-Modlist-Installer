const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { pipeline } = require('stream/promises');

const modioListPath = path.join(__dirname, '..', '..', 'modiolist.json');
const downloadsDir = path.join(__dirname, '..', '..', 'Downloads');
const maxRedirects = 5;
const downloadQueue = [];
const inFlightPromises = new Map();
let isProcessingQueue = false;

function readModioList() {
	if (!fs.existsSync(modioListPath)) {
		throw new Error(`modiolist.json not found at ${modioListPath}`);
	}

	const raw = fs.readFileSync(modioListPath, 'utf8');
	const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));

	if (!Array.isArray(parsed.ModList)) {
		throw new Error('Invalid modiolist.json format: expected ModList array.');
	}

	return parsed.ModList;
}

function normalizeValue(value) {
	return String(value || '').trim().toLowerCase();
}

function sanitizeFileName(name) {
	return String(name || 'mod-download')
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
		.replace(/\s+/g, ' ')
		.trim();
}

function getFilenameFromContentDisposition(headerValue) {
	if (!headerValue) {
		return '';
	}

	const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match && utf8Match[1]) {
		return decodeURIComponent(utf8Match[1]);
	}

	const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
	if (quotedMatch && quotedMatch[1]) {
		return quotedMatch[1];
	}

	const unquotedMatch = headerValue.match(/filename=([^;\s]+)/i);
	if (unquotedMatch && unquotedMatch[1]) {
		return unquotedMatch[1];
	}

	return '';
}

function resolveModEntry(modNameOrPage) {
	const modList = readModioList();

	if (!modNameOrPage || typeof modNameOrPage !== 'object') {
		throw new Error('Please provide an object argument with modName or modPage.');
	}

	const wantedName = normalizeValue(modNameOrPage.modName);
	const wantedPage = normalizeValue(modNameOrPage.modPage);

	if (!wantedName && !wantedPage) {
		throw new Error('Please provide modName or modPage.');
	}

	const found = modList.find((entry) => {
		const entryName = normalizeValue(entry.ModName);
		const entryPage = normalizeValue(entry.ModPage);

		if (wantedPage && entryPage === wantedPage) {
			return true;
		}

		if (wantedName && entryName === wantedName) {
			return true;
		}

		return false;
	});

	if (!found) {
		throw new Error('Mod not found in modiolist.json for the provided modName/modPage.');
	}

	if (!found.DLLink) {
		throw new Error(`Mod "${found.ModName}" does not have a DLLink.`);
	}

	return found;
}

function buildQueueKey(modEntry) {
	return normalizeValue(modEntry.ModPage || modEntry.ModName);
}

function updateModioListFilename(modEntry, fileName) {
	try {
		const raw = fs.readFileSync(modioListPath, 'utf8');
		const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(parsed.ModList)) {
			return;
		}

		const entry = parsed.ModList.find((e) => {
			const eName = normalizeValue(e.ModName);
			const ePage = normalizeValue(e.ModPage);
			const modName = normalizeValue(modEntry.ModName);
			const modPage = normalizeValue(modEntry.ModPage);

			return (modPage && ePage === modPage) || (modName && eName === modName);
		});

		if (entry && !entry.filename) {
			entry.filename = fileName;
			const updated = JSON.stringify(parsed, null, 2);
			fs.writeFileSync(modioListPath, updated, 'utf8');
		}
	} catch (error) {
		console.error(`Failed to update modiolist.json with filename: ${error.message}`);
	}
}

function downloadFile(url, destinationPath, redirectsLeft = maxRedirects) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const client = urlObj.protocol === 'https:' ? https : http;

		const request = client.get(urlObj, (response) => {
			const statusCode = response.statusCode || 0;

			if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
				if (redirectsLeft <= 0) {
					response.resume();
					reject(new Error('Too many redirects while downloading mod file.'));
					return;
				}

				const redirectUrl = new URL(response.headers.location, urlObj).toString();
				response.resume();
				resolve(downloadFile(redirectUrl, destinationPath, redirectsLeft - 1));
				return;
			}

			if (statusCode < 200 || statusCode >= 300) {
				response.resume();
				reject(new Error(`Failed to download mod file: HTTP ${statusCode}`));
				return;
			}

			const fileStream = fs.createWriteStream(destinationPath);

			pipeline(response, fileStream)
				.then(() => resolve({ headers: response.headers, finalUrl: response.url || url }))
				.catch((error) => reject(error));
		});

		request.on('error', (error) => reject(error));
	});
}

async function performDownload(modEntry) {
	await fs.promises.mkdir(downloadsDir, { recursive: true });

	const requestUrl = modEntry.DLLink;
	const tempFileName = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const tempPath = path.join(downloadsDir, tempFileName);

	const downloadResult = await downloadFile(requestUrl, tempPath);
	const headers = downloadResult.headers || {};
	const finalUrl = downloadResult.finalUrl || requestUrl;

	const contentDisposition = headers['content-disposition'] || '';
	let targetName = getFilenameFromContentDisposition(contentDisposition);

	console.log(`[Download] Mod: ${modEntry.ModName}`);
	console.log(`[Download] Final URL: ${finalUrl}`);
	console.log(`[Download] Content-Disposition: ${contentDisposition}`);
	console.log(`[Download] Extracted from header: ${targetName}`);

	// If no filename from header, try to extract from final URL
	if (!targetName) {
		const urlPathName = new URL(finalUrl).pathname;
		const urlBaseName = path.basename(urlPathName);
		if (urlBaseName && urlBaseName.toLowerCase() !== 'download' && !urlBaseName.includes('=')) {
			targetName = urlBaseName;
			console.log(`[Download] Extracted from URL: ${targetName}`);
		}
	}

	if (!targetName) {
		targetName = `${sanitizeFileName(modEntry.ModName)}.zip`;
		console.log(`[Download] Falling back to mod name: ${targetName}`);
	}

	if (!path.extname(targetName)) {
		targetName = `${targetName}.zip`;
	}

	const destinationPath = path.join(downloadsDir, targetName);

	if (tempPath !== destinationPath) {
		await fs.promises.rename(tempPath, destinationPath);
	}

	console.log(`[Download] Final filename: ${targetName}`);

	return {
		modName: modEntry.ModName,
		modPage: modEntry.ModPage,
		downloadLink: modEntry.DLLink,
		fileName: targetName,
		savedTo: destinationPath,
	};
}

async function processDownloadQueue() {
	if (isProcessingQueue) {
		return;
	}

	isProcessingQueue = true;

	while (downloadQueue.length > 0) {
		const item = downloadQueue.shift();

		if (!item) {
			continue;
		}

		try {
			const result = await performDownload(item.modEntry);
			updateModioListFilename(item.modEntry, result.fileName);
			item.resolve(result);
		} catch (error) {
			item.reject(error);
		} finally {
			inFlightPromises.delete(item.key);
		}
	}

	isProcessingQueue = false;
}

function downloadModFromModioList(modNameOrPage) {
	const modEntry = resolveModEntry(modNameOrPage);
	const key = buildQueueKey(modEntry);

	if (inFlightPromises.has(key)) {
		return inFlightPromises.get(key);
	}

	const promise = new Promise((resolve, reject) => {
		downloadQueue.push({
			key,
			modEntry,
			resolve,
			reject,
		});

		processDownloadQueue().catch((error) => {
			isProcessingQueue = false;
			reject(error);
			inFlightPromises.delete(key);
		});
	});

	inFlightPromises.set(key, promise);
	return promise;
}

module.exports = {
	readModioList,
	resolveModEntry,
	downloadModFromModioList,
};
