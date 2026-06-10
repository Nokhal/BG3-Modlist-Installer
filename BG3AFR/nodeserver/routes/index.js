const express = require('express');
const { findAndSaveBg3InstallPath } = require('../gear/findbg3installpath');

const router = express.Router();

router.get('/', (req, res) => {
	res.render('index', {
		title: 'BG3 Ad Fundamenta Redire',
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
				message: "Could not find Baldur's Gate 3 on this machine.",
			});
		}

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

module.exports = router;
