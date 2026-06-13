const fs = require('fs');
const path = require('path');

/**
 * Set the load order by decoding modsettingslsxBase64 and writing to modsettings.lsx
 * @param {string} modToInstallListPath - Path to modToInstallList.json
 * @param {string} settingsPath - Path to settings.json
 * @returns {object} Status object with result of operation
 */
async function setLoadOrder(modToInstallListPath, settingsPath) {
	const results = {
		success: true,
		message: '',
		filePath: '',
	};

	try {
		// Check if modToInstallList.json exists
		if (!fs.existsSync(modToInstallListPath)) {
			results.success = false;
			results.message = 'modToInstallList.json not found';
			return results;
		}

		// Check if settings.json exists
		if (!fs.existsSync(settingsPath)) {
			results.success = false;
			results.message = 'settings.json not found';
			return results;
		}

		// Read and parse settings.json to get bg3ModsFolderPath
		const settingsRaw = fs.readFileSync(settingsPath, 'utf8');
		const settings = JSON.parse(settingsRaw.replace(/^\uFEFF/, '')); // Remove BOM if present

		if (!settings.bg3ModsFolderPath) {
			results.success = false;
			results.message = 'bg3ModsFolderPath not found in settings.json';
			return results;
		}

		// Construct path to modsettings.lsx
		const modSettingsPath = path.join(settings.bg3ModsFolderPath, 'PlayerProfiles', 'Public', 'modsettings.lsx');

		// Read and parse modToInstallList.json
		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, '')); // Remove BOM if present

		// Check if modsettingslsxBase64 exists and has content
		if (!data.modsettingslsxBase64 || typeof data.modsettingslsxBase64 !== 'string') {
			results.success = false;
			results.message = 'modsettingslsxBase64 not found or is empty in modToInstallList.json';
			return results;
		}

		if (data.modsettingslsxBase64.trim() === '') {
			results.success = false;
			results.message = 'modsettingslsxBase64 is empty in modToInstallList.json';
			return results;
		}

		try {
			// Decode Base64 to string
			const decodedContent = Buffer.from(data.modsettingslsxBase64, 'base64').toString('utf8');

			// Ensure directory exists
			const modSettingsDir = path.dirname(modSettingsPath);
			if (!fs.existsSync(modSettingsDir)) {
				fs.mkdirSync(modSettingsDir, { recursive: true });
			}

			// Write decoded content to modsettings.lsx
			fs.writeFileSync(modSettingsPath, decodedContent, 'utf8');

			results.success = true;
			results.filePath = modSettingsPath;
			results.message = `Successfully wrote modsettings.lsx (${decodedContent.length} bytes)`;
			console.log(`[SetLoadOrder] Successfully wrote modsettings.lsx to ${modSettingsPath}`);

			return results;
		} catch (decodeError) {
			results.success = false;
			results.message = `Failed to decode Base64 content: ${decodeError.message}`;
			console.error('[SetLoadOrder] Base64 decode error:', decodeError.message);
			return results;
		}
	} catch (error) {
		results.success = false;
		results.message = error.message;
		console.error('[SetLoadOrder] Error setting load order:', error.message);
		return results;
	}
}

module.exports = {
	setLoadOrder,
};
