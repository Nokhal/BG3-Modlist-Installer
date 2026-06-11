const fs = require('fs');
const path = require('path');

/**
 * Copy files from the localFilesToCopyArray in modToInstallList.json
 * @param {string} modToInstallListPath - Path to modToInstallList.json
 * @param {string} baseDir - Base directory to resolve relative paths from (usually BG3AFR folder)
 * @returns {object} Status object with results of file copy operations
 */
async function copyLocalFiles(modToInstallListPath, baseDir) {
	const results = {
		success: true,
		copiedFiles: [],
		skippedFiles: [],
		failedFiles: [],
		message: '',
	};

	try {
		// Check if modToInstallList.json exists
		if (!fs.existsSync(modToInstallListPath)) {
			results.message = 'modToInstallList.json not found';
			results.success = false;
			return results;
		}

		// Read and parse modToInstallList.json
		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, '')); // Remove BOM if present

		// Check if localFilesToCopyArray exists
		if (!Array.isArray(data.localFilesToCopyArray)) {
			results.message = 'No localFilesToCopyArray found in modToInstallList.json';
			return results;
		}

		if (data.localFilesToCopyArray.length === 0) {
			results.message = 'localFilesToCopyArray is empty';
			return results;
		}

		// Process each file in the array
		for (const fileSpec of data.localFilesToCopyArray) {
			const { from, to } = fileSpec;

			if (!from || !to) {
				results.failedFiles.push({
					from,
					to,
					error: 'Invalid file specification: missing from or to path',
				});
				results.success = false;
				continue;
			}

			try {
				// Convert Windows-style paths and resolve relative paths
				const fromPath = path.resolve(baseDir, from.replace(/\\\\/g, '\\'));
				const toPath = path.resolve(baseDir, to.replace(/\\\\/g, '\\'));

				// Check if source file exists
				if (!fs.existsSync(fromPath)) {
					results.skippedFiles.push({
						from: fromPath,
						to: toPath,
						reason: 'Source file does not exist',
					});
					console.warn(`[CopyLocalFiles] Source file not found: ${fromPath}`);
					continue;
				}

				// Ensure destination directory exists
				const toDir = path.dirname(toPath);
				if (!fs.existsSync(toDir)) {
					fs.mkdirSync(toDir, { recursive: true });
				}

				// Copy the file
				fs.copyFileSync(fromPath, toPath);

				results.copiedFiles.push({
					from: fromPath,
					to: toPath,
				});

				console.log(`[CopyLocalFiles] Successfully copied: ${path.basename(fromPath)} to ${toPath}`);
			} catch (error) {
				results.failedFiles.push({
					from,
					to,
					error: error.message,
				});
				results.success = false;
				console.error(`[CopyLocalFiles] Error copying file from ${from} to ${to}:`, error.message);
			}
		}

		// Build result message
		const copiedCount = results.copiedFiles.length;
		const skippedCount = results.skippedFiles.length;
		const failedCount = results.failedFiles.length;

		results.message = `File copy complete. Copied: ${copiedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}.`;

		return results;
	} catch (error) {
		results.success = false;
		results.message = error.message;
		console.error('[CopyLocalFiles] Error processing localFilesToCopyArray:', error.message);
		return results;
	}
}

module.exports = {
	copyLocalFiles,
};
