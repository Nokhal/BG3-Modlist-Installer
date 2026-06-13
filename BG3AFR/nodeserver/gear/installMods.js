const fs = require('fs');
const path = require('path');

/**
 * Recursively copy files from source to destination.
 * @param {string} sourceDir - The source directory path.
 * @param {string} destDir - The destination directory path.
 * @param {Array} copiedFiles - Array to track copied files.
 * @returns {Promise<Array>} Array of copied files with source and destination.
 */
function copyDirectoryRecursive(sourceDir, destDir, copiedFiles = []) {
	return new Promise((resolve, reject) => {
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		fs.readdir(sourceDir, (err, files) => {
			if (err) {
				reject(err);
				return;
			}

			if (files.length === 0) {
				resolve(copiedFiles);
				return;
			}

			let processed = 0;

			files.forEach((file) => {
				const sourceFile = path.join(sourceDir, file);
				const destFile = path.join(destDir, file);

				fs.stat(sourceFile, (statErr, stats) => {
					if (statErr) {
						console.error(`[InstallCopy] Error stating ${sourceFile}:`, statErr.message);
						processed += 1;
						if (processed === files.length) {
							resolve(copiedFiles);
						}
						return;
					}

					if (stats.isDirectory()) {
						copyDirectoryRecursive(sourceFile, destFile, copiedFiles)
							.then(() => {
								processed += 1;
								if (processed === files.length) {
									resolve(copiedFiles);
								}
							})
							.catch((copyErr) => {
								console.error(`[InstallCopy] Error copying directory ${sourceFile}:`, copyErr.message);
								processed += 1;
								if (processed === files.length) {
									resolve(copiedFiles);
								}
							});
					} else {
						fs.copyFile(sourceFile, destFile, (copyErr) => {
							if (copyErr) {
								console.error(`[InstallCopy] Error copying file ${sourceFile}:`, copyErr.message);
							} else {
								copiedFiles.push({
									source: sourceFile,
									destination: destFile,
								});
							}

							processed += 1;
							if (processed === files.length) {
								resolve(copiedFiles);
							}
						});
					}
				});
			});
		});
	});
}

/**
 * Recursively copy Mods/gameroot contents to BG3 install path.
 * @param {string} modsGamerootPath - Source path (BG3AFR/Mods/gameroot).
 * @param {string} bg3InstallPath - Destination path from settings.json (bg3InstallPath).
 * @returns {Promise<object>} Status object with copied files list.
 */
async function copyGamerootToInstallPath(modsGamerootPath, bg3InstallPath) {
	if (!fs.existsSync(modsGamerootPath)) {
		return {
			success: false,
			message: `Mods/gameroot directory not found at: ${modsGamerootPath}`,
		};
	}

	if (!bg3InstallPath || typeof bg3InstallPath !== 'string') {
		return {
			success: false,
			message: 'BG3 install path is not configured.',
		};
	}

	if (!fs.existsSync(bg3InstallPath)) {
		return {
			success: false,
			message: `BG3 install path not found at: ${bg3InstallPath}`,
		};
	}

	try {
		console.log(`[GamerootCopy] Starting recursive copy from ${modsGamerootPath} to ${bg3InstallPath}`);
		const copiedFiles = await copyDirectoryRecursive(modsGamerootPath, bg3InstallPath);
		return {
			success: true,
			message: `Successfully copied ${copiedFiles.length} files from gameroot to BG3 install path`,
			copiedCount: copiedFiles.length,
			copiedFiles,
		};
	} catch (error) {
		console.error('[GamerootCopy] Error during copy:', error.message);
		return {
			success: false,
			message: `Error copying gameroot: ${error.message}`,
		};
	}
}

/**
 * Recursively copy Mods/AppDataBG3Root contents to BG3 app-data destination.
 * @param {string} appDataBg3RootPath - Source path (BG3AFR/Mods/AppDataBG3Root).
 * @param {string} bg3ModsFolderPath - Destination path from settings.json (bg3ModsFolderPath).
 * @returns {Promise<object>} Status object with copied files list.
 */
async function copyAppDataBG3RootToModsPath(appDataBg3RootPath, bg3ModsFolderPath) {
	if (!fs.existsSync(appDataBg3RootPath)) {
		return {
			success: false,
			message: `Source AppDataBG3Root directory not found at: ${appDataBg3RootPath}`,
		};
	}

	if (!bg3ModsFolderPath || typeof bg3ModsFolderPath !== 'string') {
		return {
			success: false,
			message: 'BG3 app-data destination path is not configured.',
		};
	}

	try {
		console.log(`[AppDataCopy] Starting recursive copy from ${appDataBg3RootPath} to ${bg3ModsFolderPath}`);
		const copiedFiles = await copyDirectoryRecursive(appDataBg3RootPath, bg3ModsFolderPath);
		return {
			success: true,
			message: `Successfully copied ${copiedFiles.length} files from AppDataBG3Root to BG3 app-data path`,
			copiedCount: copiedFiles.length,
			copiedFiles,
		};
	} catch (error) {
		console.error('[AppDataCopy] Error during copy:', error.message);
		return {
			success: false,
			message: `Error copying AppDataBG3Root: ${error.message}`,
		};
	}
}

module.exports = {
	copyGamerootToInstallPath,
	copyAppDataBG3RootToModsPath,
};
