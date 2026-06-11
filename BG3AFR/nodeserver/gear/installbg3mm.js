const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');
const express = require('express');

const downloadsDirPath = path.join(__dirname, '..', '..', 'Downloads');
const bgmmToolsDirPath = path.join(__dirname, '..', '..', '..', 'tools', 'bg3mm');
const githubLatestReleaseApiUrl = 'https://api.github.com/repos/LaughingLeader/BG3ModManager/releases/latest';
const maxRedirects = 5;

const router = express.Router();

function requestJson(url, redirectsLeft = maxRedirects) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const client = urlObj.protocol === 'https:' ? https : http;

		const request = client.get(urlObj, {
			headers: {
				'User-Agent': 'BG3-AFR-Installer',
				'Accept': 'application/vnd.github+json',
			},
		}, (response) => {
			const statusCode = response.statusCode || 0;

			if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
				if (redirectsLeft <= 0) {
					response.resume();
					reject(new Error('Too many redirects while requesting release metadata.'));
					return;
				}

				const redirectUrl = new URL(response.headers.location, urlObj).toString();
				response.resume();
				resolve(requestJson(redirectUrl, redirectsLeft - 1));
				return;
			}

			if (statusCode < 200 || statusCode >= 300) {
				response.resume();
				reject(new Error(`Failed to fetch release metadata: HTTP ${statusCode}`));
				return;
			}

			let body = '';
			response.setEncoding('utf8');
			response.on('data', (chunk) => {
				body += chunk;
			});
			response.on('end', () => {
				try {
					resolve(JSON.parse(body));
				} catch (error) {
					reject(new Error(`Invalid release metadata JSON: ${error.message}`));
				}
			});
		});

		request.on('error', (error) => reject(error));
	});
}

function downloadFile(url, destinationPath, redirectsLeft = maxRedirects) {
	return new Promise((resolve, reject) => {
		const urlObj = new URL(url);
		const client = urlObj.protocol === 'https:' ? https : http;

		const request = client.get(urlObj, {
			headers: {
				'User-Agent': 'BG3-AFR-Installer',
			},
		}, (response) => {
			const statusCode = response.statusCode || 0;

			if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
				if (redirectsLeft <= 0) {
					response.resume();
					reject(new Error('Too many redirects while downloading release archive.'));
					return;
				}

				const redirectUrl = new URL(response.headers.location, urlObj).toString();
				response.resume();
				resolve(downloadFile(redirectUrl, destinationPath, redirectsLeft - 1));
				return;
			}

			if (statusCode < 200 || statusCode >= 300) {
				response.resume();
				reject(new Error(`Failed to download release archive: HTTP ${statusCode}`));
				return;
			}

			const fileStream = fs.createWriteStream(destinationPath);
			pipeline(response, fileStream)
				.then(() => resolve())
				.catch((error) => reject(error));
		});

		request.on('error', (error) => reject(error));
	});
}

function pickArchiveAsset(releasePayload) {
	if (!releasePayload || !Array.isArray(releasePayload.assets)) {
		throw new Error('Release metadata does not contain assets.');
	}

	const zipAssets = releasePayload.assets.filter((asset) => {
		const name = String(asset?.name || '').toLowerCase();
		return name.endsWith('.zip');
	});

	if (zipAssets.length === 0) {
		throw new Error('No .zip asset found in latest BG3 Mod Manager release.');
	}

	const preferred = zipAssets.find((asset) => {
		const name = String(asset.name || '').toLowerCase();
		return name.includes('bg3modmanager');
	});

	return preferred || zipAssets[0];
}

async function extractArchiveToToolsFolder(archivePath) {
	await fs.promises.mkdir(bgmmToolsDirPath, { recursive: true });

	let zip;
	try {
		const AdmZip = require('adm-zip');
		zip = new AdmZip(archivePath);
		zip.extractAllTo(bgmmToolsDirPath, true);
	} catch (error) {
		if (error.code === 'MODULE_NOT_FOUND') {
			throw new Error('Missing dependency "adm-zip". Run npm install adm-zip in nodeserver.');
		}
		throw new Error(`Failed to extract BG3 Mod Manager archive: ${error.message}`);
	}
}

async function downloadLatestBg3ModManagerRelease() {
	await fs.promises.mkdir(downloadsDirPath, { recursive: true });

	const releasePayload = await requestJson(githubLatestReleaseApiUrl);
	const archiveAsset = pickArchiveAsset(releasePayload);

	const fileName = archiveAsset.name;
	const downloadUrl = archiveAsset.browser_download_url;
	if (!fileName || !downloadUrl) {
		throw new Error('Release asset is missing name or download URL.');
	}

	const destinationPath = path.join(downloadsDirPath, fileName);
	const alreadyDownloaded = fs.existsSync(destinationPath);

	if (!alreadyDownloaded) {
		await downloadFile(downloadUrl, destinationPath);
	}

	await extractArchiveToToolsFolder(destinationPath);

	if (fs.existsSync(destinationPath)) {
		return {
			releaseTag: releasePayload.tag_name || '',
			fileName,
			downloadUrl,
			savedTo: destinationPath,
			extractedTo: bgmmToolsDirPath,
			alreadyDownloaded,
		};
	}

	throw new Error('Failed to persist BG3 Mod Manager archive in Downloads.');
}

function getBg3ModManagerDetectionStatus() {
	const exePath = path.join(bgmmToolsDirPath, 'BG3ModManager.exe');
	const detected = fs.existsSync(exePath);

	return {
		detected,
		exePath,
		toolsPath: bgmmToolsDirPath,
	};
}

/**
 * POST /api/launch-bg3mm
 * Launches BG3ModManager.exe
 */
router.post('/launch-bg3mm', (req, res) => {
	try {
		const exePath = path.join(bgmmToolsDirPath, 'BG3ModManager.exe');

		if (!fs.existsSync(exePath)) {
			return res.status(404).json({
				success: false,
				message: 'BG3ModManager.exe not found. Please install it first.',
			});
		}

		// Launch the executable without waiting for it to complete
		spawn(exePath, [], {
			detached: true,
			stdio: 'ignore',
		}).unref();

		return res.json({
			success: true,
			message: 'BG3ModManager launched successfully.',
		});
	} catch (error) {
		console.error('Error launching BG3ModManager:', error.message);
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

module.exports = {
	downloadLatestBg3ModManagerRelease,
	getBg3ModManagerDetectionStatus,
	router,
};
