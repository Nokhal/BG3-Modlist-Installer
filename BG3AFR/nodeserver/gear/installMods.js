const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class CopyModsQueue extends EventEmitter {
	constructor() {
		super();
		this.queue = [];
		this.queuedFiles = new Set();
		this.isProcessing = false;
	}

	/**
	 * Add a PAK file to the copy queue
	 * @param {string} filename - The filename of the PAK file to copy
	 * @param {string} modsSourcePath - The source Mods folder path
	 * @param {string} modsDestinationPath - The destination BG3 Mods folder path
	 * @returns {object} Status object indicating if file was queued
	 */
	addToQueue(filename, modsSourcePath, modsDestinationPath) {
		// Validate filename ends with .pak
		if (!filename.toLowerCase().endsWith('.pak')) {
			return {
				success: false,
				message: 'File must be a .pak file',
			};
		}

		// Check if this exact file is already queued
		if (this.queuedFiles.has(filename)) {
			return {
				success: true,
				alreadyQueued: true,
				message: `File "${filename}" is already in the copy queue`,
				queuePosition: this.queue.length,
			};
		}

		// Validate source file exists
		const sourceFilePath = path.join(modsSourcePath, filename);
		if (!fs.existsSync(sourceFilePath)) {
			return {
				success: false,
				message: `Source file not found: ${filename}`,
			};
		}

		// Add to queue
		this.queue.push({
			filename,
			sourceFilePath,
			destinationFilePath: path.join(modsDestinationPath, filename),
		});
		this.queuedFiles.add(filename);

		// Start processing if not already processing
		this.processQueue();

		return {
			success: true,
			message: `File "${filename}" added to copy queue`,
			queuePosition: this.queue.length,
		};
	}

	/**
	 * Process the copy queue one file at a time
	 */
	processQueue() {
		if (this.isProcessing || this.queue.length === 0) {
			return;
		}

		this.isProcessing = true;
		this.copyNextFile();
	}

	/**
	 * Copy the next file in the queue
	 */
	copyNextFile() {
		if (this.queue.length === 0) {
			this.isProcessing = false;
			this.emit('queueComplete');
			return;
		}

		const job = this.queue.shift();

		fs.copyFile(job.sourceFilePath, job.destinationFilePath, (err) => {
			this.queuedFiles.delete(job.filename);

			if (err) {
				console.error(`[CopyMods] Error copying ${job.filename}:`, err.message);
				this.emit('error', {
					filename: job.filename,
					error: err.message,
				});
			} else {
				console.log(`[CopyMods] Successfully copied: ${job.filename}`);
				this.emit('completed', {
					filename: job.filename,
					destination: job.destinationFilePath,
				});
			}

			// Process next file
			this.copyNextFile();
		});
	}

	/**
	 * Get the current queue status
	 */
	getStatus() {
		return {
			isProcessing: this.isProcessing,
			queueLength: this.queue.length,
			queuedFiles: Array.from(this.queuedFiles),
		};
	}
}

/**
 * Recursively copy files from source to destination
 * @param {string} sourceDir - The source directory path
 * @param {string} destDir - The destination directory path
 * @param {Array} copiedFiles - Array to track copied files
 * @returns {Promise<Array>} Array of copied files with source and destination
 */
function copyDirectoryRecursive(sourceDir, destDir, copiedFiles = []) {
	return new Promise((resolve, reject) => {
		// Ensure destination directory exists
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		// Read source directory
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

				fs.stat(sourceFile, (err, stats) => {
					if (err) {
						console.error(`[GamerootCopy] Error stating ${sourceFile}:`, err.message);
						processed++;
						if (processed === files.length) {
							resolve(copiedFiles);
						}
						return;
					}

					if (stats.isDirectory()) {
						// Recursively copy subdirectories
						copyDirectoryRecursive(sourceFile, destFile, copiedFiles)
							.then(() => {
								processed++;
								if (processed === files.length) {
									resolve(copiedFiles);
								}
							})
							.catch((error) => {
								console.error(`[GamerootCopy] Error copying directory ${sourceFile}:`, error.message);
								processed++;
								if (processed === files.length) {
									resolve(copiedFiles);
								}
							});
					} else {
						// Copy file
						fs.copyFile(sourceFile, destFile, (err) => {
							if (err) {
								console.error(`[GamerootCopy] Error copying file ${sourceFile}:`, err.message);
							} else {
								console.log(`[GamerootCopy] Copied: ${sourceFile} -> ${destFile}`);
								copiedFiles.push({
									source: sourceFile,
									destination: destFile,
								});
							}

							processed++;
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
 * Copy gameroot folder to BG3 install path
 * @param {string} modsGamerootPath - The source Mods/gameroot folder path
 * @param {string} bg3InstallPath - The destination BG3 install path
 * @returns {Promise<object>} Status object with copied files list
 */
async function copyGamerootToInstallPath(modsGamerootPath, bg3InstallPath) {
	// Validate source directory exists
	if (!fs.existsSync(modsGamerootPath)) {
		return {
			success: false,
			message: `Mods/gameroot directory not found at: ${modsGamerootPath}`,
		};
	}

	// Validate destination directory exists
	if (!fs.existsSync(bg3InstallPath)) {
		return {
			success: false,
			message: `BG3 install path not found at: ${bg3InstallPath}`,
		};
	}

	try {
		console.log(`[GamerootCopy] Starting copy from ${modsGamerootPath} to ${bg3InstallPath}`);
		const copiedFiles = await copyDirectoryRecursive(modsGamerootPath, bg3InstallPath);
		
		console.log(`[GamerootCopy] Copy complete. Total files copied: ${copiedFiles.length}`);
		
		return {
			success: true,
			message: `Successfully copied ${copiedFiles.length} files from gameroot to BG3 install path`,
			copiedCount: copiedFiles.length,
			copiedFiles,
		};
	} catch (error) {
		console.error(`[GamerootCopy] Error during copy:`, error.message);
		return {
			success: false,
			message: `Error copying gameroot: ${error.message}`,
		};
	}
}

/**
 * Recursively copy Mods/AppDataBG3Root contents to BG3 AppData root path.
 * @param {string} appDataBg3RootPath - Source path (BG3AFR/Mods/AppDataBG3Root)
 * @param {string} bg3ModsFolderPath - Destination path from settings.json (bg3ModsFolderPath)
 * @returns {Promise<object>} Status object with copied files list
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
			message: 'BG3 Mods/AppData destination path is not configured.',
		};
	}

	try {
		console.log(`[AppDataCopy] Starting recursive copy from ${appDataBg3RootPath} to ${bg3ModsFolderPath}`);
		const copiedFiles = await copyDirectoryRecursive(appDataBg3RootPath, bg3ModsFolderPath);

		console.log(`[AppDataCopy] Copy complete. Total files copied: ${copiedFiles.length}`);

		return {
			success: true,
			message: `Successfully copied ${copiedFiles.length} files from AppDataBG3Root to BG3 AppData path`,
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

module.exports = new CopyModsQueue();
module.exports.copyGamerootToInstallPath = copyGamerootToInstallPath;
module.exports.copyAppDataBG3RootToModsPath = copyAppDataBG3RootToModsPath;
