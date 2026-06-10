const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const settingsFilePath = path.join(__dirname, '..', '..', 'settings.json');

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

module.exports = router;
