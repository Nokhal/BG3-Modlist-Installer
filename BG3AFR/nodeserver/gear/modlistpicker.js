/**
 * Modlist Picker Middleware
 * Handles modlist selection functionality
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();

// Configure multer for JSON file uploads
const upload = multer({
	storage: multer.memoryStorage(),
	fileFilter: (req, file, cb) => {
		if (path.extname(file.originalname).toLowerCase() === '.json') {
			cb(null, true);
		} else {
			cb(new Error('Only JSON files are allowed'));
		}
	},
});

/**
 * GET /api/browse-modlists
 * Browses the ModLists folder and returns Name, Description, and LastUpdated from JSON files
 */
router.get('/browse-modlists', (req, res) => {
	try {
		const modListsDir = path.join(__dirname, '../../ModLists');

		// Check if ModLists directory exists
		if (!fs.existsSync(modListsDir)) {
			return res.status(404).json({
				success: false,
				message: 'ModLists folder not found',
			});
		}

		// Read all files in the ModLists directory
		const files = fs.readdirSync(modListsDir);
		const modlists = [];

		// Filter for JSON files and extract data
		files.forEach((file) => {
			if (file.endsWith('.json')) {
				try {
					const filePath = path.join(modListsDir, file);
					const fileContent = fs.readFileSync(filePath, 'utf8');
					const jsonData = JSON.parse(fileContent);

					// Extract Name, Description, and LastUpdated
					modlists.push({
						filename: file,
						Name: jsonData.Name || '',
						Description: jsonData.Description || '',
						LastUpdated: jsonData['LastUpdated:'] || jsonData.LastUpdated || '',
					});
				} catch (error) {
					console.error(`Error reading modlist file ${file}:`, error.message);
				}
			}
		});

		return res.json({
			success: true,
			modlists,
			message: `Found ${modlists.length} modlist(s)`,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

/**
 * POST /api/upload-modlist
 * Uploads a JSON modlist file to the ModLists folder
 */
router.post('/upload-modlist', upload.single('file'), (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: 'No file provided',
			});
		}

		const modListsDir = path.join(__dirname, '../../ModLists');

		// Ensure ModLists directory exists
		if (!fs.existsSync(modListsDir)) {
			fs.mkdirSync(modListsDir, { recursive: true });
		}

		// Validate JSON content
		let jsonData;
		try {
			jsonData = JSON.parse(req.file.buffer.toString('utf8'));
		} catch (error) {
			return res.status(400).json({
				success: false,
				message: 'Invalid JSON file',
			});
		}

		// Save the file to ModLists folder
		const filePath = path.join(modListsDir, req.file.originalname);
		fs.writeFileSync(filePath, req.file.buffer);

		return res.json({
			success: true,
			filename: req.file.originalname,
			message: `Successfully uploaded ${req.file.originalname}`,
		});
	} catch (error) {
		console.error('Error uploading modlist:', error.message);
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

/**
 * POST /api/install-modlist
 * Copies the selected modlist JSON to modToInstallList.json and saves the selection to settings
 */
router.post('/install-modlist', (req, res) => {
	try {
		const { filename } = req.body;

		if (!filename) {
			return res.status(400).json({
				success: false,
				message: 'No modlist filename provided',
			});
		}

		const modListsDir = path.join(__dirname, '../../ModLists');
		const selectedModlistPath = path.join(modListsDir, filename);
		const targetPath = path.join(__dirname, '../../modToInstallList.json');
		const settingsPath = path.join(__dirname, '../../settings.json');

		// Check if selected modlist file exists
		if (!fs.existsSync(selectedModlistPath)) {
			return res.status(404).json({
				success: false,
				message: 'Selected modlist file not found',
			});
		}

		// Read the selected modlist
		const modlistContent = fs.readFileSync(selectedModlistPath, 'utf8');

		// Write to modToInstallList.json
		fs.writeFileSync(targetPath, modlistContent);

		// Update settings.json with the selected modlist name
		let settings = {};
		if (fs.existsSync(settingsPath)) {
			const settingsContent = fs.readFileSync(settingsPath, 'utf8');
			settings = JSON.parse(settingsContent);
		}
		settings.selectedModlist = filename;
		fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

		return res.json({
			success: true,
			message: `Successfully installed modlist: ${filename}`,
		});
	} catch (error) {
		console.error('Error installing modlist:', error.message);
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

/**
 * GET /api/get-selected-modlist
 * Retrieves the currently selected modlist from settings
 */
router.get('/get-selected-modlist', (req, res) => {
	try {
		const settingsPath = path.join(__dirname, '../../settings.json');

		if (!fs.existsSync(settingsPath)) {
			return res.json({
				success: true,
				selectedModlist: null,
			});
		}

		const settingsContent = fs.readFileSync(settingsPath, 'utf8');
		const settings = JSON.parse(settingsContent);

		return res.json({
			success: true,
			selectedModlist: settings.selectedModlist || null,
		});
	} catch (error) {
		console.error('Error retrieving selected modlist:', error.message);
		return res.json({
			success: true,
			selectedModlist: null,
		});
	}
});

/**
 * POST /api/clear-selected-modlist
 * Clears the selected modlist from settings
 */
router.post('/clear-selected-modlist', (req, res) => {
	try {
		const settingsPath = path.join(__dirname, '../../settings.json');

		if (fs.existsSync(settingsPath)) {
			const settingsContent = fs.readFileSync(settingsPath, 'utf8');
			const settings = JSON.parse(settingsContent);
			delete settings.selectedModlist;
			fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
		}

		return res.json({
			success: true,
			message: 'Cleared selected modlist',
		});
	} catch (error) {
		console.error('Error clearing selected modlist:', error.message);
		return res.status(500).json({
			success: false,
			message: error.message,
		});
	}
});

module.exports = router;
