const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const settingsFilePath = path.join(__dirname, '..', '..', 'settings.json');
const modioListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');

function readSettingsFromDisk() {
	if (!fs.existsSync(settingsFilePath)) {
		return {};
	}

	const raw = fs.readFileSync(settingsFilePath, 'utf8');
	if (!raw.trim()) {
		return {};
	}

	return JSON.parse(raw);
}

function readModioListFromDisk() {
	if (!fs.existsSync(modioListPath)) {
		return { ModList: [] };
	}

	const raw = fs.readFileSync(modioListPath, 'utf8');
	if (!raw.trim()) {
		return { ModList: [] };
	}

	return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

router.get('/api/settings', (req, res) => {
	try {
		const settings = readSettingsFromDisk();
		return res.json({
			success: true,
			settings,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to read settings.json: ${error.message}`,
		});
	}
});

router.get('/api/settings/:key', (req, res) => {
	try {
		const settings = readSettingsFromDisk();
		const key = req.params.key;
		const hasKey = Object.prototype.hasOwnProperty.call(settings, key);

		return res.json({
			success: true,
			key,
			value: hasKey ? settings[key] : null,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to read settings.json: ${error.message}`,
		});
	}
});

router.post('/api/settings/reset', (req, res) => {
	try {
		const currentSettings = readSettingsFromDisk();
		const nexusModApiKey = currentSettings.nexusModApiKey || null;

		const resetSettings = {
			dependanciesInstalled: false,
			bg3InstallPath: null,
			bg3ModsFolderPath: null,
			modiodownload: false,
			modsextracted: false,
			rpghqdownload: false,
			nexusModApiKey: nexusModApiKey,
		};

		fs.writeFileSync(settingsFilePath, JSON.stringify(resetSettings, null, 2), 'utf8');

		return res.json({
			success: true,
			message: 'Settings reset successfully. nexusModApiKey preserved.',
			settings: resetSettings,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to reset settings: ${error.message}`,
		});
	}
});

router.post('/api/settings/:key', (req, res) => {
	try {
		const settings = readSettingsFromDisk();
		const key = req.params.key;
		const value = req.body?.value;

		if (key === undefined || value === undefined) {
			return res.status(400).json({
				success: false,
				message: 'Please provide a key and value.',
			});
		}

		settings[key] = value;

		fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');

		return res.json({
			success: true,
			key,
			value,
			message: `Successfully updated settings.json: ${key} = ${value}`,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to update settings.json: ${error.message}`,
		});
	}
});

router.get('/api/modiolist', (req, res) => {
	try {
		const modioList = readModioListFromDisk();
		return res.json({
			success: true,
			modioList,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to read modToInstallList.json: ${error.message}`,
		});
	}
});

router.get('/api/modiolist/mod/:index', (req, res) => {
	try {
		const modioList = readModioListFromDisk();
		const index = parseInt(req.params.index, 10);

		if (isNaN(index) || index < 0 || index >= modioList.ModList.length) {
			return res.status(404).json({
				success: false,
				message: 'Mod not found at the specified index.',
			});
		}

		return res.json({
			success: true,
			mod: modioList.ModList[index],
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to read modToInstallList.json: ${error.message}`,
		});
	}
});

function deleteFilesInDirectory(dirPath) {
	try {
		if (!fs.existsSync(dirPath)) {
			return { success: true, deleted: 0, message: 'Directory does not exist.' };
		}

		const files = fs.readdirSync(dirPath);
		let deletedCount = 0;

		for (const file of files) {
			const filePath = path.join(dirPath, file);
			const stats = fs.statSync(filePath);

			if (stats.isDirectory()) {
				// Recursively delete subdirectories
				const subdirResult = deleteFilesInDirectory(filePath);
				deletedCount += subdirResult.deleted;
				fs.rmdirSync(filePath);
			} else {
				// Delete file
				fs.unlinkSync(filePath);
				deletedCount += 1;
			}
		}

		return { success: true, deleted: deletedCount };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

router.post('/api/clear-downloads', (req, res) => {
	try {
		const downloadsPath = path.join(__dirname, '..', '..', 'Downloads');
		const result = deleteFilesInDirectory(downloadsPath);

		if (!result.success) {
			return res.status(500).json({
				success: false,
				message: `Failed to clear Downloads folder: ${result.error}`,
			});
		}

		return res.json({
			success: true,
			message: `Downloads folder cleared. ${result.deleted} files deleted.`,
			deleted: result.deleted,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to clear Downloads folder: ${error.message}`,
		});
	}
});

router.post('/api/clear-mods', (req, res) => {
	try {
		const modsPath = path.join(__dirname, '..', '..', 'Mods');
		const result = deleteFilesInDirectory(modsPath);

		if (!result.success) {
			return res.status(500).json({
				success: false,
				message: `Failed to clear Mods folder: ${result.error}`,
			});
		}

		return res.json({
			success: true,
			message: `Mods folder cleared. ${result.deleted} files deleted.`,
			deleted: result.deleted,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: `Failed to clear Mods folder: ${error.message}`,
		});
	}
});

module.exports = router;
