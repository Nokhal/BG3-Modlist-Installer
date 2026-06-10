const express = require('express');
const { findAndSaveBg3InstallPath, isValidBg3InstallPath, updateSettingsFile, toWindowsStylePath, ensureBg3ModsFolderExists, updateSettingsValue, getBg3ModsFolderPath } = require('../gear/findbg3installpath');
const { downloadModFromModioList } = require('../gear/downloadamodiomod');
const { extractModArchive } = require('../gear/extractmods');
const settingsLoaderRoutes = require('../gear/settingLoader');

const router = express.Router();

router.get('/', (req, res) => {
	res.render('index', {
		title: 'BG3 Ad Fundamenta Redire',
		pageTitle: 'BG3 - AFR Install',
		headline: 'Welcome home',
		description: 'A basic Express server rendering an EJS homepage on port 3001.',
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

		if (!modName && !modPage) {
			return res.status(400).json({
				success: false,
				message: 'Please provide modName or modPage.',
			});
		}

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

router.use(settingsLoaderRoutes);

module.exports = router;
