const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const settingsFilePath = path.join(__dirname, '..', '..', 'settings.json');
const modioListPath = path.join(__dirname, '..', '..', 'modiolist.json');

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
			message: `Failed to read modiolist.json: ${error.message}`,
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
			message: `Failed to read modiolist.json: ${error.message}`,
		});
	}
});

module.exports = router;
