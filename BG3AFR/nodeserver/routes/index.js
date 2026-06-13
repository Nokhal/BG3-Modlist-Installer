const express = require('express');
const path = require('path');
const fs = require('fs');
const { findAndSaveBg3InstallPath, isValidBg3InstallPath, updateSettingsFile, toWindowsStylePath, ensureBg3ModsFolderExists, updateSettingsValue, getBg3ModsFolderPath } = require('../gear/findbg3installpath');
const { downloadModFromModioList } = require('../gear/downloadmods');
const { downloadModFromNexus, downloadNexusModsFromList, getDownloadQueueStatus, onDownloadEvent, offDownloadEvent, updateModToInstallListFilename } = require('../gear/downloadModsNexus');
const { extractModArchive } = require('../gear/extractmods');
const { downloadLatestBg3ModManagerRelease, getBg3ModManagerDetectionStatus, router: bg3mmRoutes } = require('../gear/installbg3mm');
const installModsQueue = require('../gear/installMods');
const { copyLocalFiles } = require('../gear/copyLocalFiles');
const { setLoadOrder } = require('../gear/setLoadOrder');
const settingsLoaderRoutes = require('../gear/settingLoader');
const modlistPickerRoutes = require('../gear/modlistpicker');

const router = express.Router();

router.get('/', (req, res) => {
	res.render('index', {
		title: 'BG3 ModList Installer',
		pageTitle: 'BG3 - ModList Installer',
	});
});

