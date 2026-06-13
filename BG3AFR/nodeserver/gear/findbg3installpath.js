const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const settingsFilePath = path.join(__dirname, '..', '..', 'settings.json');

const GAME_FOLDER_NAMES = [
	"Baldur's Gate 3",
	"Baldurs Gate 3",
	'Baldur\'s Gate 3',
];

const GAME_EXECUTABLE_NAMES = [
	'bg3.exe',
	'bg3_dx11.exe',
	'bg3_dx11.exe',
];

function normalizePath(value) {
	return value.replace(/^"|"$/g, '').trim();
}

function toWindowsStylePath(value) {
	if (!value || typeof value !== 'string') {
		return value;
	}

	return path.win32.normalize(normalizePath(value).replace(/\//g, '\\'));
}

function getBg3ModsFolderPath() {
	const localAppData = process.env.LOCALAPPDATA;

	if (!localAppData) {
		throw new Error('LOCALAPPDATA is not set on this machine.');
	}

	return toWindowsStylePath(path.join(localAppData, 'Larian Studios', "Baldur's Gate 3"));
}

function ensureBg3ModsFolderExists() {
	const modsFolderPath = getBg3ModsFolderPath();

	if (!fs.existsSync(modsFolderPath)) {
		fs.mkdirSync(modsFolderPath, { recursive: true });
	}

	return modsFolderPath;
}

function readSettingsFromDisk() {
	if (!fs.existsSync(settingsFilePath)) {
		return {};
	}

	const rawSettings = fs.readFileSync(settingsFilePath, 'utf8');
	if (!rawSettings.trim()) {
		return {};
	}

	return JSON.parse(rawSettings);
}

function writeSettingsToDisk(settings) {
	fs.writeFileSync(settingsFilePath, `${JSON.stringify(settings, null, 4)}\n`, 'utf8');
}

function updateSettingsValue(key, value) {
	const settings = readSettingsFromDisk();
	settings[key] = value;
	writeSettingsToDisk(settings);
}

function readRegistryValue(registryKey, valueName) {
	try {
		const output = execFileSync('reg.exe', ['query', registryKey, '/v', valueName], {
			encoding: 'utf8',
			windowsHide: true,
		});

		const lines = output.split(/\r?\n/);
		for (const line of lines) {
			const match = line.match(new RegExp(`^\\s*${valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+REG_\\w+\\s+(.+)$`, 'i'));
			if (match) {
				return normalizePath(match[1]);
			}
		}
	} catch {
		return null;
	}

	return null;
}

function pathExists(candidate) {
	return candidate && fs.existsSync(candidate);
}

function hasGameFiles(candidate) {
	if (!pathExists(candidate)) {
		return false;
	}

	return GAME_EXECUTABLE_NAMES.some((name) => {
		return fs.existsSync(path.join(candidate, 'bin', name)) || fs.existsSync(path.join(candidate, name));
	});
}

function collectSteamLibraryPaths(steamPath) {
	const libraryFileCandidates = [
		path.join(steamPath, 'steamapps', 'libraryfolders.vdf'),
		path.join(steamPath, 'config', 'libraryfolders.vdf'),
	];

	for (const libraryFile of libraryFileCandidates) {
		if (!fs.existsSync(libraryFile)) {
			continue;
		}

		const content = fs.readFileSync(libraryFile, 'utf8');
		const matches = [...content.matchAll(/"path"\s*"([^"]+)"/gi)];
		if (matches.length > 0) {
			return matches.map((match) => normalizePath(match[1]));
		}
	}

	return [];
}

function candidateInstallRoots() {
	const candidates = new Set();
	const steamPaths = [
		readRegistryValue('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
		readRegistryValue('HKCU\\Software\\Valve\\Steam', 'InstallPath'),
		readRegistryValue('HKLM\\Software\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
		readRegistryValue('HKLM\\Software\\Valve\\Steam', 'InstallPath'),
	].filter(Boolean);

	for (const steamPath of steamPaths) {
		candidates.add(path.join(steamPath, 'steamapps', 'common'));
		for (const libraryPath of collectSteamLibraryPaths(steamPath)) {
			candidates.add(path.join(libraryPath, 'steamapps', 'common'));
		}
	}

	const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean);
	for (const basePath of programFiles) {
		candidates.add(path.join(basePath, 'Steam', 'steamapps', 'common'));
		candidates.add(path.join(basePath, 'GOG Galaxy', 'Games'));
		candidates.add(path.join(basePath, 'GOG Games'));
	}

	const localAppData = process.env.LOCALAPPDATA;
	if (localAppData) {
		candidates.add(path.join(localAppData, 'Larian Studios'));
	}

	return [...candidates];
}

function findBg3InstallPath() {
	const registryKeys = [
		'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1086940',
		'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1086940',
		'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 1086940',
	];

	for (const registryKey of registryKeys) {
		const installLocation = readRegistryValue(registryKey, 'InstallLocation');
		if (installLocation && hasGameFiles(installLocation)) {
			return installLocation;
		}
	}

	for (const installRoot of candidateInstallRoots()) {
		for (const folderName of GAME_FOLDER_NAMES) {
			const candidate = path.join(installRoot, folderName);
			if (hasGameFiles(candidate)) {
				return candidate;
			}
		}
	}

	return null;
}

function updateSettingsFile(installPath) {
	const windowsPath = toWindowsStylePath(installPath);
	updateSettingsValue('bg3InstallPath', windowsPath);
}

function isValidBg3InstallPath(candidatePath) {
	if (!candidatePath || typeof candidatePath !== 'string') {
		return false;
	}

	return hasGameFiles(toWindowsStylePath(candidatePath));
}

function findAndSaveBg3InstallPath() {
	const installPath = toWindowsStylePath(findBg3InstallPath());

	if (installPath) {
		updateSettingsFile(installPath);
	}

	return installPath;
}

if (require.main === module) {
	const installPath = findAndSaveBg3InstallPath();

	if (installPath) {
		updateSettingsFile(installPath);
		console.log(installPath);
	} else {
		console.error("Could not find Baldur's Gate 3 on this machine.");
		process.exitCode = 1;
	}
}

module.exports = {
	findBg3InstallPath,
	findAndSaveBg3InstallPath,
	updateSettingsFile,
	isValidBg3InstallPath,
	toWindowsStylePath,
	getBg3ModsFolderPath,
	ensureBg3ModsFolderExists,
	updateSettingsValue,
};
