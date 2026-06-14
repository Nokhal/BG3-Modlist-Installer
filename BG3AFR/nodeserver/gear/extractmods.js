const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

const downloadsDirPath = path.join(__dirname, '..', '..', 'Downloads');
const modsRootPath = path.join(__dirname, '..', '..', 'Mods');
const modsDirPath = path.join(__dirname, '..', '..', 'Mods', 'AppDataBG3Root', 'Mods');
const modToInstallListPath = path.join(__dirname, '..', '..', 'modToInstallList.json');

function resolveModContentPath(relativePath) {
	if (typeof relativePath !== 'string' || !relativePath.trim()) {
		return null;
	}

	const normalizedRelativePath = path.normalize(relativePath.trim());
	if (normalizedRelativePath.includes('..') || path.isAbsolute(normalizedRelativePath)) {
		return null;
	}

	const lowerRelativePath = normalizedRelativePath.toLowerCase();
	const isGamerootPath = lowerRelativePath === 'gameroot' || lowerRelativePath.startsWith(`gameroot${path.sep}`);
	const isAppDataRootPath = lowerRelativePath === 'appdatabg3root' || lowerRelativePath.startsWith(`appdatabg3root${path.sep}`);

	if (isGamerootPath || isAppDataRootPath) {
		return path.join(modsRootPath, normalizedRelativePath);
	}

	return path.join(modsDirPath, normalizedRelativePath);
}

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

function isValidRarFile(filename) {
	if (typeof filename !== 'string') {
		return false;
	}

	const normalized = path.normalize(filename);

	// Prevent directory traversal
	if (normalized.includes('..') || path.isAbsolute(normalized)) {
		return false;
	}

	return normalized.toLowerCase().endsWith('.rar');
}

function isValid7zFile(filename) {
	if (typeof filename !== 'string') {
		return false;
	}

	const normalized = path.normalize(filename);

	// Prevent directory traversal
	if (normalized.includes('..') || path.isAbsolute(normalized)) {
		return false;
	}

	return normalized.toLowerCase().endsWith('.7z');
}

function isValidArchiveFile(filename) {
	return isValidZipFile(filename) || isValidRarFile(filename) || isValid7zFile(filename);
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

function isPathInsideDirectory(baseDir, targetPath) {
	const relativePath = path.relative(baseDir, targetPath);
	return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function getPakCandidatesFromZipEntryNames(entryNames) {
	const pakCandidates = [];

	for (const entryName of entryNames) {
		if (typeof entryName !== 'string') {
			continue;
		}

		const normalizedEntry = path.normalize(entryName);
		if (normalizedEntry.includes('..') || path.isAbsolute(normalizedEntry)) {
			continue;
		}

		if (normalizedEntry.toLowerCase().endsWith('.pak')) {
			pakCandidates.push(normalizedEntry);
		}
	}

	return pakCandidates;
}

function resolveExtractedPakFromCandidates(pakCandidates) {
	for (const pakCandidate of pakCandidates) {
		const pakFilePath = path.join(modsDirPath, pakCandidate);
		if (isPathInsideDirectory(modsDirPath, pakFilePath) && fs.existsSync(pakFilePath)) {
			return pakCandidate;
		}
	}

	return null;
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
			return null;
		}

		const raw = fs.readFileSync(modToInstallListPath, 'utf8');
		const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

		if (!Array.isArray(data.ModList)) {
			return null;
		}

		// Find the mod entry by filename
		const modEntry = data.ModList.find((mod) => mod.filename === modArchiveFilename);

		if (!modEntry || !modEntry.pakfile) {
			return null;
		}

		// Check if the pakfile exists in the Mods directory
		const pakFilePath = path.join(modsDirPath, modEntry.pakfile);
		return fs.existsSync(pakFilePath) ? modEntry.pakfile : null;
	} catch (error) {
		console.error(`Error checking if pak file is already extracted: ${error.message}`);
		return null;
	}
}