router.post('/api/find-bg3-installation-folder', (req, res) => {
	try {
		const installPath = findAndSaveBg3InstallPath();

		if (!installPath) {
			return res.status(404).json({
				success: false,
				message: "Could not find Baldur's Gate 3 on this machine. Please launch Baldur's Gate 3 at least once, then try again.",
			});
		}

		updateSettingsValue('bg3ModsFolderPath', getBg3ModsFolderPath());

		return res.json({
			success: true,
			installPath,
			message: "Found Baldur's Gate 3 installation folder.",
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/set-bg3-installation-folder', (req, res) => {
	try {
		const rawPath = typeof req.body?.installPath === 'string' ? req.body.installPath.trim() : '';

		if (!rawPath) {
			return res.status(400).json({
				success: false,
				message: 'Please provide an installation path.',
			});
		}

		if (!isValidBg3InstallPath(rawPath)) {
			return res.status(400).json({
				success: false,
				message: "The provided folder does not look like a valid Baldur's Gate 3 installation.",
			});
		}

		updateSettingsFile(rawPath);
		const savedPath = toWindowsStylePath(rawPath);
		updateSettingsValue('bg3ModsFolderPath', getBg3ModsFolderPath());

		return res.json({
			success: true,
			installPath: savedPath,
			message: "Saved Baldur's Gate 3 installation folder.",
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/find-or-create-bg3-mods-folder', (req, res) => {
	try {
		const modsFolderPath = ensureBg3ModsFolderExists();
		updateSettingsValue('bg3ModsFolderPath', modsFolderPath);

		return res.json({
			success: true,
			modsFolderPath,
			message: "Found Baldur's Gate 3 Mods folder.",
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/download-mod', async (req, res) => {
	try {
		const modName = typeof req.body?.modName === 'string' ? req.body.modName.trim() : '';
		const modPage = typeof req.body?.modPage === 'string' ? req.body.modPage.trim() : '';
		const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';

		if (!modName && !modPage) {
			return res.status(400).json({
				success: false,
				message: 'Please provide modName or modPage.',
			});
		}

		// Try to find mod in modToInstallList.json to determine source
		const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');
		const downloadsDir = path.join(__dirname, '..', '..', 'Downloads');
		let modSource = null;
		let modNexusFileId = null;
		let modPageUrl = modPage;
		let modEntry = null;

		if (fs.existsSync(modToInstallListPath)) {
			try {
				const raw = fs.readFileSync(modToInstallListPath, 'utf8');
				const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

				if (Array.isArray(data.ModList)) {
					modEntry = data.ModList.find((mod) =>
						(modName && mod.ModName === modName) ||
						(modPage && mod.ModPage === modPage)
					);

					if (modEntry) {
						modSource = modEntry.source;
						modNexusFileId = modEntry.NexusFileId;
						modPageUrl = modEntry.ModPage; // Use the ModPage from the entry
					}
				}
			} catch (error) {
				console.warn('Error reading modToInstallList.json:', error.message);
			}
		}

		// Route to appropriate download handler based on source
		if (modSource === 'nexusmods.com') {
			if (!apiKey) {
				return res.status(400).json({
					success: false,
					message: 'API key required for Nexus Mods download.',
				});
			}

			if (!modNexusFileId) {
				return res.status(400).json({
					success: false,
					message: 'Nexus File ID not found in modToInstallList.json',
				});
			}

			// Check if file already exists in Downloads before downloading
			if (modEntry && modEntry.filename) {
				const existingFilePath = path.join(downloadsDir, modEntry.filename);
				if (fs.existsSync(existingFilePath)) {
					console.log(`[Download] File already exists for "${modName}": ${modEntry.filename}`);
					return res.json({
						success: true,
						result: {
							success: true,
							modName,
							fileName: modEntry.filename,
							alreadyExists: true,
							message: 'File already exists in Downloads folder',
						},
						message: `File already exists for "${modName}"`,
					});
				}
			}

			// Extract mod ID from ModPage URL
			const modIdMatch = modPageUrl?.match(/\/mods\/(\d+)/);
			const modId = modIdMatch ? parseInt(modIdMatch[1], 10) : null;

			if (!modId) {
				return res.status(400).json({
					success: false,
					message: 'Could not extract Nexus mod ID from ModPage URL.',
				});
			}

			console.log(`[Download] Nexus Mod: ${modName} (ID: ${modId}, FileID: ${modNexusFileId})`);
			const result = await downloadModFromNexus({
				apiKey,
				modId,
				fileId: modNexusFileId,
			});

			// Update filename in modToInstallList.json
			if (result.success && modName) {
				const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');
				const updated = updateModToInstallListFilename(modName, result.fileName, modToInstallListPath);
				if (updated) {
					console.log(`[Download] Updated filename for ${modName} in modToInstallList.json`);
				}
			}

			return res.json({
				success: true,
				result,
				message: `Successfully downloaded "${result.modName}" from Nexus Mods`,
			});
		}

		// Default to mod.io download for other sources
		console.log(`[Download] mod.io Mod: ${modName}`);
		const result = await downloadModFromModioList({
			modName: modName || undefined,
			modPage: modPage || undefined,
		});

		return res.json({
			success: true,
			result,
			message: `Successfully downloaded ${result.modName}`,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/extract-mod', async (req, res) => {
	try {
		const modArchiveFilename = typeof req.body?.modArchiveFilename === 'string' ? req.body.modArchiveFilename.trim() : '';

		if (!modArchiveFilename) {
			return res.status(400).json({
				success: false,
				message: 'Please provide modArchiveFilename.',
			});
		}

		const result = await extractModArchive(modArchiveFilename);

		return res.json({
			success: true,
			result,
			message: `Successfully extracted ${modArchiveFilename}`,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/install-bg3-mod-manager', async (req, res) => {
	try {
		const result = await downloadLatestBg3ModManagerRelease();

		return res.json({
			success: true,
			result,
			message: result.alreadyDownloaded
				? 'Latest BG3 Mod Manager archive already exists in Downloads.'
				: 'Downloaded latest BG3 Mod Manager archive to Downloads.',
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.get('/api/install-bg3-mod-manager/status', (req, res) => {
	try {
		const result = getBg3ModManagerDetectionStatus();
		return res.json({
			success: true,
			result,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/download-mod-nexus', async (req, res) => {
	try {
		const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
		const modId = req.body?.modId;
		const fileId = req.body?.fileId;
		const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');
		const downloadsDir = path.join(__dirname, '..', '..', 'Downloads');

		if (!apiKey) {
			return res.status(400).json({
				success: false,
				message: 'Please provide a Nexus Mods API key.',
			});
		}

		if (!modId) {
			return res.status(400).json({
				success: false,
				message: 'Please provide a Nexus mod ID.',
			});
		}

		// Check if file already exists in Downloads before downloading
		if (fs.existsSync(modToInstallListPath)) {
			try {
				const raw = fs.readFileSync(modToInstallListPath, 'utf8');
				const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

				if (Array.isArray(data.ModList)) {
					const modEntry = data.ModList.find((mod) => {
						if (!mod.ModPage) return false;
						const match = mod.ModPage.match(/\/mods\/(\d+)/);
						const entryModId = match ? parseInt(match[1], 10) : null;
						return entryModId === parseInt(modId, 10);
					});

					if (modEntry && modEntry.filename) {
						const existingFilePath = path.join(downloadsDir, modEntry.filename);
						if (fs.existsSync(existingFilePath)) {
							console.log(`[Download] File already exists for "${modEntry.ModName}": ${modEntry.filename}`);
							return res.json({
								success: true,
								result: {
									success: true,
									modName: modEntry.ModName,
									fileName: modEntry.filename,
									alreadyExists: true,
									message: 'File already exists in Downloads folder',
								},
								message: `File already exists for "${modEntry.ModName}"`,
							});
						}
					}
				}
			} catch (error) {
				console.warn('Error checking modToInstallList.json:', error.message);
			}
		}

		const result = await downloadModFromNexus({
			apiKey,
			modId: parseInt(modId, 10),
			fileId: fileId ? parseInt(fileId, 10) : undefined,
		});

		// Update filename in modToInstallList.json if the mod is in the list
		if (result.success && result.modName) {
			const updated = updateModToInstallListFilename(result.modName, result.fileName, modToInstallListPath);
			if (updated) {
				console.log(`[Download] Updated filename for ${result.modName} in modToInstallList.json`);
			}
		}

		return res.json({
			success: true,
			result,
			message: `Successfully downloaded "${result.modName}" from Nexus Mods`,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/download-nexus-mods-from-list', async (req, res) => {
	try {
		const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
		const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');

		if (!apiKey) {
			return res.status(400).json({
				success: false,
				message: 'Please provide a Nexus Mods API key.',
			});
		}

		if (!fs.existsSync(modToInstallListPath)) {
			return res.status(400).json({
				success: false,
				message: 'modToInstallList.json not found.',
			});
		}

		const result = await downloadNexusModsFromList(apiKey, modToInstallListPath);

		return res.json({
			success: true,
			...result,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.get('/api/download-nexus-queue/status', (req, res) => {
	try {
		const status = getDownloadQueueStatus();

		return res.json({
			success: true,
			status,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.get('/api/download-nexus-queue/events', (req, res) => {
	// Set up Server-Sent Events headers
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Access-Control-Allow-Origin': '*',
	});

	// Send initial connection message
	res.write('data: {"type":"connected"}\n\n');

	// Set up event listeners
	const onProgress = (data) => {
		res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
	};

	const onCompleted = (data) => {
		res.write(`data: ${JSON.stringify({ type: 'completed', ...data })}\n\n`);
	};

	const onError = (data) => {
		res.write(`data: ${JSON.stringify({ type: 'error', ...data })}\n\n`);
	};

	const onQueueComplete = () => {
		res.write(`data: ${JSON.stringify({ type: 'queueComplete' })}\n\n`);
		// Close connection after queue complete
		setTimeout(() => res.end(), 1000);
	};

	onDownloadEvent('progress', onProgress);
	onDownloadEvent('completed', onCompleted);
	onDownloadEvent('error', onError);
	onDownloadEvent('queueComplete', onQueueComplete);

	// Clean up listeners when client disconnects
	req.on('close', () => {
		offDownloadEvent('progress', onProgress);
		offDownloadEvent('completed', onCompleted);
		offDownloadEvent('error', onError);
		offDownloadEvent('queueComplete', onQueueComplete);
	});
});

router.post('/api/copy-mod-pak', (req, res) => {
	try {
		const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';

		if (!filename) {
			return res.status(400).json({
				success: false,
				message: 'Please provide a filename.',
			});
		}

		// Get the mods folder path and BG3 destination path
		const modsSourcePath = path.join(__dirname, '..', '..', 'Mods', 'AppDataBG3Root');
		const settingsFilePath = path.join(__dirname, '..', '..', 'settings.json');
		
		let modsDestinationPath = null;
		if (fs.existsSync(settingsFilePath)) {
			const settingsRaw = fs.readFileSync(settingsFilePath, 'utf8');
			const settings = JSON.parse(settingsRaw);
			modsDestinationPath = settings.bg3ModsFolderPath;
		}

		if (!modsDestinationPath) {
			return res.status(400).json({
				success: false,
				message: 'BG3 Mods folder path not configured in settings.',
			});
		}

		const result = installModsQueue.addToQueue(filename, modsSourcePath, modsDestinationPath);

		return res.json({
			success: result.success,
			...result,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.get('/api/copy-mod-pak/status', (req, res) => {
	try {
		const status = installModsQueue.getStatus();

		return res.json({
			success: true,
			status,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.get('/api/copy-mod-pak/events', (req, res) => {
	// Set up Server-Sent Events headers
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
		'Access-Control-Allow-Origin': '*',
	});

	// Send initial connection message
	res.write('data: {"type":"connected"}\n\n');

	// Set up event listeners
	const onCompleted = (data) => {
		res.write(`data: ${JSON.stringify({ type: 'completed', ...data })}\n\n`);
	};

	const onError = (data) => {
		res.write(`data: ${JSON.stringify({ type: 'error', ...data })}\n\n`);
	};

	const onQueueComplete = () => {
		res.write(`data: ${JSON.stringify({ type: 'queueComplete' })}\n\n`);
		// Close connection after queue complete
		setTimeout(() => res.end(), 1000);
	};

	installModsQueue.on('completed', onCompleted);
	installModsQueue.on('error', onError);
	installModsQueue.on('queueComplete', onQueueComplete);

	// Clean up listeners when client disconnects
	req.on('close', () => {
		installModsQueue.removeListener('completed', onCompleted);
		installModsQueue.removeListener('error', onError);
		installModsQueue.removeListener('queueComplete', onQueueComplete);
	});
});

router.post('/api/copy-gameroot-to-install', async (req, res) => {
	try {
		// Get the BG3 install path from settings
		const settingsFilePath = path.join(__dirname, '..', '..', 'settings.json');
		
		let bg3InstallPath = null;
		if (fs.existsSync(settingsFilePath)) {
			const settingsRaw = fs.readFileSync(settingsFilePath, 'utf8');
			const settings = JSON.parse(settingsRaw);
			bg3InstallPath = settings.bg3InstallPath;
		}

		if (!bg3InstallPath) {
			return res.status(400).json({
				success: false,
				message: 'BG3 install path not configured in settings.',
			});
		}

		// Get the gameroot folder path
		const modsGamerootPath = path.join(__dirname, '..', '..', 'Mods', 'gameroot');

		// Call the copy function
		const result = await installModsQueue.copyGamerootToInstallPath(modsGamerootPath, bg3InstallPath);

		return res.json(result);
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/copy-local-files', async (req, res) => {
	try {
		const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');
		const baseDir = path.join(__dirname, '..', '..');

		if (!fs.existsSync(modToInstallListPath)) {
			return res.status(400).json({
				success: false,
				message: 'modToInstallList.json not found.',
			});
		}

		const result = await copyLocalFiles(modToInstallListPath, baseDir);

		return res.json({
			success: result.success,
			...result,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.post('/api/set-load-order', async (req, res) => {
	try {
		const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');
		const settingsPath = path.join(__dirname, '..', '..', 'settings.json');

		if (!fs.existsSync(modToInstallListPath)) {
			return res.status(400).json({
				success: false,
				message: 'modToInstallList.json not found.',
			});
		}

		if (!fs.existsSync(settingsPath)) {
			return res.status(400).json({
				success: false,
				message: 'settings.json not found.',
			});
		}

		const result = await setLoadOrder(modToInstallListPath, settingsPath);

		return res.json({
			success: result.success,
			...result,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

router.use('/api', modlistPickerRoutes);
router.use('/api', bg3mmRoutes);
router.use(settingsLoaderRoutes);

module.exports = router;
