const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

const downloadsDirPath = path.join(__dirname, '..', '..', 'Downloads');
const modsDirPath = path.join(__dirname, '..', '..', 'Mods');
const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');

function isValidZipFile(filename) {
	if (typeof filename !== 'string') {
		return false;
	}

	const normalized = path.normalize(filename);

	// Prevent directory traversal
	if (normalized.includes('..') || path.isAbsolute(normalized)) {
		return false;
	}

	return normalized.toLowerCase().endsWith('.zip');
}

function findPakFiles(dirPath, baseDir = dirPath) {
	const pakFiles = [];

	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);

			if (entry.isDirectory()) {
				pakFiles.push(...findPakFiles(fullPath, baseDir));
			} else if (entry.name.toLowerCase().endsWith('.pak')) {
				const relativePath = path.relative(baseDir, fullPath);
				pakFiles.push(relativePath);
			}
		}
	} catch (error) {
		console.error(`Error reading directory ${dirPath}: ${error.message}`);
	}

	return pakFiles;
}

function getPakFileSet(baseDir) {
	return new Set(findPakFiles(baseDir));
}

function getNewPakFiles(beforePakSet, baseDir) {
	const afterPakFiles = findPakFiles(baseDir);
	return afterPakFiles.filter((pakFile) => !beforePakSet.has(pakFile));
}

function updateModToInstallListWithPakFile(modArchiveFilename, pakFileName) {
	try {
		if (!fs.existsSync(modToInstallListPath)) {
			console.warn(`modToInstallList.json not found at ${modToInstallListPath}`);
			return false;
		}

		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(data.ModList)) {
			console.warn('Invalid modToInstallList.json format');
			return false;
		}

		// Find the mod entry by filename
		const modIndex = data.ModList.findIndex((mod) => mod.filename === modArchiveFilename);

		if (modIndex === -1) {
			console.warn(`Mod with filename "${modArchiveFilename}" not found in modToInstallList.json`);
			return false;
		}

		// Update the mod entry with pakfile
		data.ModList[modIndex].pakfile = pakFileName;

		// Write back to file
		fs.writeFileSync(modToInstallListPath, JSON.stringify(data, null, 2), 'utf8');
		return true;
	} catch (error) {
		console.error(`Failed to update modToInstallList.json with pakfile: ${error.message}`);
		return false;
	}
}

function isPakFileAlreadyExtracted(modArchiveFilename) {
	try {
		if (!fs.existsSync(modToInstallListPath)) {
			return false;
		}

		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(data.ModList)) {
			return false;
		}

		// Find the mod entry by filename
		const modEntry = data.ModList.find((mod) => mod.filename === modArchiveFilename);

		if (!modEntry || !modEntry.pakfile) {
			return false;
		}

		// Check if the pakfile exists in the Mods directory
		const pakFilePath = path.join(modsDirPath, modEntry.pakfile);
		return fs.existsSync(pakFilePath);
	} catch (error) {
		console.error(`Error checking if pak file is already extracted: ${error.message}`);
		return false;
	}
}

async function extractModArchive(modArchiveFilename) {
	if (!isValidZipFile(modArchiveFilename)) {
		throw new Error('Invalid archive filename: must be a .zip file without path traversal.');
	}

	const archivePath = path.join(downloadsDirPath, modArchiveFilename);

	// Verify the file exists
	if (!fs.existsSync(archivePath)) {
		throw new Error(`Archive file not found: ${modArchiveFilename}`);
	}

	// Verify it's in the Downloads directory (security check)
	const realArchivePath = fs.realpathSync(archivePath);
	const realDownloadsPath = fs.realpathSync(downloadsDirPath);
	if (!realArchivePath.startsWith(realDownloadsPath)) {
		throw new Error('Archive file is outside Downloads directory.');
	}

	// Check if pak file is already extracted
	if (isPakFileAlreadyExtracted(modArchiveFilename)) {
		// Pak file already extracted, skip extraction
		return Promise.resolve({
			success: true,
			archiveFilename: modArchiveFilename,
			alreadyExtracted: true,
			message: 'Pak file already extracted, skipping extraction.',
		});
	}

	// Ensure Mods directory exists
	await fs.promises.mkdir(modsDirPath, { recursive: true });
	const pakFilesBeforeExtraction = getPakFileSet(modsDirPath);

	// Use a simple extraction approach - try to use unzip if available, otherwise use decompress
	// For now, we'll try to use the built-in zip support via a child process
	return new Promise((resolve, reject) => {
		try {
			const AdmZip = require('adm-zip');
			const zip = new AdmZip(realArchivePath);
			const zipEntries = zip.getEntries();

			zipEntries.forEach((entry) => {
				const targetPath = path.join(modsDirPath, entry.entryName);

				// Prevent directory traversal in zip
				if (!targetPath.startsWith(modsDirPath)) {
					return;
				}

				if (entry.isDirectory) {
					fs.mkdirSync(targetPath, { recursive: true });
				} else {
					fs.mkdirSync(path.dirname(targetPath), { recursive: true });
					fs.writeFileSync(targetPath, entry.getData());
				}
			});

			// Only use pak files added by this extraction.
			const pakFiles = getNewPakFiles(pakFilesBeforeExtraction, modsDirPath);
			let pakFileName = null;

			if (pakFiles.length > 0) {
				pakFileName = pakFiles[0]; // Use the first .pak file found
				updateModToInstallListWithPakFile(modArchiveFilename, pakFileName);
			}

			resolve({
				success: true,
				archiveFilename: modArchiveFilename,
				extractedTo: modsDirPath,
				entriesExtracted: zipEntries.length,
				pakfile: pakFileName,
			});
		} catch (error) {
			if (error.code === 'MODULE_NOT_FOUND') {
				// Fallback: try using command line unzip
				const { execFile } = require('child_process');
				execFile('powershell', [
					'-NoProfile',
					'-Command',
					`Expand-Archive -Path "${realArchivePath}" -DestinationPath "${modsDirPath}" -Force`,
				], (err) => {
					if (err) {
						reject(new Error(`Failed to extract archive: ${err.message}`));
					} else {
						// Only use pak files added by this extraction.
						const pakFiles = getNewPakFiles(pakFilesBeforeExtraction, modsDirPath);
						let pakFileName = null;

						if (pakFiles.length > 0) {
							pakFileName = pakFiles[0]; // Use the first .pak file found
							updateModToInstallListWithPakFile(modArchiveFilename, pakFileName);
						}

						resolve({
							success: true,
							archiveFilename: modArchiveFilename,
							extractedTo: modsDirPath,
							pakfile: pakFileName,
						});
					}
				});
			} else {
				reject(new Error(`Failed to extract archive: ${error.message}`));
			}
		}
	});
}

module.exports = {
	isValidZipFile,
	extractModArchive,
};