async function extractModArchive(modArchiveFilename) {
	if (!isValidArchiveFile(modArchiveFilename)) {
		throw new Error('Invalid archive filename: must be a .zip, .rar, or .7z file without path traversal.');
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
	const alreadyExtractedPakFile = isPakFileAlreadyExtracted(modArchiveFilename);
	if (alreadyExtractedPakFile) {
		console.log(`[Extract] Mod already extracted, skipping: ${modArchiveFilename}`);
		// Pak file already extracted, skip extraction
		return Promise.resolve({
			success: true,
			archiveFilename: modArchiveFilename,
			alreadyExtracted: true,
			pakfile: alreadyExtractedPakFile,
			message: 'Pak file already extracted, skipping extraction.',
		});
	}

	// Check if mod is marked as isNotPak before extracting
	let extractionTargetPath = modsDirPath;
	let isNotPakMod = false;
	let modEntry = null;

	try {
		if (fs.existsSync(modToInstallListPath)) {
			const raw = fs.readFileSync(modToInstallListPath, 'utf8');
			const data = JSON.parse(raw.replace(/^\uFEFF/, ''));

			if (Array.isArray(data.ModList)) {
				modEntry = data.ModList.find((mod) => mod.filename === modArchiveFilename);
				if (modEntry && modEntry.isNotPak === true) {
					isNotPakMod = true;
					// If isNotPak is true and contentTo is specified, resolve target folder.
					// gameroot* paths go to ./Mods/gameroot; all others go under ./Mods/AppDataBG3Root/Mods.
					if (modEntry.contentTo) {
						const resolvedContentPath = resolveModContentPath(modEntry.contentTo);
						if (!resolvedContentPath) {
							return Promise.resolve({
								success: false,
								archiveFilename: modArchiveFilename,
								message: `Mod "${modEntry.ModName || modArchiveFilename}" has an invalid contentTo path.`,
								isNotPak: true,
							});
						}
						extractionTargetPath = resolvedContentPath;
					} else {
						return Promise.resolve({
							success: false,
							archiveFilename: modArchiveFilename,
							message: `Mod "${modEntry.ModName || modArchiveFilename}" is marked as isNotPak but no contentTo path is specified.`,
							isNotPak: true,
						});
					}
				}
			}
		}
	} catch (error) {
		console.warn(`Warning checking isNotPak status: ${error.message}`);
	}

	// Ensure extraction target directory exists
	await fs.promises.mkdir(extractionTargetPath, { recursive: true });

	// Check if fileToCheck exists for isNotPak mods
	if (isNotPakMod && modEntry && modEntry.fileToCheck) {
		const fileToCheckPath = resolveModContentPath(modEntry.fileToCheck);
		if (!fileToCheckPath) {
			return Promise.resolve({
				success: false,
				archiveFilename: modArchiveFilename,
				message: `Mod "${modEntry.ModName || modArchiveFilename}" has an invalid fileToCheck path.`,
				isNotPak: true,
			});
		}
		if (fs.existsSync(fileToCheckPath)) {
			return Promise.resolve({
				success: true,
				archiveFilename: modArchiveFilename,
				skipped: true,
				reason: `File "${modEntry.fileToCheck}" already exists in Mods folder, skipping extraction.`,
				isNotPak: true,
			});
		}
	}

	// Determine file type and extract accordingly
	const is7zFile = isValid7zFile(modArchiveFilename);
	const isRarFile = isValidRarFile(modArchiveFilename);

	if (is7zFile) {
		return extract7zArchive(realArchivePath, modArchiveFilename, extractionTargetPath, isNotPakMod, modEntry);
	} else if (isRarFile) {
		return extractRarArchive(realArchivePath, modArchiveFilename, extractionTargetPath, isNotPakMod, modEntry);
	} else {
		return extractZipArchive(realArchivePath, modArchiveFilename, extractionTargetPath, isNotPakMod, modEntry);
	}
}

async function extract7zArchive(realArchivePath, modArchiveFilename, extractionTargetPath, isNotPakMod, modEntry) {
	try {
		const Seven = require('node-7z');
		const { path7za } = require('7zip-bin');

		console.log(`[Extract] Starting extraction of 7z: ${modArchiveFilename}`);
		console.log(`[Extract] Target directory: ${extractionTargetPath}`);

		if (!fs.existsSync(extractionTargetPath)) {
			fs.mkdirSync(extractionTargetPath, { recursive: true });
		}

		const extractedFiles = [];
		const pakCandidates = [];

		await new Promise((resolve, reject) => {
			const extractStream = Seven.extractFull(realArchivePath, extractionTargetPath, {
				$bin: path7za,
				$progress: true,
			});

			extractStream.on('data', (entry) => {
				if (!entry || typeof entry.file !== 'string') {
					return;
				}

				const normalizedFileName = path.normalize(entry.file);
				if (normalizedFileName.includes('..') || path.isAbsolute(normalizedFileName)) {
					return;
				}

				extractedFiles.push(normalizedFileName);
				if (normalizedFileName.toLowerCase().endsWith('.pak')) {
					pakCandidates.push(normalizedFileName);
				}
			});

			extractStream.on('end', resolve);
			extractStream.on('error', reject);
		});

		console.log(`[Extract] Extracted files from ${modArchiveFilename}:`);
		extractedFiles.forEach((file) => {
			console.log(`[Extract]   - ${file}`);
		});

		if (!isNotPakMod) {
			const pakFileName = resolveExtractedPakFromCandidates(pakCandidates);

			if (pakFileName) {
				updateModToInstallListWithPakFile(modArchiveFilename, pakFileName);
			}

			return {
				success: true,
				archiveFilename: modArchiveFilename,
				extractedTo: extractionTargetPath,
				entriesExtracted: extractedFiles.length,
				pakfile: pakFileName,
			};
		}

		return {
			success: true,
			archiveFilename: modArchiveFilename,
			extractedTo: extractionTargetPath,
			entriesExtracted: extractedFiles.length,
			isNotPak: true,
			message: 'Extracted to Mods folder as isNotPak mod.',
		};
	} catch (error) {
		if (error.code === 'MODULE_NOT_FOUND') {
			throw new Error('Failed to extract 7z archive: missing dependencies "node-7z" and/or "7zip-bin". Run npm install node-7z 7zip-bin in nodeserver.');
		}

		throw new Error(`Failed to extract 7z archive: ${error.message}`);
	}
}

function extractZipArchive(realArchivePath, modArchiveFilename, extractionTargetPath, isNotPakMod, modEntry) {
	return new Promise((resolve, reject) => {
		try {
			const AdmZip = require('adm-zip');
			const zip = new AdmZip(realArchivePath);
			const zipEntries = zip.getEntries();
			const pakCandidates = getPakCandidatesFromZipEntryNames(zipEntries.map((entry) => entry.entryName));

			console.log(`[Extract] Starting extraction of: ${modArchiveFilename}`);
			console.log(`[Extract] Target directory: ${extractionTargetPath}`);
			console.log(`[Extract] Total entries to extract: ${zipEntries.length}`);

			const extractedFiles = [];

			zipEntries.forEach((entry) => {
				const normalizedEntryPath = path.normalize(entry.entryName);
				const targetPath = path.join(extractionTargetPath, normalizedEntryPath);

				// Prevent directory traversal in zip
				if (!isPathInsideDirectory(extractionTargetPath, targetPath)) {
					return;
				}

				if (entry.isDirectory) {
					fs.mkdirSync(targetPath, { recursive: true });
				} else {
					fs.mkdirSync(path.dirname(targetPath), { recursive: true });
					fs.writeFileSync(targetPath, entry.getData());
					extractedFiles.push(normalizedEntryPath);
				}
			});

			console.log(`[Extract] Extracted files from ${modArchiveFilename}:`);
			extractedFiles.forEach((file) => {
				console.log(`[Extract]   - ${file}`);
			});

			// Only look for pak files if not a isNotPak mod
			if (!isNotPakMod) {
				const pakFileName = resolveExtractedPakFromCandidates(pakCandidates);

				if (pakFileName) {
					updateModToInstallListWithPakFile(modArchiveFilename, pakFileName);
				}

				resolve({
					success: true,
					archiveFilename: modArchiveFilename,
					extractedTo: extractionTargetPath,
					entriesExtracted: zipEntries.length,
					pakfile: pakFileName,
				});
			} else {
				resolve({
					success: true,
					archiveFilename: modArchiveFilename,
					extractedTo: extractionTargetPath,
					entriesExtracted: zipEntries.length,
					isNotPak: true,
					message: 'Extracted to Downloads folder as isNotPak mod.',
				});
			}
		} catch (error) {
			if (error.code === 'MODULE_NOT_FOUND') {
				reject(new Error('Failed to extract archive: missing dependency "adm-zip". Run npm install adm-zip in nodeserver.'));
			} else {
				reject(new Error(`Failed to extract archive: ${error.message}`));
			}
		}
	});
}

async function extractRarArchive(realArchivePath, modArchiveFilename, extractionTargetPath, isNotPakMod, modEntry) {
	try {
		const { createExtractorFromFile } = require('node-unrar-js');

		console.log(`[Extract] Starting extraction of RAR: ${modArchiveFilename}`);
		console.log(`[Extract] Target directory: ${extractionTargetPath}`);

		// Ensure target directory exists
		if (!fs.existsSync(extractionTargetPath)) {
			fs.mkdirSync(extractionTargetPath, { recursive: true });
		}

		// Create extractor from file
		const extractor = await createExtractorFromFile({
			filepath: realArchivePath,
			targetPath: extractionTargetPath,
		});

		// Extract all files
		const extracted = extractor.extract();
		const extractedFiles = [];
		const pakCandidates = [];

		// Iterate through extracted files
		for (const arcFile of extracted.files) {
			const fileName = arcFile.fileHeader.name;

			// Normalize file path
			const normalizedFileName = path.normalize(fileName);

			// Prevent directory traversal
			const fullPath = path.join(extractionTargetPath, normalizedFileName);
			if (isPathInsideDirectory(extractionTargetPath, fullPath)) {
				// Skip directories
				if (!arcFile.fileHeader.flags.directory) {
					const relativePath = path.relative(extractionTargetPath, fullPath);
					extractedFiles.push(relativePath);

					// Check if it's a pak file
					if (relativePath.toLowerCase().endsWith('.pak')) {
						pakCandidates.push(relativePath);
					}

					console.log(`[Extract]   - ${relativePath}`);
				}
			}
		}

		console.log(`[Extract] Extracted files from ${modArchiveFilename}:`);
		extractedFiles.forEach((file) => {
			console.log(`[Extract]   - ${file}`);
		});

		// Only look for pak files if not a isNotPak mod
		if (!isNotPakMod) {
			const pakFileName = resolveExtractedPakFromCandidates(pakCandidates);

			if (pakFileName) {
				updateModToInstallListWithPakFile(modArchiveFilename, pakFileName);
			}

			return {
				success: true,
				archiveFilename: modArchiveFilename,
				extractedTo: extractionTargetPath,
				entriesExtracted: extractedFiles.length,
				pakfile: pakFileName,
			};
		} else {
			return {
				success: true,
				archiveFilename: modArchiveFilename,
				extractedTo: extractionTargetPath,
				entriesExtracted: extractedFiles.length,
				isNotPak: true,
				message: 'Extracted to Mods folder as isNotPak mod.',
			};
		}
	} catch (error) {
		if (error.code === 'MODULE_NOT_FOUND') {
			throw new Error('Failed to extract RAR archive: missing dependency "node-unrar-js". Run npm install node-unrar-js in nodeserver.');
		} else {
			throw new Error(`Failed to extract RAR archive: ${error.message}`);
		}
	}
}

module.exports = {
	isValidZipFile,
	isValidRarFile,
	isValid7zFile,
	isValidArchiveFile,
	extractModArchive,
};
